"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { AlertTriangle, Check, Loader2, Mail, Key, Tags, CreditCard } from "lucide-react"

const steps = [
  { icon: Mail, title: "Connect Gmail", description: "Connect your Google account" },
  { icon: Key, title: "API Key", description: "Add an API key" },
  { icon: Tags, title: "Sync Labels", description: "Sync your Gmail labels" },
  { icon: CreditCard, title: "Subscribe", description: "Choose a plan" },
]

function SetupInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const expiredFlow = searchParams.get("expired") === "1"
  const [step, setStep] = useState(0)
  const [resuming, setResuming] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0)
  const [geminiKey, setGeminiKey] = useState("")
  const [savingKey, setSavingKey] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [labelsCount, setLabelsCount] = useState(0)
  const [loadingInterval, setLoadingInterval] = useState<"month" | "year" | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }
    if (status !== "authenticated") return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/user/settings")
        if (!res.ok) throw new Error(`settings ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        const s = data.settings || {}

        // Active paid subscribers have no business on /setup — they're
        // already through the entire flow. Skip the page entirely. Exception:
        // ?expired=1 won't apply because checkSubscription only flips trial
        // users to "expired"; an "active" status genuinely means subscribed.
        if (s.subscriptionStatus === "active") {
          router.replace("/dashboard")
          return
        }

        setSubscriptionStatus(s.subscriptionStatus ?? null)
        setTrialDaysRemaining(s.trialDaysRemaining ?? 0)

        // ?expired=1 from dashboard 402 redirect: trial is over, jump
        // straight to the subscribe step. Their other setup is already
        // done; we're not making them redo it.
        if (expiredFlow) {
          setStep(3)
          return
        }

        // Resume at the first incomplete step. Subscription is intentionally
        // not part of this calc — trialing users should still see the
        // subscribe step but can opt to skip into the dashboard.
        let resumeStep = 0
        if (s.hasGeminiKey) resumeStep = 2
        if (s.hasGeminiKey && s.pushEnabled) resumeStep = 3
        setStep(resumeStep)
      } catch (err) {
        console.error("[setup] Failed to load settings:", err)
        // Stay on step 0 — user can still proceed manually
      } finally {
        if (!cancelled) setResuming(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, router, expiredFlow])

  if (status === "loading" || resuming) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isPaid = subscriptionStatus === "active"
  const isTrialing = subscriptionStatus === "trialing"
  const isExpired = subscriptionStatus === "expired" || expiredFlow

  async function handleSaveKey() {
    if (!geminiKey.trim()) return
    setSavingKey(true)
    try {
      const res = await fetch("/api/user/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: geminiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save key")
      toast({ title: "API key saved", variant: "success" })
      setStep(2)
    } catch (err) {
      toast({ title: "Failed to save key", description: String(err), variant: "destructive" })
    } finally {
      setSavingKey(false)
    }
  }

  async function handleSyncLabels() {
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/labels")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to sync labels")
      setLabelsCount(data.labels?.length || 0)
      toast({ title: `Synced ${data.labels?.length || 0} labels`, variant: "success" })
      setTimeout(() => setStep(3), 1000)
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  async function handleSubscribe(interval: "month" | "year") {
    setLoadingInterval(interval)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Checkout failed")
      window.location.href = data.url
    } catch (err) {
      toast({ title: "Checkout failed", description: String(err), variant: "destructive" })
      setLoadingInterval(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set Up Viltreon</CardTitle>
          <CardDescription>Complete these steps to start sorting your emails</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Trial-expired banner. Surfaces when the user landed via
                /setup?expired=1 (402 redirect) or when checkSubscription has
                already flipped their row to "expired". */}
            {isExpired && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Your free trial has ended</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Subscribe below to keep using Viltreon. Your account, labels,
                    and settings are preserved.
                  </p>
                </div>
              </div>
            )}

            {/* Step indicators */}
            <div className="flex items-center justify-between">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      i < step
                        ? "bg-[#8A9A86] text-white"
                        : i === step
                        ? "bg-[#2C2A28] text-[#F9F8F6]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && <div className="h-px w-12 bg-border" />}
                </div>
              ))}
            </div>

            {/* Step 0: Gmail Connected */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#8A9A86]/15 border border-[#8A9A86]">
                  <p className="text-sm font-medium text-[#2C2A28]">
                    Connected as {session?.user?.email}
                  </p>
                </div>
                {isTrialing && trialDaysRemaining > 0 && (
                  <div className="p-3 rounded-lg bg-[#E5DFD3] border border-[#2C2A28]/15">
                    <p className="text-xs text-[#5A5753]">
                      Your {trialDaysRemaining}-day free trial is active.
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Your Gmail account is linked. Viltreon can read your inbox and apply labels.
                </p>
                <Button
                  onClick={async () => {
                    // Best-effort: enable live push. If it fails we still
                    // advance — the user can toggle it later from settings.
                    try {
                      await fetch("/api/gmail/watch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "start" }),
                      })
                    } catch {
                      // Ignored — non-blocking
                    }
                    setStep(1)
                  }}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 1: API Key */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">How to get your free Groq key</p>
                  <video
                    src="/onboarding/groq-key.mp4"
                    poster="/onboarding/groq-key.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full rounded-md border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gemini-key">Groq API Key</Label>
                  <Input
                    id="gemini-key"
                    type="password"
                    placeholder="gsk_..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get a free key from{" "}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      console.groq.com/keys
                    </a>
                    .
                  </p>
                </div>
                <Button onClick={handleSaveKey} disabled={!geminiKey.trim() || savingKey} className="w-full">
                  {savingKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save &amp; Continue
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep(0)}>
                  Back
                </Button>
              </div>
            )}

            {/* Step 2: Sync Labels */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Viltreon will now scan your Gmail labels. This reads your existing label
                  structure so AI knows how to sort your emails.
                </p>
                {labelsCount > 0 && (
                  <div className="p-4 rounded-lg bg-[#8A9A86]/15 border border-[#8A9A86]">
                    <p className="text-sm font-medium text-[#2C2A28]">
                      {labelsCount} labels synced
                    </p>
                  </div>
                )}
                <Button onClick={handleSyncLabels} disabled={syncing} className="w-full">
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {syncing ? "Syncing..." : "Sync Labels"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
                  Back
                </Button>
              </div>
            )}

            {/* Step 3: Subscribe */}
            {step === 3 && (
              <div className="space-y-4">
                {(isTrialing || isPaid) && (
                  <div className="p-4 rounded-lg bg-[#8A9A86]/15 border border-[#8A9A86]">
                    <p className="text-sm font-medium text-[#2C2A28]">
                      {isPaid
                        ? "Subscription active"
                        : `Free trial active — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} remaining`}
                    </p>
                    <p className="mt-1 text-xs text-[#5A5753]">
                      You can start sorting your inbox right now. Subscribe any time
                      before the trial ends to keep access.
                    </p>
                  </div>
                )}

                {/* Two price cards side by side, matching /pricing. No default
                    selected; each card starts its own interval's checkout.
                    Hidden for trialing users: they already have a Stripe
                    subscription, so a second checkout would create a duplicate
                    sub and double-charge them at trial end. */}
                {!isTrialing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Monthly */}
                    <div className="rounded-xl border border-[#2C2A28]/15 bg-white p-4 flex flex-col text-center">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5A5753]">
                        Monthly
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">
                        $9.99
                        <span className="text-sm font-normal text-muted-foreground"> /mo</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Cancel any month</p>
                      <Button
                        className="w-full mt-3"
                        onClick={() => handleSubscribe("month")}
                        disabled={loadingInterval !== null || isPaid}
                      >
                        {loadingInterval === "month" && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        {isPaid ? "Subscribed" : isExpired ? "Subscribe" : "Start trial"}
                      </Button>
                    </div>

                    {/* Annual */}
                    <div className="relative rounded-xl border-2 border-[#D86B5A] bg-white p-4 flex flex-col text-center">
                      <Badge className="absolute -top-2 right-2 bg-[#D86B5A] text-white text-xs">
                        Save 17%
                      </Badge>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5A5753]">
                        Annual
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">
                        $99.99
                        <span className="text-sm font-normal text-muted-foreground"> /yr</span>
                      </p>
                      <p className="mt-1 text-xs text-[#D86B5A] font-medium">
                        ${(99.99 / 12).toFixed(2)}/mo, 17% off
                      </p>
                      <Button
                        className="w-full mt-3"
                        onClick={() => handleSubscribe("year")}
                        disabled={loadingInterval !== null || isPaid}
                      >
                        {loadingInterval === "year" && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        {isPaid ? "Subscribed" : isExpired ? "Subscribe" : "Start trial"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Trial disclosure only for genuinely new users; returning
                    (expired) users have already used their trial and are
                    charged immediately. */}
                {!isPaid && !isTrialing && !isExpired && (
                  <p className="text-xs text-muted-foreground text-center">
                    14-day free trial. Your card is saved now but not charged
                    until the trial ends. Cancel anytime before then and you
                    won&apos;t be charged.
                  </p>
                )}

                {(isTrialing || isPaid) && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => router.push("/dashboard")}
                  >
                    Continue to Dashboard
                  </Button>
                )}

                <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>
                  Back
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// useSearchParams must live inside a Suspense boundary in the Next 16 App
// Router. Without this, route prerender breaks on the param read.
export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SetupInner />
    </Suspense>
  )
}
