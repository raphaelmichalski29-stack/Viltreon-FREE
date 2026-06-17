export interface SortJobData {
  userId: string
  jobType: "inbox-sort" | "single-sort"
  messageId?: string
  archive?: boolean
}

export interface SortJobResult {
  processed: number
  labeled: number
  skipped: number
  results?: Array<{
    labelApplied: string
    confidence: number
  }>
}

export interface QueueJobStatus {
  jobId: string
  status: "waiting" | "active" | "completed" | "failed" | "delayed"
  progress?: number | string | boolean | object
  result?: SortJobResult | null
  error?: string | null
  userId?: string
}

export interface SortQueue {
  addInboxSort(userId: string): Promise<string>
  addSingleSort(userId: string, messageId: string): Promise<string>
  getStatus(jobId: string): Promise<QueueJobStatus | null>
}

export interface SortWorker {
  start(): void
  shutdown(): Promise<void>
}
