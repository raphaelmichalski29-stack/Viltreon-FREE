# Viltreon one-command installer (Windows / PowerShell).
#   irm https://raw.githubusercontent.com/<you>/viltreon/main/install.ps1 | iex
#
# Clones the repo and runs the setup wizard. The wizard is interactive (Google
# sign-in can't be automated), but this is the only command you run.
$ErrorActionPreference = 'Stop'

# >>> After publishing, set this to your repo's clone URL <<<
$Repo = 'https://github.com/<you>/viltreon.git'
$Dir  = 'viltreon'

if (-not (Get-Command git  -ErrorAction SilentlyContinue)) { throw 'git is required.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node 20+ is required (https://nodejs.org).' }

if (Test-Path "$Dir/.git") {
  Write-Host "==> $Dir already exists - using it."
} else {
  Write-Host "==> Cloning Viltreon into ./$Dir"
  git clone --depth 1 $Repo $Dir
}

Set-Location $Dir
Write-Host "==> Launching setup"
npm run setup
