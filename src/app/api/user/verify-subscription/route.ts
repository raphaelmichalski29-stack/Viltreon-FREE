import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { getStripe } from "@/lib/stripe"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { invalidateSubscriptionCache } from "@/lib/subscription"

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "verify-subscription"), {
      maxRequests: 20,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ active: false })
    }

    const subscriptions = await getStripe().subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 10,
    })

    const activeSub = subscriptions.data.find(
      (sub) => sub.status === "active" || sub.status === "trialing" || sub.status === "past_due"
    )

    if (activeSub) {
      const isActive = activeSub.status === "active" || activeSub.status === "trialing"
      const status = activeSub.status === "trialing" ? "trialing" : "active"

      await prisma.user.update({
        where: { id: token.sub },
        data: {
          stripeSubscriptionId: activeSub.id,
          subscriptionStatus: status,
          subscriptionEndsAt: new Date(activeSub.current_period_end * 1000),
          accessDisabled: !isActive,
        },
      })
      // Drop the cached subscription verdict so the next gated request reflects
      // the new status immediately rather than waiting for the 30s TTL.
      await invalidateSubscriptionCache(token.sub)

      return NextResponse.json({ active: isActive, status })
    }

    return NextResponse.json({ active: false })
  } catch (err) {
    return apiError(err, "user/verify-subscription")
  }
}
