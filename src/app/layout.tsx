import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/shared/providers"

// Inter is the app default (applied via .className on <body>). The `variable`
// option also exposes it as --font-sans; JetBrains Mono is exposed as
// --font-mono. The cinematic landing page reads both CSS variables instead of
// loading any external font CDN, which the per-request CSP would block.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" })

// Force per-request rendering for every page. The middleware in src/proxy.ts
// generates a fresh CSP nonce on each request; if any page is statically
// prerendered at build time, its <script> tags get baked with no nonce and
// the per-request CSP refuses to execute them — breaking hydration site-wide
// (no theme toggle, no useSession, no client-side interaction).
export const dynamic = "force-dynamic"

// metadataBase makes every relative OG/twitter image URL absolute (required
// by scrapers); the title template gives subpages "Pricing | Viltreon"-style
// titles while the landing page keeps its own full title.
export const metadata: Metadata = {
  metadataBase: new URL("https://viltreon.com"),
  title: {
    default: "Viltreon - AI Gmail Sorter",
    template: "%s | Viltreon",
  },
  description: "Hands-off AI inbox sorting for Gmail. Every new email is filed the moment it arrives, by rules you set once. We never store your email body or who sent it.",
  openGraph: {
    title: "Viltreon - AI Gmail Sorter",
    description: "Every new email files itself the moment it arrives, by rules you write in plain English. We never store your email content.",
    url: "https://viltreon.com",
    siteName: "Viltreon",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Viltreon - Stop sorting email. Let it sort itself." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Viltreon - AI Gmail Sorter",
    description: "Every new email files itself the moment it arrives, by rules you write in plain English. We never store your email content.",
    images: ["/og.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Warm up the Google OAuth origins so the first sign-in click is snappy;
            dns-prefetch the Groq AI endpoint for the same reason. */}
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="preconnect" href="https://oauth2.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.groq.com" />
      </head>
      <body className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} selection:bg-[#D86B5A] selection:text-white`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
