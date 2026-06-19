import type { SortJobData, SortJobResult } from "./queue"
import { getGmailClient, fetchInboxMessages, applyLabelsBatch, getFallbackLabel, fetchMessage, countInboxMessages } from "./gmail"
import { buildLabelsPrompt, buildSystemInstruction, classifyEmail } from "./gemini"
import type { GeminiClassification } from "@/types"
import { prisma } from "./db"
import { logger } from "./logger"
import type { UserLabel } from "@prisma/client"

const log = logger("processor")

function resolveLabelId(aiLabelId: string, labels: UserLabel[], fallbackId: string, validLabelIds?: Set<string>): string {
  if (!aiLabelId) return fallbackId
  if (validLabelIds && !validLabelIds.has(aiLabelId)) return fallbackId
  const match = labels.find((l) => l.gmailLabelId === aiLabelId)
  if (match) return match.gmailLabelId
  const byName = labels.find((l) => l.name.toLowerCase() === aiLabelId.toLowerCase())
  if (byName) return byName.gmailLabelId
  return fallbackId
}

export async function processSortJob(data: SortJobData): Promise<SortJobResult> {
  const { userId, jobType, messageId, archive: archiveOverride } = data

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { labels: true },
  })

  if (!user) throw new Error("User not found")
  if (!user.geminiKeyEnc) throw new Error("API key not configured")

  const gmail = await getGmailClient(user.id)
  const fallback = await getFallbackLabel(user.id)
  if (!fallback) throw new Error("No fallback label configured. Set one in Labels settings.")
  const archive = archiveOverride ?? user.archiveSorted
  const sortScope = user.sortScope || "unread" as string

  if (jobType !== "single-sort") {
    const count = await countInboxMessages(gmail, sortScope as "unread" | "read" | "both", user.id)
    if (count === 0) return { processed: 0, labeled: 0, skipped: 0 }
  }

  const labelsPrompt = buildLabelsPrompt(user.labels)
  const userName = user.name || "User"
  const systemInstruction = buildSystemInstruction(userName, labelsPrompt, user.sortingRules || undefined)

  const validLabelIds = new Set([...user.labels.map((l) => l.gmailLabelId), fallback.gmailLabelId])

  if (jobType === "single-sort" && messageId) {
    return processSingleEmail(gmail, user.geminiKeyEnc, systemInstruction, messageId, validLabelIds, fallback, archive, userId, user.labels)
  }

  return processInboxSort(gmail, user.geminiKeyEnc, systemInstruction, user.id, validLabelIds, fallback, archive, sortScope, user.labels)
}

async function processSingleEmail(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  apiKeyEnc: string,
  systemInstruction: string,
  messageId: string,
  _validLabelIds: Set<string>,
  fallback: { gmailLabelId: string; name: string },
  archive: boolean,
  userId: string,
  labels: UserLabel[],
): Promise<SortJobResult> {
  let email
  try {
    email = await fetchMessage(gmail, messageId)
  } catch (err) {
    // Silent skip used to mask all errors here — decryption failures (e.g.
    // after an ENCRYPTION_SALT rotation), Gmail 404s on deleted messages, and
    // OAuth 401s all looked identical to the user. Log so the cause is
    // diagnosable in the worker log.
    log.error("single.fetchMessage failed", {
      userId,
      gmailMessageId: messageId,
      reason: err instanceof Error ? err.message : String(err),
    })
    return { processed: 1, labeled: 0, skipped: 1 }
  }

  let result
  try {
    result = await classifyEmail(
      apiKeyEnc,
      systemInstruction,
      email.from,
      email.subject,
      email.fullBody,
      fallback.gmailLabelId,
      fallback.name,
    )
  } catch (err) {
    log.error("single.classifyEmail failed", {
      userId,
      gmailMessageId: messageId,
      reason: err instanceof Error ? err.message : String(err),
    })
    return { processed: 1, labeled: 0, skipped: 1 }
  }

  let safeLabelId = resolveLabelId(result.labelId, labels, fallback.gmailLabelId, _validLabelIds)
  let applied = false

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await applyLabelsBatch(gmail, [{ messageId: email.id, labelId: safeLabelId, archive }], 1, userId)
      applied = true
      break
    } catch {
      if (safeLabelId === fallback.gmailLabelId) {
        safeLabelId = "INBOX"
        try {
          await applyLabelsBatch(gmail, [{ messageId: email.id, labelId: safeLabelId, archive: false }], 1, userId)
          applied = true
        } catch {}
        break
      }
      safeLabelId = fallback.gmailLabelId
    }
  }

  if (!applied) {
    return { processed: 1, labeled: 0, skipped: 1 }
  }

  await prisma.sortingLog.create({
    data: {
      userId,
      labelApplied: safeLabelId,
      confidence: result.confidence,
      modelUsed: result.modelUsed,
    },
  })

  const isFallback = safeLabelId === fallback.gmailLabelId || safeLabelId === "INBOX"
  return { processed: 1, labeled: isFallback ? 0 : 1, skipped: isFallback ? 1 : 0 }
}

async function processInboxSort(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  apiKeyEnc: string,
  systemInstruction: string,
  userId: string,
  _validLabelIds: Set<string>,
  fallback: { gmailLabelId: string; name: string },
  archive: boolean,
  sortScope: string,
  labels: UserLabel[],
): Promise<SortJobResult> {
  const emails = await fetchInboxMessages(gmail, sortScope as "unread" | "read" | "both", userId)

  if (emails.length === 0) {
    return { processed: 0, labeled: 0, skipped: 0 }
  }

  let labeled = 0
  let skipped = 0
  const results: Array<{
    labelApplied: string
    confidence: number
  }> = []

  // Parallelize the per-email pipeline at concurrency 8. Each email does
  // classify (Groq, 1-3s) + applyLabel (Gmail, 200-500ms) + DB write. Running
  // sequentially, a 200-message inbox takes ~5 min; at concurrency 8 it
  // drops to ~40 sec. The cap is intentional:
  //   - Per-user Groq throttling on free tier (30/min) caps useful parallelism
  //     to roughly 8-10 before requests start serializing on the rate-limit
  //   - applyLabelsBatch already has its own p-limit(25) for the Gmail call,
  //     so we don't double-parallelize the bottleneck API
  //   - Worker process memory: each in-flight classify holds ~10MB; 8 × 10
  //     leaves room for other concurrent jobs on the same process
  const { default: pLimit } = await import("p-limit")
  const perEmailLimit = pLimit(8)

  await Promise.all(
    emails.map((email) =>
      perEmailLimit(async () => {
        let classification: GeminiClassification
        try {
          classification = await classifyEmail(
            apiKeyEnc,
            systemInstruction,
            email.from,
            email.subject,
            email.fullBody,
            fallback.gmailLabelId,
            fallback.name,
          )
        } catch (err) {
          log.error("batch.classifyEmail failed", {
            userId,
            gmailMessageId: email.id,
            reason: err instanceof Error ? err.message : String(err),
          })
          classification = { labelId: fallback.gmailLabelId, confidence: 0, reason: "Classification failed" }
        }

        let safeLabelId = resolveLabelId(classification.labelId, labels, fallback.gmailLabelId, _validLabelIds)
        let applied = false

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await applyLabelsBatch(gmail, [{ messageId: email.id, labelId: safeLabelId, archive }], 1, userId)
            applied = true
            break
          } catch {
            if (safeLabelId === fallback.gmailLabelId) {
              safeLabelId = "INBOX"
              try {
                await applyLabelsBatch(gmail, [{ messageId: email.id, labelId: safeLabelId, archive: false }], 1, userId)
                applied = true
              } catch {}
              break
            }
            safeLabelId = fallback.gmailLabelId
          }
        }

        if (!applied) {
          skipped++
          return
        }

        const isFallback = safeLabelId === fallback.gmailLabelId || safeLabelId === "INBOX"

        try {
          await prisma.sortingLog.create({
            data: {
              userId,
              labelApplied: safeLabelId,
              confidence: classification.confidence,
              modelUsed: classification.modelUsed,
            },
          })
        } catch (err) {
          log.error("batch.sortingLog write failed", {
            userId,
            gmailMessageId: email.id,
            reason: err instanceof Error ? err.message : String(err),
          })
        }

        if (isFallback) skipped++
        else labeled++

        results.push({
          labelApplied: safeLabelId,
          confidence: classification.confidence,
        })
      }),
    ),
  )

  return { processed: emails.length, labeled, skipped, results }
}
