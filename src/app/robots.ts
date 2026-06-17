import type { MetadataRoute } from "next"

// Served at /robots.txt (the middleware's public-asset regex lets .txt through
// without auth). Private/app routes are excluded from crawling; everything
// public is open. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are
// listed explicitly and allowed on purpose: being readable by AI assistants is
// how Viltreon gets recommended in their answers — do not blocklist them.
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/dashboard", "/setup", "/api/", "/auth/"]
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow,
      },
    ],
    sitemap: "https://viltreon.com/sitemap.xml",
  }
}
