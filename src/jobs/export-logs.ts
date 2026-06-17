import { prisma } from "@/lib/db"
import { exportLogsToGitHub } from "@/lib/github-export"

const BATCH_SIZE = 1000

export async function exportSortingLogs(): Promise<{
  exported: number
  failed: boolean
  error?: string
}> {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log("[export-logs] GitHub not configured, skipping")
    return { exported: 0, failed: false }
  }

  let totalExported = 0
  let cursor: string | undefined

  try {
    while (true) {
      const logs = await prisma.sortingLog.findMany({
        where: { exportedAt: null },
        take: BATCH_SIZE,
        orderBy: { processedAt: "asc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })

      if (logs.length === 0) break

      const results = await exportLogsToGitHub(logs)
      const allSucceeded = results.every((r) => r.success)

      if (!allSucceeded) {
        const errors = results.filter((r) => !r.success).map((r) => r.error)
        console.error(`[export-logs] GitHub upload failed: ${errors.join("; ")}`)
        return { exported: totalExported, failed: true, error: errors.join("; ") }
      }

      await prisma.$transaction(
        logs.map((log) =>
          prisma.sortingLog.update({
            where: { id: log.id },
            data: { exportedAt: new Date() },
          }),
        ),
      )

      totalExported += logs.length
      cursor = logs[logs.length - 1].id

      console.log(`[export-logs] Exported ${totalExported} logs so far`)
    }

    if (totalExported > 0) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const deleted = await prisma.sortingLog.deleteMany({
        where: { exportedAt: { not: null }, processedAt: { lt: cutoff } },
      })
      console.log(`[export-logs] Pruned ${deleted.count} old exported logs`)
    }

    console.log(`[export-logs] Done — ${totalExported} logs exported`)
    return { exported: totalExported, failed: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error(`[export-logs] Error: ${msg}`)
    return { exported: totalExported, failed: true, error: msg }
  }
}
