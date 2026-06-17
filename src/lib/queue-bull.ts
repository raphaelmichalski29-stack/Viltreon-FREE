import { Queue, Worker, Job } from "bullmq"
import { bullConnection } from "./redis"
import type { SortQueue, SortWorker, QueueJobStatus } from "./queue-types"
import type { SortJobData, SortJobResult } from "./queue-types"
import { processSortJob } from "./processor"

export const SORT_QUEUE_NAME = "email-sort"

// Local copy of api-error.ts's check. Importing api-error here would pull
// next/server into the standalone worker process, which runs outside Next.
function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { response?: { data?: { error?: string } }; message?: string }
  if (e.response?.data?.error === "invalid_grant") return true
  return typeof e.message === "string" && e.message.toLowerCase().includes("invalid_grant")
}

let queueInstance: Queue | null = null

function getQueueInstance(): Queue {
  if (queueInstance) return queueInstance
  queueInstance = new Queue(SORT_QUEUE_NAME, {
    ...bullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400, count: 5000 },
    },
  })
  return queueInstance
}

export const bullQueue: SortQueue = {
  async addInboxSort(userId: string): Promise<string> {
    const job = await getQueueInstance().add("inbox-sort", { userId, jobType: "inbox-sort" })
    return job.id as unknown as string
  },

  async addSingleSort(userId: string, messageId: string): Promise<string> {
    const job = await getQueueInstance().add("single-sort", { userId, jobType: "single-sort", messageId })
    return job.id as unknown as string
  },

  async getStatus(jobId: string): Promise<QueueJobStatus | null> {
    const job = await getQueueInstance().getJob(jobId)
    if (!job) return null

    const state = await job.getState()
    const jobData = job.data as SortJobData | undefined
    return {
      jobId,
      status: state as QueueJobStatus["status"],
      progress: job.progress,
      result: state === "completed" ? (job.returnvalue as SortJobResult | null) : null,
      error: state === "failed" ? job.failedReason : null,
      userId: jobData?.userId,
    }
  },
}

let workerInstance: Worker | null = null

export const bullWorker: SortWorker = {
  start() {
    if (workerInstance) return

    workerInstance = new Worker(
      SORT_QUEUE_NAME,
      async (job: Job) => {
        const data = job.data as SortJobData
        try {
          return await processSortJob(data)
        } catch (err) {
          // invalid_grant means the cached tokens are revoked — but after the
          // user reconnects, the DB already holds fresh ones. Drop the caches
          // so the BullMQ retry (attempts: 3) rebuilds the client from the DB
          // instead of failing every attempt on the same stale credentials.
          if (isInvalidGrant(err)) {
            const { invalidateGmailTokens } = await import("./gmail")
            await invalidateGmailTokens(data.userId).catch(() => {})
          }
          throw err
        }
      },
      {
        ...bullConnection(),
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5"),
        limiter: { max: parseInt(process.env.WORKER_MAX_RATE || "200"), duration: 1000 },
      },
    )

    workerInstance.on("failed", (job, err) => {
      console.error(`[bull-worker] Job ${job?.id} failed:`, err)
    })

    workerInstance.on("completed", (job) => {
      const r = job.returnvalue as SortJobResult | undefined
      console.log(`[bull-worker] Job ${job.id} done (${r?.labeled ?? 0} labeled, ${r?.skipped ?? 0} skipped)`)
    })

    console.log("[bull-worker] Started")
  },

  async shutdown() {
    if (workerInstance) {
      await workerInstance.close()
      workerInstance = null
    }
    if (queueInstance) {
      await queueInstance.close()
      queueInstance = null
    }
  },
}
