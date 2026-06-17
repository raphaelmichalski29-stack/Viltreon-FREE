import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "portal"), {
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
    })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "No stripe customer" }, { status: 400 })
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    return apiError(err, "stripe/portal")
  }
}
