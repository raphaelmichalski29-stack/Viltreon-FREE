import { NextRequest, NextResponse } from "next/server"
import { getToken, invalidateToken } from "@/lib/secure-token"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { apiError } from "@/lib/api-error"

/**
 * Self-service account deletion (GDPR / CCPA right-to-erasure).
 *
 * Order is intentional: external services first (Stripe, Gmail watch), then
 * the User row. Cascading FKs in the Prisma schema clean up Account, Session,
 * UserLabel, SortingLog. Each external call is best-effort — if Stripe or
 * Gmail is unreachable, we still proceed so the user isn't trapped.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await checkRateLimit(rateLimitKey(token.sub, "delete-account"), {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 3/hour — destructive op, no need for higher
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { id: true },
    })
    if (!user) {
      // Already gone — make this idempotent.
      return NextResponse.json({ success: true })
    }

    // Stop Gmail push watch (best-effort). Use try/import so a Gmail outage
    //    or revoked token doesn't block deletion.
    try {
      const { getGmailClient } = await import("@/lib/gmail")
      const { stopGmailPush } = await import("@/lib/push-notifications")
      const gmail = await getGmailClient(user.id)
      await stopGmailPush(user.id, gmail)
    } catch (err) {
      console.error("[user.DELETE] Gmail watch stop failed (continuing):",
        err instanceof Error ? err.message : err)
    }

    // 2b) Revoke the Google OAuth grant so the app is removed from the user's
    //     "Third-party access" list. Must run AFTER stopping the watch (which
    //     needs a live token) and BEFORE deleting the row (the cascade removes
    //     the Account that holds the tokens). Best-effort.
    try {
      const { revokeGoogleAccess } = await import("@/lib/gmail")
      await revokeGoogleAccess(user.id)
    } catch (err) {
      console.error("[user.DELETE] Google access revoke failed (continuing):",
        err instanceof Error ? err.message : err)
    }

    // 3) Revoke the current session token so it can't be replayed.
    if (token.jti) {
      try {
        await invalidateToken(token.jti)
      } catch (err) {
        console.error("[user.DELETE] Token invalidate failed (continuing):",
          err instanceof Error ? err.message : err)
      }
    }

    // 4) Delete the User row. Cascade kills Account/Session/UserLabel/SortingLog.
    await prisma.user.delete({ where: { id: user.id } })

    // 5) Clear every NextAuth cookie variant. Without this, the deleted
    // user's browser still holds a session-token cookie until natural
    // expiry (30 days). The JWT is blacklisted server-side, so requests
    // would fail — but the user appears "still logged in" client-side
    // until they manually clear cookies or call signOut(). Belt-and-
    // suspenders: clear both the dev (`next-auth.*`) and the
    // HTTPS-prefixed production (`__Secure-…`, `__Host-…`) variants —
    // unused names are no-ops in the browser.
    const response = NextResponse.json({ success: true, signOutRequired: true })
    const cookieNames = [
      "next-auth.session-token",
      "next-auth.csrf-token",
      "next-auth.callback-url",
      "next-auth.pkce.code_verifier",
      "next-auth.state",
      "__Secure-next-auth.session-token",
      "__Host-next-auth.csrf-token",
      "__Secure-next-auth.callback-url",
      "__Secure-next-auth.pkce.code_verifier",
      "__Secure-next-auth.state",
    ]
    for (const name of cookieNames) {
      response.cookies.delete(name)
    }
    return response
  } catch (err) {
    return apiError(err, "user.DELETE")
  }
}
