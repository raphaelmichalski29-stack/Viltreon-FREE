import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"
import { sanitizeSortingRules } from "@/lib/gemini"
import { maybeExpireTrial } from "@/lib/subscription"
import { getOrSet, cacheKey, invalidate } from "@/lib/cache"
import type { UserSettings } from "@/types"
import { z } from "zod"

// Short TTL: settings change rarely between dashboard tab switches but we
// want a recent state on every fresh dashboard load. 30s matches the
// subscription cache TTL — a cold dashboard load makes one Redis read, every
// quick toggle/navigation in the same minute hits cache.
const SETTINGS_CACHE_TTL_SEC = 30

const patchSchema = z.object({
  autoSortEnabled: z.boolean().optional(),
  archiveSorted: z.boolean().optional(),
  sortScope: z.enum(["unread", "read", "both"]).optional(),
  sortingRules: z.string().max(1000).nullable().optional(),
  fallbackGmailLabelId: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fire the trial-expiry writeback if applicable, BEFORE the cache. If a
    // trial is expiring this second, we WANT the cache to capture the
    // post-writeback state — not the pre-writeback one. Doing this outside
    // getOrSet means it always runs.
    await maybeExpireTrial(token.sub)

    const payload = await getOrSet(
      cacheKey("settings", token.sub),
      async () => {
        // Explicit projection so sensitive fields (geminiKeyEnc, stripeCustomerId,
        // stripeSubscriptionId) never enter the route handler in the first place.
        // Defense-in-depth against a future refactor that returns `user` verbatim.
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            autoSortEnabled: true,
            archiveSorted: true,
            sortScope: true,
            sortingRules: true,
            geminiKeyEnc: true, // not returned, but `!!user.geminiKeyEnc` used for hasGeminiKey
            gmailHistoryId: true,
            subscriptionStatus: true,
            subscriptionEndsAt: true,
            emailsProcessedThisMonth: true,
            fallbackGmailLabelId: true,
          },
        })

        if (!user) return null

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const [totalEmailsSorted, emailsSortedToday, googleAccount] = await Promise.all([
          prisma.sortingLog.count({ where: { userId: user.id } }),
          prisma.sortingLog.count({ where: { userId: user.id, processedAt: { gte: todayStart } } }),
          prisma.account.findFirst({
            where: { userId: user.id, provider: "google" },
            select: { access_token: true },
          }),
        ])

        const trialEndsAt = user.subscriptionStatus === "trialing" && user.subscriptionEndsAt
          ? user.subscriptionEndsAt.toISOString()
          : null

        const trialDaysRemaining = trialEndsAt
          ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0

        const settings: UserSettings = {
          autoSortEnabled: user.autoSortEnabled,
          archiveSorted: user.archiveSorted,
          sortScope: user.sortScope,
          sortingRules: user.sortingRules || undefined,
          hasGeminiKey: !!user.geminiKeyEnc,
          gmailConnected: !!googleAccount?.access_token,
          pushEnabled: !!user.gmailHistoryId,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() || null,
          trialDaysRemaining,
          emailsProcessedThisMonth: user.emailsProcessedThisMonth,
          fallbackGmailLabelId: user.fallbackGmailLabelId,
        }

        const timeSavedMinutes = Math.round(totalEmailsSorted * 0.25)
        const stats = { totalEmailsSorted, emailsSortedToday, timeSavedMinutes }

        return { settings, stats }
      },
      SETTINGS_CACHE_TTL_SEC,
    )

    if (!payload) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (err) {
    return apiError(err, "user/settings/GET")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "settings-update"), {
      maxRequests: 20,
      windowMs: 60_000,
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const data: Record<string, unknown> = {}

    if (parsed.data.autoSortEnabled !== undefined) data.autoSortEnabled = parsed.data.autoSortEnabled
    if (parsed.data.archiveSorted !== undefined) data.archiveSorted = parsed.data.archiveSorted
    if (parsed.data.sortScope !== undefined) data.sortScope = parsed.data.sortScope
    if (parsed.data.sortingRules !== undefined) {
      // Use the same sanitizer the prompt builder applies, so a value that
      // passes here is guaranteed not to be stripped to empty at classify time
      // (and vice versa — no silent divergence between validate and apply).
      if (parsed.data.sortingRules === null || parsed.data.sortingRules === "") {
        data.sortingRules = null
      } else {
        const cleaned = sanitizeSortingRules(parsed.data.sortingRules)
        if (!cleaned) {
          return NextResponse.json({ error: "Sorting rules contain prohibited patterns" }, { status: 400 })
        }
        data.sortingRules = cleaned
      }
    }
    if (parsed.data.fallbackGmailLabelId !== undefined) {
      if (parsed.data.fallbackGmailLabelId !== null) {
        const labelExists = await prisma.userLabel.findFirst({
          where: { userId: token.sub, gmailLabelId: parsed.data.fallbackGmailLabelId },
        })
        if (!labelExists) {
          return NextResponse.json({ error: "Label not found" }, { status: 400 })
        }
      }
      data.fallbackGmailLabelId = parsed.data.fallbackGmailLabelId
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({
        where: { id: token.sub },
        data,
      })
      // Drop the cached settings payload so the next GET re-reads from
      // Postgres. Otherwise the dashboard shows pre-PATCH state for up to
      // SETTINGS_CACHE_TTL_SEC after a toggle.
      await invalidate("settings", token.sub)
    }

    let pushWarning: string | undefined
    if (parsed.data.autoSortEnabled !== undefined) {
      try {
        const { getGmailClient } = await import("@/lib/gmail")
        const { setupGmailPush, stopGmailPush } = await import("@/lib/push-notifications")
        const gmail = await getGmailClient(token.sub)
        if (parsed.data.autoSortEnabled) {
          await setupGmailPush(token.sub, gmail)
        } else {
          await stopGmailPush(token.sub, gmail)
        }
      } catch (err) {
        // Push toggle is a best-effort side-effect — the settings row is already
        // saved. Surface the failure so the UI can warn the user instead of
        // silently lying that live sorting is on.
        const msg = err instanceof Error ? err.message : "Unknown error"
        console.error("[settings] Push watch toggle failed:", msg)
        pushWarning = `Settings saved, but live sort ${
          parsed.data.autoSortEnabled ? "could not be enabled" : "could not be disabled"
        }: ${msg}`
      }
    }

    return NextResponse.json({ success: true, ...(pushWarning ? { warning: pushWarning } : {}) })
  } catch (err) {
    return apiError(err, "user/settings/PATCH")
  }
}
