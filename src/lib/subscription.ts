import { prisma } from "./db"
import { getOrSet, cacheKey, invalidate } from "./cache"

export interface SubscriptionStatus {
  allowed: boolean
  status: string | null
}

const SUBSCRIPTION_TTL = 30

/**
 * Source of truth for "is this user allowed to use paid features."
 *
 * Side-effect: when a trialing user's `subscriptionEndsAt` is in the past,
 * we flip their row to `subscriptionStatus: "expired"` + `accessDisabled: true`
 * before returning. Otherwise the system gets stuck in a halfway state
 * (status="trialing", end-date in past, accessDisabled=false) — the daily
 * watch-renewal job keeps pinging Gmail for a user who can't actually sort,
 * and the middleware never bounces them off paid routes.
 */
export async function checkSubscription(userId: string): Promise<SubscriptionStatus> {
  return getOrSet<SubscriptionStatus>(
    cacheKey("subscription", userId),
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionStatus: true, subscriptionEndsAt: true, accessDisabled: true },
      })

      if (!user) return { allowed: false, status: null }
      if (user.accessDisabled) return { allowed: false, status: user.subscriptionStatus }

      const status = user.subscriptionStatus
      if (status === "active") return { allowed: true, status }

      if (status === "trialing") {
        if (user.subscriptionEndsAt && user.subscriptionEndsAt > new Date()) {
          return { allowed: true, status }
        }
        // Trial expired — write back the terminal state. updateMany lets us
        // guard on both id AND status, so we don't clobber a user who has
        // somehow moved to "active" between SELECT and UPDATE (e.g. Stripe
        // webhook fired concurrently). Idempotent across concurrent callers.
        await prisma.user.updateMany({
          where: { id: userId, subscriptionStatus: "trialing" },
          data: { subscriptionStatus: "expired", accessDisabled: true },
        }).catch(() => { /* row moved on; safe to ignore */ })
        return { allowed: false, status: "expired" }
      }

      return { allowed: false, status }
    },
    SUBSCRIPTION_TTL,
  )
}

export function invalidateSubscriptionCache(userId: string): Promise<void> {
  return invalidate("subscription", userId)
}

/**
 * Convenience for callers that don't gate on the verdict but want the
 * "trial expired → expired+accessDisabled" writeback to fire. Used by the
 * settings GET so the dashboard reflects expiry on load even before the
 * user touches a gated endpoint.
 */
export async function maybeExpireTrial(userId: string): Promise<void> {
  await checkSubscription(userId)
}
