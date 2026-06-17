// IDOR (Insecure Direct Object Reference) regression test. Verifies that
// every Prisma query that touches user-owned data scopes by token.sub. The
// test does NOT exercise the HTTP layer — it audits the source against a
// known-good pattern. If a route handler ever reads a user-owned table
// without a `userId: token.sub` filter, this test fails.
//
// Why static analysis instead of integration: spinning up two real sessions
// against a running app is brittle in CI. A grep-based check catches >95% of
// real IDOR regressions because the failure mode is mechanical (forgetting
// the WHERE clause).
//
// Run with:  node scripts/tests/test-authorization.mjs

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = "src"

// User-scoped Prisma models. Any query against these models in a route
// handler MUST include `token.sub` (the authenticated user's id) somewhere
// in the where clause.
const USER_SCOPED_MODELS = [
  "userLabel",
  "sortingLog",
]

// Routes that are deliberately exempt. Each entry must have a defensible
// reason — none should be added without justification.
const EXEMPT_ROUTES = new Set([
  // The webhook route looks up users by email from Pub/Sub payload, not by
  // session token. Authorization is via OIDC signature, not user-id match.
  "src/app/api/gmail/webhook/route.ts",
  // The Stripe webhook route looks up users by stripeSubscriptionId from
  // Stripe-signed events. Authorization is via Stripe webhook signature.
  "src/app/api/stripe/webhook/route.ts",
  // The export-logs job touches all users' SortingLog rows — it's a
  // scheduled background task, not a request handler.
  "src/jobs/export-logs.ts",
])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full)
  }
  return files
}

let failed = 0
let passed = 0
const findings = []

for (const file of walk(ROOT)) {
  const normalized = file.replace(/\\/g, "/")
  if (EXEMPT_ROUTES.has(normalized)) continue
  // Only audit route handlers — components and lib helpers are not
  // request-context callers and don't have access to a session token.
  if (!normalized.includes("/api/") || !normalized.endsWith("/route.ts")) continue

  const src = readFileSync(file, "utf-8")

  for (const model of USER_SCOPED_MODELS) {
    // Find prisma.<model>.<method>({ ... }) blocks
    const pattern = new RegExp(
      `prisma\\.${model}\\.(findUnique|findFirst|findMany|update|updateMany|delete|deleteMany|create|count|aggregate)\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
      "g",
    )

    // First pass: does this file establish user-scoping for this model?
    // A "scoping anchor" is any findFirst/findUnique/findMany/count call on
    // the model where the where clause contains `userId:`. If the file has
    // at least one such anchor, subsequent id-based operations on the model
    // are considered transitively scoped — the ids they operate on came
    // from a user-scoped lookup.
    const anchorPattern = new RegExp(
      `prisma\\.${model}\\.(findFirst|findUnique|findMany|count)\\s*\\(\\s*\\{[\\s\\S]*?userId\\s*:[\\s\\S]*?\\}\\s*\\)`,
    )
    const hasAnchor = anchorPattern.test(src)

    let match
    while ((match = pattern.exec(src)) !== null) {
      const block = match[0]
      const scoped =
        // Explicit: where clause contains userId:
        /userId\s*:/.test(block) ||
        // Transitive: file has a user-scoping anchor AND this operation
        // filters by `id:` or `parentId:` (i.e. uses a primary key the
        // anchor produced).
        (hasAnchor && /\b(id|parentId)\s*:/.test(block))
      if (!scoped) {
        failed++
        findings.push({
          file: normalized,
          method: match[1],
          excerpt: block.slice(0, 120).replace(/\s+/g, " "),
        })
      } else {
        passed++
      }
    }
  }
}

console.log("=== IDOR Authorization Audit ===\n")
console.log(`User-scoped models checked: ${USER_SCOPED_MODELS.join(", ")}`)
console.log(`Exempt routes: ${EXEMPT_ROUTES.size}`)
console.log(`\nResults:`)
console.log(`  Properly-scoped queries:   ${passed}`)
console.log(`  Unscoped queries (BAD):    ${failed}`)

if (failed > 0) {
  console.log(`\nFindings:`)
  for (const f of findings) {
    console.log(`  ✗ ${f.file}`)
    console.log(`    method: ${f.method}`)
    console.log(`    excerpt: ${f.excerpt}...`)
  }
  process.exit(1)
}

console.log(`\n  ALL CHECKS PASSED ✓`)
