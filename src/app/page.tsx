import type { Metadata } from "next"
import { EditorialLanding } from "@/components/landing/editorial-landing"
import { prisma } from "@/lib/db"
import { getOrSet, cacheKey } from "@/lib/cache"

export const metadata: Metadata = {
  title: "Viltreon - Effortless Email",
  description:
    "Hands-off Gmail sorting. Set your rules once in plain English and every new email is filed the moment it arrives. We never store your email body, sender, or recipients.",
  alternates: { canonical: "/" },
}

// Only surface the all-time "emails sorted" counter once it is genuinely
// impressive. A small number reads as "nobody uses this" and costs more
// conversion than showing nothing, so below this threshold the counter is
// hidden entirely. Tune via the LANDING_SORT_COUNTER_MIN env var (a reload,
// no code change) when the volume is there.
const COUNTER_MIN_DISPLAY = Number(process.env.LANDING_SORT_COUNTER_MIN || 50000)

// Total emails ever sorted — one SortingLog row is written per applied label
// (skips/failures aren't logged), so a plain count is exactly that figure.
// Cached 5 min so the landing page never runs a COUNT per visit; falls back to
// in-memory cache when Redis is down, and to a hidden counter if the query
// fails — a marketing stat must never break the page.
async function getSortedCount(): Promise<number> {
  try {
    return await getOrSet(cacheKey("landing", "sorted-count"), () => prisma.sortingLog.count(), 300)
  } catch {
    return 0
  }
}

// Structured data so Google (rich results) and AI assistants understand the
// entity: what Viltreon is, what it does, what it costs. JSON-LD data blocks
// are not executable scripts, so the per-request CSP nonce doesn't apply.
// Organization + WebSite establish the brand entity (site name in results,
// disambiguation from similar-sounding brands); SoftwareApplication carries
// the product and pricing. Add social profile URLs to `sameAs` as they exist.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://viltreon.com/#org",
      name: "Viltreon",
      url: "https://viltreon.com",
      logo: "https://viltreon.com/logo-circle.png",
      email: "support@viltreon.com",
    },
    {
      "@type": "WebSite",
      "@id": "https://viltreon.com/#website",
      name: "Viltreon",
      url: "https://viltreon.com",
      publisher: { "@id": "https://viltreon.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Viltreon",
      url: "https://viltreon.com",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      description:
        "AI Gmail sorter that files every email automatically the moment it arrives, using rules written in plain English. Never stores email content.",
      offers: [
        { "@type": "Offer", name: "Monthly", price: "9.99", priceCurrency: "USD" },
        { "@type": "Offer", name: "Annual", price: "99.99", priceCurrency: "USD" },
      ],
      publisher: { "@id": "https://viltreon.com/#org" },
    },
  ],
}

export default async function LandingPage() {
  const total = await getSortedCount()
  const sortedCount = total >= COUNTER_MIN_DISPLAY ? total : null
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EditorialLanding sortedCount={sortedCount} />
    </>
  )
}
