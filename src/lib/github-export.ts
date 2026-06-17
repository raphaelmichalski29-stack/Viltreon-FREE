import crypto from "crypto"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO

const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/
function validateGithubRepo(repo: string): void {
  if (!GITHUB_REPO_REGEX.test(repo)) {
    throw new Error(`Invalid GITHUB_REPO format — expected "owner/repo"`)
  }
}

// Audit finding L2: the GitHub log export was leaking raw email metadata
// (fromEmail, subject) — if the PAT was ever stolen, an attacker could read
// every user's email subjects. We now HMAC every identifying field with the
// encryption key as secret. The sender address is
// no longer stored at all (we don't retain who you correspond with), so it
// never reaches this export. Subject and AI reasoning are likewise absent
// from the stored log. The export keeps its model-evaluation utility
// (per-user buckets via hash collision) without exposing identities or content.
function hmacField(value: string): string {
  const secret = process.env.ENCRYPTION_KEY!
  return crypto.createHmac("sha256", secret).update(value).digest("hex").slice(0, 32)
}

interface GitHubExportResult {
  success: boolean
  path: string
  error?: string
}

export async function exportLogsToGitHub(
  logs: Array<{
    id: string
    userId: string
    labelApplied: string
    confidence: number
    modelUsed: string | null
    processedAt: Date
  }>,
): Promise<GitHubExportResult[]> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPO must be set")
  }
  validateGithubRepo(GITHUB_REPO)

  const scrubbed = logs.map((log) => ({
    id: log.id,
    userIdHash: hmacField(log.userId),
    labelApplied: log.labelApplied,
    confidence: log.confidence,
    modelUsed: log.modelUsed,
    processedAt: log.processedAt,
  }))

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  const dateStr = `${year}-${month}-${day}`
  const path = `logs/${year}/${month}/${dateStr}.json`

  const content = JSON.stringify(
    {
      exportedAt: now.toISOString(),
      schema: "v2-scrubbed",
      count: scrubbed.length,
      logs: scrubbed,
    },
    null,
    2,
  )

  const encoded = Buffer.from(content).toString("base64")

  const results: GitHubExportResult[] = []

  try {
    let sha: string | undefined

    const existingRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "viltreon-export",
        },
      },
    )

    if (existingRes.ok) {
      const existing = await existingRes.json()
      sha = existing.sha
    }

    const body: Record<string, unknown> = {
      message: `Export sorting logs for ${dateStr}`,
      content: encoded,
      sha,
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "viltreon-export",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const errBody = await res.text()
      results.push({
        success: false,
        path,
        error: `GitHub API error ${res.status}`,
      })
      return results
    }

    const data = await res.json()
    results.push({ success: true, path: data.content?.path || path })
  } catch (err) {
    results.push({
      success: false,
      path,
      error: err instanceof Error ? err.message : "Unknown error",
    })
  }

  return results
}
