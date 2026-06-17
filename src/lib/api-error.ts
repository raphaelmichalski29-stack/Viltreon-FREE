import { NextResponse } from "next/server"

/**
 * Detect Google OAuth's `invalid_grant` — the refresh token was revoked or
 * expired. The frontend handles this with a "Reconnect your Gmail account"
 * prompt rather than a generic 500. Anything else stays 500 so we don't leak
 * internal details.
 */
function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as {
    response?: { data?: { error?: string } }
    message?: string
  }
  if (e.response?.data?.error === "invalid_grant") return true
  if (typeof e.message === "string" && e.message.toLowerCase().includes("invalid_grant")) return true
  return false
}

export function apiError(err: unknown, label: string, status = 500, publicMessage = "Internal server error") {
  console.error(`[${label}]`, err)

  if (isInvalidGrant(err)) {
    return NextResponse.json(
      { error: "Gmail access was revoked. Please reconnect your account.", code: "reconnect_required" },
      { status: 401 },
    )
  }

  return NextResponse.json({ error: publicMessage }, { status })
}
