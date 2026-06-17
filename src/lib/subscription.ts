import { invalidate } from "./cache"

export interface SubscriptionStatus {
  allowed: boolean
  status: string | null
}

// Open-source self-hosted build: billing has been removed, so every user has
// full access. These remain as no-op shims so existing callers keep compiling.
export async function checkSubscription(_userId: string): Promise<SubscriptionStatus> {
  return { allowed: true, status: "active" }
}

export function invalidateSubscriptionCache(userId: string): Promise<void> {
  return invalidate("subscription", userId)
}

export async function maybeExpireTrial(_userId: string): Promise<void> {
  // no-op: there are no trials in the open-source build
}
