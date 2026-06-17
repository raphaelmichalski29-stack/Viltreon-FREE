import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getQueue } from "@/lib/queue"
import { prisma } from "@/lib/db"
import { checkSubscription } from "@/lib/subscription"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { z } from "zod"

const schema = z.object({
  messageId: z.string().min(1, "messageId is required"),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sub = await checkSubscription(token.sub)
    if (!sub.allowed) {
      return NextResponse.json({ error: "Active subscription required" }, { status: 402 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "sort-single"), {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { id: true, geminiKeyEnc: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    if (!user.geminiKeyEnc) {
      return NextResponse.json({ error: "API key not configured" }, { status: 400 })
    }

    const queue = await getQueue()
    const jobId = await queue.addSingleSort(user.id, parsed.data.messageId)

    return NextResponse.json({ jobId })
  } catch (err) {
    return apiError(err, "sort/single")
  }
}
