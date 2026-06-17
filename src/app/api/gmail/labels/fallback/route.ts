import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getGmailClient, createGmailLabel } from "@/lib/gmail"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "labels-fallback"), {
      maxRequests: 5,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      include: { labels: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.fallbackGmailLabelId) {
      const existing = user.labels.find((l) => l.gmailLabelId === user.fallbackGmailLabelId)
      if (existing) {
        return NextResponse.json({ label: { id: existing.gmailLabelId, name: existing.name } })
      }
    }

    const existingOther = user.labels.find(
      (l) => l.name.toLowerCase() === "other" || l.name.toLowerCase() === "miscellaneous",
    )
    if (existingOther) {
      await prisma.user.update({
        where: { id: token.sub },
        data: { fallbackGmailLabelId: existingOther.gmailLabelId },
      })
      return NextResponse.json({ label: { id: existingOther.gmailLabelId, name: existingOther.name } })
    }

    const gmail = await getGmailClient(token.sub)
    const created = await createGmailLabel(gmail, "Other")

    const dbLabel = await prisma.userLabel.create({
      data: {
        userId: token.sub,
        gmailLabelId: created.id,
        name: created.name,
        type: "user",
        description: "Emails the AI can't confidently classify (< 60% confidence) end up here.",
      },
    })

    await prisma.user.update({
      where: { id: token.sub },
      data: { fallbackGmailLabelId: created.id },
    })

    return NextResponse.json({ label: { id: created.id, name: created.name, dbId: dbLabel.id } })
  } catch (err) {
    return apiError(err, "gmail/labels/fallback/POST")
  }
}
