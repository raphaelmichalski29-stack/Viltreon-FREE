"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

/**
 * Auth gate for the dashboard layout.
 *
 * - Unauthenticated users → bounced to /auth/signin.
 * - Authenticated users whose JWT says `accessDisabled: true` get an
 *   opportunistic verify-subscription poll (in case the Stripe webhook lagged
 *   and the JWT is stale). If verification flips them to active, the session
 *   refreshes silently.
 * - In all cases the children render. The dashboard surfaces a trial / expired
 *   banner per its own state, and paid actions (Sort Inbox, etc.) gate
 *   server-side on `checkSubscription`. Don't pre-empt the page with a redirect
 *   — the user should see their stats and the "Subscribe" prompt in context,
 *   not be bounced to /pricing.
 *
 * Important: we only show the loader on the FIRST authentication check.
 * Subsequent transient "loading" states (e.g. when `update()` refreshes the
 * JWT) would otherwise tear down and remount the entire children subtree,
 * resetting any refs/state inside the dashboard. That would re-trigger
 * one-shot effects like the post-checkout verify-subscription poll, creating
 * an infinite remount loop.
 */
export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const verifiedRef = useRef(false)
  const [bootstrapped, setBootstrapped] = useState(false)

  // Once we've reached any non-loading state on first mount, remember it. From
  // then on we render children unconditionally, even when status briefly flips
  // back to "loading" during an update().
  useEffect(() => {
    if (status !== "loading") setBootstrapped(true)
  }, [status])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }
    if (status !== "authenticated") return
    if (verifiedRef.current) return

    // Best-effort: if the JWT shows disabled but Stripe might already say
    // active, pull a fresh read. Don't block the UI on it.
    if (session?.user?.accessDisabled) {
      verifiedRef.current = true
      fetch("/api/user/verify-subscription", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.active) update()
        })
        .catch(() => { /* non-blocking */ })
    }
  }, [status, session, router, update])

  if (!bootstrapped) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
