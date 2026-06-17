import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "stats-history"), {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const logs = await prisma.sortingLog.findMany({
      where: {
        userId: token.sub,
        processedAt: { gte: thirtyDaysAgo },
      },
      select: { processedAt: true },
    })

    const dayMap = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split("T")[0]
      dayMap.set(key, 0)
    }

    for (const log of logs) {
      const key = log.processedAt.toISOString().split("T")[0]
      dayMap.set(key, (dayMap.get(key) || 0) + 1)
    }

    const days = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }))

    return NextResponse.json({ days })
  } catch (err) {
    return apiError(err, "user/stats/history/GET")
  }
}
