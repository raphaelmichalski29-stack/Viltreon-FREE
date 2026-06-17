"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Check, Loader2, Mail, Key, Tags } from "lucide-react"

const steps = [
  { icon: Mail, title: "Connect Gmail", description: "Connect your Google account" },
  { icon: Key, title: "API Key", description: "Add your Groq API key" },
  { icon: Tags, title: "Sync Labels", description: "Sync your Gmail labels" },
]

function SetupInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [resuming, setResuming] = useState(true)
  const [geminiKey, setGeminiKey] = useState("")
  const [savingKey, setSavingKey] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [labelsCount, setLabelsCount] = useState(0)

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
        // Setup already complete — go straight to the dashboard.
        if (s.hasGeminiKey && s.pushEnabled) {
          router.replace("/dashboard")
          return
        }
        // Resume at the first incomplete step.
        setStep(s.hasGeminiKey ? 2 : 0)
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
  }, [status, router])

  if (status === "loading" || resuming) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
      setTimeout(() => router.push("/dashboard"), 1000)
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" })
    } finally {
      setSyncing(false)
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
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {syncing ? "Syncing..." : "Sync Labels & Finish"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
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

// useSearchParams is no longer used, but keep the Suspense boundary so the
// page's structure stays consistent with the rest of the App Router pages.
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
