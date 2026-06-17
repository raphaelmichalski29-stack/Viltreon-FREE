/**
 * Structured logger with PII scrubbing.
 *
 * Why custom (vs pino, winston, etc.):
 *   - Zero new dependency. The project already pushes ~4 GB in dev; pino's
 *     transports stack adds another tree of native deps for the worker box.
 *   - Tight control over what gets redacted. We KNOW which fields in our
 *     data shape carry PII; an off-the-shelf logger doesn't.
 *   - Same surface (`log.info("...", { fields })`) — easy to swap to pino
 *     later if we ever need its transports + sampling features.
 *
 * In development: pretty-printed lines to stdout via console.log.
 * In production:  one-line JSON per entry (`process.stdout.write`), parseable
 *                 by any log shipper (Vector, Fluent Bit, Datadog Agent, etc.).
 *
 * PII redaction is opt-OUT — every nested key whose name matches a sensitive
 * pattern gets replaced with "[REDACTED]" in production. Add to
 * SENSITIVE_FIELD_RE if you introduce new sensitive field names.
 */

import { randomUUID } from "node:crypto"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  requestId?: string
  userId?: string
  jobId?: string
  // Free-form extras callers can attach. Subject to scrubbing.
  [key: string]: unknown
}

// Field names that may carry PII. Match is case-insensitive AND substring —
// `userEmail`, `from_email`, `fromEmailAddress` all match. Add new patterns
// here as the schema evolves.
const SENSITIVE_FIELD_RE =
  /(password|token|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|gemini[_-]?key|stripe[_-]?customer|stripe[_-]?subscription|authorization|cookie|session|email|subject|body|snippet|from[_-]?email|to[_-]?email|recipient)/i

// Cap recursion in case someone logs `prisma` or similar with circular refs.
const MAX_DEPTH = 5

function scrubValue(key: string, value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]"
  if (value === null || value === undefined) return value
  if (SENSITIVE_FIELD_RE.test(key)) return "[REDACTED]"

  if (typeof value === "string") {
    // Catch tokens/keys passed as bare values where the key name didn't match
    // (e.g. someone logs `apiKey` value under a misleading key name). Bearer
    // tokens, JWTs, and Stripe keys all match these patterns.
    if (/^(Bearer\s|sk_|whsec_|gsk_|GOCSPX-|ghp_|eyJ)/.test(value)) {
      return "[REDACTED-token-like]"
    }
    return value
  }

  if (typeof value !== "object") return value

  if (Array.isArray(value)) {
    return value.map((v, i) => scrubValue(String(i), v, depth + 1))
  }

  // Plain object — recurse.
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubValue(k, v, depth + 1)
  }
  return out
}

function shouldScrub(): boolean {
  // Production scrubs aggressively. Dev keeps raw values for debuggability.
  // Override with LOG_SCRUB=1 to scrub locally (useful for testing).
  if (process.env.LOG_SCRUB === "1") return true
  return process.env.NODE_ENV === "production"
}

function emit(level: LogLevel, service: string, message: string, fields: Record<string, unknown> | undefined, context: LogContext) {
  const scrub = shouldScrub()
  const merged = { ...context, ...(fields || {}) }
  const scrubbed = scrub
    ? (scrubValue("", merged, 0) as Record<string, unknown>)
    : merged

  if (process.env.NODE_ENV !== "production") {
    // Pretty-print in dev. console.log keeps the existing visual flow.
    const ctxStr = context.requestId ? ` (req=${context.requestId.slice(0, 8)})` : ""
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log
    if (Object.keys(scrubbed).length === 0) {
      fn(`[${level.toUpperCase()}] [${service}]${ctxStr} ${message}`)
    } else {
      fn(`[${level.toUpperCase()}] [${service}]${ctxStr} ${message}`, scrubbed)
    }
    return
  }

  // Production: single-line JSON to stdout. Log shipper parses.
  const record = {
    ts: new Date().toISOString(),
    level,
    service,
    message,
    ...scrubbed,
  }
  try {
    process.stdout.write(JSON.stringify(record) + "\n")
  } catch {
    // Last-resort fallback — never throw from the logger.
    process.stdout.write(`{"level":"error","service":"logger","message":"emit failed","ts":"${new Date().toISOString()}"}\n`)
  }
}

export interface Logger {
  debug: (message: string, fields?: Record<string, unknown>) => void
  info: (message: string, fields?: Record<string, unknown>) => void
  warn: (message: string, fields?: Record<string, unknown>) => void
  error: (message: string, fields?: Record<string, unknown>) => void
  /** Returns a new logger that inherits this one's context plus the given extras. */
  child: (extra: LogContext) => Logger
}

export function logger(service: string, context: LogContext = {}): Logger {
  return {
    debug: (m, f) => emit("debug", service, m, f, context),
    info: (m, f) => emit("info", service, m, f, context),
    warn: (m, f) => emit("warn", service, m, f, context),
    error: (m, f) => emit("error", service, m, f, context),
    child: (extra) => logger(service, { ...context, ...extra }),
  }
}

/**
 * Generate a request ID. Use at the entry point of every HTTP request that
 * doesn't already have one in `x-request-id`.
 */
export function generateRequestId(): string {
  return randomUUID()
}

/**
 * Extract or create a request ID from incoming headers. Use to chain context
 * across services that propagate `x-request-id`.
 */
export function requestIdFromHeaders(headers: Headers | Record<string, string | undefined>): string {
  const existing = headers instanceof Headers ? headers.get("x-request-id") : headers["x-request-id"]
  return existing && /^[a-zA-Z0-9-]{8,128}$/.test(existing) ? existing : generateRequestId()
}
