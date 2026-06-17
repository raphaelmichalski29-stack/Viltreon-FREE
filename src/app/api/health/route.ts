import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ensureRedis } from "@/lib/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Public health endpoint consumed by the external uptime monitor and bypassed
 * from auth in src/proxy.ts. Deliberately returns only liveness + dependency
 * up/down — no queue depth or webhook outcome counters, because those reveal
 * usage volume to anyone on the web. To inspect those internal metrics, read
 * the Redis counters directly on the server (e.g. redis-cli get
 * webhook:outcome:success, or KEYS webhook:outcome:*).
 *
 * Returns 503 if Postgres is down (real outage) so the monitor alerts; 200
 * otherwise, even Redis-degraded, since the app can still serve auth/dashboards.
 */
export async function GET() {
  const start = Date.now()

  let postgresHealthy = false
  try {
    await prisma.$queryRaw`SELECT 1`
    postgresHealthy = true
  } catch {
    postgresHealthy = false
  }

  const redisHealthy = await ensureRedis()

  const overall = postgresHealthy ? "healthy" : "degraded"
  const httpStatus = postgresHealthy ? 200 : 503

  return NextResponse.json(
    {
      status: overall,
      responseTimeMs: Date.now() - start,
      dependencies: {
        postgres: postgresHealthy ? "ok" : "down",
        redis: redisHealthy ? "ok" : "down",
      },
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } },
  )
}
