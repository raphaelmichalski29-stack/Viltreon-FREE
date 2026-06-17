import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
    _stripe = new Stripe(key, { typescript: true })
  }
  return _stripe
}

export function getPriceId(interval: "month" | "year"): string {
  if (interval === "month") {
    return process.env.STRIPE_MONTHLY_PRICE_ID!
  }
  return process.env.STRIPE_ANNUAL_PRICE_ID!
}
