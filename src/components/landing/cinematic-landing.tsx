"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { setupCinematic } from "./cinematic-animations"
import "./cinematic-landing.css"

const marqueeCats = [
  "Receipts", "Newsletters", "Travel", "Finance", "Work",
  "Calendar", "Social", "Promotions", "Updates", "Personal",
]

const manifestoAccent = new Set(["read", "understood", "filed"])
const manifestoWords =
  "Every email that lands gets read, understood, and filed the second it arrives. By rules you wrote once and never touch again."
    .split(/\s+/)
    .map((text) => ({ text, accent: manifestoAccent.has(text.toLowerCase().replace(/[^a-z]/g, "")) }))

const stats = [
  { count: "0", pre: "", suf: "", label: "email bodies stored" },
  { count: "256", pre: "AES-", suf: "", label: "bit token encryption" },
  { count: "30", pre: "<", suf: "d", label: "day max log life" },
  { count: "1", pre: "", suf: "-click", label: "delete everything" },
]

const faqs: Array<[string, string]> = [
  [
    "Does it really sort email by itself?",
    "Yes. After setup, Viltreon watches your inbox and labels each new message as it arrives, following the rules you set. You do not open or approve anything.",
  ],
  [
    "What can Viltreon do to my Gmail?",
    "It applies labels and can archive messages. That is all. It cannot send email on your behalf and it cannot permanently delete your mail.",
  ],
  [
    "What do you store?",
    "We never store your email bodies, attachments, the sender's address, or recipients. We keep a short sort log (label, confidence, and which model ran) and delete it within 30 days.",
  ],
  [
    "How are my credentials protected?",
    "Your Google tokens are encrypted with AES-256. You can revoke Viltreon's access from your Google Account at any time, or delete your account and all stored data with one click.",
  ],
  [
    "How long does setup take?",
    "About a minute. One Google sign-in, then describe your categories in plain English. There is no app to download and no extension to install.",
  ],
  [
    "What does it cost?",
    "A 14-day free trial. You add a card to start, but you are not charged until the trial ends; then it is $9.99/month or $99.99/year. Cancel anytime before the trial ends and you won't be charged. No lock-in.",
  ],
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={open ? "faq-item open" : "faq-item"}>
      <button className="faq-q" data-magnetic="true" onClick={() => setOpen((v) => !v)}>
        {q}
        <span className="plus">+</span>
      </button>
      <div className="faq-a" style={{ height: open ? "auto" : 0 }}>
        <div>{a}</div>
      </div>
    </div>
  )
}

export function CinematicLanding() {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return setupCinematic(root)
  }, [])

  return (
    <main ref={rootRef} className="vlt">
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="progress" id="progress" aria-hidden="true" />
      <div className="cursor" id="cursor" aria-hidden="true" />
      <div className="cursor-dot" id="cursorDot" aria-hidden="true" />

      {/* ============ PRELOADER ============ */}
      <div className="preloader" id="preloader">
        <div className="pl-inner">
          <div className="pl-brand">VILTREON</div>
          <div className="pl-count" id="plCount">000</div>
          <div className="pl-line"><i id="plLine" /></div>
        </div>
      </div>

      {/* ============ NAV ============ */}
      <nav className="nav" id="nav">
        <div className="nav-inner">
          <Link href="/" className="logo"><span className="mark">V</span> viltreon_</Link>
          <div className="nav-links">
            <a href="#sort">Live sort</a>
            <a href="#gallery">Categories</a>
            <a href="#privacy">Privacy</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link href="/auth/signin" className="nav-cta" data-magnetic="true">Sign in</Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero" id="hero">
        <div className="hero-ghost" aria-hidden="true">INBOX</div>
        <div className="hero-orb orb-1" aria-hidden="true" />
        <div className="hero-orb orb-2" aria-hidden="true" />

        <div className="floaters" aria-hidden="true">
          <div className="fmail fm1" data-depth="40"><span className="tag">Finance</span><span className="sub">Stripe payout sent</span></div>
          <div className="fmail fm2" data-depth="26"><span className="tag">Travel</span><span className="sub">Check-in is open</span></div>
          <div className="fmail fm3" data-depth="34"><span className="tag">Receipts</span><span className="sub">Your receipt from Figma</span></div>
          <div className="fmail fm4" data-depth="22"><span className="tag">Work</span><span className="sub">Q3 board deck review</span></div>
        </div>

        <div className="container">
          <div className="hero-content">
            <div className="hero-badge"><span className="pulse" /> Live Gmail sorting</div>
            <h1>
              <span className="l1">Stop sorting email.</span><br />
              <span className="l2">It sorts itself.</span>
            </h1>
            <p className="subtitle">From an inbox you triage every morning to one that files itself the moment mail lands. You set the rules once. Viltreon does the rest, live.</p>
            <div className="hero-cta-row">
              <Link href="/auth/signin" className="btn btn-primary" data-magnetic="true">Start free trial <span className="arrow">→</span></Link>
              <a href="#sort" className="btn btn-ghost" data-magnetic="true">Watch it sort</a>
            </div>
            <p className="hero-micro">14-day free trial · Cancel anytime · Revoke access anytime</p>
          </div>
        </div>

        <div className="scroll-cue" aria-hidden="true"><span>Scroll</span><span className="chev" /></div>
      </header>

      {/* ============ MARQUEE ============ */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track" id="marquee">
          {[...marqueeCats, ...marqueeCats].map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </div>

      {/* ============ MANIFESTO ============ */}
      <section className="manifesto" id="manifesto">
        <div className="mani-pin">
          <p className="lit" id="lit">
            {manifestoWords.map((w, i) => (
              <Fragment key={i}>
                <span className={w.accent ? "w accent" : "w"}>{w.text}</span>{" "}
              </Fragment>
            ))}
          </p>
        </div>
      </section>

      {/* ============ SORT SCRUB (the reveal) ============ */}
      <section className="sort" id="sort">
        <div className="sort-pin">
          <div className="sort-hud">
            <span className="mono">LIVE_SORT // scope = label + archive</span>
            <span className="k"><b id="sortNum">0</b> <span className="mono">sorted</span></span>
          </div>
          <div className="sort-field" id="sortField">
            <div className="intake" id="intake" aria-hidden="true" />

            <article className="scard" data-cat="work">
              <div className="sc-row"><span>Jordan Lee</span><span>now</span></div>
              <div className="sc-subj">Q3 board deck review</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Work</span><span className="conf">98%</span></div>
            </article>
            <article className="scard" data-cat="receipts">
              <div className="sc-row"><span>Figma</span><span>now</span></div>
              <div className="sc-subj">Your receipt from Figma</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Receipts</span><span className="conf">99%</span></div>
            </article>
            <article className="scard" data-cat="travel">
              <div className="sc-row"><span>Virgin Atlantic</span><span>now</span></div>
              <div className="sc-subj">Flight VS024 — check-in open</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Travel</span><span className="conf">97%</span></div>
            </article>
            <article className="scard" data-cat="finance">
              <div className="sc-row"><span>Stripe</span><span>now</span></div>
              <div className="sc-subj">Payout sent to your bank</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Finance</span><span className="conf">96%</span></div>
            </article>
            <article className="scard" data-cat="newsletters">
              <div className="sc-row"><span>The Browser</span><span>now</span></div>
              <div className="sc-subj">Five links worth reading</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Newsletters</span><span className="conf">94%</span></div>
            </article>
            <article className="scard" data-cat="personal">
              <div className="sc-row"><span>Mom</span><span>now</span></div>
              <div className="sc-subj">Dinner on Sunday?</div>
              <div className="sc-scan"><i /></div>
              <div className="sc-tag"><span className="dot" /><span className="cat">Personal</span><span className="conf">92%</span></div>
            </article>

            <aside className="lanes" id="lanes">
              <div className="lane" data-cat="work"><span className="fill" /><span className="ln-name">Work</span><span className="ln-n">01</span></div>
              <div className="lane" data-cat="finance"><span className="fill" /><span className="ln-name">Finance</span><span className="ln-n">02</span></div>
              <div className="lane" data-cat="travel"><span className="fill" /><span className="ln-name">Travel</span><span className="ln-n">03</span></div>
              <div className="lane" data-cat="receipts"><span className="fill" /><span className="ln-name">Receipts</span><span className="ln-n">04</span></div>
              <div className="lane" data-cat="newsletters"><span className="fill" /><span className="ln-name">Newsletters</span><span className="ln-n">05</span></div>
              <div className="lane" data-cat="calendar"><span className="fill" /><span className="ln-name">Calendar</span><span className="ln-n">06</span></div>
              <div className="lane" data-cat="social"><span className="fill" /><span className="ln-name">Social</span><span className="ln-n">07</span></div>
              <div className="lane" data-cat="personal"><span className="fill" /><span className="ln-name">Personal</span><span className="ln-n">08</span></div>
            </aside>
          </div>
        </div>
      </section>

      {/* ============ HORIZONTAL GALLERY ============ */}
      <section className="gallery" id="gallery">
        <div className="gal-pin">
          <div className="gal-head eyebrow">Your taxonomy, in motion</div>
          <div className="gal-track" id="galTrack">
            <div className="panel edge intro">
              <div className="p-i">// CATEGORIES</div>
              <h3>Labels<br />you own.</h3>
            </div>
            <div className="panel"><div className="p-i">01 / WORK</div><h3>Work</h3><p className="p-desc">Threads, decks, and replies that actually need you. Everything from your team and clients, filed on arrival.</p><div className="p-sample"><span className="dot" />Q3 board deck review · 98%</div></div>
            <div className="panel"><div className="p-i">02 / FINANCE</div><h3>Finance</h3><p className="p-desc">Payouts, invoices, statements. The money mail, gathered in one lane instead of scattered across your inbox.</p><div className="p-sample"><span className="dot" />Payout sent to your bank · 96%</div></div>
            <div className="panel"><div className="p-i">03 / TRAVEL</div><h3>Travel</h3><p className="p-desc">Bookings, check-ins, itineraries. Pulled together so the trip is one tap away when you are running for the gate.</p><div className="p-sample"><span className="dot" />Flight VS024 — check-in open · 97%</div></div>
            <div className="panel"><div className="p-i">04 / RECEIPTS</div><h3>Receipts</h3><p className="p-desc">Every purchase confirmation, in one place. Expense season stops being an archaeology dig.</p><div className="p-sample"><span className="dot" />Your receipt from Figma · 99%</div></div>
            <div className="panel"><div className="p-i">05 / NEWSLETTERS</div><h3>News.</h3><p className="p-desc">The reading you opted into, out of the way until you want it. Your inbox stops being a feed.</p><div className="p-sample"><span className="dot" />Five links worth reading · 94%</div></div>
            <div className="panel edge intro">
              <div className="p-i">// AND MORE</div>
              <h3>You<br />decide.</h3>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="stats" id="stats" aria-label="What Viltreon keeps">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <b data-count={s.count} data-pre={s.pre} data-suf={s.suf}>{s.pre}{s.count}<span className="u">{s.suf}</span></b>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="block" id="how">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">Protocol</div>
            <h2>Three steps. The last one is doing nothing.</h2>
            <p>Setup is finite. Sorting is silent. Once it is running, Viltreon asks nothing more of you.</p>
          </div>
          <div className="steps">
            <div className="step reveal">
              <span className="num">STEP_01</span><span className="tag">~30s</span>
              <h3>Connect</h3>
              <p>One Google sign-in. Viltreon gets permission to label and archive your mail. It cannot send email and cannot permanently delete anything.</p>
              <div className="code">{"> auth.scope = label + archive"}</div>
            </div>
            <div className="step reveal">
              <span className="num">STEP_02</span><span className="tag">plain english</span>
              <h3>Make your labels</h3>
              <p>Create your own labels, or keep the ones already in your inbox. Then say what belongs in each, in plain English. &quot;Receipts to Finance, newsletters to Read Later.&quot; Rewrite them whenever.</p>
              <div className="code">{"> rules.custom = user_defined"}</div>
            </div>
            <div className="step reveal">
              <span className="num">STEP_03</span><span className="tag">real-time</span>
              <h3>Forget it</h3>
              <p>New mail is sorted the moment it arrives. No queue to review, no app to open. You do nothing.</p>
              <div className="code">{"> mode = live"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="block" id="why">
        <div className="container">
          <div className="section-head center reveal">
            <div className="eyebrow">Why Viltreon</div>
            <h2>Built to disappear into your workflow.</h2>
          </div>
          <div className="features">
            <div className="feature reveal">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" /></svg>
              <h3>Real-time</h3>
              <p>Sorted the moment it lands. A new email is filed before you would have opened it.</p>
            </div>
            <div className="feature reveal">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12l5 5L20 7" /></svg>
              <h3>Hands-off</h3>
              <p>Set your rules once. No daily triage, no inbox to babysit, no new app to check.</p>
            </div>
            <div className="feature reveal">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              <h3>Your labels</h3>
              <p>Create your own labels or keep the ones you have. The AI sorts into the categories you define, in plain English.</p>
            </div>
            <div className="feature reveal">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z" /></svg>
              <h3>Minimal footprint</h3>
              <p>We label your mail. We do not hoard it. See exactly what we keep below.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PRIVACY ============ */}
      <section className="block" id="privacy">
        <div className="container">
          <div className="section-head center reveal">
            <div className="eyebrow">Minimum footprint</div>
            <h2>We label your mail. We do not hoard it.</h2>
            <p>Sorting needs almost none of your data kept. So we keep almost none of it.</p>
          </div>
          <div className="priv-grid reveal">
            <div className="priv-col never">
              <div className="h">Never stored</div>
              <ul>
                <li><span className="sym">×</span> Email bodies</li>
                <li><span className="sym">×</span> Attachments</li>
                <li><span className="sym">×</span> The sender&apos;s address</li>
                <li><span className="sym">×</span> Recipients</li>
                <li><span className="sym">×</span> Your payment card</li>
              </ul>
            </div>
            <div className="priv-col keep">
              <div className="h">Kept briefly, deleted within 30 days</div>
              <ul>
                <li><span className="sym">+</span> The label applied</li>
                <li><span className="sym">+</span> A confidence score</li>
                <li><span className="sym">+</span> Which model ran</li>
              </ul>
            </div>
          </div>
          <p className="priv-foot reveal">OAuth tokens encrypted with AES-256 · Delete everything with one click · Revoke from Google anytime</p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="block" id="faq">
        <div className="container">
          <div className="section-head center reveal">
            <div className="eyebrow">FAQ</div>
            <h2>Straight answers.</h2>
          </div>
          <div className="faq reveal" id="faqList">
            {faqs.map(([q, a]) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="final" id="cta">
        <div className="glow" aria-hidden="true" />
        <div className="final-inner">
          <h2 className="reveal">Your inbox,<br />on autopilot.</h2>
          <p className="reveal">Connect Gmail, set your rules, and let Viltreon file the rest.</p>
          <div className="hero-cta-row reveal" style={{ marginTop: 40 }}>
            <Link href="/auth/signin" className="btn btn-primary" data-magnetic="true">Start free trial <span className="arrow">→</span></Link>
            <Link href="/pricing" className="btn btn-ghost" data-magnetic="true">See pricing</Link>
          </div>
          <p className="hero-micro reveal">14-day free trial · then $9.99/mo · cancel anytime</p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="foot-inner">
          <div className="c"><i /> viltreon_ · No trackers on this page</div>
          <div className="foot-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support@viltreon.com">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
