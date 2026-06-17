"use client"

import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { Loader2, Sparkles, Mail, Clock, TrendingUp, AlertTriangle, ShieldCheck, Lock, Trash2, Zap } from "lucide-react"
import type { DashboardStats, SortJobStatus, UserSettings } from "@/types"
import { AuroraBackdrop, GlassStatCard, Mail3D, NumberTicker, Reveal } from "@/components/dashboard/activity-visuals"
import "@/components/dashboard/activity-dashboard.css"

// Recharts is ~150KB gzipped and only used on this page. Splitting it out of
// the initial bundle improves first-paint on the dashboard noticeably,
// especially on mobile / slow networks. The skeleton matches the chart's
// rendered height so layout doesn't shift when the bundle arrives.
const ActivityChart = dynamic(() => import("@/components/ActivityChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
})

function DashboardPageInner() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sorting, setSorting] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [enablingPush, setEnablingPush] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<Array<{ date: string; count: number }>>([])
  const [chartLoading, setChartLoading] = useState(true)
  // One-shot gate for the post-checkout verify flow. useSession's `update`
  // function is a new reference on every render — putting it in the effect
  // deps caused the verify loop to re-spawn every time it updated the session,
  // creating an infinite POST /api/user/verify-subscription storm.
  const handledSubscribedRef = useRef(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  // Stripe checkout success redirects back here with ?subscribed=1. The
  // checkout.session.completed webhook fires async, so the user's JWT
  // is still pre-payment when they land. Poll verify-subscription a few
  // times to let Stripe's webhook catch up, then refresh the session so
  // the API stops returning 402.
  useEffect(() => {
    if (status !== "authenticated") return
    if (searchParams.get("subscribed") !== "1") return
    if (handledSubscribedRef.current) return
    handledSubscribedRef.current = true

    let cancelled = false
    ;(async () => {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        try {
          const res = await fetch("/api/user/verify-subscription", { method: "POST" })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.active) {
            await updateSession()
            toast({ title: "Subscription active", variant: "success" })
            break
          }
        } catch {
          // network blip — retry
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
      if (!cancelled) {
        // Strip the query param so a page refresh doesn't re-trigger.
        router.replace("/dashboard")
      }
    })()

    return () => {
      cancelled = true
    }
    // updateSession intentionally omitted — see handledSubscribedRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, searchParams, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetchStats()
    fetchHistory()
  }, [status])

  async function fetchHistory() {
    try {
      const res = await fetch("/api/user/stats/history")
      if (!res.ok) throw new Error("Failed to fetch history")
      const data = await res.json()
      setChartData(data.days || [])
    } catch {
      // silent fail
    } finally {
      setChartLoading(false)
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/user/settings")
      if (!res.ok) throw new Error("Failed to fetch settings")
      const data = await res.json()
      setStats(data.stats)
      setSettings(data.settings)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  async function handleEnablePush() {
    setEnablingPush(true)
    try {
      const res = await fetch("/api/gmail/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to enable")
      toast({ title: "Live sorting enabled", variant: "success" })
      fetchStats()
    } catch (err) {
      toast({ title: "Failed to enable live sorting", description: String(err), variant: "destructive" })
    } finally {
      setEnablingPush(false)
    }
  }

  async function handleSortInbox() {
    setSorting(true)
    try {
      const res = await fetch("/api/sort/inbox", { method: "POST" })
      // 402 = trial expired / subscription required. Bounce the user to the
      // setup flow which has the subscribe UI inline, rather than just
      // showing a cryptic toast.
      if (res.status === 402) {
        router.push("/setup?expired=1")
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start sort")

      let result: { processed: number; labeled: number; skipped: number }
      if (data.immediate) {
        result = data
      } else {
        if (!data.jobId) throw new Error("No job ID returned")
        result = await pollJobStatus(data.jobId)
      }

      const parts = [`Processed ${result.processed} emails`]
      if (result.labeled > 0) parts.push(`${result.labeled} labeled`)
      if (result.skipped > 0) parts.push(`${result.skipped} fell back to Other`)
      toast({
        title: result.processed === 0 ? "Inbox empty" : result.labeled === result.processed ? "Inbox sorted" : "Sort partially completed",
        description: parts.join(", "),
        variant: result.processed === 0 ? "default" : "success",
      })
      fetchStats()
    } catch (err) {
      toast({ title: "Sort failed", description: String(err), variant: "destructive" })
    } finally {
      setSorting(false)
    }
  }

  async function pollJobStatus(jobId: string): Promise<{ processed: number; labeled: number; skipped: number }> {
    try {
      return await sseJobStatus(jobId)
    } catch {
      return pollFallback(jobId)
    }
  }

  function sseJobStatus(jobId: string): Promise<{ processed: number; labeled: number; skipped: number }> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`/api/sort/status/${jobId}/sse`)

      const timeout = setTimeout(() => {
        eventSource.close()
        reject(new Error("SSE timed out"))
      }, 300_000)

      eventSource.onmessage = (event) => {
        clearTimeout(timeout)
        eventSource.close()
        try {
          resolve(JSON.parse(event.data))
        } catch {
          reject(new Error("Failed to parse SSE data"))
        }
      }

      eventSource.onerror = () => {
        clearTimeout(timeout)
        eventSource.close()
        reject(new Error("SSE connection failed"))
      }
    })
  }

  async function pollFallback(jobId: string): Promise<{ processed: number; labeled: number; skipped: number }> {
    const delays = [200, 300, 500, 800, 1000]
    for (let i = 0; i < 300; i++) {
      const res = await fetch(`/api/sort/status/${jobId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Status request failed (${res.status})`)
      }
      const status: SortJobStatus = await res.json()
      if (status.status === "completed" && status.result) {
        return status.result
      }
      if (status.status === "failed") {
        throw new Error(status.error || "Sort job failed")
      }
      await new Promise((r) => setTimeout(r, delays[i] ?? 1000))
    }
    throw new Error("Sort timed out")
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Promote minutes → hours and minutes → days as the count grows, so a
  // long-running user sees "2 d 5 h" instead of "3155 min". Components with
  // a zero count are omitted, e.g. 1 d + 5 min displays as "1 d 5 min", not
  // "1 d 0 h 5 min".
  function formatTimeSaved(minutes: number): string {
    if (!minutes) return "0 min"
    const days = Math.floor(minutes / (60 * 24))
    const hours = Math.floor((minutes % (60 * 24)) / 60)
    const mins = minutes % 60
    const parts: string[] = []
    if (days > 0) parts.push(`${days} d`)
    if (hours > 0) parts.push(`${hours} h`)
    if (mins > 0) parts.push(`${mins} min`)
    return parts.join(" ")
  }

  const statCards = [
    {
      title: "Total Emails Sorted",
      value: stats?.totalEmailsSorted ?? 0,
      icon: Mail,
      description: "All-time emails processed by AI",
    },
    {
      title: "Emails Sorted Today",
      value: stats?.emailsSortedToday ?? 0,
      icon: TrendingUp,
      description: "Emails processed since midnight",
    },
    {
      title: "Time Saved",
      value: formatTimeSaved(stats?.timeSavedMinutes ?? 0),
      icon: Clock,
      description: "Estimated at ~15s per email",
    },
  ]

  const subStatus = settings?.subscriptionStatus
  // Red "Trial ended" banner once the server-side writeback has flipped
  // status to "expired". Trialing users get no banner: their card is on
  // file and they are charged automatically when the trial ends.
  const trialBanner =
    !loading && settings ? (
      subStatus === "expired" ? (
        <div className="flex items-center justify-between gap-4 bg-white p-4 border-2 border-[#2C2A28] border-l-[6px] border-l-[#D86B5A] rounded-[255px_15px_225px_15px/15px_225px_15px_255px]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" style={{ color: "#D86B5A" }} />
            <div>
              <p className="text-sm font-medium text-[#2C2A28]">Your free trial has ended</p>
              <p className="mt-1 text-xs text-[#5A5753]">
                Subscribe to keep sorting your inbox. Your settings and preferences are preserved.
              </p>
            </div>
          </div>
          <button
            className="bg-[#D86B5A] text-white px-4 py-2 text-sm font-medium rounded-[8px_30px_12px_25px] border border-transparent hover:-translate-y-0.5 hover:rotate-[-1deg] hover:shadow-[4px_8px_15px_rgba(216,107,90,0.2)] hover:rounded-[25px_12px_30px_8px] transition-all whitespace-nowrap"
            onClick={() => router.push("/setup?expired=1")}
          >
            Subscribe
          </button>
        </div>
      ) : null
    ) : null

  return (
    <div className="main-content relative z-10 w-full max-w-5xl mx-auto space-y-12 pb-12">
      {trialBanner}

      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <p className="text-[#5A5753] text-sm font-medium mb-1 tracking-wide uppercase">Overview</p>
          <h1 className="font-serif text-4xl text-[#2C2A28]">
            Your inbox is <span className="scribble-underline text-[#8A9A86] italic">clear.</span>
          </h1>
        </div>
        
        {/* Live Status */}
        <div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] shadow-sm">
          <div className="relative flex h-3 w-3">
            <span className={`absolute inline-flex h-full w-full rounded-full ${settings?.pushEnabled ? "animate-ping bg-[#8A9A86]" : "bg-[#D86B5A]"} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${settings?.pushEnabled ? "bg-[#8A9A86]" : "bg-[#D86B5A]"}`}></span>
          </div>
          <span className="text-sm font-medium text-[#2C2A28]">{settings?.pushEnabled ? "Live Sorting Active" : "Live Sorting Paused"}</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Stats Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stat Card 1 */}
          <div className="bg-white p-6 border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] transform rotate-1 transition-transform hover:-translate-y-1">
            <p className="text-sm text-[#5A5753] mb-2 font-medium">Emails Sorted Today</p>
            <div className="font-serif text-5xl mb-2 text-[#D86B5A]">{stats?.emailsSortedToday ?? 0}</div>
            <p className="text-xs text-[#5A5753]">Total All-Time: {stats?.totalEmailsSorted ?? 0}</p>
          </div>
          {/* Stat Card 2 */}
          <div className="bg-white p-6 border-2 border-[#2C2A28] rounded-[15px_225px_15px_255px/255px_15px_225px_15px] transform -rotate-1 transition-transform hover:-translate-y-1">
            <p className="text-sm text-[#5A5753] mb-2 font-medium">Time Saved</p>
            <div className="font-serif text-4xl mb-2 text-[#2C2A28]">{formatTimeSaved(stats?.timeSavedMinutes ?? 0)}</div>
            <p className="text-xs text-[#5A5753]">Estimated at ~15s per email</p>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 border-2 border-[#2C2A28] rounded-[255px_15px_225px_15px/15px_225px_15px_255px] h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-[#E5DFD3] gap-4">
              <h2 className="font-serif text-2xl italic text-[#2C2A28]">Activity Chart</h2>
              <div className="flex gap-2">
                {!loading && settings && !settings.pushEnabled && (
                  <button onClick={handleEnablePush} disabled={enablingPush} className="bg-transparent text-[#2C2A28] border border-[#2C2A28] px-4 py-1.5 rounded-[30px_8px_25px_12px] text-sm font-medium hover:bg-[#E5DFD3] transition-all flex items-center">
                    {enablingPush ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    Enable Push
                  </button>
                )}
                <button onClick={handleSortInbox} disabled={sorting} className="bg-[#D86B5A] text-white px-4 py-1.5 rounded-[8px_30px_12px_25px] text-sm font-medium border border-transparent hover:-translate-y-0.5 hover:rotate-[-1deg] hover:shadow-[4px_8px_15px_rgba(216,107,90,0.2)] hover:rounded-[25px_12px_30px_8px] transition-all flex items-center">
                  {sorting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sort Now
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[250px]">
              <ActivityChart data={chartData} loading={chartLoading} />
            </div>
            
            {/* Empty state embedded */}
            {!loading && (stats?.totalEmailsSorted ?? 0) === 0 && (
              <div className="mt-4 text-center py-6 border-t border-dashed border-[#E5DFD3]">
                <p className="font-serif italic text-lg text-[#2C2A28]">No emails sorted yet.</p>
                <p className="text-[#5A5753] text-sm mb-4">Click &quot;Sort Now&quot; to start processing your emails.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Next 16 App Router requires useSearchParams to live inside a Suspense
// boundary so that route prerender doesn't break on the param read.
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  )
}
