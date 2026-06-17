import { Queue } from "bullmq"
import { bullConnection } from "@/lib/redis"
import { SORT_QUEUE_NAME } from "@/lib/queue-bull"

/**
 * Periodic queue-depth / failure-rate watcher.
 *
 * Doesn't auto-scale or auto-page — its job is to make problems visible in
 * the log stream so an on-call (or just a tail -f) can react. Thresholds
 * are deliberately conservative for a 5000-user deployment:
 *
 *   - waiting > 500   → WARN: backlog forming, throughput insufficient
 *   - waiting > 2000  → ERROR: production-grade backlog, intervene
 *   - failed delta > 50 in one minute → ERROR: something is systemically wrong
 *
 * Scheduled by src/worker.ts as a BullMQ repeatable job. Single-execution
 * via Redis lock so 12 worker processes don't all log the same line.
 */

const HEALTH_LOCK_KEY = "lock:queue-health-monitor"
const HEALTH_LOCK_TTL_SEC = 50 // less than the 60s schedule so one fires per minute

const WAITING_WARN = 500
const WAITING_CRITICAL = 2000
const FAILED_DELTA_CRITICAL = 50

let lastFailedCount = 0

let healthQueue: Queue | null = null
function getQueue(): Queue {
  if (healthQueue) return healthQueue
  healthQueue = new Queue(SORT_QUEUE_NAME, { ...bullConnection() })
  return healthQueue
}

export async function checkQueueHealth(): Promise<void> {
  const { redis, ensureRedis } = await import("@/lib/redis")
  const ok = await ensureRedis()
  if (!ok || !redis) return

  const acquired = await redis.set(HEALTH_LOCK_KEY, String(process.pid), "EX", HEALTH_LOCK_TTL_SEC, "NX")
  if (!acquired) return // another worker is doing the check this minute

  try {
    const queue = getQueue()
    const counts = await queue.getJobCounts("waiting", "active", "failed", "delayed", "completed")

    const waiting = counts.waiting ?? 0
    const active = counts.active ?? 0
    const failed = counts.failed ?? 0
    const delayed = counts.delayed ?? 0

    // Failure delta since last check. First run seeds the baseline so we
    // don't alert on the lifetime cumulative.
    const failedDelta = lastFailedCount === 0 ? 0 : failed - lastFailedCount
    lastFailedCount = failed

    const line = `[queue-health] waiting=${waiting} active=${active} delayed=${delayed} failed=${failed} (Δ${failedDelta >= 0 ? "+" : ""}${failedDelta})`

    if (waiting > WAITING_CRITICAL) {
      console.error(`${line} CRITICAL backlog`)
    } else if (waiting > WAITING_WARN) {
      console.warn(`${line} elevated backlog`)
    } else if (failedDelta > FAILED_DELTA_CRITICAL) {
      console.error(`${line} CRITICAL failure surge`)
    } else {
      console.log(line)
    }
  } catch (err) {
    console.error(
      "[queue-health] check failed:",
      err instanceof Error ? err.message : err,
    )
  }
}
