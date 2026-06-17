import type { SortQueue, SortWorker, QueueJobStatus, SortJobData, SortJobResult } from "./queue-types"
import { processSortJob } from "./processor"

const MAX_JOB_AGE = 60 * 60 * 1000
const JOBS_CLEANUP_INTERVAL = 10 * 60 * 1000

const jobs = new Map<string, {
  id: string
  data: SortJobData
  status: "waiting" | "active" | "completed" | "failed"
  result: SortJobResult | null
  error: string | null
  createdAt: number
}>()

let nextId = 1

let cleanupTimer: ReturnType<typeof setInterval> | null = null
function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - MAX_JOB_AGE
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff) {
        jobs.delete(id)
      }
    }
  }, JOBS_CLEANUP_INTERVAL)
}

async function processJob(jobId: string, data: SortJobData): Promise<void> {
  const entry = jobs.get(jobId)
  if (!entry) return
  entry.status = "active"

  try {
    const result = await processSortJob(data)
    entry.status = "completed"
    entry.result = result
  } catch (err) {
    entry.status = "failed"
    entry.error = err instanceof Error ? err.message : "Unknown error"
  }
}

export const memoryQueue: SortQueue = {
  async addInboxSort(userId: string): Promise<string> {
    ensureCleanup()
    const id = String(nextId++)
    const data: SortJobData = { userId, jobType: "inbox-sort" }
    jobs.set(id, { id, data, status: "waiting", result: null, error: null, createdAt: Date.now() })
    processJob(id, data)
    return id
  },

  async addSingleSort(userId: string, messageId: string): Promise<string> {
    ensureCleanup()
    const id = String(nextId++)
    const data: SortJobData = { userId, jobType: "single-sort", messageId }
    jobs.set(id, { id, data, status: "waiting", result: null, error: null, createdAt: Date.now() })
    processJob(id, data)
    return id
  },

  async getStatus(jobId: string): Promise<QueueJobStatus | null> {
    const job = jobs.get(jobId)
    if (!job) return null
    return {
      jobId: job.id,
      status: job.status === "failed" ? "failed" : job.status === "completed" ? "completed" : "active",
      result: job.result,
      error: job.error,
      userId: job.data.userId,
    }
  },
}

export const memoryWorker: SortWorker = {
  start() {
    // memory worker processes inline — no-op
  },
  async shutdown() {
    jobs.clear()
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }
  },
}
