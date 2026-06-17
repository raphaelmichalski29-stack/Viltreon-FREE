import { redis, ensureRedis } from "./redis"

const GMAIL_API_LIMIT = 200
const GMAIL_API_WINDOW_MS = 100_000
const MAX_SLEEP_MS = 5_000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function checkGmailApiRateLimit(userId: string): Promise<void> {
  if (!(await ensureRedis()) || !redis) return

  const key = `gmail-api:${userId}`

  const count = await redis.incr(key)
  if (count === 1) {
    await redis.pexpire(key, GMAIL_API_WINDOW_MS)
  }

  if (count > GMAIL_API_LIMIT) {
    const ttl = await redis.pttl(key)
    if (ttl > 0) {
      // Cap the wait. Holding an HTTP request for the full 100s window blows past
      // Next.js / nginx / Pub/Sub timeouts. If we're truly over, Gmail will return
      // 429 and the BullMQ retry will pick it up.
      await sleep(Math.min(ttl + 1000, MAX_SLEEP_MS))
    }
  }
}
