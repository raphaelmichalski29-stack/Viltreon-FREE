import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { getStripe, getPriceId } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { z } from "zod"

const schema = z.object({
  interval: z.enum(["month", "year"]),
})

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "checkout"), {
      maxRequests: 10,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 })
    }

    const { interval } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let stripeCustomerId = user.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      })
      stripeCustomerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      })
    }

    // Existing subscribers (trialing or active) already have a live
    // subscription. Creating another checkout would make a duplicate
    // subscription and charge them immediately. Send them to the billing
    // portal to change or manage their current plan instead.
    if (
      user.stripeSubscriptionId &&
      (user.subscriptionStatus === "trialing" || user.subscriptionStatus === "active")
    ) {
      const portal = await getStripe().billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
      })
      return NextResponse.json({ url: portal.url })
    }

    const priceId = getPriceId(interval)
    const mode = "subscription"
    // Card-required free trial: collect the card now, charge nothing for 14
    // days, then auto-charge unless they cancel. Only first-time subscribers
    // get the trial — `stripeSubscriptionId` is set once a user has ever had a
    // subscription (and is not cleared on cancellation), so a returning user
    // who already trialed is charged immediately instead of looping trials.
    const isFirstTimeSubscriber = !user.stripeSubscriptionId
    // `?subscribed=1` tells the dashboard mount handler to call
    // verify-subscription. Without this the user's JWT still has the
    // pre-payment subscriptionStatus until their session refreshes —
    // causing 402s on every API call right after they paid.
    const successUrl = `${process.env.NEXTAUTH_URL}/dashboard?subscribed=1`

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { userId: user.id },
        ...(isFirstTimeSubscriber ? { trial_period_days: 14 } : {}),
      },
      metadata: { userId: user.id },
      success_url: successUrl,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    return apiError(err, "stripe/checkout")
  }
}
