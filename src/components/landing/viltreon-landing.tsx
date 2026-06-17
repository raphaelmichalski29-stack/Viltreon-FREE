"use client"

/**
 * Viltreon landing page in the "midnight azure" glass style, matching the
 * dashboard. Reuses the dashboard's 3D mail and glass/chip/button classes
 * (from activity-dashboard.css) so the marketing surface and the product share
 * one visual language.
 *
 * Plain `motion` (already a dependency) drives the scroll reveals. No GSAP /
 * Lenis / CDNs — keeps it light and CSP-safe. Reduced motion is respected.
 *
 * Copy sells outcomes (time saved, an organized inbox, set-and-forget), not
 * mechanics.
 */

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import {
  Zap,
  Clock,
  Sparkles,
  Inbox,
  FolderTree,
  MessageSquareText,
  Lock,
  ArrowRight,
  Plus,
} from "lucide-react"
import { Mail3D } from "@/components/dashboard/activity-visuals"
import "@/components/dashboard/activity-dashboard.css"
import "./viltreon-landing.css"

function InView({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

const RESULTS = [
  { icon: Clock, title: "Get your time back", body: "The hours you lose filing email every week are yours again. Spend them on something that matters." },
  { icon: Inbox, title: "An always-organized inbox", body: "Every message lands in the right place the moment it arrives. No backlog, no clutter, no inbox guilt." },
  { icon: Sparkles, title: "Set it once, forget it", body: "Tell Viltreon how you like things sorted. After that it runs quietly in the background, on its own." },
]

const FEATURES = [
  { icon: Zap, title: "Sorted the second it lands", body: "New mail is filed the instant it arrives. You just watch your inbox stay clean." },
  { icon: FolderTree, title: "Uses the labels you already have", body: "Keep your current labels or add new ones. Nothing to rebuild, nothing to learn." },
  { icon: MessageSquareText, title: "Organized your way", body: "Sort by what matters to you, in plain words. It fits how you work, not the other way around." },
  { icon: Inbox, title: "Important mail stays in view", body: "The noise gets filed out of the way. The things you actually need stay where you'll see them." },
  { icon: Sparkles, title: "Nothing to manage", body: "No rules to babysit, no daily cleanup. It keeps working whether or not you think about it." },
  { icon: Lock, title: "Private by default", body: "We organize your mail without keeping it. Your inbox stays yours." },
]

const FAQS = [
  { q: "Will it mess up my inbox?", a: "No. You stay in control. Anything Viltreon isn't sure about goes to a catch-all label instead of disappearing, and you can change how it sorts anytime." },
  { q: "Do I have to set up complicated rules?", a: "No. Point it at your labels, say roughly what goes where, and walk away. That's the whole idea: set it once and forget it." },
  { q: "What about the emails I already have?", a: "New mail is sorted the moment it arrives. You can also clean up your current inbox in one click whenever you want." },
  { q: "Is my email private?", a: "Yes. Viltreon organizes your mail without keeping it. Your inbox stays yours." },
  { q: "What does it cost?", a: "Start free, then one simple plan with no per-email limits. See the pricing page for details." },
]

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="vl-faq__item">
      <button className="vl-faq__q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {q}
        <Plus className="vl-faq__icon h-5 w-5 shrink-0" data-open={open} />
      </button>
      <motion.div
        className="vl-faq__a"
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="pb-5 pr-8">{a}</p>
      </motion.div>
    </div>
  )
}

export function ViltreonLanding() {
  // Paint the page backdrop indigo so overscroll / rubber-banding doesn't flash
  // the global theme background behind the fixed aurora.
  useEffect(() => {
    const prevBody = document.body.style.background
    const prevHtml = document.documentElement.style.background
    document.body.style.background = "#0a1230"
    document.documentElement.style.background = "#0a1230"
    return () => {
      document.body.style.background = prevBody
      document.documentElement.style.background = prevHtml
    }
  }, [])

  return (
    <div className="vlt-land">
      <div className="vl-aurora" aria-hidden="true">
        <div className="vl-aurora__grid" />
        <div className="vl-aurora__blob vl-aurora__blob--a" />
        <div className="vl-aurora__blob vl-aurora__blob--b" />
        <div className="vl-aurora__blob vl-aurora__blob--c" />
      </div>

      <div className="vl-content">
        {/* NAV */}
        <header className="vl-nav">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="vl-nav__brand">
              <Image src="/logo-circle.png" alt="Viltreon" width={26} height={26} unoptimized />
              <span>viltreon_</span>
            </Link>
            <nav className="hidden items-center gap-8 md:flex">
              <a href="#results" className="vl-nav__link">Benefits</a>
              <a href="#features" className="vl-nav__link">Features</a>
              <Link href="/pricing" className="vl-nav__link">Pricing</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/auth/signin" className="vl-nav__link hidden sm:inline">Sign in</Link>
              <Link href="/auth/signin" className="vlt-btn px-4 py-2 text-sm font-semibold">Get started</Link>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-16 md:grid-cols-[1.05fr_0.95fr] md:pt-24">
          <InView>
            <span className="vl-eyebrow">Your inbox, on autopilot</span>
            <h1 className="vl-display mt-4 text-5xl md:text-6xl">
              Stop sorting email.<br />It sorts itself.
            </h1>
            <p className="vlt-muted mt-5 max-w-xl text-lg">
              Viltreon files every new email into the right label the moment it lands. You get a
              clean, organized inbox and hours back every week. Set it up once and forget it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth/signin" className="vlt-btn inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="vlt-chip" style={{ padding: "10px 16px" }}>
                See pricing
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="vlt-chip"><Clock className="h-3.5 w-3.5" /> Hours back every week</span>
              <span className="vlt-chip"><Sparkles className="h-3.5 w-3.5" /> Sorts itself, automatically</span>
              <span className="vlt-chip"><Lock className="h-3.5 w-3.5" /> Private by default</span>
            </div>
          </InView>

          <InView delay={0.1}>
            <Mail3D />
          </InView>
        </section>

        {/* WHAT YOU GET */}
        <section id="results" className="mx-auto max-w-6xl px-5 py-20">
          <InView className="mb-12 text-center">
            <span className="vl-eyebrow">What you get</span>
            <h2 className="vl-display mt-3 text-3xl md:text-4xl">An inbox that runs itself</h2>
          </InView>
          <div className="grid gap-5 md:grid-cols-3">
            {RESULTS.map((r, i) => (
              <InView key={r.title} delay={0.08 * i}>
                <div className="vlt-card h-full p-6">
                  <span className="vl-ic"><r.icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
                  <p className="vlt-muted mt-2 text-sm leading-relaxed">{r.body}</p>
                </div>
              </InView>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-20">
          <InView className="mb-12 text-center">
            <span className="vl-eyebrow">Why Viltreon</span>
            <h2 className="vl-display mt-3 text-3xl md:text-4xl">Less inbox. More life.</h2>
          </InView>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <InView key={f.title} delay={0.05 * i}>
                <div className="vlt-card h-full p-6">
                  <span className="vl-ic"><f.icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="vlt-muted mt-2 text-sm leading-relaxed">{f.body}</p>
                </div>
              </InView>
            ))}
          </div>
        </section>

        {/* PRIVACY (light, benefit-framed) */}
        <section id="privacy" className="mx-auto max-w-3xl px-5 py-20">
          <InView>
            <div className="vlt-card p-8 text-center md:p-12">
              <span className="vl-eyebrow">Private by default</span>
              <h2 className="vl-display mx-auto mt-3 max-w-xl text-3xl md:text-4xl">Your inbox stays yours</h2>
              <p className="vlt-muted mx-auto mt-4 max-w-lg text-base leading-relaxed">
                Viltreon organizes your email without keeping it. We sort it and move on. No reading
                it for anything else, no hoarding. That's the whole deal.
              </p>
              <Link href="/privacy" className="mt-6 inline-flex items-center gap-2 text-sm" style={{ color: "#8fb6ff" }}>
                Read the privacy policy <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </InView>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <InView>
            <div className="vlt-card relative overflow-hidden p-10 text-center md:p-16">
              <span className="vl-eyebrow">Ready when you are</span>
              <h2 className="vl-display mx-auto mt-3 max-w-2xl text-3xl md:text-5xl">
                Let your inbox sort itself
              </h2>
              <p className="vlt-muted mx-auto mt-4 max-w-lg text-base">
                Set it up in a couple of minutes, then never file an email again.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/auth/signin" className="vlt-btn inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/pricing" className="vlt-chip" style={{ padding: "10px 16px" }}>See pricing</Link>
              </div>
            </div>
          </InView>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 py-20">
          <InView className="mb-8 text-center">
            <span className="vl-eyebrow">Questions</span>
            <h2 className="vl-display mt-3 text-3xl md:text-4xl">Good to know</h2>
          </InView>
          <InView className="vl-faq">
            {FAQS.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </InView>
        </section>

        {/* FOOTER */}
        <footer className="vl-footer">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 pt-10 pb-4 sm:flex-row">
            <Link href="/" className="vl-nav__brand">
              <Image src="/logo-circle.png" alt="Viltreon" width={24} height={24} unoptimized />
              <span>viltreon_</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-5 text-sm" style={{ color: "var(--d-muted)" }}>
              <Link href="/pricing" className="vl-nav__link">Pricing</Link>
              <Link href="/terms" className="vl-nav__link">Terms</Link>
              <Link href="/privacy" className="vl-nav__link">Privacy</Link>
              <Link href="/billing-terms" className="vl-nav__link">Billing</Link>
              <Link href="/website-terms" className="vl-nav__link">Website Terms</Link>
              <Link href="/auth/signin" className="vl-nav__link">Sign in</Link>
            </div>
            <p className="vlt-faint text-xs">© {new Date().getFullYear()} Viltreon</p>
          </div>
          {/* FT4: AI disclaimer — the deliberate exception to the results-only
              rule; it names the "how" because putting users on notice limits
              liability. Mirrors the Terms disclaimer. */}
          <div className="mx-auto max-w-3xl px-5 pb-10">
            <p className="vlt-faint text-center text-xs leading-relaxed">
              Viltreon uses AI, which operates on complex algorithms and may not always
              produce the intended result. You remain responsible for reviewing important
              emails. Nothing is ever deleted, and you can adjust how it sorts anytime.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
