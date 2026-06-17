"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start sign-in. Please try again.",
  OAuthCallback: "Google rejected the sign-in. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  EmailCreateAccount: "Could not create your account. Please try again.",
  Callback: "Sign-in callback failed. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  AccessDenied: "Access denied. You may have cancelled the consent screen.",
  missing_gmail_scope:
    "Viltreon needs permission to access your Gmail to sort it. Please sign in again and keep the Gmail permissions checked on the consent screen.",
  Configuration: "Authentication is misconfigured. Contact support.",
  SessionRequired: "Please sign in to continue.",
  Default: "Sign-in failed. Please try again.",
}

function SignInInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/setup"
  const errorCode = searchParams.get("error")
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (status === "authenticated" && session) {
      if (
        session.user?.accessDisabled === false &&
        (session.user?.subscriptionStatus === "active" ||
          session.user?.subscriptionStatus === "trialing")
      ) {
        router.replace("/dashboard")
      } else {
        router.replace("/setup")
      }
    }
  }, [status, session, router])

  async function handleSignIn() {
    setSigningIn(true)
    try {
      // signIn handles the CSRF token internally and routes through the
      // current host — avoids the "State cookie was missing" class of errors
      // that happens when a hand-rolled form posts to a different origin.
      await signIn("google", { callbackUrl })
    } catch {
      setSigningIn(false)
    }
  }

  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default
    : null

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2A28] flex flex-col relative">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute filter blur-[40px] opacity-50 w-96 h-96 rounded-full bg-[#E5DFD3] top-[-10%] left-[-10%]"></div>
        <div className="absolute filter blur-[40px] opacity-50 w-[500px] h-[500px] rounded-full bg-[#F3EFE9] top-[40%] right-[-10%]"></div>
      </div>

      <header className="w-full max-w-7xl mx-auto px-6 py-8">
        <Link href="/" className="font-serif font-semibold text-2xl tracking-tight italic text-[#2C2A28]">
          Viltreon.
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md bg-white border-2 border-[#2C2A28] rounded-[15px_25px_15px_25px] shadow-sm p-8">
          <div className="font-mono text-xs tracking-[0.2em] text-[#D86B5A] mb-4">SIGN IN</div>
          <h1 className="font-serif text-3xl text-[#2C2A28]">Welcome to Viltreon.</h1>
          <p className="mt-2 text-[#5A5753]">
            Sign in with Google to connect your Gmail account.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-[#D86B5A]/50 bg-[#D86B5A]/10 px-3 py-2 text-sm text-[#2C2A28]"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn || status === "loading"}
            className="w-full mt-6 flex items-center justify-center gap-2 border-2 border-[#2C2A28] bg-white text-[#2C2A28] font-medium text-base py-3.5 rounded-[8px_30px_12px_25px] hover:bg-[#F3EFE9] hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {signingIn ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {signingIn ? "Redirecting to Google…" : "Sign in with Google"}
          </button>

          {/* Pre-OAuth trust note: defuses both the unverified-app warning and
              the scary "send email" line on Google's consent screen before the
              user sees them. */}
          <div className="mt-5 rounded-lg bg-[#F3EFE9] border border-[#E5DFD3] px-4 py-3 text-xs text-[#5A5753] leading-relaxed">
            Google&apos;s consent screen mentions sending email because Gmail
            bundles read, label, and send into one permission. Viltreon only
            reads a message in the moment and re-files it. It never sends,
            deletes, or composes anything, and your email is never stored.
          </div>

          <p className="mt-5 text-xs text-[#5A5753] text-center">
            By continuing, you agree to our{" "}
            <Link href="/privacy" className="underline hover:text-[#2C2A28]">Privacy Policy</Link>
            {" "}and{" "}
            <Link href="/terms" className="underline hover:text-[#2C2A28]">Terms of Service</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  )
}
