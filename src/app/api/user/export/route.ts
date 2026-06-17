import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

/**
 * Self-service data export (GDPR / PIPEDA data portability).
 *
 * Returns the user's stored personal data as a downloadable JSON file.
 * Deliberately excludes secrets: the encrypted Groq key and the OAuth tokens
 * are not the user's "data to take elsewhere" and exporting them would be a
 * security risk, so they are omitted (we report only whether a key is set).
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "export-account"), {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000, // 5/hour — export is a heavier read
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        geminiKeyEnc: true,
        autoSortEnabled: true,
        archiveSorted: true,
        sortScope: true,
        sortingRules: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        emailsProcessedThisMonth: true,
        labels: {
          select: {
            gmailLabelId: true,
            name: true,
            type: true,
            parentId: true,
            aiVisible: true,
            description: true,
          },
        },
        sortingLogs: {
          select: {
            labelApplied: true,
            confidence: true,
            modelUsed: true,
            processedAt: true,
          },
          orderBy: { processedAt: "desc" },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        hasGroqKey: !!user.geminiKeyEnc,
      },
      settings: {
        autoSortEnabled: user.autoSortEnabled,
        archiveSorted: user.archiveSorted,
        sortScope: user.sortScope,
        sortingRules: user.sortingRules,
      },
      subscription: {
        status: user.subscriptionStatus,
        endsAt: user.subscriptionEndsAt,
        emailsProcessedThisMonth: user.emailsProcessedThisMonth,
      },
      labels: user.labels,
      sortingHistory: user.sortingLogs,
    }

    const filename = `viltreon-data-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    return apiError(err, "user.export")
  }
}
