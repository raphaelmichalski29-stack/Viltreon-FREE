import { PrismaClient } from "@prisma/client"

const SUPABASE_URL = process.env.SUPABASE_URL
if (!SUPABASE_URL) {
  console.error("Set SUPABASE_URL env var to your old Supabase connection string")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: SUPABASE_URL } } })
const dest = new PrismaClient()

async function migrate() {
  // Migrate Users
  const users = await source.user.findMany({ include: { accounts: true, sessions: true, labels: true, sortingLogs: true } })
  console.log(`Found ${users.length} users`)

  for (const u of users) {
    const { accounts, sessions, labels, sortingLogs, ...userData } = u
    await dest.user.create({ data: userData })
    console.log(`  Migrated user: ${u.email}`)

    for (const a of accounts) {
      await dest.account.create({ data: a })
    }
    console.log(`  Migrated ${accounts.length} accounts`)

    for (const s of sessions) {
      await dest.session.create({ data: s })
    }
    console.log(`  Migrated ${sessions.length} sessions`)

    for (const l of labels) {
      await dest.userLabel.create({ data: l })
    }
    console.log(`  Migrated ${labels.length} labels`)

    for (const log of sortingLogs) {
      await dest.sortingLog.create({ data: log })
    }
    console.log(`  Migrated ${sortingLogs.length} sorting logs`)
  }

  // Migrate VerificationTokens
  const tokens = await source.verificationToken.findMany()
  for (const t of tokens) {
    await dest.verificationToken.create({ data: t })
  }
  console.log(`Migrated ${tokens.length} verification tokens`)

  console.log("\nMigration complete!")
}

migrate()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => {
    await source.$disconnect()
    await dest.$disconnect()
  })
