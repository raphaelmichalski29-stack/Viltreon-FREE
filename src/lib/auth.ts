import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"
import { secureAdapter } from "./secure-adapter"
import { encrypt } from "./encryption"

export const authOptions: AuthOptions = {
  adapter: secureAdapter(PrismaAdapter(prisma)),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // gmail.modify already grants every read operation we use
          // (messages.get, messages.list, history.list, labels.list,
          // users.watch). gmail.readonly was redundant and added a scarier
          // line to the consent screen without unlocking any new capability.
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels",
          access_type: "offline",
          // `select_account consent` shows the account picker AND forces the
          // consent screen on every sign-in. The consent prompt is what makes
          // Google re-issue a refresh_token each time. Without it, Google only
          // returns a refresh_token on the very first authorization, so any time
          // our stored token is lost (account deleted then re-signup, DB reset,
          // manual revoke) the account ends up with an access token but no
          // refresh token and Gmail calls fail with "account not connected".
          // The cost is one extra Allow click for returning users, which is
          // worth guaranteed Gmail connectivity.
          prompt: "select_account consent",
        },
      },
    }),
  ],
  callbacks: {
    // Google's granular consent lets a user untick the Gmail permissions while
    // still completing sign-in. Without them every Gmail call (watch, sort,
    // labels) fails later with a cryptic error, so reject the sign-in up front
    // and send the user back with a clear message to grant Gmail access.
    async signIn({ account }) {
      if (account?.provider === "google") {
        const granted = account.scope ?? ""
        const required = [
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.labels",
        ]
        if (required.some((s) => !granted.includes(s))) {
          return "/auth/signin?error=missing_gmail_scope"
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (!token.email) return token

      // Assign jti on token creation (sign in) or if missing
      if (!token.jti) {
        token.jti = crypto.randomUUID()
      }

      // On first sign-in the adapter has just written the User; some Neon
      // read replicas haven't seen it yet. Seed the token from the in-memory
      // user object and skip the DB read this turn — the next refresh picks
      // up the persisted record.
      if (account && user) {
        token.sub = user.id
        return token
      }

      let dbUser
      try {
        dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { subscriptionStatus: true, subscriptionEndsAt: true, accessDisabled: true },
        })
      } catch (err) {
        // Transient DB error (Neon cold start, network blip). Keep the existing
        // token rather than signing the user out — returning null here makes
        // NextAuth treat the session as broken and bounces them to /auth/signin.
        console.error("[auth.jwt] DB lookup failed, keeping existing token:", err)
        return token
      }
      // The user row no longer exists (genuine deletion). Returning null here
      // makes NextAuth try to encode a null JWT and throw "JWT Claims Set MUST
      // be an object". Instead strip access on the token so the session is
      // gated out (bounced to sign-in / setup) without crashing. A deleted user
      // who signs in again is recreated by the createUser event.
      if (!dbUser) {
        token.accessDisabled = true
        token.subscriptionStatus = undefined
        token.subscriptionEndsAt = null
        return token
      }

      token.subscriptionStatus = dbUser.subscriptionStatus
      token.subscriptionEndsAt = dbUser.subscriptionEndsAt?.getTime() ?? null
      token.accessDisabled = dbUser.accessDisabled
      return token
    },
    async session({ session, token }) {
      if (!token?.email || !session.user) return session

      // session.user.id is the canonical user identifier consumed by every
      // API route — never drop it even if the supplemental lookup below fails.
      session.user.id = token.sub!

      try {
        const user = await prisma.user.findUnique({
          where: { email: token.email },
          select: { subscriptionStatus: true, accessDisabled: true },
        })
        if (user) {
          session.user.subscriptionStatus = user.subscriptionStatus ?? undefined
          session.user.accessDisabled = user.accessDisabled
        } else {
          // Fall back to token-cached values when the row is briefly invisible
          // (Neon replica lag) so the client doesn't see undefined.
          session.user.subscriptionStatus = token.subscriptionStatus ?? undefined
          session.user.accessDisabled = token.accessDisabled
        }
      } catch (err) {
        console.error("[auth.session] DB lookup failed, using token cache:", err)
        session.user.subscriptionStatus = token.subscriptionStatus ?? undefined
        session.user.accessDisabled = token.accessDisabled
      }

      return session
    },
  },
  events: {
    async createUser({ user }) {
      // The 14-day trial is card-required and runs in Stripe (see
      // api/stripe/checkout). A brand-new account therefore starts with no
      // subscription and accessDisabled=true (the schema default): it can
      // complete setup (connect Gmail, add key, sync labels) but cannot sort
      // until the user adds a card and the Stripe trial begins. We only seed
      // the usage counters so settings/usage reads are well-defined before then.
      if (!user?.id) return
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessDisabled: true,
            emailMonthStartAt: new Date(),
            emailsProcessedThisMonth: 0,
          },
        })
      } catch (err) {
        // Non-blocking — sign-in still succeeds, the user just lands on /setup.
        // Log loudly so we notice the regression.
        console.error("[auth.createUser] Failed to seed new user:", err)
      }
    },
    async signIn({ user, account }) {
      if (!account?.access_token || account.type !== "oauth") return
      try {
        const updateData: Record<string, unknown> = {
          access_token: encrypt(account.access_token),
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          // id_token is a PII-bearing JWT (email, name, picture) that nothing
          // in the app reads back. Don't persist it; null out any value a
          // previous version stored.
          id_token: null,
        }
        if (account.refresh_token) {
          updateData.refresh_token = encrypt(account.refresh_token)
        }
        if (account.refresh_token_expires_in) {
          updateData.refresh_token_expires_in = account.refresh_token_expires_in
        }
        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          data: updateData,
        })
        // Drop every cached credential (in-memory clients cluster-wide via the
        // epoch bump, plus the Redis token cache) so the fresh tokens written
        // above are picked up immediately. Clearing only this process's client
        // cache left the other web/worker processes and the Redis cache serving
        // revoked tokens for up to an hour after a reconnect.
        if (user?.id) {
          const { invalidateGmailTokens } = await import("./gmail")
          await invalidateGmailTokens(user.id)
        }
      } catch (err) {
        // Non-blocking — token update failure should not break sign-in,
        // but it MUST be visible: silent failure here leaves the user logged in
        // with stale/missing tokens and Gmail calls fail mysteriously later.
        console.error("[auth.signIn] Failed to persist OAuth tokens:", err)
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
