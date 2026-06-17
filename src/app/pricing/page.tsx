"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { toast } from "@/hooks/use-toast"
import { Loader2, Check } from "lucide-react"

const features = [
  "Every email sorted the moment it arrives",
  "Uses the labels you already have",
  "Clean your whole inbox in one click",
  "Your email is never stored",
  "Cancel anytime, no lock-in",
]

// The two plans the toggle switches between. The live page shows one ticket at
// a time; the pill below the headline flips between these.
const PLANS = {
  month: { tag: "VILTREON / MONTHLY", price: "$9.99", period: "month", sub: "Billed monthly. Cancel anytime." },
  year: { tag: "VILTREON / ANNUAL", price: "$99.99", period: "year", sub: "Just $8.33/mo, billed yearly. Save 17%." },
} as const

export default function PricingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loadingInterval, setLoadingInterval] = useState<"month" | "year" | null>(null)
  // Annual is featured by default so the savings anchor is visible without a click.
  const [billing, setBilling] = useState<"month" | "year">("year")
  // Trialing users already have a subscription; the checkout API routes them to
  // the billing portal to change plan rather than starting a new trial.
  const isTrialing = session?.user?.subscriptionStatus === "trialing"

  const pollingRef = useRef(false)

  useEffect(() => {
    if (status === "authenticated") {
      const subStatus = session?.user?.subscriptionStatus
      // Paid users don't belong on the pricing page.
      if (subStatus === "active") {
        router.push("/dashboard")
        return
      }
      // Trialing users may view/change their plan here. They already have
      // access, so skip the post-checkout polling below (which exists to bounce
      // a waiting user to the dashboard once their first payment lands).
      if (subStatus === "trialing") {
        return
      }
      if (!pollingRef.current) {
        pollingRef.current = true

        const timer = window.setInterval(async () => {
          try {
            const res = await fetch("/api/user/verify-subscription", { method: "POST" })
            const data = await res.json()
            if (data.active) {
              window.clearInterval(timer)
              pollingRef.current = false
              router.push("/dashboard")
            }
          } catch {}
        }, 3000)

        return () => {
          window.clearInterval(timer)
          pollingRef.current = false
        }
      }
    }
  }, [status, session, router])

  async function handleSubscribe(interval: "month" | "year") {
    if (status !== "authenticated") {
      router.push("/auth/signin?callbackUrl=/setup")
      return
    }
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

  const ctaLabel = isTrialing ? "Change plan" : status === "authenticated" ? "Start free trial" : "Get started"
  const plan = PLANS[billing]

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2A28]">
      <header className="sticky top-0 z-50 border-b border-[#E5DFD3] bg-[#F9F8F6]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="font-serif font-semibold text-2xl tracking-tight italic text-[#2C2A28]">
            Viltreon.
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            {session ? (
              <button onClick={() => router.push("/dashboard")} className="px-5 py-2 rounded-[30px_8px_25px_12px] border border-[#2C2A28] hover:bg-[#E5DFD3] transition-colors">
                Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => router.push("/auth/signin")} className="px-5 py-2 rounded-[30px_8px_25px_12px] border border-[#2C2A28] hover:bg-[#E5DFD3] transition-colors hidden sm:inline-block">
                  Sign in
                </button>
                <button onClick={() => router.push("/auth/signin")} className="px-5 py-2 rounded-[8px_30px_12px_25px] bg-[#D86B5A] text-white hover:-translate-y-0.5 transition-transform">
                  Get started
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="font-mono text-xs tracking-[0.2em] text-[#D86B5A] mb-5">PRICING</div>
        <h1 className="font-serif text-4xl md:text-5xl text-[#2C2A28]">A sorted inbox, on autopilot.</h1>
        <p className="mt-5 text-lg text-[#5A5753] max-w-md">
          One plan. Choose how you would like to pay, and switch or cancel whenever you want.
        </p>

        {/* Billing toggle: swaps the single ticket below between monthly and annual. */}
        <div className="inline-flex items-center rounded-full border border-[#2C2A28]/15 p-1 mt-10 mb-10">
          <button
            onClick={() => setBilling("month")}
            className={`px-5 py-1.5 rounded-full text-sm transition-colors ${billing === "month" ? "bg-[#2C2A28] text-[#F9F8F6]" : "text-[#5A5753]"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("year")}
            className={`px-5 py-1.5 rounded-full text-sm transition-colors ${billing === "year" ? "bg-[#2C2A28] text-[#F9F8F6]" : "text-[#5A5753]"}`}
          >
            Annual <span className={billing === "year" ? "text-[#F9F8F6]/70" : "text-[#D86B5A]"}>&middot; save 17%</span>
          </button>
        </div>

        {/* The ticket */}
        <div className={`w-full max-w-sm bg-white text-left ${billing === "year" ? "border-2 border-[#D86B5A]" : "border border-[#2C2A28]/15"} rounded-2xl`}>
          <div className="p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[11px] tracking-[0.12em] text-[#5A5753]">{plan.tag}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight text-[#2C2A28]">{plan.price}</span>
                  <span className="text-sm text-[#5A5753]">/ {plan.period}</span>
                </div>
                <div className="text-sm text-[#5A5753] mt-1.5">{plan.sub}</div>
              </div>
              <div className="font-mono text-[10px] text-[#9A938A] text-right border border-[#2C2A28]/15 rounded-md px-2 py-1 leading-tight">
                NO.<br />0001
              </div>
            </div>
            <button
              onClick={() => handleSubscribe(billing)}
              disabled={loadingInterval !== null}
              className="w-full mt-6 rounded-xl py-3.5 font-medium text-white bg-[#D86B5A] hover:-translate-y-0.5 transition-transform disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {loadingInterval === billing && <Loader2 className="h-4 w-4 animate-spin" />}
              {ctaLabel}
            </button>
          </div>

          {/* Perforated stub: the notch circles match the page background to read as a cut. */}
          <div className="relative border-t-2 border-dashed border-[#2C2A28]/20 p-7">
            <span className="absolute -left-[9px] -top-[9px] w-4 h-4 rounded-full bg-[#F9F8F6]" aria-hidden />
            <span className="absolute -right-[9px] -top-[9px] w-4 h-4 rounded-full bg-[#F9F8F6]" aria-hidden />
            <div className="font-mono text-[10px] tracking-[0.14em] text-[#9A938A] mb-4">INCLUDED</div>
            <ul className="space-y-2.5">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-[#2C2A28]">
                  <Check className="h-4 w-4 text-[#D86B5A] shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="font-mono text-[11px] text-[#9A938A] mt-6 max-w-sm">
          14-day free trial. Your card is saved now but not charged until the trial ends. Cancel anytime before then and you won&apos;t be charged.
        </p>

        <p className="text-sm text-[#5A5753] mt-12">
          Questions? Email us at{" "}
          <a href="mailto:support@viltreon.com" className="text-[#D86B5A] hover:underline">
            support@viltreon.com
          </a>
        </p>
      </main>
    </div>
  )
}
