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
      const historyId = await setupGmailPush(token.sub, gmail)
      // Keep autoSortEnabled in sync — the webhook short-circuits when this is false,
      // so a registered watch with autoSortEnabled=false silently does nothing.
      await prisma.user.update({
        where: { id: token.sub },
        data: { autoSortEnabled: true },
      })
      return NextResponse.json({ success: true, historyId })
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
