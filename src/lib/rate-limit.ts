import { redis, ensureRedis } from "./redis"

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const redisReady = await ensureRedis()
  if (!redisReady || !redis) {
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs }
  }

  const redisKey = `ratelimit:${key}`
  const now = Date.now()

  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.pexpire(redisKey, config.windowMs)
  }

  const ttl = await redis.pttl(redisKey)
  const resetAt = ttl > 0 ? now + ttl : now + config.windowMs

  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt,
  }
}

export function rateLimitKey(userId: string, endpoint: string): string {
  return `${userId}:${endpoint}`
}
