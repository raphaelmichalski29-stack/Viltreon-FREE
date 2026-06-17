import crypto from "crypto"
import type { gmail_v1 } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import { prisma } from "./db"

export async function verifyWebhookToken(token: string | null | undefined): Promise<boolean> {
  const expected = process.env.PUBSUB_VERIFICATION_TOKEN
  if (!expected || !token || token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

// Module-level client reuses Google's public-key cache across requests.
const oidcClient = new OAuth2Client()

/**
 * Verify a Google-signed OIDC JWT from a Pub/Sub push request's Authorization header.
 * This is the CASA tier 3-compliant alternative to the shared verification_token:
 * the token is signed by Google with the service account configured on the push
 * subscription, and we check both the signature (against Google's public keys)
 * and the issuing service-account email.
 *
 * Set up via `gcloud pubsub subscriptions create ... --push-auth-service-account=<sa>`
 * and the audience defaults to the push endpoint URL (or set --push-auth-token-audience).
 */
export async function verifyPubSubOidcToken(authHeader: string | null | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false

  const audience = process.env.PUBSUB_OIDC_AUDIENCE
  const expectedEmail = process.env.PUBSUB_OIDC_SERVICE_ACCOUNT
  if (!audience || !expectedEmail) return false

  const token = authHeader.slice("Bearer ".length).trim()
  if (!token) return false

  try {
    const ticket = await oidcClient.verifyIdToken({ idToken: token, audience })
    const payload = ticket.getPayload()
    if (!payload) return false
    if (payload.email !== expectedEmail) return false
    if (payload.email_verified !== true) return false
    return true
  } catch {
    return false
  }
}

export async function setupGmailPush(userId: string, gmail: gmail_v1.Gmail): Promise<string> {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.PUBSUB_TOPIC_NAME) {
    throw new Error("Pub/Sub not configured")
  }

  // First-time users have no active watch; users.stop returns 404 in that case.
  // Swallow so a clean signup can register their first watch.
  try {
    await gmail.users.stop({ userId: "me" })
  } catch {
    // no existing watch — fine
  }

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: process.env.PUBSUB_TOPIC_NAME,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    },
  })

  const historyId = res.data.historyId || ""
  await prisma.user.update({
    where: { id: userId },
    data: { gmailHistoryId: historyId },
  })

  return historyId
}

export async function stopGmailPush(userId: string, gmail: gmail_v1.Gmail): Promise<void> {
  try {
    await gmail.users.stop({ userId: "me" })
  } catch {
    // no active watch — fine
  }

  await prisma.user.update({
    where: { id: userId },
    data: { gmailHistoryId: null },
  })
}
