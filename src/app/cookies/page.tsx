import Link from "next/link"

export const metadata = {
  title: "Cookie Notice",
  description: "Which cookies Viltreon uses and why.",
  alternates: { canonical: "/cookies" },
}

/**
 * Cookie Notice — describes the only cookies the Service sets: three
 * strictly-necessary NextAuth cookies. No analytics, advertising, or
 * third-party tracking cookies are used. Cookie facts verified against
 * src/lib/auth.ts (JWT session strategy, 30-day maxAge).
 *
 * NOT legal advice. Replace every [bracketed] placeholder and have a lawyer
 * review before launch. If analytics are introduced later, this notice and
 * the consent approach must be revisited.
 */
export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Cookie Notice</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: <span className="font-mono">June 12, 2026</span>
        </p>
      </header>

      <section className="space-y-6">
        <p>
          This Cookie Notice explains how Viltreon (&ldquo;we,&rdquo;
          &ldquo;us,&rdquo; &ldquo;our&rdquo;) uses cookies and similar
          technologies on our website and in our Service. It should be read
          together with our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>

        <h2 className="mt-10 text-xl font-medium">1. What cookies are</h2>
        <p>
          A cookie is a small text file that a website stores in your browser.
          Cookies are widely used to make websites work, to keep you signed in,
          and to remember preferences. Some cookies are{" "}
          <strong>strictly necessary</strong> for a site to function, while
          others (such as analytics or advertising cookies) are optional.
        </p>

        <h2 className="mt-10 text-xl font-medium">2. The cookies we use</h2>
        <p>
          We use <strong>only strictly necessary cookies</strong>. These are
          required to sign you in securely and keep your session active. We do
          not use analytics, advertising, social media, or other tracking
          cookies, and we do not allow third parties to set tracking cookies
          through our Service.
        </p>
        <p>
          All of our cookies are set by our authentication library (NextAuth)
          on our own domain. They are marked <code>HttpOnly</code> (not readable
          by JavaScript), <code>Secure</code> (sent only over HTTPS), and{" "}
          <code>SameSite=Lax</code>.
        </p>

        <div className="overflow-x-auto">
          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">Cookie</th>
                <th className="py-2 pr-4 font-medium">Purpose</th>
                <th className="py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">
                  __Host-next-auth.csrf-token
                </td>
                <td className="py-2 pr-4">
                  Security token that protects sign-in and sign-out against
                  cross-site request forgery (CSRF).
                </td>
                <td className="py-2">Session</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">
                  __Secure-next-auth.callback-url
                </td>
                <td className="py-2 pr-4">
                  Remembers which page to return you to after you finish signing
                  in.
                </td>
                <td className="py-2">Session</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">
                  __Secure-next-auth.session-token
                </td>
                <td className="py-2 pr-4">
                  Keeps you signed in. Holds an encrypted session token; it does
                  not contain your email content.
                </td>
                <td className="py-2">Up to 30 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground">
          On non-HTTPS development environments these cookies may appear without
          the <code>__Host-</code> or <code>__Secure-</code> prefix (for
          example, <code>next-auth.session-token</code>). The purpose is the
          same.
        </p>

        <h2 className="mt-10 text-xl font-medium">
          3. Why we do not show a cookie banner
        </h2>
        <p>
          Strictly necessary cookies are exempt from prior-consent requirements
          under laws such as the EU/UK ePrivacy rules and the GDPR, and their
          use is consistent with Canadian privacy law (PIPEDA). Because we use
          no optional, analytics, or advertising cookies, no cookie consent
          banner or preference tool is required. If this changes, see Section 5.
        </p>

        <h2 className="mt-10 text-xl font-medium">4. Managing cookies</h2>
        <p>
          You can control or delete cookies through your browser settings, and
          you can set your browser to block cookies. Because the cookies above
          are strictly necessary, blocking or deleting them will prevent you
          from signing in and using the Service. Most browsers explain how to
          manage cookies in their help pages.
        </p>

        <h2 className="mt-10 text-xl font-medium">5. Changes to this Notice</h2>
        <p>
          We may update this Cookie Notice if we change how we use cookies, for
          example if we introduce privacy-friendly analytics in the future. If
          we add any non-essential cookies, we will update this Notice, update
          the &ldquo;Effective date&rdquo; above, and provide any consent
          mechanism required by law before those cookies are set.
        </p>

        <h2 className="mt-10 text-xl font-medium">6. Contact us</h2>
        <p>If you have questions about our use of cookies, contact us:</p>
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
