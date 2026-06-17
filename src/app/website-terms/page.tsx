import Link from "next/link"

export const metadata = {
  title: "Website Terms of Use",
  description: "Terms governing use of the Viltreon website.",
  alternates: { canonical: "/website-terms" },
}

/**
 * Website Terms of Use — based on the operator-provided draft.
 * NOT legal advice. Replace every [bracketed] placeholder and have a lawyer
 * review before launch.
 */
export default function WebsiteTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Website Terms of Use</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: <span className="font-mono">June 12, 2026</span>
        </p>
      </header>

      <section className="space-y-6">
        <p>
          These Website Terms of Use apply to your use of the{" "}
          Viltreon website and any public pages we operate.
        </p>
        <p>
          By accessing or using our website, you agree to these Website Terms of
          Use. If you do not agree, do not use the website.
        </p>

        <h2 className="mt-10 text-xl font-medium">1. Website owner</h2>
        <p>
          The website is operated by Viltreon, based in Edmonton,
          Alberta, Canada.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Email: <a href="mailto:support@viltreon.com" className="underline">support@viltreon.com</a></li>
          <li>Address: Edmonton, Alberta, Canada</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">2. Permitted use</h2>
        <p>
          You may use the website for lawful, personal, or internal business
          purposes only.
        </p>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>use the website for unlawful purposes;</li>
          <li>interfere with the website&rsquo;s security or functionality;</li>
          <li>attempt unauthorized access to the website or related systems;</li>
          <li>use bots, scrapers, crawlers, or other automated tools without our permission;</li>
          <li>upload malicious code, spam, or harmful content.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">3. Website content</h2>
        <p>
          All text, graphics, logos, designs, software, and other materials on
          the website are owned by us or our licensors and are protected by
          intellectual property laws. You may not copy, reproduce, distribute,
          modify, display, or exploit website content without our written
          permission, except as allowed by law.
        </p>

        <h2 className="mt-10 text-xl font-medium">4. Accuracy of information</h2>
        <p>
          We try to keep website information accurate and current, but we do not
          guarantee that all content is complete, reliable, or error-free.
          Website content is provided for general information only and may change
          without notice.
        </p>

        <h2 className="mt-10 text-xl font-medium">5. Third-party links</h2>
        <p>
          Our website may contain links to third-party websites or services. We
          do not control those third parties and are not responsible for their
          content, policies, or practices.
        </p>

        <h2 className="mt-10 text-xl font-medium">6. No professional advice</h2>
        <p>
          Information on the website is not legal, tax, financial, or technical
          advice unless we clearly say otherwise.
        </p>

        <h2 className="mt-10 text-xl font-medium">7. Disclaimer of warranties</h2>
        <p>
          The website is provided on an <strong>&ldquo;as is&rdquo;</strong> and{" "}
          <strong>&ldquo;as available&rdquo;</strong> basis. To the fullest
          extent permitted by law, we disclaim all warranties, express or
          implied, including implied warranties of merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>

        <h2 className="mt-10 text-xl font-medium">8. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, we will not be liable for
          indirect, incidental, special, consequential, or punitive damages
          arising out of your use of the website.
        </p>

        <h2 className="mt-10 text-xl font-medium">9. Privacy</h2>
        <p>
          Your use of the website is also subject to our{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <h2 className="mt-10 text-xl font-medium">10. Changes to these Terms</h2>
        <p>
          We may update these Website Terms of Use at any time by posting a
          revised version on the website. Your continued use of the website after
          the revised version is posted means you accept the updated terms.
        </p>

        <h2 className="mt-10 text-xl font-medium">11. Governing law</h2>
        <p>
          These Website Terms of Use are governed by the laws of Alberta and the
          federal laws of Canada applicable there.
        </p>

        <h2 className="mt-10 text-xl font-medium">12. Contact</h2>
        <p>Questions?</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Viltreon</li>
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
