// GSAP + Lenis setup for the cinematic landing page, ported faithfully from
// landing-pages/viltreon-cinematic.html. Runs client-side only (called from a
// useEffect). Everything created here is torn down by the returned cleanup so
// it leaves no listeners, tickers, ScrollTriggers, Lenis instance, or mutated
// document styles behind on route change / React strict-mode remount.

import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

export function setupCinematic(root: HTMLElement): () => void {
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches

  gsap.registerPlugin(ScrollTrigger)

  // Disables the CSS safety auto-reveal; JS now owns the timeline.
  root.classList.add("vlt-ready")

  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T | null
  const $$ = (sel: string) => Array.from(root.querySelectorAll(sel)) as HTMLElement[]

  const preloaderEl = $("#preloader") as HTMLElement | null

  /* ============================================================
     REDUCED MOTION: reveal everything, lay the sort field out
     statically, no pinning / scrubbing. (No-GSAP is impossible
     here since gsap is bundled, so we only branch on reduce.)
  ============================================================ */
  if (REDUCE) {
    if (preloaderEl) preloaderEl.style.display = "none"
    $$(".reveal").forEach((n) => (n.style.opacity = "1"))
    $$(".lit .w").forEach((n) => n.classList.add("on"))
    const sn = $("#sortNum")
    if (sn) sn.textContent = "6"
    $$(".lane").forEach((l, i) => { if (i < 6) l.classList.add("lit") })
    $$(".scard").forEach((c) => {
      c.style.position = "static"
      c.style.transform = "none"
      c.style.width = "100%"
      c.style.marginBottom = "12px"
    })
    const field = $("#sortField")
    if (field) {
      field.style.height = "auto"
      field.style.display = "grid"
      field.style.gridTemplateColumns = "1fr 1fr"
      field.style.gap = "24px"
    }
    return () => {}
  }

  /* ---------- bookkeeping for full teardown ---------- */
  const disposers: Array<() => void> = []
  let disposed = false
  const prevScrollRestoration = history.scrollRestoration
  const prevBodyBg = document.body.style.background
  const prevBodyOverflowX = document.body.style.overflowX
  document.body.style.background = "#060607"
  document.body.style.overflowX = "hidden"

  /* ---------- Lenis smooth scroll fused with ScrollTrigger ---------- */
  let lenis: Lenis | null = null
  if (!TOUCH) {
    try {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true })
      const onLenisScroll = () => ScrollTrigger.update()
      lenis.on("scroll", onLenisScroll)
      const tickerFn = (time: number) => { lenis?.raf(time * 1000) }
      gsap.ticker.add(tickerFn)
      gsap.ticker.lagSmoothing(0)
      disposers.push(() => { gsap.ticker.remove(tickerFn) })
    } catch {
      lenis = null
    }
  }

  /* ---------- everything GSAP, scoped to the landing root ---------- */
  const ctx = gsap.context(() => {
    /* FOUC-safe hero initial states */
    gsap.set([".hero .hero-badge", ".hero h1 .l1", ".hero h1 .l2", ".hero .subtitle", ".hero .hero-cta-row", ".hero .hero-micro"], { opacity: 0, y: 36 })
    gsap.set(".scroll-cue", { opacity: 0 })
    gsap.set(".fmail", { opacity: 0, scale: 0.9 })

    function heroIn() {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.to(".hero .hero-badge", { opacity: 1, y: 0, duration: 0.6 })
        .to(".hero h1 .l1", { opacity: 1, y: 0, duration: 0.9 }, "-=0.35")
        .to(".hero h1 .l2", { opacity: 1, y: 0, duration: 0.9 }, "-=0.7")
        .to(".hero .subtitle", { opacity: 1, y: 0, duration: 0.7 }, "-=0.6")
        .to(".hero .hero-cta-row", { opacity: 1, y: 0, duration: 0.6 }, "-=0.5")
        .to(".hero .hero-micro", { opacity: 1, y: 0, duration: 0.5 }, "-=0.4")
        .to(".fmail", { opacity: 1, scale: 1, duration: 0.8, stagger: 0.12 }, "-=0.9")
        .to(".scroll-cue", { opacity: 1, duration: 0.5 }, "-=0.3")
    }

    /* ---------- preloader ---------- */
    if (history.scrollRestoration) history.scrollRestoration = "manual"
    window.scrollTo(0, 0)
    if (lenis) lenis.stop()

    const count = $("#plCount")
    const line = $("#plLine") as HTMLElement | null
    const pre = preloaderEl
    const prog = { v: 0 }

    const pl = gsap.timeline({
      onComplete: () => { if (lenis) lenis.start(); ScrollTrigger.refresh() },
    })
    pl.to(prog, {
      v: 100, duration: 1.25, ease: "power2.inOut",
      onUpdate: () => {
        const n = Math.round(prog.v)
        if (count) count.textContent = (n < 10 ? "00" : n < 100 ? "0" : "") + n
        if (line) line.style.transform = "scaleX(" + prog.v / 100 + ")"
      },
    })
      .to(".pl-inner", { opacity: 0, y: -20, duration: 0.5, ease: "power2.in" }, "+=0.15")
    if (pre) {
      pl.to(pre, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.1")
    }
    pl.add(heroIn, "-=0.45")
    if (pre) pl.set(pre, { display: "none" })

    /* ---------- continuous float on the hero cards ---------- */
    gsap.to(".fm1", { y: "+=18", duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true })
    gsap.to(".fm2", { y: "-=22", duration: 6.5, ease: "sine.inOut", repeat: -1, yoyo: true })
    gsap.to(".fm3", { y: "-=16", duration: 5.5, ease: "sine.inOut", repeat: -1, yoyo: true })
    gsap.to(".fm4", { y: "+=20", duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true })

    /* ---------- reactive marquee ---------- */
    const track = $("#marquee")
    if (track) {
      const loop = gsap.to(track, { xPercent: -50, duration: 22, ease: "none", repeat: -1 })
      ScrollTrigger.create({
        trigger: ".marquee", start: "top bottom", end: "bottom top",
        onUpdate: (self) => {
          const v = self.getVelocity()
          gsap.to(loop, { timeScale: v < 0 ? -1 : 1, duration: 0.6, overwrite: true, ease: "power2.out" })
        },
      })
    }

    /* ---------- manifesto word lighting (pinned scrub) ---------- */
    const words = gsap.utils.toArray<HTMLElement>("#lit .w")
    if (words.length) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#manifesto", start: "top top",
          end: () => "+=" + words.length * 62,
          pin: ".mani-pin", scrub: 0.6, invalidateOnRefresh: true,
        },
      })
      words.forEach((w) => {
        tl.to(w, {
          color: w.classList.contains("accent") ? "#34d399" : "#f3f3f5", duration: 1,
          onStart: () => { if (w.classList.contains("accent")) w.classList.add("on") },
          onReverseComplete: () => { if (w.classList.contains("accent")) w.classList.remove("on") },
        })
      })
    }

    /* ---------- THE SORT SCRUB ---------- */
    const field = $("#sortField")
    const intake = $("#intake")
    const lanes = $("#lanes")
    const cards = gsap.utils.toArray<HTMLElement>(".scard")
    const sortNum = $("#sortNum")
    if (field && intake && lanes && cards.length) {
      const delta = (cat: string) => {
        const lane = lanes.querySelector('.lane[data-cat="' + cat + '"]')
        if (!lane) return { dx: 0, dy: 0 }
        const ir = intake.getBoundingClientRect()
        const lr = lane.getBoundingClientRect()
        return {
          dx: lr.left + lr.width / 2 - (ir.left + ir.width / 2),
          dy: lr.top + lr.height / 2 - (ir.top + ir.height / 2),
        }
      }

      gsap.set(cards, { yPercent: -50, opacity: 0, scale: 0.85, x: 0, y: 0 })

      const counter = { v: 0 }
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".sort", start: "top top",
          end: () => "+=" + window.innerHeight * cards.length * 0.85,
          pin: ".sort-pin", scrub: 1, invalidateOnRefresh: true,
        },
      })

      cards.forEach((card, i) => {
        const cat = card.dataset.cat as string
        const scan = card.querySelector(".sc-scan > i")
        const tag = card.querySelector(".sc-tag")
        const lane = lanes.querySelector('.lane[data-cat="' + cat + '"]')
        const fill = lane ? lane.querySelector(".fill") : null
        const lab = "c" + i

        gsap.set(tag, { opacity: 0, y: 8 })
        gsap.set(scan, { scaleX: 0 })

        tl.addLabel(lab)
        tl.fromTo(card, { opacity: 0, scale: 0.85, x: 0, y: 0 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, lab)
        tl.to(scan, { scaleX: 1, duration: 0.5, ease: "power1.inOut" }, lab + "+=0.2")
        tl.to(tag, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, lab + "+=0.65")
        tl.to(card, {
          x: () => delta(cat).dx,
          y: () => delta(cat).dy,
          scale: 0.42, duration: 0.85, ease: "power3.inOut",
        }, lab + "+=1.0")
        if (fill) {
          tl.to(fill, {
            scaleY: 1, duration: 0.3, ease: "power2.out",
            onStart: () => { if (lane) lane.classList.add("lit") },
            onReverseComplete: () => { if (lane) lane.classList.remove("lit") },
          }, "<0.25")
        }
        tl.to(card, { opacity: 0, duration: 0.25, ease: "power2.in" }, ">-0.08")
        tl.to(counter, {
          v: i + 1, duration: 0.3,
          onUpdate: () => { if (sortNum) sortNum.textContent = String(Math.round(counter.v)) },
        }, "<")
      })
    }

    /* ---------- horizontal category gallery ---------- */
    const galTrack = $("#galTrack")
    if (galTrack) {
      const distance = () => galTrack.scrollWidth - window.innerWidth
      gsap.to(galTrack, {
        x: () => -distance(), ease: "none",
        scrollTrigger: {
          trigger: ".gallery", start: "top top",
          end: () => "+=" + distance(),
          pin: ".gal-pin", scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        },
      })
    }

    /* ---------- stat counters ---------- */
    $$(".stat b").forEach((b) => {
      const target = parseFloat(b.getAttribute("data-count") || "0") || 0
      const pre = b.getAttribute("data-pre") || ""
      const suf = b.getAttribute("data-suf") || ""
      const obj = { v: 0 }
      ScrollTrigger.create({
        trigger: b, start: "top 85%", once: true,
        onEnter: () => {
          gsap.to(obj, {
            v: target, duration: 1.4, ease: "power2.out",
            onUpdate: () => { b.innerHTML = pre + Math.round(obj.v) + '<span class="u">' + suf + "</span>" },
            onComplete: () => { b.innerHTML = pre + target + '<span class="u">' + suf + "</span>" },
          })
        },
      })
    })

    /* ---------- generic reveals ---------- */
    ScrollTrigger.batch(".reveal", {
      start: "top 85%",
      onEnter: (batch) => {
        gsap.fromTo(batch, { opacity: 0, y: 50, rotateX: 12 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.9, stagger: 0.1, ease: "power3.out", overwrite: true })
      },
    })
  }, root)

  /* ---------- nav scroll state ---------- */
  const nav = $("#nav")
  const navState = () => { if (nav) nav.classList.toggle("scrolled", window.scrollY > 40) }
  window.addEventListener("scroll", navState)
  navState()
  disposers.push(() => window.removeEventListener("scroll", navState))

  /* ---------- scroll progress ---------- */
  const bar = $("#progress") as HTMLElement | null
  const progress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (bar) bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")"
  }
  window.addEventListener("scroll", progress)
  progress()
  disposers.push(() => window.removeEventListener("scroll", progress))

  /* ---------- mouse parallax (hero floaters) ---------- */
  if (!TOUCH) {
    const hero = $("#hero")
    if (hero) {
      const onHeroMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2
        const y = (e.clientY / window.innerHeight - 0.5) * 2
        $$(".fmail").forEach((m) => {
          const d = parseFloat(m.getAttribute("data-depth") || "20") || 20
          gsap.to(m, { x: x * d, y: y * (d * 0.5), duration: 0.9, ease: "power2.out" })
        })
        const ghost = $(".hero-ghost")
        if (ghost) gsap.to(ghost, { x: x * 18, y: y * 10, duration: 1, ease: "power2.out" })
      }
      hero.addEventListener("mousemove", onHeroMove)
      disposers.push(() => hero.removeEventListener("mousemove", onHeroMove))
    }
  }

  /* ---------- custom cursor + magnetic ---------- */
  if (!TOUCH) {
    root.classList.add("has-cursor")
    const cur = $("#cursor") as HTMLElement | null
    const dot = $("#cursorDot") as HTMLElement | null
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2, dx = cx, dy = cy
    const onMove = (e: MouseEvent) => { cx = e.clientX; cy = e.clientY; if (dot) gsap.set(dot, { x: cx, y: cy }) }
    window.addEventListener("mousemove", onMove)
    const cursorTick = () => { dx += (cx - dx) * 0.18; dy += (cy - dy) * 0.18; if (cur) gsap.set(cur, { x: dx, y: dy }) }
    gsap.ticker.add(cursorTick)
    disposers.push(() => {
      window.removeEventListener("mousemove", onMove)
      gsap.ticker.remove(cursorTick)
      root.classList.remove("has-cursor")
    })

    $$("[data-magnetic]").forEach((el) => {
      const onEnter = () => { if (cur) cur.classList.add("hot") }
      const onLeave = () => { if (cur) cur.classList.remove("hot"); gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" }) }
      const onMagMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        const mx = e.clientX - (r.left + r.width / 2)
        const my = e.clientY - (r.top + r.height / 2)
        gsap.to(el, { x: mx * 0.28, y: my * 0.4, duration: 0.5, ease: "power3.out" })
      }
      el.addEventListener("mouseenter", onEnter)
      el.addEventListener("mouseleave", onLeave)
      el.addEventListener("mousemove", onMagMove)
      disposers.push(() => {
        el.removeEventListener("mouseenter", onEnter)
        el.removeEventListener("mouseleave", onLeave)
        el.removeEventListener("mousemove", onMagMove)
      })
    })
  }

  /* ---------- in-page anchor smooth scroll (Lenis, with native fallback) ---------- */
  const onAnchorClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute("href")
    if (!href || href === "#") return
    const target = root.querySelector(href)
    if (!target) return
    e.preventDefault()
    if (lenis) lenis.scrollTo(target as HTMLElement)
    else (target as HTMLElement).scrollIntoView({ behavior: "smooth" })
  }
  root.addEventListener("click", onAnchorClick)
  disposers.push(() => root.removeEventListener("click", onAnchorClick))

  /* ---------- refresh after fonts/load so pinned math is correct ---------- */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh() })
  }
  const onLoad = () => ScrollTrigger.refresh()
  window.addEventListener("load", onLoad)
  disposers.push(() => window.removeEventListener("load", onLoad))

  /* ---------- teardown ---------- */
  return () => {
    disposed = true
    disposers.forEach((fn) => fn())
    ctx.revert()
    if (lenis) lenis.destroy()
    gsap.ticker.lagSmoothing(500, 33)
    if (history.scrollRestoration) history.scrollRestoration = prevScrollRestoration
    document.body.style.background = prevBodyBg
    document.body.style.overflowX = prevBodyOverflowX
  }
}
