import Redis from "ioredis"

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const RETRY_BACKOFF_MS = 5000

let redisAvailable = false
let nextRetryAt = 0

const createClient = () => {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: () => null,
  })

  client.on("error", () => {
    // suppress connection errors — handled by ensureRedis()
  })
  client.on("end", () => { redisAvailable = false })
  client.on("close", () => { redisAvailable = false })
  client.on("ready", () => { redisAvailable = true })

  return client
}

const rawClient = createClient()

export const redis: Redis | null = rawClient

if (rawClient && process.env.NODE_ENV !== "production") {
  globalForRedis.redis = rawClient
}

export async function ensureRedis(): Promise<boolean> {
  if (redisAvailable) return true
  if (!redis) return false
  if (Date.now() < nextRetryAt) return false

  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect()
    }
    await redis.ping()
    redisAvailable = true
    return true
  } catch {
    redisAvailable = false
    nextRetryAt = Date.now() + RETRY_BACKOFF_MS
    return false
  }
}

export function bullConnection(): { connection: { host: string; port: number; password?: string } } {
  const url = process.env.REDIS_URL || "redis://localhost:6379"
  const parsed = new URL(url)
  return {
    connection: {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379"),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    },
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable
}
