#!/usr/bin/env node
/**
 * Viltreon launcher.
 *   viltreon          first run -> setup wizard; once configured -> starts the app
 *   viltreon setup    force the setup wizard again (e.g. to change your keys)
 *
 * "Configured" = a .env file exists and dependencies are installed.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1

const forceSetup = process.argv[2] === 'setup'
const configured = existsSync(join(ROOT, '.env')) && existsSync(join(ROOT, 'node_modules'))

if (forceSetup || !configured) {
  process.exit(run('node', ['scripts/setup.mjs']))
}

console.log('Starting Viltreon -> http://localhost:3000   (Ctrl+C to stop)')
process.exit(run('npm', ['run', 'dev']))
