"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { Loader2, RefreshCw, FolderTree, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, FileText, ShieldAlert, ShieldCheck } from "lucide-react"
import type { GmailLabel, LabelUpdate } from "@/types"

interface TreeNode extends GmailLabel {
  children: TreeNode[]
  depth: number
}

export default function LabelsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [labels, setLabels] = useState<TreeNode[]>([])
  const [flatLabels, setFlatLabels] = useState<GmailLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newParentId, setNewParentId] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [updatingLabel, setUpdatingLabel] = useState<string | null>(null)
  const [descEditId, setDescEditId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [savingDesc, setSavingDesc] = useState(false)
  const [fallbackGmailLabelId, setFallbackGmailLabelId] = useState<string | null>(null)
  const [fallbackIgnored, setFallbackIgnored] = useState(false)
  const [savingFallback, setSavingFallback] = useState(false)
  const [creatingFallback, setCreatingFallback] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const labelsData = await fetchLabels()
    await fetchFallback(labelsData)
  }

  async function fetchFallback(labelsData: GmailLabel[]) {
    try {
      const res = await fetch("/api/user/settings")
      const data = await res.json()
      if (res.ok) {
        const current = data.settings.fallbackGmailLabelId
        if (current) {
          setFallbackGmailLabelId(current)
        }
      }
    } catch {
      // silent
    }
  }

  async function handleFallbackChange(gmailLabelId: string) {
    if (!gmailLabelId) return
    setSavingFallback(true)
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fallbackGmailLabelId: gmailLabelId }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setFallbackGmailLabelId(gmailLabelId)
      toast({ title: "Fallback label updated", variant: "success" })
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    } finally {
      setSavingFallback(false)
    }
  }

  async function handleCreateFallback() {
    setCreatingFallback(true)
    try {
      const res = await fetch("/api/gmail/labels/fallback", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create fallback label")
      setFallbackGmailLabelId(data.label.id)
      setFallbackIgnored(false)
      handleSync()
      toast({ title: `Fallback label "Other" created`, variant: "success" })
    } catch (err) {
      toast({ title: "Failed to create fallback", description: String(err), variant: "destructive" })
    } finally {
      setCreatingFallback(false)
    }
  }

  async function fetchLabels(): Promise<GmailLabel[]> {
    try {
      const res = await fetch("/api/gmail/labels")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch labels")
      const allLabels = data.labels || []
      setFlatLabels(allLabels)
      setLabels(buildTree(allLabels))
      return allLabels
    } catch (err) {
      toast({ title: "Failed to load labels", description: String(err), variant: "destructive" })
      return []
    } finally {
      setLoading(false)
    }
  }

  function buildTree(flat: GmailLabel[]): TreeNode[] {
    const map = new Map<string, TreeNode>()
    for (const l of flat) {
      map.set(l.id, { ...l, children: [], depth: 0 })
    }
    const roots: TreeNode[] = []
    for (const label of flat) {
      const node = map.get(label.id)!
      const parts = label.name.split("/")
      if (parts.length > 1) {
        const parentName = parts.slice(0, -1).join("/")
        const parent = flat.find((l) => l.name === parentName)
        if (parent && map.has(parent.id)) {
          map.get(parent.id)!.children.push(node)
          continue
        }
      }
      roots.push(node)
    }
    return roots
  }

  async function handleSync() {
    setSyncing(true)
    let labels: GmailLabel[] = []
    try {
      const res = await fetch("/api/gmail/labels")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync failed")
      labels = data.labels || []
      setFlatLabels(labels)
      setLabels(buildTree(labels))
      toast({ title: `Synced ${labels.length} labels`, variant: "success" })
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" })
    } finally {
      setSyncing(false)
    }
    fetchFallback(labels)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/gmail/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentGmailId: newParentId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create label")
      toast({ title: `Label "${newName.trim()}" created`, variant: "success" })
      setNewName("")
      setNewParentId("")
      setShowCreate(false)
      handleSync()
    } catch (err) {
      toast({ title: "Failed to create label", description: String(err), variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(gmailLabelId: string) {
    if (!editName.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch("/api/gmail/labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailLabelId, name: editName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to rename label")
      toast({ title: "Label renamed", variant: "success" })
      setEditingId(null)
      setEditName("")
      handleSync()
    } catch (err) {
      toast({ title: "Failed to rename label", description: String(err), variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(gmailLabelId: string, labelName: string) {
    if (!confirm(`Delete label "${labelName}"? This removes it from Gmail.`)) return
    try {
      const res = await fetch(`/api/gmail/labels?gmailLabelId=${gmailLabelId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete label")
      toast({ title: `Label "${labelName}" deleted`, variant: "success" })
      handleSync()
    } catch (err) {
      toast({ title: "Failed to delete label", description: String(err), variant: "destructive" })
    }
  }

  async function handleToggleVisibility(gmailLabelId: string, current: boolean) {
    setUpdatingLabel(gmailLabelId)
    try {
      const res = await fetch("/api/gmail/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailLabelId, aiVisible: !current } as LabelUpdate),
      })
      if (!res.ok) throw new Error("Failed to update")
      handleSync()
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    } finally {
      setUpdatingLabel(null)
    }
  }

  async function handleUpdateDescription(gmailLabelId: string) {
    setSavingDesc(true)
    try {
      const res = await fetch("/api/gmail/labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailLabelId, description: editDesc.trim() || null } as LabelUpdate),
      })
      if (!res.ok) throw new Error("Failed to update")
      toast({ title: "Description updated", variant: "success" })
      setDescEditId(null)
      setEditDesc("")
      handleSync()
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" })
    } finally {
      setSavingDesc(false)
    }
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  function getAllLabelsList(): GmailLabel[] {
    const result: GmailLabel[] = []
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        result.push(n)
        walk(n.children)
      }
    }
    walk(labels)
    return result
  }

  function renderTree(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.id)
      const isEditing = editingId === node.id
      const isEditingDesc = descEditId === node.id
      const isVisible = node.aiVisible !== false
      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent group"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={() => handleToggleVisibility(node.id, isVisible)}
              disabled={updatingLabel === node.id}
              title={isVisible ? "AI can sort into this label" : "AI will skip this label"}
            >
              {updatingLabel === node.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
            <div onClick={() => hasChildren && toggleExpand(node.id)} className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )
              ) : (
                <div className="w-4" />
              )}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm py-0 w-48"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(node.id)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRename(node.id)} disabled={savingEdit}>
                        {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className={`text-sm truncate ${!isVisible ? "text-muted-foreground line-through" : ""}`}>
                      {node.name.split("/").pop()}
                    </span>
                  )}
                </div>
                {!isEditing && !isEditingDesc && node.description && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-muted-foreground/70">
                      {node.description}
                    </span>
                  </div>
                )}
                {isEditingDesc && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value.substring(0, 250))}
                        className="h-7 text-xs py-0 w-64"
                        placeholder="Describe what emails go here (250 chars max)"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateDescription(node.id)
                          if (e.key === "Escape") { setDescEditId(null); setEditDesc("") }
                        }}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">{editDesc.length}/250</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateDescription(node.id)} disabled={savingDesc}>
                      {savingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setDescEditId(null); setEditDesc("") }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => { setDescEditId(node.id); setEditDesc(node.description || ""); setEditingId(null) }}
                  title="Edit description"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => { setEditingId(node.id); setEditName(node.name); setDescEditId(null) }}
                  title="Rename label"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(node.id, node.name)}
                  title="Delete label"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {node.color && (
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: node.color.backgroundColor }}
              />
            )}
          </div>
          {hasChildren && isExpanded && renderTree(node.children, depth + 1)}
        </div>
      )
    })
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Labels</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Gmail labels. Changes sync to Gmail automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Label
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncing ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create New Label</CardTitle>
            <CardDescription>This will be created in your Gmail account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Label name</label>
                <Input
                  placeholder="e.g. Clients, Projects/Active"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="w-48 space-y-1">
                <label className="text-sm font-medium">Parent (optional)</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                >
                  <option value="">None (top-level)</option>
                  {getAllLabelsList().map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); setNewParentId("") }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Label Tree
          </CardTitle>
          <CardDescription>
            Hover over a label to rename or delete it. Changes apply to Gmail immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : labels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No user labels found</p>
              <p className="text-sm mt-1">
                Create a label above or sync from Gmail
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-2">
              {renderTree(labels)}
            </div>
          )}
        </CardContent>
      </Card>

      {!fallbackGmailLabelId && !fallbackIgnored ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              No Fallback Label Configured
            </CardTitle>
            <CardDescription className="text-destructive/80">
              Sorting requires a fallback label. Unclassifiable emails and low-confidence classifications (&lt; 60%) will land here instead of staying in your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button onClick={handleCreateFallback} disabled={creatingFallback} variant="default">
                {creatingFallback ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Approve &mdash; Auto-create &quot;Other&quot;
              </Button>
              <Button onClick={() => setFallbackIgnored(true)} variant="outline">
                Ignore
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !fallbackGmailLabelId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="h-5 w-5" />
              Fallback Label
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No fallback &mdash; unclassifiable emails stay in inbox.
              </p>
              <Button onClick={handleCreateFallback} disabled={creatingFallback} variant="outline" size="sm">
                {creatingFallback ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Fallback
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Fallback Label
            </CardTitle>
            <CardDescription>
              When AI can&apos;t determine a label or confidence is below 60%, emails go here instead of staying in the inbox
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <select
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={fallbackGmailLabelId ?? ""}
                onChange={(e) => handleFallbackChange(e.target.value)}
                disabled={savingFallback}
              >
                {flatLabels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {savingFallback && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Every email gets labeled. Unclassifiable emails go to &quot;{flatLabels.find((l) => l.id === fallbackGmailLabelId)?.name ?? "Other"}&quot;.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
