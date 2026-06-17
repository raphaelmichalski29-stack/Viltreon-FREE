import Link from "next/link"

export const metadata = {
  title: "About",
  description:
    "Why Viltreon exists: an AI inbox organizer built on a simple promise — your email gets sorted the moment it arrives, and we never keep it.",
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">About Viltreon</h1>
        <p className="mt-2 text-muted-foreground">
          The calm, anti-clutter inbox assistant.
        </p>
      </header>

      <section className="space-y-6">
        <p>
          Email triage is a chore nobody signed up for. Most people spend a
          chunk of every morning dragging messages into folders, or give up and
          let the inbox become a pile. Gmail&rsquo;s filters help, but they
          break the moment a sender changes their address or a newsletter
          rewords its subject line.
        </p>
        <p>
          Viltreon exists to make that chore disappear. You describe how you
          want your inbox organized in plain English &mdash; &ldquo;receipts go
          to Finance, cold outreach goes to Pitch, newsletters go to Read
          Later&rdquo; &mdash; and from then on every new email files itself
          into the right label the moment it arrives. No rules engine to
          maintain, no dragging, no app to keep open.
        </p>

        <h2 className="mt-10 text-xl font-medium">Built on one promise</h2>
        <p>
          An inbox organizer has to read a message to file it. We think the
          only acceptable way to do that is to forget it immediately. Viltreon
          processes each email in memory for the seconds a classification
          takes, applies the label, and discards the content &mdash; message
          bodies, senders, and recipients are never written to our database or
          logs. Viltreon also cannot send, delete, or compose email; our code
          simply contains no such operations. The full detail is on our{" "}
          <Link href="/security" className="underline hover:text-foreground">
            Security
          </Link>{" "}
          page and in our{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>

        <h2 className="mt-10 text-xl font-medium">How we think about software</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Calm by default.</strong> Viltreon is designed to be set up
            once and then never opened again. The best session is the one you
            don&rsquo;t need.
          </li>
          <li>
            <strong>Privacy by architecture.</strong> Not a setting, not a
            promise in fine print &mdash; the system is built so your email
            cannot pile up on our servers.
          </li>
          <li>
            <strong>No lock-in.</strong> Viltreon works with the Gmail labels
            you already have. Cancel any time and your inbox keeps every label
            exactly as it is.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">Made in Canada</h2>
        <p>
          Viltreon is built and operated in Canada. Questions, feedback, or
          just want to say hello? Email{" "}
          <a href="mailto:support@viltreon.com" className="underline hover:text-foreground">
            support@viltreon.com
          </a>{" "}
          &mdash; a human reads every message.
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
