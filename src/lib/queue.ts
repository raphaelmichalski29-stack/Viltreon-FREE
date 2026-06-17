import { ensureRedis } from "./redis"
import { bullQueue, bullWorker } from "./queue-bull"
import { memoryQueue, memoryWorker } from "./queue-memory"
import type { SortQueue, SortWorker } from "./queue-types"
export type { SortJobData, SortJobResult, QueueJobStatus } from "./queue-types"

let queueInstance: SortQueue | null = null
let workerInstance: SortWorker | null = null

async function getImpl(): Promise<{ queue: SortQueue; worker: SortWorker }> {
  if (await ensureRedis()) {
    return { queue: bullQueue, worker: bullWorker }
  }
  // If the operator explicitly configured REDIS_URL, treat an unreachable
  // Redis as a hard failure — not a silent downgrade to the per-process
  // memory queue. Otherwise the SSE endpoint asks worker B for a job that
  // worker A created and reports "Job not found" minutes later. We'd rather
  // surface the misconfiguration immediately.
  if (process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is configured but Redis is unreachable. Refusing to fall back to the per-process memory queue (jobs would be invisible across processes). Start Redis or unset REDIS_URL.",
    )
  }
  // `.trim()` defends against `set LOCAL_PROD_TEST=1 && ...` from cmd, which
  // assigns "1 " (trailing space) and breaks strict equality.
  if (process.env.NODE_ENV === "production" && (process.env.LOCAL_PROD_TEST || "").trim() !== "1") {
    throw new Error(
      "Redis is required in production. The in-memory queue is per-process and breaks under pm2 cluster mode (jobs created on one worker are invisible to others). Configure REDIS_URL and ensure Redis is reachable. (Set LOCAL_PROD_TEST=1 to bypass for local prod-build smoke tests.)",
    )
  }
  return { queue: memoryQueue, worker: memoryWorker }
}

export async function getQueue(): Promise<SortQueue> {
  if (queueInstance) return queueInstance
  const { queue } = await getImpl()
  queueInstance = queue
  return queue
}

export async function startWorker(): Promise<void> {
  const { worker } = await getImpl()
  workerInstance = worker
  worker.start()
}

export async function shutdownWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.shutdown()
    workerInstance = null
  }
}
