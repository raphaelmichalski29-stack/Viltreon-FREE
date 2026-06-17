/**
 * Destructive: wipes every user-owned row from Postgres and flushes the
 * Redis namespace for this app.
 *
 * Usage:
 *   npx tsx scripts/wipe-data.ts --inspect   # show counts only
 *   npx tsx scripts/wipe-data.ts --wipe      # actually delete
 *
 * Tables touched (User cascades via Prisma onDelete: Cascade):
 *   - User  → cascades to Account, Session, UserLabel, SortingLog
 *   - VerificationToken
 *   - ProcessedStripeEvent
 *   - RateLimit
 *
 * Redis: FLUSHDB on the configured namespace (rate-limit counters,
 * JWT blacklist, cached Gmail tokens, BullMQ queues).
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function counts() {
  const [users, accounts, sessions, labels, logs, vts, stripeEvents] =
    await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.session.count(),
      prisma.userLabel.count(),
      prisma.sortingLog.count(),
      prisma.verificationToken.count(),
      prisma.processedStripeEvent.count(),
    ])
  return { users, accounts, sessions, labels, logs, vts, stripeEvents }
}

async function inspect() {
  const c = await counts()
  console.log("Current row counts:")
  console.log(`  User:                 ${c.users}`)
  console.log(`  Account:              ${c.accounts}`)
  console.log(`  Session:              ${c.sessions}`)
  console.log(`  UserLabel:            ${c.labels}`)
  console.log(`  SortingLog:           ${c.logs}`)
  console.log(`  VerificationToken:    ${c.vts}`)
  console.log(`  ProcessedStripeEvent: ${c.stripeEvents}`)
}

async function wipe() {
  console.log("Wiping Postgres data...")
  // deleteMany on User cascades to Account/Session/UserLabel/SortingLog
  // because of onDelete: Cascade in schema.prisma.
  const r1 = await prisma.user.deleteMany({})
  console.log(`  deleted ${r1.count} User rows (+ cascaded Account/Session/UserLabel/SortingLog)`)

  const r2 = await prisma.verificationToken.deleteMany({})
  console.log(`  deleted ${r2.count} VerificationToken rows`)

  const r3 = await prisma.processedStripeEvent.deleteMany({})
  console.log(`  deleted ${r3.count} ProcessedStripeEvent rows`)

  console.log("Postgres wipe complete.")

  // Redis: flush the namespace (rate-limit counters, JWT blacklist,
  // cached Gmail tokens, BullMQ queue state). Wrapped — if Redis is
  // unreachable we still claim success on the DB wipe.
  try {
    const { redis, ensureRedis } = await import("../src/lib/redis")
    const ok = await ensureRedis()
    if (ok && redis) {
      const prefix = process.env.REDIS_PREFIX || "gmail-ai"
      const keys: string[] = []
      let cursor = "0"
      do {
        const [next, batch] = await redis.scan(cursor, "MATCH", `${prefix}:*`, "COUNT", 1000)
        cursor = next
        keys.push(...batch)
      } while (cursor !== "0")

      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`Redis: deleted ${keys.length} keys under "${prefix}:*"`)
      } else {
        console.log(`Redis: no keys under "${prefix}:*"`)
      }

      // BullMQ uses its own key prefix scheme. Also scan unprefixed bull keys.
      const bullKeys: string[] = []
      cursor = "0"
      do {
        const [next, batch] = await redis.scan(cursor, "MATCH", "bull:*", "COUNT", 1000)
        cursor = next
        bullKeys.push(...batch)
      } while (cursor !== "0")
      if (bullKeys.length > 0) {
        await redis.del(...bullKeys)
        console.log(`Redis: deleted ${bullKeys.length} BullMQ keys`)
      }
    } else {
      console.log("Redis: unreachable, skipping flush")
    }
  } catch (err) {
    console.warn("Redis flush failed:", err instanceof Error ? err.message : err)
  }

  await inspect()
}

async function main() {
  const arg = process.argv[2]
  if (arg === "--inspect") {
    await inspect()
  } else if (arg === "--wipe") {
    await inspect()
    console.log("")
    await wipe()
  } else {
    console.error("Usage: tsx scripts/wipe-data.ts [--inspect|--wipe]")
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
