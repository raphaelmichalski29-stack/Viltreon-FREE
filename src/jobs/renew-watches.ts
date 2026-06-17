import { prisma } from "@/lib/db"
import { redis, ensureRedis } from "@/lib/redis"

/**
 * Re-register Gmail push watches for every user with auto-sort enabled.
 *
 * Google's `users.watch` expires after 7 days. Without renewal, live sorting
 * silently stops working for every user every week. Run this daily and the
 * watch is always within 24h of fresh.
 *
 * Best-effort per user: failures are logged but don't abort the batch. A
 * revoked OAuth token (`invalid_grant`) clears `autoSortEnabled` for the
 * affected user so we stop wasting calls on them; they re-auth from the
 * dashboard to resume live sort.
 *
 * Parallelized at concurrency 25 — at 5000 users this brings runtime from
 * ~42min sequential to ~100s. Each call only costs 1 Gmail quota unit so
 * project-wide quota is irrelevant; per-user quota is bounded by p-limit.
 *
 * Each user is guarded by a per-user Redis lock so two workers can't race
 * the same user (which would briefly orphan the previous watch). The lock
 * is 60s TTL — well past the slowest watch call we've observed.
 */

const RENEW_CONCURRENCY = 25
const PER_USER_LOCK_TTL_SEC = 60

function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { response?: { data?: { error?: string } }; message?: string }
  if (e.response?.data?.error === "invalid_grant") return true
  if (typeof e.message === "string" && e.message.toLowerCase().includes("invalid_grant")) return true
  return false
}

export async function renewGmailWatches(): Promise<{
  attempted: number
  renewed: number
  failed: number
  disabled: number
}> {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.PUBSUB_TOPIC_NAME) {
    console.log("[renew-watches] Pub/Sub not configured, skipping")
    return { attempted: 0, renewed: 0, failed: 0, disabled: 0 }
  }

  const users = await prisma.user.findMany({
    where: {
      autoSortEnabled: true,
      geminiKeyEnc: { not: null },
      accessDisabled: false,
    },
    select: { id: true },
  })

  if (users.length === 0) {
    return { attempted: 0, renewed: 0, failed: 0, disabled: 0 }
  }

  const { getGmailClient } = await import("@/lib/gmail")
  const { setupGmailPush } = await import("@/lib/push-notifications")
  const { default: pLimit } = await import("p-limit")

  const redisOk = await ensureRedis()
  const limit = pLimit(RENEW_CONCURRENCY)

  let renewed = 0
  let failed = 0
  let disabled = 0
  let skippedLocked = 0

  await Promise.all(
    users.map((user) =>
      limit(async () => {
        // Per-user lock prevents two workers (or a stale schedule re-fire) from
        // calling users.watch on the same user concurrently. The previous watch
        // would be orphaned and Gmail would briefly fire to a dead historyId.
        if (redisOk && redis) {
          const lockKey = `lock:renew-watch:${user.id}`
          const acquired = await redis.set(lockKey, "1", "EX", PER_USER_LOCK_TTL_SEC, "NX")
          if (!acquired) {
            skippedLocked++
            return
          }
        }

        try {
          const gmail = await getGmailClient(user.id)
          await setupGmailPush(user.id, gmail)
          renewed++
        } catch (err) {
          if (isInvalidGrant(err)) {
            // OAuth has been revoked. Stop pinging Gmail for this user every
            // day — they need to re-auth from the dashboard to opt back in.
            // We don't delete the user; their stats and labels survive.
            disabled++
            try {
              await prisma.user.update({
                where: { id: user.id },
                data: { autoSortEnabled: false, gmailHistoryId: null },
              })
              console.log(`[renew-watches] invalid_grant for ${user.id} — autoSortEnabled cleared`)
            } catch (updateErr) {
              console.error(
                `[renew-watches] Failed to disable ${user.id} after invalid_grant:`,
                updateErr instanceof Error ? updateErr.message : updateErr,
              )
            }
          } else {
            failed++
            const msg = err instanceof Error ? err.message : "Unknown error"
            console.error(`[renew-watches] Failed for ${user.id}: ${msg}`)
          }
        }
      }),
    ),
  )

  console.log(
    `[renew-watches] Done — attempted=${users.length} renewed=${renewed} failed=${failed} disabled=${disabled} skippedLocked=${skippedLocked}`,
  )
  return { attempted: users.length, renewed, failed, disabled }
}
