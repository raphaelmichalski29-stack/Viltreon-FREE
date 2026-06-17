import Link from "next/link"

export const metadata = {
  title: "Privacy Policy",
  description: "How Viltreon handles your data.",
  alternates: { canonical: "/privacy" },
}

/**
 * Privacy Policy — based on the operator-provided draft, with two changes:
 *  (1) the data sections use the accurate "processed in memory, never stored"
 *      language that matches what the app actually does and the marketing copy
 *      (operator chose option b);
 *  (2) the Gmail section includes the Google API Services "Limited Use"
 *      affirmation, which is required to pass Google OAuth verification.
 *
 * NOT legal advice. Replace every [bracketed] placeholder and have a lawyer
 * review before launch.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: <span className="font-mono">June 12, 2026</span>
        </p>
      </header>

      <section className="space-y-6">
        <p>
          Viltreon (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
          &ldquo;our&rdquo;) respects your privacy. This Privacy Policy explains
          how we collect, use, disclose, store, and protect personal information
          when you use our website, applications, and services.
        </p>

        <h2 className="mt-10 text-xl font-medium">1. Scope</h2>
        <p>This Privacy Policy applies to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>visitors to our website;</li>
          <li>account holders and users of our Service;</li>
          <li>individuals who connect Gmail or Google accounts to the Service;</li>
          <li>people who contact us for support or other inquiries.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">2. Information we collect</h2>
        <p><strong>Information you provide directly</strong></p>
        <ul className="list-disc pl-6 space-y-2">
          <li>name</li>
          <li>email address</li>
          <li>account login information (via Google sign-in)</li>
          <li>billing information (handled by Stripe)</li>
          <li>support messages</li>
          <li>any information you choose to send us</li>
        </ul>
        <p>
          <strong>Information collected through the Service.</strong> If you
          connect a Gmail or Google account, we process the following to provide
          the Service. We distinguish between what we <em>store</em> and what we
          only handle <em>in memory</em> during a single classification and then
          discard:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Stored:</strong> account identifiers (name, email), your
            OAuth access and refresh tokens (encrypted at rest), your AI API key
            (encrypted at rest), your label structure (names and IDs), service
            settings and preferences, and a sort log for each classified email
            consisting of the label applied, the confidence score,
            and the model used (retained at most 30 days, then deleted).
          </li>
          <li>
            <strong>Processed in memory only, never written to our database or
            logs:</strong> message bodies and attachments, sender addresses, and
            recipient lists. These are used for the few seconds it takes to
            generate a label and are then discarded.
          </li>
        </ul>
        <p><strong>Information collected automatically</strong></p>
        <ul className="list-disc pl-6 space-y-2">
          <li>IP address, browser type, device type, operating system</li>
          <li>pages visited, timestamps</li>
          <li>error and performance logs related to your use of the Service</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">3. How we use information</h2>
        <p>We use personal information to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>provide, operate, and maintain the Service;</li>
          <li>sort, classify, organize, or manage email as requested;</li>
          <li>authenticate users and manage accounts;</li>
          <li>process payments and subscriptions;</li>
          <li>communicate with you about your account, security, billing, and the Service (transactional messages);</li>
          <li>with your permission, send product updates, beta announcements, and other Service-related news, which you can opt out of at any time;</li>
          <li>provide support and respond to inquiries;</li>
          <li>detect, prevent, and investigate fraud, abuse, and security incidents;</li>
          <li>debug, improve, and optimize the Service;</li>
          <li>comply with legal obligations.</li>
        </ul>
        <p>
          We send two kinds of email: <strong>essential</strong> account,
          security, and billing messages tied to your use of the Service, and{" "}
          <strong>non-essential</strong> product updates and beta announcements.
          You can unsubscribe from non-essential email at any time using the link
          in those messages or by contacting us; we will still send essential
          messages while your account is active.
        </p>

        <h2 className="mt-10 text-xl font-medium">4. Gmail and Google data; Limited Use</h2>
        <p>
          If you connect a Gmail or Google account, we access only the data
          necessary to provide the Service based on the permissions you
          authorize. We may use Gmail-related data to analyze and sort emails,
          apply labels and categories, perform user-requested automations, and
          maintain your account settings and preferences.
        </p>
        <p>
          <strong>What we never do.</strong> Google&rsquo;s permission screen
          lists the ability to read, compose, and send email. That is because
          Gmail bundles those capabilities into a single permission
          (<code>gmail.modify</code>), which is the only permission that lets an
          inbox organizer move a message between labels. Viltreon uses it for
          exactly that and nothing more: it reads a newly arrived message and
          re-files it. We never send, compose, forward, reply to, draft, or
          delete email. Our application code contains no send or delete
          operations of any kind.
        </p>
        <p>
          <strong>
            Viltreon&rsquo;s use and transfer to any other app of information
            received from Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </strong>{" "}
          Specifically:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>we use Gmail data only to provide and improve the user-facing sorting feature you signed up for;</li>
          <li>we do not transfer Gmail data except as necessary to provide that feature, with your consent, for security, or to comply with law;</li>
          <li>we do not use Gmail data for advertising;</li>
          <li>
            we do not allow humans to read your Gmail data, except with your
            consent for specific messages, where necessary for security or to
            comply with law, or where the data has been aggregated and
            anonymized;
          </li>
          <li>we do not sell Gmail data, and we do not use it to train generalized AI or machine-learning models.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">5. Legal bases for processing</h2>
        <p>
          Where required by law, including for users in the European Economic
          Area, the United Kingdom, or similar jurisdictions, we may process
          personal information based on:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>your consent;</li>
          <li>performance of a contract;</li>
          <li>our legitimate interests;</li>
          <li>compliance with legal obligations.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">6. How we share information</h2>
        <p>We do not sell or rent your data. We may share personal information with:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>service providers and subprocessors that help us operate the Service (hosting, database, queue, classification, email delivery);</li>
          <li>payment processors (Stripe);</li>
          <li>analytics, monitoring, and security providers;</li>
          <li>professional advisers such as lawyers, accountants, and auditors;</li>
          <li>law enforcement, regulators, or others when required by law;</li>
          <li>a buyer or successor in connection with a merger, acquisition, financing, or sale of assets.</li>
        </ul>
        <p>
          We require service providers to use personal information only as
          needed to provide services to us and to protect it with appropriate
          safeguards.
        </p>

        <h2 className="mt-10 text-xl font-medium">7. International transfers</h2>
        <p>
          Your information may be stored and processed in Canada, the United
          States, or other countries where we or our service providers operate.
          Those countries may have different privacy laws than your home
          jurisdiction. Where required for transfers from the EEA, UK, or
          Switzerland, we rely on appropriate safeguards such as the Standard
          Contractual Clauses.
        </p>

        <h2 className="mt-10 text-xl font-medium">8. Data retention</h2>
        <p>
          We keep personal information only as long as reasonably necessary for
          the purposes described in this Policy, unless a longer retention period
          is required by law. Retention may depend on whether your account is
          active, whether we must keep records for legal, tax, or accounting
          reasons, security and fraud prevention needs, and backup and disaster
          recovery cycles.
        </p>
        <p>
          If you delete your account or disconnect your Gmail account, we will
          take reasonable steps to delete or de-identify related personal
          information, subject to legal, technical, or backup limitations.
        </p>

        <h2 className="mt-10 text-xl font-medium">9. Security</h2>
        <p>
          We use reasonable administrative, technical, and physical safeguards
          designed to protect personal information, including AES-256 encryption
          of tokens and keys at rest and HTTPS in transit. However, no system is
          completely secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="mt-10 text-xl font-medium">10. Your rights and choices</h2>
        <p>Depending on where you live, you may have rights to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>access your personal information;</li>
          <li>correct inaccurate information;</li>
          <li>delete certain information;</li>
          <li>withdraw consent;</li>
          <li>object to or restrict certain processing;</li>
          <li>request portability, where applicable.</li>
        </ul>
        <p>
          To exercise your rights, contact us at{" "}
          <a href="mailto:support@viltreon.com" className="underline">support@viltreon.com</a>. You
          may also disconnect your Gmail account from within the Service or from{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            your Google Account permissions page
          </a>
          .
        </p>

        <h2 className="mt-10 text-xl font-medium">11. Cookies and analytics</h2>
        <p>
          We use a small number of strictly necessary cookies (set by NextAuth)
          to keep you signed in and to protect sign-in against cross-site request
          forgery; they are <code>HttpOnly</code>, <code>Secure</code>, and{" "}
          <code>SameSite=Lax</code>. We do not use advertising cookies or
          third-party tracking pixels. For the full list, see our{" "}
          <Link href="/cookies" className="underline">Cookie Notice</Link>. If we
          introduce analytics, we will update this Policy and, where required,
          provide a cookie preference tool.
        </p>

        <h2 className="mt-10 text-xl font-medium">12. Children&rsquo;s privacy</h2>
        <p>
          Our Service is not intended for children under the age of 16. We do not knowingly collect personal information from
          children without lawful authorization. If we learn that we have, we
          delete it.
        </p>

        <h2 className="mt-10 text-xl font-medium">13. Third-party services and links</h2>
        <p>
          Our website and Service may link to third-party websites or integrate
          with third-party services. We are not responsible for the privacy
          practices, content, or security of those third parties.
        </p>

        <h2 className="mt-10 text-xl font-medium">14. Changes to this Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make
          material changes, we will provide notice as required by law or through
          the Service, and update the &ldquo;Effective date&rdquo; above.
        </p>

        <h2 className="mt-10 text-xl font-medium">15. Contact us</h2>
        <p>
          If you have questions or privacy requests, contact us. For users in the
          EEA or UK, the data controller is Viltreon, Edmonton, Alberta, Canada.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Viltreon</li>
          <li>Edmonton, Alberta, Canada</li>
          <li><a href="mailto:support@viltreon.com" className="underline">support@viltreon.com</a></li>
        </ul>

        <div className="mt-12 border-t pt-6">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
