import { getToken as originalGetToken } from "next-auth/jwt"
import type { GetTokenParams, JWT } from "next-auth/jwt"
import { redis, ensureRedis } from "./redis"

const BLACKLIST_PREFIX = "jwt-blacklist:"
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const LOCAL_BLACKLIST_MAX = 10_000

// Map preserves insertion order — we use it as a FIFO LRU. Never clear in bulk:
// dropping the whole set after a flood would re-validate every revoked JWT until
// Redis is consulted, which is a revocation-bypass risk if Redis is briefly down.
const localBlacklist = new Map<string, true>()

export async function getToken<R extends boolean = false>(
  params?: GetTokenParams<R>
): Promise<R extends true ? string | null : JWT | null> {
  const token = await originalGetToken(params as any)
  if (!token) return null as any
  if (typeof token === "string") return token as any

  const jti = (token as any).jti
  if (!jti) return token as any

  if (localBlacklist.has(jti)) {
    // Touch to mark recently used so eviction prefers older entries
    localBlacklist.delete(jti)
    localBlacklist.set(jti, true)
    return null as any
  }

  const redisReady = await ensureRedis()
  if (!redisReady || !redis) {
    return token as any
  }

  const blacklisted = await redis.get(`${BLACKLIST_PREFIX}${jti}`)
  if (blacklisted) return null as any

  return token as any
}

export async function invalidateToken(jti: string): Promise<void> {
  if (localBlacklist.has(jti)) localBlacklist.delete(jti)
  localBlacklist.set(jti, true)
  while (localBlacklist.size > LOCAL_BLACKLIST_MAX) {
    const oldest = localBlacklist.keys().next().value
    if (oldest === undefined) break
    localBlacklist.delete(oldest)
  }

  const redisReady = await ensureRedis()
  if (!redisReady || !redis) return

  await redis.set(`${BLACKLIST_PREFIX}${jti}`, "1", "EX", MAX_AGE_SECONDS)
}
