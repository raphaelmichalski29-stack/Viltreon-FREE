import { NextRequest, NextResponse } from "next/server"
import { getQueue } from "@/lib/queue"
import { getGmailClient } from "@/lib/gmail"
import { prisma } from "@/lib/db"
import { redis, ensureRedis } from "@/lib/redis"
import { verifyWebhookToken, verifyPubSubOidcToken } from "@/lib/push-notifications"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { checkSubscription } from "@/lib/subscription"
import { apiError } from "@/lib/api-error"
import { logger, requestIdFromHeaders } from "@/lib/logger"
import { z } from "zod"

const pubSubEnvelopeSchema = z.object({
  message: z.object({
    // messageId is required for idempotency — Pub/Sub has at-least-once
    // delivery semantics and will redeliver on a hiccup. Without a dedupe
    // store keyed on this, we'd run the same sort multiple times.
    messageId: z.string().optional(),
    data: z.string().min(1),
    attributes: z.object({
      verification_token: z.string().optional(),
    }).optional(),
  }).optional(),
})

const webhookDataSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.union([z.string(), z.number()]).transform(String),
})

// Outcome counter increments are best-effort; if Redis is unreachable we
// just skip them. Keys are namespaced under the app's REDIS_PREFIX (set
// elsewhere) so multiple deploys don't conflict.
const COUNTER_TTL_SEC = 60 * 60 * 24 * 7 // rolling 7-day window
async function recordOutcome(outcome: string): Promise<void> {
  try {
    const ok = await ensureRedis()
    if (!ok || !redis) return
    const key = `webhook:outcome:${outcome}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, COUNTER_TTL_SEC)
  } catch {
    // counters are observability, not load-bearing
  }
}

// 5-minute dedupe window. Pub/Sub's at-least-once retry typically completes
// within seconds, but if a worker hangs for several minutes during a job, a
// retry could fire mid-processing. 5 min is the documented Pub/Sub ack-
// extension limit, so duplicates beyond that are effectively impossible.
const DEDUPE_TTL_SEC = 300
async function isDuplicateDelivery(messageId: string): Promise<boolean> {
  const ok = await ensureRedis()
  if (!ok || !redis) return false // can't dedupe without Redis → fail open
  const key = `webhook:dedupe:${messageId}`
  const set = await redis.set(key, "1", "EX", DEDUPE_TTL_SEC, "NX")
  return set === null
}

export async function POST(request: NextRequest) {
  const log = logger("webhook.gmail", { requestId: requestIdFromHeaders(request.headers) })
  // Hoisted so the invalid_grant catch below can invalidate this user's
  // token caches — the catch is outside the block where `user` is declared.
  let webhookUserId: string | null = null
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0")
    if (contentLength > 1_048_576) {
      await recordOutcome("payload_too_large")
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    // Auth precedence (CASA tier 3 prefers OIDC):
    //   1. If PUBSUB_OIDC_AUDIENCE + PUBSUB_OIDC_SERVICE_ACCOUNT are set, require a
    //      Google-signed OIDC JWT in the Authorization header.
    //   2. Else if PUBSUB_VERIFICATION_TOKEN is set, accept the legacy shared-token
    //      sent as a Pub/Sub message attribute (checked after parse — it lives in
    //      the body).
    //   3. Else: fail closed. Production env validation refuses to boot without
    //      one of these set, but a dev/staging instance with neither would
    //      otherwise accept any unauthenticated POST — refuse instead.
    //
    // OIDC is header-based, so verify it BEFORE reading the body: an
    // unauthenticated caller is rejected with a correct 401 without us doing any
    // parsing work (previously an unparseable body threw a 500 from request.json
    // before auth ran at all).
    const oidcConfigured = !!(process.env.PUBSUB_OIDC_AUDIENCE && process.env.PUBSUB_OIDC_SERVICE_ACCOUNT)
    if (oidcConfigured) {
      const ok = await verifyPubSubOidcToken(request.headers.get("authorization"))
      if (!ok) {
        await recordOutcome("unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Guard the parse so a malformed body returns 400, not an unhandled 500.
    let body: unknown
    try {
      body = await request.json()
    } catch {
      await recordOutcome("bad_payload")
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    // For permanent-skip conditions (malformed payload, no subscription, decode failure)
    // we return 200. Pub/Sub treats any non-2xx as delivery failure and retries with
    // backoff — for conditions that will never succeed on retry, that's an endless loop.
    const envelopeParsed = pubSubEnvelopeSchema.safeParse(body)
    if (!envelopeParsed.success) {
      // Don't log the raw body — Pub/Sub envelopes can contain encoded email
      // data, and "envelope parse failed" with raw body in plaintext is a PII
      // leak. Log only structure (which keys were present) and the parse
      // error path.
      log.warn("envelope parse error", {
        bodyKeys: typeof body === "object" && body ? Object.keys(body) : [],
        zodIssues: envelopeParsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
      })
      await recordOutcome("bad_envelope")
      return NextResponse.json({ message: "Invalid Pub/Sub envelope, dropping" })
    }
    if (!envelopeParsed.data?.message?.data) {
      log.warn("missing message.data", {
        bodyKeys: typeof body === "object" && body ? Object.keys(body) : [],
      })
      await recordOutcome("bad_envelope")
      return NextResponse.json({ message: "Invalid Pub/Sub envelope, dropping" })
    }

    // Shared-token fallback, only when OIDC is not configured. The token is a
    // Pub/Sub message attribute, so this must run after the body is parsed.
    if (!oidcConfigured) {
      if (process.env.PUBSUB_VERIFICATION_TOKEN) {
        const verificationToken = envelopeParsed.data.message.attributes?.verification_token
        if (!verificationToken || !(await verifyWebhookToken(verificationToken))) {
          await recordOutcome("unauthorized")
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
      } else {
        log.error("no auth configured (neither PUBSUB_OIDC_* nor PUBSUB_VERIFICATION_TOKEN) — rejecting")
        await recordOutcome("misconfigured")
        return NextResponse.json({ error: "Webhook auth not configured" }, { status: 503 })
      }
    }

    // Pub/Sub idempotency check. Done AFTER auth so an attacker can't burn
    // through our dedupe keyspace with forged messageIds.
    const messageId = envelopeParsed.data.message.messageId
    if (messageId && (await isDuplicateDelivery(messageId))) {
      await recordOutcome("duplicate")
      return NextResponse.json({ message: "Duplicate delivery, acked" })
    }

    const decoded = Buffer.from(envelopeParsed.data.message.data, "base64").toString("utf-8")
    let emailAddress: string
    let historyId: string
    try {
      const parsed = webhookDataSchema.parse(JSON.parse(decoded))
      emailAddress = parsed.emailAddress
      historyId = parsed.historyId
    } catch {
      // Don't log the decoded body — it contains the user's email address
      // (PII). Log only the length to gauge if it was truncated/empty.
      log.warn("decode error", { decodedLength: decoded.length })
      await recordOutcome("bad_payload")
      return NextResponse.json({ message: "Invalid webhook data, dropping" })
    }

    // Single user lookup pulls every field we need for the rest of the path —
    // no separate query for gmailHistoryId later. Net saving: one Postgres
    // round-trip per webhook (~10-30ms on Neon). At 5000 users with sustained
    // 50/s, that's ~1.5s of saved DB time per second.
    const user = await prisma.user.findUnique({
      where: { email: emailAddress },
      select: {
        id: true,
        geminiKeyEnc: true,
        autoSortEnabled: true,
        gmailHistoryId: true,
      },
    })

    if (!user || !user.geminiKeyEnc) {
      await recordOutcome("unknown_user")
      return NextResponse.json({ message: "User not found or no API key, skipping" })
    }
    webhookUserId = user.id

    // checkSubscription has its own 30s Redis cache, so calling it on the
    // hot path is cheap (1-2ms typical). Keeping it serialized after the
    // user lookup because it needs user.id; the lookup itself can't run
    // before we know which user the webhook is for.
    const sub = await checkSubscription(user.id)
    if (!sub.allowed) {
      // Permanent-skip from Pub/Sub's point of view: a no-subscription user won't
      // become valid by retrying the same push. Return 200 to stop the retry storm.
      await recordOutcome("no_subscription")
      return NextResponse.json({ message: "Subscription required, skipping" })
    }

    if (!user.autoSortEnabled) {
      await recordOutcome("autosort_disabled")
      return NextResponse.json({ message: "Auto-sort disabled, skipping" })
    }

    const rateLimit = await checkRateLimit(rateLimitKey(user.id, "webhook"), {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      await recordOutcome("rate_limited")
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      )
    }

    const gmail = await getGmailClient(user.id)
    const { fetchHistory } = await import("@/lib/gmail")

    let entries
    let latestHistoryId: string
    try {
      const fetched = await fetchHistory(gmail, user.gmailHistoryId || historyId)
      entries = fetched.entries
      latestHistoryId = fetched.latestHistoryId
    } catch (err: any) {
      const isNotFound =
        err?.response?.status === 404 ||
        err?.errors?.[0]?.reason === "notFound" ||
        err?.message?.includes("not found")
      if (isNotFound) {
        log.info("stale historyId — clearing", { userId: user.id })
        await prisma.user.update({
          where: { id: user.id },
          data: { gmailHistoryId: null },
        })
        await recordOutcome("stale_history")
        return NextResponse.json({ message: "Stale historyId, cleared" })
      }
      throw err
    }

    const queue = await getQueue()
    // history.list is filtered by historyTypes: ["messageAdded"], so the precise field
    // is entry.messagesAdded[].message.id. entry.messages is a superset that can include
    // unrelated changes (label edits, etc) that we don't want to re-classify.
    const enqueued = await Promise.all(
      entries.flatMap((entry) =>
        (entry.messagesAdded || [])
          .map((m) => m.message?.id)
          .filter((id): id is string => !!id)
          .map((id) => queue.addSingleSort(user.id, id)),
      ),
    )

    // Skip the write when the history ID didn't advance — a no-op write still
    // serializes against any other concurrent update on the same row in Neon's
    // pooler. At sustained webhook traffic this is ~10 ms per fire saved.
    if (latestHistoryId && latestHistoryId !== user.gmailHistoryId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { gmailHistoryId: latestHistoryId },
      })
    }

    await recordOutcome("success")
    return NextResponse.json({ success: true, enqueued: enqueued.length })
  } catch (err) {
    const isInvalidGrant =
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { data?: { error?: string } } }).response?.data?.error === "invalid_grant"
    if (isInvalidGrant) {
      // Self-heal: the cached tokens are dead. Drop them (cluster-wide via
      // the epoch bump) so the next webhook for this user rebuilds from the
      // DB — which has fresh tokens once the user reconnects.
      if (webhookUserId) {
        const { invalidateGmailTokens } = await import("@/lib/gmail")
        await invalidateGmailTokens(webhookUserId).catch(() => {})
      }
      log.info("token expired/revoked — skipping")
      await recordOutcome("invalid_grant")
      return NextResponse.json({ message: "Token expired, skipping" })
    }
    await recordOutcome("error")
    return apiError(err, "gmail/webhook")
  }
}
