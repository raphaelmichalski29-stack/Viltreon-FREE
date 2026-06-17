import { NextRequest, NextResponse } from "next/server"
import { getToken, invalidateToken } from "@/lib/secure-token"

/**
 * NextAuth-cookie names. We clear both dev (no prefix) and HTTPS
 * (`__Secure-` / `__Host-`) variants — unused names are no-ops in the
 * browser. NextAuth's own signOut() only expires session-token; the
 * csrf-token and callback-url cookies linger after logout otherwise.
 */
const NEXTAUTH_COOKIES = [
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

function clearAllNextAuthCookies(res: NextResponse): NextResponse {
  for (const name of NEXTAUTH_COOKIES) {
    res.cookies.delete(name)
  }
  return res
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token || !token.jti) {
      // Still clear cookies even if no session — the user may have a stale
      // cookie jar from a previous deployment with different secrets, and
      // this endpoint should be safe to call defensively.
      return clearAllNextAuthCookies(
        NextResponse.json({ error: "No valid session" }, { status: 401 }),
      )
    }

    await invalidateToken(token.jti)

    return clearAllNextAuthCookies(NextResponse.json({ success: true }))
  } catch {
    return clearAllNextAuthCookies(
      NextResponse.json({ error: "Failed to invalidate session" }, { status: 500 }),
    )
  }
}
