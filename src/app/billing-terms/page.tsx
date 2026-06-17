import Link from "next/link"

export const metadata = {
  title: "Billing and Payment Terms",
  description: "Billing, payment, renewal, and refund terms for Viltreon.",
  alternates: { canonical: "/billing-terms" },
}

/**
 * Billing and Payment Terms — based on the operator-provided draft.
 * NOT legal advice. Replace every [bracketed] placeholder and have a lawyer
 * review before launch.
 */
export default function BillingTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Billing and Payment Terms</h1>
        <p className="mt-2 text-muted-foreground">
          Effective date: <span className="font-mono">June 12, 2026</span>
        </p>
      </header>

      <section className="space-y-6">
        <p>
          These Billing and Payment Terms apply to any paid subscription,
          invoice, or purchase of the Service provided by{" "}
          Viltreon. They form part of our{" "}
          <Link href="/terms" className="underline">Terms of Service</Link>.
        </p>

        <h2 className="mt-10 text-xl font-medium">1. Payment processor</h2>
        <p>
          We use Stripe to process payments. By providing payment information,
          you authorize us and Stripe to charge your payment method for the
          applicable fees, taxes, and other amounts due under these Terms. Your
          payment information is handled by Stripe subject to Stripe&rsquo;s own
          terms and privacy policy.
        </p>

        <h2 className="mt-10 text-xl font-medium">2. Fees</h2>
        <p>
          You agree to pay all fees shown at checkout, in your account, on an
          order page, or on an invoice. Fees are charged in USD unless stated otherwise. Unless expressly stated,
          fees do not include taxes, bank fees, foreign exchange fees, or charges
          imposed by your payment provider.
        </p>

        <h2 className="mt-10 text-xl font-medium">3. Taxes</h2>
        <p>
          You are responsible for all applicable taxes, duties, levies, or
          similar charges, except taxes based on our net income. If we are
          required to collect taxes, those taxes will be added to your charges
          where applicable. Taxes may include GST/HST, VAT, sales tax, or other
          similar taxes depending on your location.
        </p>

        <h2 className="mt-10 text-xl font-medium">4. Billing cycle and renewal</h2>
        <p>If you purchase a subscription:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>the subscription will renew automatically unless you cancel before renewal;</li>
          <li>the billing cycle will be monthly, annual, or otherwise stated at checkout;</li>
          <li>the fee for each renewal period will be charged in advance, unless we say otherwise.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">5. Payment authorization</h2>
        <p>
          By starting a paid plan, you authorize us and Stripe to charge your
          payment method on a recurring basis for subscription fees, taxes, and
          any other applicable charges until you cancel. You are responsible for
          keeping your payment information current and complete.
        </p>

        <h2 className="mt-10 text-xl font-medium">6. Failed or declined payments</h2>
        <p>If a payment fails or is declined, we may:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>retry the charge;</li>
          <li>notify you by email or through the Service;</li>
          <li>suspend or limit your access to the Service until payment is received;</li>
          <li>terminate your account if the issue is not resolved.</li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">7. Refunds</h2>
        <p>Unless required by law or expressly stated in writing:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>fees are non-refundable;</li>
          <li>unused time in a billing period is not refunded;</li>
          <li>we do not provide credits or prorated refunds for partial billing periods.</li>
        </ul>
        <p>
          If you believe you were charged in error, contact us at{" "}
          <a href="mailto:support@viltreon.com" className="underline">support@viltreon.com</a> as soon as possible.
        </p>

        <h2 className="mt-10 text-xl font-medium">8. Chargebacks and payment disputes</h2>
        <p>
          Before filing a chargeback or payment dispute, you agree to contact us
          and try to resolve the issue informally. If you file an improper
          chargeback, we may suspend or terminate your account and may recover
          reasonable costs associated with responding to the dispute, to the
          extent permitted by law.
        </p>

        <h2 className="mt-10 text-xl font-medium">9. Pricing changes</h2>
        <p>
          We may change our pricing from time to time. If we increase
          subscription pricing, we will give reasonable notice before the new
          pricing applies to your renewal term. If you do not agree to the new
          pricing, you must cancel before the next renewal date.
        </p>

        <h2 className="mt-10 text-xl font-medium">10. Invoicing</h2>
        <p>
          If we invoice you directly, payment is due within 30 days
          of the invoice date unless the invoice says otherwise. Unpaid invoices
          may be considered overdue after the due date.
        </p>

        <h2 className="mt-10 text-xl font-medium">11. Currencies and billing descriptor</h2>
        <p>
          Charges will be processed in the currency shown at checkout or on the
          invoice. The name that appears on your card statement may be VILTREON. If you have questions about a charge,
          contact us before disputing it.
        </p>

        <h2 className="mt-10 text-xl font-medium">12. Contact</h2>
        <p>Billing questions?</p>
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
