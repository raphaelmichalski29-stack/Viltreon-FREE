import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getGmailClient } from "@/lib/gmail"
import { setupGmailPush, stopGmailPush } from "@/lib/push-notifications"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { prisma } from "@/lib/db"
import { z } from "zod"

const schema = z.object({
  action: z.enum(["start", "stop"]),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "watch"), {
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const gmail = await getGmailClient(token.sub)

    if (parsed.data.action === "start") {
      // Keep autoSortEnabled in sync — the webhook short-circuits when false.
      await prisma.user.update({
        where: { id: token.sub },
        data: { autoSortEnabled: true },
      })

      // Real-time push needs a Pub/Sub topic AND a public HTTPS endpoint — neither
      // exists on a localhost self-host. Skip it (no topic) or tolerate failure
      // (topic missing/unreachable) instead of 500ing. Manual "Sort Now" works
      // either way; see docs/REALTIME.md to enable live sorting.
      if (!process.env.PUBSUB_TOPIC_NAME) {
        return NextResponse.json({
          success: true,
          pushConfigured: false,
          message: "Real-time push isn't configured — using manual sync. See docs/REALTIME.md to enable live sorting.",
        })
      }
      try {
        const historyId = await setupGmailPush(token.sub, gmail)
        return NextResponse.json({ success: true, pushConfigured: true, historyId })
      } catch (err) {
        console.warn(
          "[gmail/watch] live push unavailable (continuing with manual sync):",
          err instanceof Error ? err.message : err,
        )
        return NextResponse.json({
          success: true,
          pushConfigured: false,
          message: "Couldn't enable real-time push (Pub/Sub topic not found or unreachable). Manual sync still works.",
        })
      }
    }

    await stopGmailPush(token.sub, gmail)
    await prisma.user.update({
      where: { id: token.sub },
      data: { autoSortEnabled: false },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    // Previously forwarded the raw Google API error to the client, which
    // leaked project IDs, internal endpoints, and IAM principals. Use the
    // shared sanitized error path like the rest of the routes.
    return apiError(err, "gmail/watch")
  }
}
