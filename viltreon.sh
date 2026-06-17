#!/usr/bin/env bash
# Viltreon launcher (macOS/Linux): run `./viltreon.sh` from the project root.
# First run sets up; once configured, it starts the app.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/scripts/viltreon.mjs" "$@"
