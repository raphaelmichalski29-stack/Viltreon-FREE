import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

function buildCsp(nonce: string): string {
  // strict-dynamic lets scripts loaded by trusted (nonce'd) scripts inherit trust —
  // needed for Next.js framework chunks. Removes the need for an explicit allowlist
  // of script origins. style-src keeps 'unsafe-inline' because Tailwind/shadcn emit
  // dynamic style attributes; style-based XSS is bounded.
  const scriptSrc = process.env.NODE_ENV === "development"
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://oauth2.googleapis.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}

function applyCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp)
  return response
}

/**
 * Stop the browser from serving authenticated pages out of its back/forward
 * cache. Without this, hitting the Back button after logout shows the previous
 * authenticated render — stale state, leftover banners, etc. Applied on dynamic
 * routes only; static assets are still cacheable.
 */
function applyNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, must-revalidate, private")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  return response
}

export async function proxy(req: NextRequest) {
  const nonce = crypto.randomBytes(16).toString("base64")
  const csp = buildCsp(nonce)

  // Make the nonce available to RSC/server components via request headers —
  // Next.js auto-injects this into <Script> components and framework chunks.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)

  // Generate a request ID if the incoming request doesn't already have one.
  // Downstream route handlers create a `logger.child({ requestId })` so all
  // logs from one request can be correlated end-to-end (webhook → queue →
  // worker → Gmail apply). External clients can also pass their own.
  const incomingReqId = req.headers.get("x-request-id")
  const requestId =
    incomingReqId && /^[a-zA-Z0-9-]{8,128}$/.test(incomingReqId)
      ? incomingReqId
      : crypto.randomUUID()
  requestHeaders.set("x-request-id", requestId)

  const pass = () =>
    applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp)

  const { headers, nextUrl } = req
  const path = nextUrl.pathname

  // Defense-in-depth HTTPS redirect. Only fires in production; nginx in front
  // should normally redirect HTTP→HTTPS already, but this catches the case where
  // a misconfigured proxy forwards plain HTTP to the app. Localhost is exempt
  // so `next start` works for local production-mode smoke tests without needing
  // a TLS terminator in front.
  if (process.env.NODE_ENV === "production" && headers.get("x-forwarded-proto") !== "https") {
    const host = headers.get("host") || ""
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]")
    if (!isLocal) {
      const url = new URL(req.url)
      url.protocol = "https:"
      url.port = ""
      return applyCsp(NextResponse.redirect(url), csp)
    }
  }

  // CORS: reject cross-origin state-changing requests before we even look at
  // the route. Cookie SameSite=Lax already blocks naive browser-form CSRF,
  // but a same-origin script on a compromised CDN could fire `fetch(..., {
  // credentials: "include" })` from another origin. Reject when Origin is
  // present AND doesn't match NEXTAUTH_URL. Missing Origin is allowed
  // (server-to-server callers like Pub/Sub — those have their own signature
  // auth and hit the bypass list below anyway).
  const stateChanging = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS"
  if (stateChanging && path.startsWith("/api/")) {
    const origin = req.headers.get("origin")
    if (origin && origin !== process.env.NEXTAUTH_URL) {
      return applyNoStore(applyCsp(
        NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 }),
        csp,
      ))
    }
  }

  // Skip auth lookup for webhook, health, and static-asset paths — they don't
  // need a session. Health must be reachable for external uptime monitors;
  // the Gmail webhook authenticates itself (Pub/Sub OIDC/token);
  // any file in /public (images, fonts, robots.txt, etc.) is public by name
  // and should never be gated behind the "redirect to /auth/signin" branch.
  const isPublicAsset = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|css|js|map|txt|xml|json)$/i.test(path)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/gmail/webhook") ||
    path === "/api/health" ||
    path === "/favicon.ico" ||
    isPublicAsset
  ) {
    return pass()
  }

  const token = await getToken({ req })

  // Note: This middleware runs in Edge runtime and cannot access Redis
  // for JWT revocation checks (ioredis not supported in Edge).
  // The revocation blacklist is enforced by all API route handlers
  // via secure-token.ts (Node.js runtime with Redis access).
  // This is defense-in-depth: middleware handles redirects, route handlers
  // enforce the actual security boundary.

  // Auth pages — always public. no-store so a logged-out user hitting Back
  // on a signin page after a previous session doesn't see a stale render.
  if (path.startsWith("/auth")) {
    return applyNoStore(pass())
  }

  // Root — page.tsx redirects into the app (sign-in -> setup -> dashboard).
  if (path === "/") {
    return pass()
  }

  // API routes — require auth. Always no-store: API responses are dynamic
  // by definition and the browser should never re-serve them from cache.
  if (path.startsWith("/api/")) {
    if (!token) {
      return applyNoStore(applyCsp(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        csp,
      ))
    }
    return applyNoStore(pass())
  }

  // Protected pages — redirect to sign-in
  if (!token) {
    const signInUrl = new URL("/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", path)
    return applyNoStore(applyCsp(NextResponse.redirect(signInUrl), csp))
  }

  // Authenticated protected page (dashboard, setup, etc.) — no-store so a
  // user can't see a previously-rendered version after logout.
  return applyNoStore(pass())
}

export const config = {
  // Match everything except Next.js static assets and image-optimization output.
  // This ensures the nonce-based CSP applies to every HTML/JS response.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
