import { redis, ensureRedis, isRedisAvailable } from "./redis"
import { encrypt, decrypt } from "./encryption"

const CACHE_PREFIX = process.env.REDIS_PREFIX || "gmail-ai"

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>()

export function cacheKey(...parts: string[]): string {
  return `${CACHE_PREFIX}:${parts.join(":")}`
}

export async function getOrSet<T>(
  key: string,
  fetch: () => Promise<T>,
  ttl: number = 300,
): Promise<T> {
  if (await ensureRedis()) {
    const cached = await redis!.get(key)
    if (cached) return JSON.parse(cached) as T

    const value = await fetch()
    await redis!.setex(key, ttl, JSON.stringify(value))
    return value
  }

  const mem = memoryCache.get(key)
  if (mem && mem.expiresAt > Date.now()) return mem.value as T

  const value = await fetch()
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  return value
}

export async function invalidate(...parts: string[]): Promise<void> {
  const prefix = cacheKey(...parts)
  if (isRedisAvailable() && redis) {
    const pattern = prefix + "*"
    let cursor = "0"
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100)
      cursor = next
      if (batch.length > 0) await redis.del(...batch)
    } while (cursor !== "0")
  }
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
}

export async function getCachedTokens(userId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (isRedisAvailable() && redis) {
    const cached = await redis.get(cacheKey("user", userId, "tokens"))
    if (!cached) return null
    try {
      return JSON.parse(decrypt(cached)) as { accessToken: string; refreshToken: string }
    } catch {
      return null
    }
  }
  return null
}

export async function setCachedTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken: string },
  ttl = 3600,
): Promise<void> {
  if (isRedisAvailable() && redis) {
    await redis.setex(cacheKey("user", userId, "tokens"), ttl, encrypt(JSON.stringify(tokens)))
  }
}

// Token epoch: a per-user marker that is bumped whenever the user's OAuth
// tokens change (re-auth) or are found revoked (invalid_grant). Each process
// records the epoch when it caches a Gmail client in memory; a mismatch on a
// later read tells it to rebuild from the DB. This is what makes token
// invalidation work across the whole pm2 cluster — deleting the Redis token
// cache alone can't reach the other processes' in-memory clients.
// TTL outlives the 50-min client cache so a bump can never expire before
// every stale client has either re-checked or aged out.
const TOKEN_EPOCH_TTL_SEC = 2 * 60 * 60

export async function getTokenEpoch(userId: string): Promise<string | null> {
  if (isRedisAvailable() && redis) {
    return redis.get(cacheKey("user", userId, "token-epoch"))
  }
  return null
}

export async function bumpTokenEpoch(userId: string): Promise<void> {
  if (isRedisAvailable() && redis) {
    await redis.set(cacheKey("user", userId, "token-epoch"), String(Date.now()), "EX", TOKEN_EPOCH_TTL_SEC)
  }
}
