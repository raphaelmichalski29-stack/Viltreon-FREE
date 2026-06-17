import type { MetadataRoute } from "next"

// Served at /sitemap.xml (public via the middleware's .xml asset pass).
// Only public, indexable pages belong here — never /dashboard or /setup.
// Add future blog posts to this list (or replace with a dynamic source).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://viltreon.com"
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/billing-terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/website-terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
