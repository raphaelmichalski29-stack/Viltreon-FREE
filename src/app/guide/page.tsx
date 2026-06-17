import Link from "next/link"

export const metadata = {
  title: "Sorting Accuracy Guide",
  description:
    "How to get near-perfect automatic sorting from Viltreon using label descriptions, sorting rules, AI visibility, and the fallback label.",
  alternates: { canonical: "/guide" },
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">Getting to near-perfect sorting</h1>
        <p className="mt-2 text-muted-foreground">
          Viltreon works out of the box, but five minutes of setup turns
          &ldquo;mostly right&rdquo; into &ldquo;almost always right.&rdquo; This
          guide shows you exactly which levers matter and how to use them.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="mt-10 text-xl font-medium">How a sorting decision is made</h2>
        <p>
          When an email arrives, the AI sees four things: the sender, the
          subject, the beginning of the message body, and <em>your</em>{" "}
          setup &mdash; the list of labels you let it use, each label&rsquo;s
          description, and your sorting rules. It picks exactly one label and
          reports how confident it is. If confidence is below 60%, the email
          goes to your fallback label instead of being guessed into the wrong
          place.
        </p>
        <p>
          That means accuracy is mostly about one thing: <strong>how clearly
          your labels communicate what belongs in them.</strong> The AI can
          only be as precise as the categories you give it.
        </p>

        <h2 className="mt-10 text-xl font-medium">1. Start with label names that don&rsquo;t overlap</h2>
        <p>
          Before touching descriptions, look at your label list the way a new
          assistant would. If two labels could plausibly claim the same email,
          the AI will sometimes pick the one you didn&rsquo;t want. Common
          trouble pairs:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>&ldquo;Finance&rdquo; and &ldquo;Receipts&rdquo;</strong> &mdash;
            where does a bank statement go? An Amazon order confirmation?
            Either merge them or draw the line in their descriptions.
          </li>
          <li>
            <strong>&ldquo;Work&rdquo; and &ldquo;Projects&rdquo;</strong> &mdash;
            nearly everything work-related is also project-related. Be
            specific about the split.
          </li>
          <li>
            <strong>&ldquo;Misc&rdquo;, &ldquo;Other&rdquo;, &ldquo;Stuff&rdquo;</strong> &mdash;
            keep at most one catch-all, and make it your fallback label.
          </li>
        </ul>
        <p>
          Nested labels work well and the AI sees the full path
          (<code>Work/External</code>, <code>Work/Internal</code>), which
          itself carries meaning.
        </p>

        <h2 className="mt-10 text-xl font-medium">2. Descriptions: the highest-leverage tool you have</h2>
        <p>
          Every label can carry a description (the document icon next to a
          label on the <strong>Inbox Rules</strong> page). The AI reads these
          on every single decision. A good description does two jobs: it says
          what belongs in the label, and it draws the boundary against the
          labels it could be confused with.
        </p>
        <p>Weak description:</p>
        <blockquote className="border-l-2 border-muted pl-4 text-muted-foreground">
          Finance stuff
        </blockquote>
        <p>Strong description:</p>
        <blockquote className="border-l-2 border-muted pl-4 text-muted-foreground">
          Receipts, invoices, order and payment confirmations, bank and credit
          card statements, tax documents. NOT promotional emails from stores
          &mdash; those go to Shopping.
        </blockquote>
        <p>Three patterns that work:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>List concrete examples.</strong> &ldquo;Order
            confirmations, shipping updates, return labels&rdquo; beats
            &ldquo;purchase-related email.&rdquo; The AI matches incoming mail
            against your examples.
          </li>
          <li>
            <strong>Name senders when they define the category.</strong>
            &ldquo;Anything from my accountant, my bank, Stripe, or
            PayPal&rdquo; is unambiguous.
          </li>
          <li>
            <strong>Say what does NOT belong.</strong> One &ldquo;NOT
            X&rdquo; clause resolves most boundary fights between similar
            labels. Put it in whichever label keeps getting the wrong mail.
          </li>
        </ul>
        <p>
          Keep it tight: one or two precise sentences outperform a paragraph.
        </p>

        <h2 className="mt-10 text-xl font-medium">3. Sorting rules: for logic that crosses labels</h2>
        <p>
          Sorting rules live in <strong>Settings</strong> and apply to every
          decision. Descriptions define categories; rules define{" "}
          <em>behavior</em> &mdash; priorities, tie-breakers, and special
          cases. The AI is instructed to follow them strictly. Use them for:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Tie-breakers:</strong> &ldquo;If an email is both a
            receipt and a shipping update, prefer Finance over
            Shopping.&rdquo;
          </li>
          <li>
            <strong>Sender routing:</strong> &ldquo;Anything from
            @mycompany.com goes to Work/Internal, no matter the topic.&rdquo;
          </li>
          <li>
            <strong>Intent detection:</strong> &ldquo;Cold outreach and sales
            pitches from people I have never emailed go to Pitch.&rdquo;
          </li>
          <li>
            <strong>Personal exceptions:</strong> &ldquo;Emails from my mom
            (jane@example.com) always go to Family, even if they look like
            forwards or newsletters.&rdquo;
          </li>
        </ul>
        <p>Tips for writing them:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Write each rule as one plain sentence: <em>if this, then that
            label</em>. Bullet-like lines work well; clever prose does not
            add anything.
          </li>
          <li>
            Refer to labels by their exact names so there is no ambiguity
            about which label you mean.
          </li>
          <li>
            Keep rules for exceptions and priorities. If you find yourself
            describing what a label IS, that sentence belongs in the
            label&rsquo;s description instead.
          </li>
          <li>
            Fewer, sharper rules beat many vague ones.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-medium">4. Hide labels the AI should never use</h2>
        <p>
          The eye icon next to each label on the Inbox Rules page controls
          whether the AI can file mail into it. Hide labels you manage by hand
          (&ldquo;To Print&rdquo;, &ldquo;Waiting on reply&rdquo;) and any
          label that exists for archiving rather than incoming mail. Every
          label you hide is one less way to be wrong &mdash; a shorter menu
          makes every remaining choice more accurate.
        </p>

        <h2 className="mt-10 text-xl font-medium">5. Choose a fallback label you actually review</h2>
        <p>
          When the AI is less than 60% sure, it refuses to guess and files the
          email under your fallback label. This is a feature: uncertain mail is
          concentrated in one place instead of being scattered into wrong
          categories. Pick something like &ldquo;Other&rdquo; and skim it
          occasionally &mdash; every email you find there is telling you which
          description or rule to sharpen.
        </p>

        <h2 className="mt-10 text-xl font-medium">The improvement loop</h2>
        <p>When an email lands in the wrong place, fix the cause, not the email:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Wrong label won?</strong> Add a &ldquo;NOT ...&rdquo;
            clause to the label that wrongly claimed it, or a tie-breaker rule
            naming both labels.
          </li>
          <li>
            <strong>Landed in fallback?</strong> The right label&rsquo;s
            description was too vague to clear the confidence bar &mdash; add
            the missed email&rsquo;s type or sender to it as an example.
          </li>
          <li>
            <strong>A whole sender keeps missing?</strong> One sender-routing
            rule in Settings ends it permanently.
          </li>
        </ul>
        <p>
          Two or three rounds of this in your first week typically gets
          sorting to the point where you stop thinking about it &mdash; which
          is the whole idea.
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
