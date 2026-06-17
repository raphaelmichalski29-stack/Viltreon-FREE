"use client"

/**
 * Presentational building blocks for the reimagined "Activity" dashboard.
 * Pure visuals — no data fetching, no business logic. The 3D mail is built
 * from CSS 3D transforms (transform-style: preserve-3d), so it ships with zero
 * extra dependencies and works under the per-request CSP. Motion is the
 * already-installed `motion` (Framer) package.
 *
 * All decorative motion respects `prefers-reduced-motion` (handled here in JS
 * and in activity-dashboard.css).
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { Check, type LucideIcon } from "lucide-react"

/** Allow CSS custom properties in inline style objects without `any` leaks. */
type Vars = CSSProperties & Record<`--${string}`, string | number>

/* ---------------------------------------------------------------------- */
/*  Entrance reveal                                                        */
/* ---------------------------------------------------------------------- */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* ---------------------------------------------------------------------- */
/*  Count-up number ticker (rAF based — no extra deps)                     */
/* ---------------------------------------------------------------------- */
export function NumberTicker({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(0)

  useEffect(() => {
    const to = value
    if (reduce) {
      setDisplay(to)
      fromRef.current = to
      return
    }
    const from = fromRef.current
    if (from === to) {
      setDisplay(to)
      return
    }
    const duration = 1100
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])

  return <>{Math.round(display).toLocaleString()}</>
}

/* ---------------------------------------------------------------------- */
/*  Glass stat card with cursor-follow spotlight                           */
/* ---------------------------------------------------------------------- */
export function GlassStatCard({
  title,
  description,
  icon: Icon,
  loading,
  children,
}: {
  title: string
  description: string
  icon: LucideIcon
  loading?: boolean
  children: ReactNode
}) {
  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - r.left}px`)
    el.style.setProperty("--my", `${e.clientY - r.top}px`)
  }

  return (
    <div className="vlt-card vlt-stat p-5" onMouseMove={handleMove}>
      <div className="vlt-stat__spot" aria-hidden />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--d-muted)" }}>
          {title}
        </span>
        <span className="vlt-stat__icon" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="vlt-stat__value mt-3 text-3xl font-bold">
        {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-white/15" /> : children}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--d-faint)" }}>
        {description}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/*  Aurora / ambient background                                            */
/* ---------------------------------------------------------------------- */
export function AuroraBackdrop() {
  return (
    <div className="vlt-dash__bg" aria-hidden>
      <div className="vlt-dash__grid" />
      <div className="vlt-dash__blob vlt-dash__blob--a" />
      <div className="vlt-dash__blob vlt-dash__blob--b" />
      <div className="vlt-dash__blob vlt-dash__blob--c" />
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/*  The 3D spinning mail                                                   */
/* ---------------------------------------------------------------------- */
const PARTICLES: { px: number; py: number; delay: number }[] = [
  { px: -150, py: -40, delay: 0 },
  { px: 140, py: -70, delay: 0.6 },
  { px: -120, py: 60, delay: 1.2 },
  { px: 170, py: 30, delay: 1.8 },
  { px: -180, py: -10, delay: 2.4 },
  { px: 110, py: 90, delay: 3.0 },
  { px: -90, py: -90, delay: 3.6 },
  { px: 160, py: -30, delay: 4.2 },
  { px: -150, py: 30, delay: 0.9 },
  { px: 90, py: -100, delay: 2.1 },
]

export function Mail3D() {
  const reduce = useReducedMotion()
  const particles = useMemo(() => PARTICLES, [])

  return (
    <div className="mail3d" aria-hidden>
      <div className="mail3d__glow" />
      <div className="mail3d__orbit" />

      <div className="mail3d__scene">
        <div className="mail3d__cube">
          {/* envelope front */}
          <div className="mail3d__face mail3d__face--front">
            <div className="env-flap" />
            <div className="env-pocket-left" />
            <div className="env-pocket-right" />
            <div className="env-seal">
              <Image src="/logo-circle.png" alt="" width={26} height={26} unoptimized />
            </div>
          </div>

          {/* letter that rises out of the envelope */}
          <div className="mail3d__letter">
            <span />
            <span />
            <span />
            <span />
            <i className="mail3d__letter__check">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </i>
          </div>

          {/* the remaining 5 faces give the envelope real depth */}
          <div className="mail3d__face mail3d__face--back" />
          <div className="mail3d__face mail3d__face--right" />
          <div className="mail3d__face mail3d__face--left" />
          <div className="mail3d__face mail3d__face--top" />
          <div className="mail3d__face mail3d__face--bottom" />
        </div>
      </div>

      {!reduce && (
        <div className="mail3d__particles">
          {particles.map((p, i) => (
            <span
              key={i}
              className="mail3d__particle"
              style={
                {
                  left: "50%",
                  top: "45%",
                  marginLeft: -3,
                  marginTop: -3,
                  "--px": `${p.px}px`,
                  "--py": `${p.py}px`,
                  animationDelay: `${p.delay}s`,
                } as Vars
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
