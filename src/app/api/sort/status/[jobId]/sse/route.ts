import { NextRequest } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getQueue } from "@/lib/queue"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Per-user open SSE connection count. Each connection holds a polling loop,
// a keepalive interval, and an open socket — without a cap an authenticated
// user could open hundreds of streams and degrade the process. Single-process
// tracking is fine for `next start`; for multi-instance prod move this to a
// Redis INCR/DECR pair keyed by userId.
const MAX_SSE_PER_USER = 5
const openSseByUser = new Map<string, number>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  const token = await getToken({ req: request })
  if (!token?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const userId = token.sub
  const currentOpen = openSseByUser.get(userId) ?? 0
  if (currentOpen >= MAX_SSE_PER_USER) {
    return new Response(
      JSON.stringify({ error: "Too many active sort-status streams" }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    )
  }
  openSseByUser.set(userId, currentOpen + 1)

  const releaseSlot = () => {
    const n = (openSseByUser.get(userId) ?? 1) - 1
    if (n <= 0) openSseByUser.delete(userId)
    else openSseByUser.set(userId, n)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          const msg =
            event === "message"
              ? `data: ${JSON.stringify(data)}\n\n`
              : `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(msg))
        } catch {
          // client disconnected
        }
      }

      let queue
      try {
        queue = await getQueue()
      } catch (err) {
        send("error", { message: "Failed to connect to queue" })
        controller.close()
        return
      }

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"))
        } catch {
          clearInterval(keepalive)
        }
      }, 15_000)

      const timeout = setTimeout(() => {
        clearInterval(keepalive)
        send("timeout", { message: "Job did not complete within 5 minutes" })
        try { controller.close() } catch { /* already closed */ }
      }, 300_000)

      try {
        while (true) {
          let status
          try {
            status = await queue.getStatus(jobId)
          } catch {
            send("error", { message: "Failed to get job status" })
            break
          }

          if (!status || status.userId !== token.sub) {
            send("error", { message: "Job not found" })
            break
          }

          if (status.status === "completed") {
            send("message", status.result)
            break
          }

          if (status.status === "failed") {
            send("error", { message: status.error || "Job failed" })
            break
          }

          await new Promise((r) => setTimeout(r, 1000))
        }
      } finally {
        clearTimeout(timeout)
        clearInterval(keepalive)
        try { controller.close() } catch { /* already closed */ }
        releaseSlot()
      }
    },
    cancel() {
      // Client disconnected before the loop's finally{} ran (browser tab close,
      // network drop). Without this the slot would leak until the next server
      // restart.
      releaseSlot()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
