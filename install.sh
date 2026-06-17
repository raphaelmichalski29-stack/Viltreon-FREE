#!/usr/bin/env bash
# Viltreon one-command installer (macOS / Linux).
#   curl -fsSL https://raw.githubusercontent.com/<you>/viltreon/main/install.sh | bash
#
# Clones the repo and runs the setup wizard. The wizard is interactive (Google
# sign-in can't be automated), but this is the only command you run.
set -euo pipefail

# >>> After publishing, set this to your repo's clone URL <<<
REPO="https://github.com/<you>/viltreon.git"
DIR="viltreon"

command -v git  >/dev/null 2>&1 || { echo "Error: git is required."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: Node 20+ is required (https://nodejs.org)."; exit 1; }

if [ -d "$DIR/.git" ]; then
  echo "==> $DIR already exists — using it."
else
  echo "==> Cloning Viltreon into ./$DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi

cd "$DIR"
echo "==> Launching setup"
npm run setup
