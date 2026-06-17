import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { decryptToken } from "@/lib/secure-adapter"
import { invalidateSubscriptionCache } from "@/lib/subscription"
import { google } from "googleapis"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const sig = request.headers.get("stripe-signature") || ""

    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const eventType = event.type

    // Idempotency: atomic transaction prevents race conditions from Stripe at-least-once delivery
    const alreadyProcessed = await prisma.$transaction(async (tx) => {
      const existing = await tx.processedStripeEvent.findUnique({ where: { id: event.id } })
      if (existing) return true
      await tx.processedStripeEvent.create({ data: { id: event.id } })
      return false
    })
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, deduplicated: true })
    }

    switch (eventType) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        const userId = checkoutSession.metadata?.userId
        const subscriptionId = checkoutSession.subscription
        const customerId = checkoutSession.customer

        if (!userId || !subscriptionId) break

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId as string)
        const status = subscription.status === "trialing" ? "trialing" : "active"

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeSubscriptionId: subscriptionId as string,
            stripeCustomerId: customerId as string,
            subscriptionStatus: status,
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
            accessDisabled: false,
            emailMonthStartAt: new Date(),
            emailsProcessedThisMonth: 0,
          },
        })
        await invalidateSubscriptionCache(userId)
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription
        if (!subscriptionId) break

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId as string)
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId as string },
        })
        if (!user) break

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: "active",
            accessDisabled: false,
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
            emailsProcessedThisMonth: 0,
            emailMonthStartAt: new Date(),
          },
        })
        await invalidateSubscriptionCache(user.id)
        break
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice
        const failedSubId = failedInvoice.subscription
        if (!failedSubId) break

        const failedUser = await prisma.user.findFirst({
          where: { stripeSubscriptionId: failedSubId as string },
        })
        if (!failedUser) break

        await prisma.user.update({
          where: { id: failedUser.id },
          data: { subscriptionStatus: "past_due", accessDisabled: true },
        })
        await invalidateSubscriptionCache(failedUser.id)
        await revokePushWatch(failedUser.id)
        break
      }

      case "customer.subscription.updated": {
        const updatedSub = event.data.object as Stripe.Subscription
        const updatedUser = await prisma.user.findFirst({
          where: { stripeSubscriptionId: updatedSub.id },
        })
        if (!updatedUser) break

        const status = updatedSub.status === "trialing" ? "trialing" : updatedSub.status === "active" ? "active" : updatedSub.status

        const accessDisabled = status !== "active" && status !== "trialing"
        await prisma.user.update({
          where: { id: updatedUser.id },
          data: {
            subscriptionStatus: status,
            accessDisabled,
            subscriptionEndsAt: new Date(updatedSub.current_period_end * 1000),
          },
        })
        await invalidateSubscriptionCache(updatedUser.id)
        if (accessDisabled) {
          await revokePushWatch(updatedUser.id)
        }
        break
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription
        const deletedUser = await prisma.user.findFirst({
          where: { stripeSubscriptionId: deletedSub.id },
        })
        if (!deletedUser) break

        await prisma.user.update({
          where: { id: deletedUser.id },
          data: {
            subscriptionStatus: "canceled",
            accessDisabled: true,
            subscriptionEndsAt: new Date(deletedSub.current_period_end * 1000),
          },
        })
        await invalidateSubscriptionCache(deletedUser.id)
        await revokePushWatch(deletedUser.id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[stripe/webhook]", msg)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}

async function revokePushWatch(userId: string) {
  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
    })
    if (!account?.access_token || !account?.refresh_token) return

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    )
    oauth2Client.setCredentials({
      access_token: decryptToken(account.access_token),
      refresh_token: decryptToken(account.refresh_token),
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })
    await gmail.users.stop({ userId: "me" })
  } catch {
    // Best-effort: push watch may not exist
  }

  await prisma.user.update({
    where: { id: userId },
    data: { gmailHistoryId: null },
  })
}
