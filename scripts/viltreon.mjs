#!/usr/bin/env node
/**
 * Viltreon launcher — PRODUCTION mode.
 *   viltreon          first run -> setup; once configured -> build (if needed) + start
 *   viltreon setup    re-run the setup wizard (e.g. to change keys)
 *   viltreon build    force a fresh production build, then exit
 *
 * Runs Next in production (next build -> next start). Production mode uses a
 * fraction of dev mode's memory and never compiles pages on the fly, so it
 * won't spike your machine the way `next dev` can.
 *
 * LOCAL_PROD_TEST=1 lets a localhost run skip next.config's cloud-only guards
 * (https URL, Redis). RUN_INPROC_WORKER=1 runs the sort worker inside this one
 * process (no separate worker terminal needed).
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, LOCAL_PROD_TEST: '1', RUN_INPROC_WORKER: '1' }
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, env }).status ?? 1

const arg = process.argv[2]
const configured = existsSync(join(ROOT, '.env')) && existsSync(join(ROOT, 'node_modules'))

// Not set up yet (or asked to) -> run the wizard.
if (arg === 'setup' || !configured) {
  process.exit(run('node', ['scripts/setup.mjs']))
}

// Build if there's no production build yet, or if explicitly asked. We check for
// .next/BUILD_ID (written only by `next build`) rather than the .next folder —
// `next dev` also creates .next, but `next start` needs a real production build.
if (arg === 'build' || !existsSync(join(ROOT, '.next', 'BUILD_ID'))) {
  console.log('Building Viltreon (production, one-time ~30s)...')
  const code = run('npx', ['next', 'build'])
  if (code !== 0) process.exit(code)
  if (arg === 'build') { console.log('Build complete. Run "viltreon" to start.'); process.exit(0) }
}

console.log('Starting Viltreon (production) -> http://localhost:3000   (Ctrl+C to stop)')
process.exit(run('npx', ['next', 'start', '-p', '3000']))
