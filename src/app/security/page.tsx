import Link from "next/link"

export const metadata = {
  title: "Security",
  description:
    "How Viltreon protects your Gmail data: encryption at rest and in transit, no stored email content, no ability to send or delete mail, and independent verification.",
  alternates: { canonical: "/security" },
}

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Security at Viltreon</h1>
        <p className="mt-2 text-muted-foreground">
          Viltreon reads email to sort it. That is a serious responsibility, and
          the entire service is designed around it.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="mt-10 text-xl font-medium">Your email is never stored</h2>
        <p>
          When a new message arrives, Viltreon reads it once, decides which of
          your labels it belongs to, applies the label, and discards the
          content. Message bodies, attachments, sender addresses, and recipient
          lists are processed in memory for the seconds a classification takes
          and are never written to our database or our logs. The only record we
          keep is which label was applied, the confidence score, and the model
          used &mdash; and that log is deleted after 30 days.
        </p>

        <h2 className="mt-10 text-xl font-medium">Viltreon cannot send, delete, or compose email</h2>
        <p>
          Gmail bundles reading, labeling, and sending into a single permission
          (<code>gmail.modify</code>) &mdash; the only permission that lets an
          inbox organizer move a message between labels. Viltreon uses it for
          exactly that. Our application code contains no send, compose, forward,
          reply, draft, or delete operations of any kind, and you can revoke
          access at any time from your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Google Account permissions
          </a>
          .
        </p>

        <h2 className="mt-10 text-xl font-medium">Encryption everywhere</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>In transit:</strong> all traffic is served over TLS, with
            HTTP Strict Transport Security (HSTS) so browsers refuse to connect
            insecurely.
          </li>
          <li>
            <strong>At rest:</strong> your Google OAuth tokens and your AI API
            key are encrypted with AES-256-GCM (authenticated encryption)
            before they touch our database or cache. The encryption key never
            lives alongside the data it protects.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">Hardened by default</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Every API endpoint requires authentication and is rate limited per user.</li>
          <li>Sessions can be revoked server-side the moment you sign out or delete your account.</li>
          <li>
            Incoming webhooks are cryptographically verified: Stripe events by
            HMAC signature, Gmail push notifications by Google-signed tokens.
          </li>
          <li>
            A strict Content Security Policy with per-request nonces guards
            against script injection.
          </li>
          <li>Production refuses to boot if any security-critical configuration is missing or weak.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">Limited Use and verification</h2>
        <p>
          Viltreon&rsquo;s use of Google user data complies with the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. As an app requesting
          restricted Gmail scopes, Viltreon goes through Google&rsquo;s
          verification process, which includes an independent security
          assessment (CASA).
        </p>

        <h2 className="mt-10 text-xl font-medium">Your data, your call</h2>
        <p>
          You can export your data or delete your account at any time from
          Settings. Deletion cancels your subscription, revokes Viltreon&rsquo;s
          access to your Google account, and removes your data from our
          database in one step. Details are in our{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>

        <h2 className="mt-10 text-xl font-medium">Reporting a vulnerability</h2>
        <p>
          If you believe you have found a security issue in Viltreon, please
          email{" "}
          <a href="mailto:support@viltreon.com" className="underline hover:text-foreground">
            support@viltreon.com
          </a>{" "}
          with the details. We read every report and will respond as quickly as
          we can. Please give us a reasonable window to fix the issue before
          disclosing it publicly.
        </p>

        <p className="mt-10">
          <Link href="/" className="underline hover:text-foreground">
            &larr; Back to home
          </Link>
        </p>
      </section>
    </main>
  )
}
