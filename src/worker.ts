import "dotenv/config"
import { Queue, Worker } from "bullmq"
import { startWorker } from "@/lib/queue"
import { prisma } from "@/lib/db"
import { ensureRedis, bullConnection, redis } from "@/lib/redis"
import { renewGmailWatches } from "@/jobs/renew-watches"
import { checkQueueHealth } from "@/jobs/queue-health-monitor"

async function setupPushWatches() {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.PUBSUB_TOPIC_NAME) {
    console.log("[worker] Pub/Sub not configured, skipping push watch setup")
    return
  }

  // With 12 worker processes, every restart would hit Gmail with 12 concurrent
  // stop+watch calls per user. Use a Redis lock so only one process does it.
  if (!(await ensureRedis()) || !redis) {
    console.log("[worker] No Redis lock available, skipping push watch setup")
    return
  }
  const acquired = await redis.set("lock:setup-push-watches", String(process.pid), "EX", 300, "NX")
  if (!acquired) {
    console.log("[worker] Push watch setup already claimed by another worker, skipping")
    return
  }

  try {
    const users = await prisma.user.findMany({
      where: { autoSortEnabled: true, geminiKeyEnc: { not: null } },
      select: { id: true },
    })

    if (users.length === 0) {
      console.log("[worker] No users with auto-sort enabled, skipping push watch setup")
      return
    }

    const { getGmailClient } = await import("@/lib/gmail")
    const { setupGmailPush } = await import("@/lib/push-notifications")

    for (const user of users) {
      try {
        const gmail = await getGmailClient(user.id)
        await setupGmailPush(user.id, gmail)
        console.log(`[worker] Push watch activated for ${user.id}`)
      } catch (err: any) {
        console.log(`[worker] Failed to set up push watch for ${user.id}: ${err.message}`)
      }
    }
  } catch (err: any) {
    console.log(`[worker] Error setting up push watches: ${err.message}`)
  }
}

let renewWorker: Worker | null = null
let renewQueue: Queue | null = null
let healthWorker: Worker | null = null
let healthQueue: Queue | null = null

async function setupQueueHealthMonitor() {
  try {
    healthQueue = new Queue("queue-health", {
      ...bullConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 600 }, // 10min — short, this fires every 60s
        removeOnFail: { age: 3600 },
      },
    })

    // Every 60s. Internal Redis lock in checkQueueHealth ensures only one
    // of the 12 worker processes does the actual check per minute.
    await healthQueue.upsertJobScheduler(
      "queue-health-tick",
      { pattern: "* * * * *" },
      { name: "queue-health-check", data: {} },
    )

    healthWorker = new Worker(
      "queue-health",
      async () => {
        await checkQueueHealth()
      },
      { ...bullConnection() },
    )

    console.log("[worker] Queue health monitor scheduled (every 60s)")
  } catch (err) {
    console.log(
      `[worker] Failed to schedule queue health monitor: ${err instanceof Error ? err.message : err}`,
    )
  }
}

async function setupWatchRenewScheduler() {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.PUBSUB_TOPIC_NAME) {
    console.log("[worker] Pub/Sub not configured — skipping watch renewal schedule")
    return
  }

  try {
    renewQueue = new Queue("watch-renew", {
      ...bullConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 86400 },
      },
    })

    // Daily at 02:00 UTC. Watches last 7 days, so renewing once a day means
    // a watch is at worst ~24h old before it gets a fresh 7-day lease.
    await renewQueue.upsertJobScheduler("daily-watch-renew", {
      pattern: "0 2 * * *",
    }, {
      name: "renew-gmail-watches",
      data: {},
    })

    renewWorker = new Worker(
      "watch-renew",
      async () => {
        console.log("[watch-renew] Starting daily Gmail watch renewal...")
        const result = await renewGmailWatches()
        console.log(
          `[watch-renew] Done — attempted=${result.attempted} renewed=${result.renewed} failed=${result.failed}`,
        )
      },
      { ...bullConnection() },
    )

    console.log("[worker] Daily Gmail watch renewal scheduled (2:00 AM UTC)")
  } catch (err) {
    console.log(`[worker] Failed to schedule watch renewal: ${err instanceof Error ? err.message : err}`)
  }
}

async function main() {
  console.log("[worker] Starting...")

  const redisOk = await ensureRedis()
  console.log(`[worker] Redis: ${redisOk ? "connected" : "unavailable (using in-memory fallback)"}`)

  await startWorker()

  setupPushWatches()

  if (redisOk) {
    await setupWatchRenewScheduler()
    await setupQueueHealthMonitor()
  }

  console.log("[worker] Ready")

  // Shared cleanup for both SIGTERM and SIGINT. Keeping in one place avoids
  // the two handlers drifting out of sync as we add more schedulers.
  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} received, shutting down...`)
    const { shutdownWorker } = await import("@/lib/queue")
    await shutdownWorker()
    const closers: Array<{ name: string; close: () => Promise<unknown> | unknown }> = [
      { name: "renewWorker", close: () => renewWorker?.close() },
      { name: "renewQueue", close: () => renewQueue?.close() },
      { name: "healthWorker", close: () => healthWorker?.close() },
      { name: "healthQueue", close: () => healthQueue?.close() },
    ]
    for (const c of closers) {
      try {
        await c.close()
      } catch (err) {
        console.error(`[worker] ${c.name} close failed:`, err instanceof Error ? err.message : err)
      }
    }
    renewWorker = null
    renewQueue = null
    healthWorker = null
    healthQueue = null
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((err) => {
  console.error("[worker] Fatal:", err)
  process.exit(1)
})
