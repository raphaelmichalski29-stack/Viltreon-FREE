import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getQueue } from "@/lib/queue"
import { prisma } from "@/lib/db"
import { getGmailClient, countInboxMessages, getFallbackLabel } from "@/lib/gmail"
import { checkSubscription } from "@/lib/subscription"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // A full inbox sort fans out into up to 200 Gmail fetches + Groq calls.
    // 6/min is generous for a human clicking the button and stops a scripted
    // loop from burning the user's Groq quota and our Gmail rate budget.
    const rl = await checkRateLimit(rateLimitKey(token.sub, "sort-inbox"), {
      maxRequests: 6,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    const sub = await checkSubscription(token.sub)
    if (!sub.allowed) {
      return NextResponse.json({ error: "Active subscription required" }, { status: 402 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { id: true, geminiKeyEnc: true, sortScope: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    if (!user.geminiKeyEnc) {
      return NextResponse.json({ error: "API key not configured" }, { status: 400 })
    }

    const fallback = await getFallbackLabel(user.id)
    if (!fallback) {
      return NextResponse.json({ error: "No fallback label configured. Go to Labels to set one." }, { status: 400 })
    }

    const gmail = await getGmailClient(user.id)
    const scope = user.sortScope || "unread"
    const count = await countInboxMessages(gmail, scope as "unread" | "read" | "both", user.id)

    if (count === 0) {
      return NextResponse.json({ processed: 0, labeled: 0, skipped: 0, immediate: true })
    }

    const queue = await getQueue()
    const jobId = await queue.addInboxSort(user.id)

    return NextResponse.json({ jobId })
  } catch (err) {
    return apiError(err, "sort/inbox")
  }
}
