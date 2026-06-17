import { google, gmail_v1 } from "googleapis"
import { Agent as HttpsAgent } from "node:https"
import type { GmailLabel, EmailMessage } from "@/types"
import { prisma } from "./db"
import { decryptToken } from "./secure-adapter"
import { getCachedTokens, setCachedTokens, getTokenEpoch, bumpTokenEpoch, invalidate } from "./cache"
import { checkGmailApiRateLimit } from "./gmail-rate-limiter"

const AUTH_CACHE_PREFIX = "gmail-ai:oauth-client"

const gmailClientCache = new Map<string, { gmail: gmail_v1.Gmail; expiresAt: number; epoch: string | null }>()

// Shared keep-alive agent for every outbound call into Google's APIs. Without
// this, googleapis opens a fresh TLS connection per request — every
// fetchMessage, every applyLabel, every history.list pays ~100-200ms of
// TLS handshake. With a pool of persistent sockets, repeat calls reuse an
// existing connection. At sustained webhook traffic this is the single
// biggest latency reduction for live sort.
const googleApiAgent = new HttpsAgent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  // 50 sockets per worker is plenty — Gmail's per-user 250 units/sec rate
  // limiter is the upstream bottleneck, not socket availability.
  maxSockets: 50,
  // Reuse idle sockets aggressively but cap pool size so we don't accumulate
  // half-open connections across all 12 workers.
  maxFreeSockets: 10,
})

// Tell the global googleapis client to use the keep-alive agent for every
// outbound HTTPS call. Setting at module load means every gmail/auth call
// downstream picks it up automatically.
google.options({ http2: false, agent: googleApiAgent })

function getOAuth2Client(accessToken: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return oauth2Client
}

export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  // The epoch moves when the user re-authenticates or their tokens are found
  // revoked. An in-memory client built under an older epoch may hold dead
  // credentials (this process never saw the re-auth), so discard it and
  // rebuild from the DB. Redis-down returns null, which compares equal to a
  // null-built entry — fail-open, same as the rest of the cache layer.
  const epoch = await getTokenEpoch(userId)
  const cached = gmailClientCache.get(`${AUTH_CACHE_PREFIX}:${userId}`)
  if (cached && cached.expiresAt > Date.now() && cached.epoch === epoch) {
    return cached.gmail
  }

  let accessToken: string
  let refreshToken: string

  const cachedTokens = await getCachedTokens(userId)
  if (cachedTokens) {
    accessToken = cachedTokens.accessToken
    refreshToken = cachedTokens.refreshToken
  } else {
    // Without allowDangerousEmailAccountLinking this user has at most one Google Account
    // (NextAuth's provider_providerAccountId is unique). If somehow multiple exist, prefer
    // the most-recently-issued token rather than whichever expires latest.
    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
      orderBy: { id: "desc" },
    })
    if (!account?.access_token || !account?.refresh_token) {
      throw new Error("Gmail account not connected")
    }
    accessToken = decryptToken(account.access_token)
    refreshToken = decryptToken(account.refresh_token)

    setCachedTokens(userId, { accessToken, refreshToken }).catch(() => {})
  }

  const auth = getOAuth2Client(accessToken, refreshToken)
  const gmail = google.gmail({ version: "v1", auth })

  gmailClientCache.set(`${AUTH_CACHE_PREFIX}:${userId}`, {
    gmail,
    expiresAt: Date.now() + 50 * 60 * 1000,
    epoch,
  })

  return gmail
}

export function invalidateGmailClient(userId: string): void {
  gmailClientCache.delete(`${AUTH_CACHE_PREFIX}:${userId}`)
}

/**
 * Drop every cached credential for this user across the whole cluster: this
 * process's in-memory client, the Redis token cache, and (via the epoch bump)
 * every other process's in-memory client. Call after re-auth — the DB now has
 * fresh tokens — and on invalid_grant, where the cached tokens are dead and
 * the next attempt should rebuild from the DB.
 */
export async function invalidateGmailTokens(userId: string): Promise<void> {
  invalidateGmailClient(userId)
  await invalidate("user", userId, "tokens")
  await bumpTokenEpoch(userId)
}

/**
 * Revoke this user's Google OAuth grant so the app is removed from their
 * Google "Third-party access" list. Revoking the refresh token tears down the
 * entire grant (and any derived access tokens); we fall back to the access
 * token only if no refresh token was ever stored. Best-effort: an absent or
 * already-revoked token is fine to ignore. Call this BEFORE deleting the user
 * row, since the cascade removes the Account that holds these tokens.
 */
export async function revokeGoogleAccess(userId: string): Promise<void> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    orderBy: { id: "desc" },
  })
  const enc = account?.refresh_token ?? account?.access_token
  if (!enc) return

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  )
  await oauth2Client.revokeToken(decryptToken(enc))
}

export async function fetchUserLabels(gmail: gmail_v1.Gmail): Promise<GmailLabel[]> {
  const res = await gmail.users.labels.list({ userId: "me" })
  const allLabels = res.data.labels || []
  return allLabels
    .filter((l) => l.type === "user")
    .map((l) => {
      const visibility = l.messageListVisibility ?? undefined
      return {
        id: l.id!,
        name: l.name!,
        type: l.type!,
        messageListVisibility: visibility,
        labelListVisibility: l.labelListVisibility ?? undefined,
        color: l.color
          ? { textColor: l.color.textColor!, backgroundColor: l.color.backgroundColor! }
          : undefined,
      } as GmailLabel
    })
}

export function buildLabelTree(labels: GmailLabel[]): GmailLabel[] {
  const tree: GmailLabel[] = []
  const map = new Map<string, GmailLabel & { children: GmailLabel[] }>()

  for (const label of labels) {
    map.set(label.id, { ...label, children: [] })
  }

  for (const label of labels) {
    const parts = label.name.split("/")
    if (parts.length > 1) {
      const parentName = parts[0]
      const parent = labels.find((l) => l.name === parentName)
      if (parent && map.has(parent.id)) {
        map.get(parent.id)!.children.push(map.get(label.id)!)
        continue
      }
    }
    tree.push(map.get(label.id)!)
  }

  return tree
}

const MAX_CONCURRENT_GMAIL_FETCHES = 25

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
}

function extractPlaintext(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlaintext(part)
      if (text) return text
    }
  }
  return ""
}

function cleanBody(text: string): string {
  // Strip quoted-replies, signatures, and control chars. Don't strip quotes/apostrophes/$ —
  // those mangle legitimate content (prices, contractions) and prompt-injection defense
  // is already handled by JSON-wrapping the body in gemini.ts buildSystemInstruction.
  return text
    .split("\n")
    .filter((line) => !line.startsWith(">") && !/^On\s+.+\s+wrote:$/.test(line.trim()))
    .join("\n")
    .split(/\n-- ?\n/)[0]
    .split(/\n_{2,}\n/)[0]
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
}

export async function countInboxMessages(gmail: gmail_v1.Gmail, scope: "unread" | "read" | "both", userId?: string): Promise<number> {
  let q = "in:inbox"
  if (scope === "unread") q += " is:unread"
  else if (scope === "read") q += " is:read"

  if (userId) await checkGmailApiRateLimit(userId)

  const res = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 1,
  })
  return res.data.resultSizeEstimate ?? res.data.messages?.length ?? 0
}

export async function fetchInboxMessages(
  gmail: gmail_v1.Gmail,
  scope: "unread" | "read" | "both",
  userId?: string,
): Promise<EmailMessage[]> {
  let q = "in:inbox"
  if (scope === "unread") q += " is:unread"
  else if (scope === "read") q += " is:read"

  if (userId) await checkGmailApiRateLimit(userId)

  const res = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 200,
  })
  const messageIds = res.data.messages || []
  if (messageIds.length === 0) return []

  const { default: pLimit } = await import("p-limit")
  const limit = pLimit(MAX_CONCURRENT_GMAIL_FETCHES)

  const messages = await Promise.all(
    messageIds.map((m) =>
      limit(async () => {
        if (userId) await checkGmailApiRateLimit(userId)
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "full",
        })
        const headers = detail.data.payload?.headers || []
        const getHeader = (name: string) =>
          headers.find((h) => h.name === name)?.value || ""
        const rawBody = extractPlaintext(detail.data.payload!)
        return {
          id: detail.data.id!,
          threadId: detail.data.threadId!,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          fullBody: cleanBody(rawBody),
          date: getHeader("Date"),
          labelIds: detail.data.labelIds || [],
        }
      }),
    ),
  )
  return messages
}

export async function createGmailLabel(
  gmail: gmail_v1.Gmail,
  name: string,
  parentName?: string,
): Promise<GmailLabel> {
  const fullName = parentName ? `${parentName}/${name}` : name
  const res = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: fullName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  })
  return {
    id: res.data.id!,
    name: res.data.name!,
    type: res.data.type!,
    messageListVisibility: res.data.messageListVisibility ?? undefined,
    labelListVisibility: res.data.labelListVisibility ?? undefined,
    color: res.data.color
      ? { textColor: res.data.color.textColor!, backgroundColor: res.data.color.backgroundColor! }
      : undefined,
  }
}

export async function updateGmailLabel(
  gmail: gmail_v1.Gmail,
  labelId: string,
  newName: string,
): Promise<GmailLabel> {
  const res = await gmail.users.labels.update({
    userId: "me",
    id: labelId,
    requestBody: {
      name: newName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  })
  return {
    id: res.data.id!,
    name: res.data.name!,
    type: res.data.type!,
  }
}

export async function deleteGmailLabel(
  gmail: gmail_v1.Gmail,
  labelId: string,
): Promise<void> {
  await gmail.users.labels.delete({ userId: "me", id: labelId })
}

export async function applyLabel(
  gmail: gmail_v1.Gmail,
  messageId: string,
  labelId: string,
  archive = false,
): Promise<void> {
  const removeLabelIds: string[] = []
  if (archive) removeLabelIds.push("INBOX")

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: labelId !== "INBOX" ? [labelId] : [],
      removeLabelIds,
    },
  })
}

export async function applyLabelsBatch(
  gmail: gmail_v1.Gmail,
  operations: Array<{ messageId: string; labelId: string; archive: boolean }>,
  concurrency = 25,
  userId?: string,
): Promise<void> {
  const { default: pLimit } = await import("p-limit")
  const limit = pLimit(concurrency)

  await Promise.all(
    operations.map((op) =>
      limit(async () => {
        if (userId) await checkGmailApiRateLimit(userId)
        await applyLabel(gmail, op.messageId, op.labelId, op.archive)
      }),
    ),
  )
}

export async function fetchHistory(
  gmail: gmail_v1.Gmail,
  historyId: string,
): Promise<{ entries: gmail_v1.Schema$History[]; latestHistoryId: string }> {
  const res = await gmail.users.history.list({
    userId: "me",
    startHistoryId: historyId,
    historyTypes: ["messageAdded"],
  })
  return {
    entries: res.data.history || [],
    // res.data.historyId is the highest historyId Gmail has seen — resume from here
    // next time so we don't drop messages that arrived between webhook fire and fetch.
    latestHistoryId: res.data.historyId || historyId,
  }
}

export async function getFallbackLabel(
  userId: string,
): Promise<{ gmailLabelId: string; name: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { labels: true },
  })
  if (!user) throw new Error("User not found")
  if (!user.fallbackGmailLabelId) return null

  const label = user.labels.find((l) => l.gmailLabelId === user.fallbackGmailLabelId)
  if (!label) return null

  return { gmailLabelId: label.gmailLabelId, name: label.name }
}

export async function fetchMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<EmailMessage> {
  const detail = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  })
  const headers = detail.data.payload?.headers || []
  const getHeader = (name: string) =>
    headers.find((h) => h.name === name)?.value || ""
  const rawBody = extractPlaintext(detail.data.payload!)
  return {
    id: detail.data.id!,
    threadId: detail.data.threadId!,
    from: getHeader("From"),
    subject: getHeader("Subject"),
    fullBody: cleanBody(rawBody),
    date: getHeader("Date"),
    labelIds: detail.data.labelIds || [],
  }
}
