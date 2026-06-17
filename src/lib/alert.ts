/**
 * Minimal, dependency-free error alerting.
 *
 * If ALERT_WEBHOOK_URL is set, sendAlert() POSTs a short, scrubbed summary to
 * it. The body shape ({ text, content }) is what Slack and Discord incoming
 * webhooks accept, so either works out of the box.
 *
 * Design notes:
 *   - Inert and zero-cost when ALERT_WEBHOOK_URL is unset (the common case).
 *   - Fire-and-forget: never throws, never blocks the caller, 3s timeout.
 *   - This is the "alerting" layer the readiness audit flagged as missing. It
 *     is deliberately NOT a full APM — no grouping, traces, or dashboards.
 *     Wire in Sentry/Datadog if you outgrow a webhook ping.
 */

// Strip the two PII shapes most likely to appear in a raw error string: email
// addresses and known secret-token formats. Alerts go to an external endpoint,
// so this runs regardless of NODE_ENV.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const TOKEN_RE =
  /(sk_[a-z]+_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|gsk_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+|GOCSPX-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g

function scrubText(s: string): string {
  return s.replace(EMAIL_RE, "[email]").replace(TOKEN_RE, "[redacted]")
}

export function sendAlert(title: string, error?: unknown): void {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return

  const lines = [`[Viltreon] ${title}`]
  if (error instanceof Error) {
    lines.push(scrubText(`${error.name}: ${error.message}`))
    if (error.stack) {
      // First few frames are enough to locate the failure; keep the alert short.
      for (const frame of error.stack.split("\n").slice(1, 4)) {
        lines.push(scrubText(frame.trim()))
      }
    }
  } else if (error !== undefined && error !== null) {
    lines.push(scrubText(String(error)))
  }

  const text = lines.join("\n")
  const body = JSON.stringify({ text, content: text })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: controller.signal,
  })
    .catch(() => {
      // Alerting must never cascade into another failure. Swallow.
    })
    .finally(() => clearTimeout(timer))
}
