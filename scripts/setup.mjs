#!/usr/bin/env node
/**
 * Viltreon — one-command local setup.
 *   npm run setup   (or)   npm run viltreon
 *
 * Fully local: SQLite database (a single file) + in-memory queue (no Redis).
 * No Docker, no cloud. Installs dependencies, generates secrets, walks you
 * through Google sign-in, writes .env, creates the database, and starts the app.
 * Zero external dependencies — Node built-ins only.
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_PATH = join(ROOT, '.env')
const rl = createInterface({ input, output })

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' }
const log = (s = '') => console.log(s)
const head = (s) => log(`\n${c.bold}${c.cyan}== ${s} ==${c.reset}`)
const warn = (s) => log(`${c.yellow}${s}${c.reset}`)
const ok = (s) => log(`${c.green}${s}${c.reset}`)
const secret = () => randomBytes(32).toString('hex')

async function ask(q, def = '') {
  const suffix = def ? ` ${c.dim}(${def})${c.reset}` : ''
  const a = (await rl.question(`${q}${suffix}: `)).trim()
  return a || def
}
async function yes(q, def = true) {
  const a = (await rl.question(`${q} ${c.dim}[${def ? 'Y/n' : 'y/N'}]${c.reset} `)).trim().toLowerCase()
  return a ? a.startsWith('y') : def
}
function run(cmd, args) {
  log(`${c.dim}$ ${cmd} ${args.join(' ')}${c.reset}`)
  return spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status === 0
}

async function main() {
  log(`${c.bold}${c.cyan}`)
  log('  +======================================+')
  log('  |            VILTREON  SETUP           |')
  log('  |   local install - AI email sorter    |')
  log('  +======================================+')
  log(c.reset)
  log('Everything runs on your machine: a SQLite database (one file) and an in-memory')
  log('queue. No Docker, no cloud. The only external call is to Google, to read your Gmail.')

  if (Number(process.versions.node.split('.')[0]) < 20) {
    warn(`! Node ${process.versions.node} detected. Viltreon needs Node 20+ (22 LTS recommended).`)
  }
  if (existsSync(ENV_PATH) && !(await yes('.env already exists. Overwrite it?', false))) {
    warn('Keeping existing .env. Exiting.'); rl.close(); return
  }

  head('Installing dependencies')
  if (existsSync(join(ROOT, 'node_modules'))) {
    ok('OK  Dependencies already installed.')
  } else {
    log('Running npm install (first run — this can take a minute)...')
    if (!run('npm', ['install'])) {
      warn('! npm install failed. Fix the error above, then re-run: npm run setup')
      rl.close(); return
    }
    ok('OK  Dependencies installed.')
  }

  head('Generating secrets')
  const NEXTAUTH_SECRET = secret()
  const ENCRYPTION_KEY = secret()
  const ENCRYPTION_SALT = secret()
  const PUBSUB_VERIFICATION_TOKEN = secret()
  ok('OK  NEXTAUTH_SECRET, ENCRYPTION_KEY, ENCRYPTION_SALT generated')
  warn('    Back up ENCRYPTION_KEY / ENCRYPTION_SALT — losing them makes stored Google tokens unrecoverable.')

  head('Database (local SQLite — zero install)')
  log('Viltreon stores everything in a local SQLite file. No server, no cloud.')
  log(`${c.dim}(Prefer Postgres? Set provider="postgresql" in prisma/schema.prisma, then paste a URL here.)${c.reset}`)
  const DATABASE_URL = await ask('Database file', 'file:./dev.db')

  head('Queue / Redis (local in-memory — zero install)')
  log('Viltreon uses a built-in in-memory queue on localhost; rate-limiting and caching')
  log('fall back to memory automatically. No Redis needed.')
  let REDIS_URL = ''
  if (await yes('Use external Redis instead? (advanced)', false)) {
    REDIS_URL = await ask('REDIS_URL', 'redis://localhost:6379')
  } else {
    ok('OK  Using the built-in in-memory queue — no Redis.')
  }

  head('Google sign-in (required)')
  log("This is the one part Google won't let us automate. ~5 minutes, one time:")
  log(`  ${c.bold}1.${c.reset} https://console.cloud.google.com/  ->  create or pick a project`)
  log(`  ${c.bold}2.${c.reset} APIs & Services > Library  ->  enable ${c.bold}Gmail API${c.reset}`)
  log(`  ${c.bold}3.${c.reset} APIs & Services > OAuth consent screen  ->  External  ->  add your email as a ${c.bold}Test user${c.reset}`)
  log(`     scopes: gmail.modify, userinfo.email, userinfo.profile`)
  log(`  ${c.bold}4.${c.reset} APIs & Services > Credentials  ->  Create Credentials  ->  ${c.bold}OAuth client ID${c.reset}  ->  Web application`)
  log(`  ${c.bold}5.${c.reset} Authorized redirect URI:  ${c.cyan}http://localhost:3000/api/auth/callback/google${c.reset}`)
  log(`  ${c.bold}6.${c.reset} Paste the Client ID + Secret below`)
  log('')
  const GOOGLE_CLIENT_ID = await ask('GOOGLE_CLIENT_ID')
  const GOOGLE_CLIENT_SECRET = await ask('GOOGLE_CLIENT_SECRET')
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    warn("    (Blank for now — paste them into .env later; sign-in won't work until you do.)")
  }

  head('Real-time push via Pub/Sub (optional — skip for localhost)')
  warn('    Gmail push CANNOT reach http://localhost (it needs a public HTTPS URL).')
  warn('    On localhost you sort via manual / periodic sync. Configure Pub/Sub only when')
  warn('    you deploy to a real server (or are tunneling localhost with ngrok for testing).')
  let GOOGLE_PROJECT_ID = ''
  let PUBSUB_TOPIC_NAME = ''
  if (await yes('Configure Pub/Sub now?', false)) {
    GOOGLE_PROJECT_ID = await ask('GOOGLE_PROJECT_ID (your GCP project id)')
    if (GOOGLE_PROJECT_ID) PUBSUB_TOPIC_NAME = `projects/${GOOGLE_PROJECT_ID}/topics/email-sorter-push`
  }

  head('Writing .env')
  writeFileSync(ENV_PATH, `# Generated by Viltreon setup on ${new Date().toISOString()}
# --- Authentication ---
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# --- Google OAuth ---
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

# --- Database (local SQLite file) ---
DATABASE_URL=${DATABASE_URL}

# --- Encryption (BACK THESE UP) ---
ENCRYPTION_KEY=${ENCRYPTION_KEY}
ENCRYPTION_SALT=${ENCRYPTION_SALT}

# --- Google Cloud Pub/Sub (real-time push; optional on localhost) ---
GOOGLE_PROJECT_ID=${GOOGLE_PROJECT_ID}
PUBSUB_TOPIC_NAME=${PUBSUB_TOPIC_NAME}
PUBSUB_VERIFICATION_TOKEN=${PUBSUB_VERIFICATION_TOKEN}

# --- Redis (blank = built-in in-memory queue; fine for localhost) ---
REDIS_URL=${REDIS_URL}
REDIS_PREFIX=gmail-ai

# --- Optional ---
GITHUB_TOKEN=
GITHUB_REPO=
ALERT_WEBHOOK_URL=
NEXT_PUBLIC_BUG_REPORT_URL=
`, { mode: 0o600 })
  ok(`OK  Wrote ${ENV_PATH}`)

  head('Create the database')
  log('Creating the database (prisma db push)...')
  if (!run('npx', ['prisma', 'db', 'push'])) {
    warn('    prisma db push failed. Check DATABASE_URL, then run:  npx prisma db push')
  }

  log('Registering the "viltreon" command (npm link)...')
  if (run('npm', ['link'])) {
    ok('OK  "viltreon" is now available from any terminal.')
  } else {
    warn('    Could not register globally (permissions?). Use "npm run viltreon", or ".\\viltreon" from this folder.')
  }

  head('Done')
  ok('Setup complete.')
  log('')
  warn('+---------------------------------------------------------------------+')
  warn('|  !  24/7 SORTING NEEDS AN ALWAYS-ON SERVER                          |')
  warn('|                                                                     |')
  warn('|  This localhost install sorts email only while your computer and    |')
  warn('|  the app are running. Gmail real-time push (Pub/Sub) cannot reach   |')
  warn('|  localhost — it needs a public HTTPS server running 24/7. For       |')
  warn('|  continuous hands-off sorting, deploy to an always-on server with   |')
  warn('|  a public domain. See README -> "Running 24/7".                     |')
  warn('+---------------------------------------------------------------------+')
  log('')
  log(`Start the app:  ${c.bold}npm run dev${c.reset}   ->  ${c.cyan}http://localhost:3000${c.reset}`)
  if (REDIS_URL) {
    log(`Using Redis — also start the worker in a 2nd terminal:  ${c.bold}npm run worker${c.reset}`)
  } else {
    log(`${c.dim}In-memory mode: the app sorts in-process — no separate worker needed.${c.reset}`)
  }
  log('')

  if (await yes('Start the app now? (npm run dev)', true)) { rl.close(); run('npm', ['run', 'dev']); return }
  rl.close()
}

main().catch((e) => { console.error(e); rl.close(); process.exit(1) })
