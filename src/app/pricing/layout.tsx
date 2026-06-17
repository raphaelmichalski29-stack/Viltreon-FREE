import type { Metadata } from "next"

// The pricing page is a client component and can't export metadata itself;
// this layout exists solely to give the tab a proper title via the root
// "%s | Viltreon" template.
export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One plan, two ways to pay. $9.99/month or $99.99/year with a 14-day free trial. Every email sorted the moment it arrives.",
  alternates: { canonical: "/pricing" },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
