export interface GeminiClassification {
  labelId: string
  confidence: number
  reason: string
  modelUsed?: string
}

export interface GmailLabel {
  id: string
  name: string
  type: string
  messageListVisibility?: string
  labelListVisibility?: string
  color?: { textColor: string; backgroundColor: string }
  aiVisible?: boolean
  description?: string
}

export interface LabelUpdate {
  gmailLabelId: string
  aiVisible?: boolean
  description?: string
}

export interface EmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  fullBody: string
  date: string
  labelIds: string[]
}

export interface SortingResult {
  labelApplied: string
  confidence: number
  processedAt: string
}

export interface UserSettings {
  autoSortEnabled: boolean
  archiveSorted: boolean
  sortScope: string
  sortingRules?: string
  hasGeminiKey: boolean
  gmailConnected: boolean
  pushEnabled: boolean
  subscriptionStatus?: string | null
  subscriptionEndsAt?: string | null
  trialDaysRemaining?: number
  emailsProcessedThisMonth?: number
  fallbackGmailLabelId?: string | null
}

export interface DashboardStats {
  totalEmailsSorted: number
  emailsSortedToday: number
  timeSavedMinutes: number
}

export interface SortJobStatus {
  jobId: string
  status: "waiting" | "active" | "completed" | "failed" | "delayed"
  progress?: number
  result?: {
    processed: number
    labeled: number
    skipped: number
  } | null
  error?: string | null
}
