"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Loader2, Key, Bell, Trash2, CreditCard, Mail, Archive, Filter, BookOpen, Download } from "lucide-react"
import type { UserSettings } from "@/types"

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [geminiKey, setGeminiKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [sortingRules, setSortingRules] = useState("")
  const [savingRules, setSavingRules] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch("/api/user/settings")
      const data = await res.json()
      if (res.ok) {
        setSettings(data.settings)
        setSortingRules(data.settings.sortingRules || "")
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey() {
    if (!geminiKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/user/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: geminiKey.trim() }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast({ title: "API key updated", variant: "success" })
      setGeminiKey("")
      fetchSettings()
    } catch (err) {
      toast({ title: "Failed to save key", description: String(err), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAutoSort(enabled: boolean) {
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSortEnabled: enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update")
      setSettings((prev) => prev ? { ...prev, autoSortEnabled: enabled } : prev)
      if (data?.warning) {
        // Push toggle failed downstream but the DB flag was saved — warn the
        // user instead of pretending live sort is on.
        toast({ title: "Saved with warning", description: data.warning, variant: "destructive" })
      } else {
        toast({ title: `Auto-sort ${enabled ? "enabled" : "disabled"}`, variant: "success" })
      }
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    }
  }

  async function handleToggleArchive(enabled: boolean) {
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveSorted: enabled }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setSettings((prev) => prev ? { ...prev, archiveSorted: enabled } : prev)
      toast({ title: `Archive ${enabled ? "enabled" : "disabled"}`, variant: "success" })
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    }
  }

  async function handleChangeSortScope(scope: string) {
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortScope: scope }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setSettings((prev) => prev ? { ...prev, sortScope: scope } : prev)
      toast({ title: `Sorting scope updated`, variant: "success" })
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    }
  }

  async function handleSaveSortingRules() {
    setSavingRules(true)
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortingRules: sortingRules.substring(0, 1000) }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setSettings((prev) => prev ? { ...prev, sortingRules } : prev)
      toast({ title: "Sorting rules saved", variant: "success" })
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    } finally {
      setSavingRules(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch("/api/user", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to delete account")
      }
      // The server has cancelled Stripe, stopped the Gmail watch, deleted all
      // data, revoked the session, and cleared the auth cookies. A full
      // navigation to the landing page drops any stale client session state.
      window.location.href = "/"
    } catch (err) {
      toast({ title: "Account deletion failed", description: String(err), variant: "destructive" })
      setDeleting(false)
    }
  }

  async function handleExportData() {
    setExporting(true)
    try {
      const res = await fetch("/api/user/export")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `viltreon-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: "Data exported", variant: "success" })
    } catch (err) {
      toast({ title: "Export failed", description: String(err), variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Usage
          </CardTitle>
          <CardDescription>
            Emails processed this billing period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{settings?.emailsProcessedThisMonth ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">
            No artificial limits on email sorting.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Groq API Key
          </CardTitle>
          <CardDescription>
            {settings?.hasGeminiKey
              ? "A key is configured (hidden for security)"
              : "No API key set. AI sorting won't work without one."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
              <Label htmlFor="gemini-key">Update Key</Label>
            <Input
              id="gemini-key"
              type="password"
              placeholder="gsk_..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveKey} disabled={!geminiKey.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Auto-Sort
          </CardTitle>
          <CardDescription>
            Automatically sort new emails when they arrive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Enable auto-sort</p>
              <p className="text-xs text-muted-foreground">
                Processes emails through your connected Gmail
              </p>
            </div>
            <Switch
              checked={settings?.autoSortEnabled ?? true}
              onCheckedChange={handleToggleAutoSort}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Sorting Preferences
          </CardTitle>
          <CardDescription>
            Control how emails are sorted and processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-sm">Archive sorted emails</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Remove sorted emails from your inbox
              </p>
            </div>
            <Switch
              checked={settings?.archiveSorted ?? false}
              onCheckedChange={handleToggleArchive}
            />
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-sm">Emails to sort</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Choose which inbox emails the AI processes
            </p>
            <select
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm"
              value={settings?.sortScope || "unread"}
              onChange={(e) => handleChangeSortScope(e.target.value)}
            >
              <option value="unread" className="bg-background text-foreground">Unread only</option>
              <option value="read" className="bg-background text-foreground">Read only</option>
              <option value="both" className="bg-background text-foreground">Both read and unread</option>
            </select>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-sm">Sorting Rules</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Custom instructions attached to the AI prompt ({sortingRules.length}/1000 characters)
            </p>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
              placeholder="e.g. Emails from my domain @company.com should always go under Work. Newsletters go under Promotions..."
              value={sortingRules}
              onChange={(e) => setSortingRules(e.target.value.substring(0, 1000))}
            />
            <Button
              className="mt-3"
              onClick={handleSaveSortingRules}
              disabled={savingRules}
            >
              {savingRules ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>
            Signed in as {session?.user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connected with Google. Revoke access from your Google Account settings at any time.
          </p>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Export my data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Download a JSON copy of your account, settings, labels, and sort history.
              </p>
            </div>
            <Button variant="outline" onClick={handleExportData} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Export
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm text-destructive">Delete my account</p>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently deletes your account and all associated data: your
                connected Gmail authorization, API key, labels, sorting rules,
                settings, and sort history. This also cancels your subscription
                and renders it void. This action cannot be undone.
              </p>
            </div>

            {!confirmingDelete ? (
              <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete my account
              </Button>
            ) : (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm font-medium">
                  Type <span className="font-mono">DELETE</span> to confirm. Your
                  subscription will be cancelled and all your data erased. This
                  cannot be undone.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  aria-label="Type DELETE to confirm account deletion"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={confirmText !== "DELETE" || deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Permanently delete
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirmingDelete(false)
                      setConfirmText("")
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
