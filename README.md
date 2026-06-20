# Viltreon

**The open-source, self-hosted AI email sorter for Gmail.** Your email never leaves
infrastructure you control — no third-party SaaS sees your inbox. You bring your own
Groq API key (BYOK); Viltreon reads incoming mail and files it into your labels automatically.

> ⚠️ **This open-source build is for running locally.** It sorts your inbox on demand, on
> your own machine, while the app is running — perfect for trying Viltreon and keeping
> full control of your data. It does **not** sort 24/7 on its own (a laptop that sleeps
> doesn't sort email).
>
> **Want hands-off, always-on real-time sorting?** That's the hosted version — it runs
> 24/7 so you don't have to. → **[viltreon.com](https://viltreon.com)**

---

## Install — one command

Once the repo is public, this clones it and launches setup in a single line:

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/raphaelmichalski29-stack/Viltreon-FREE/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/raphaelmichalski29-stack/Viltreon-FREE/main/install.ps1 | iex
```

The wizard is still interactive — Google sign-in can't be automated — but that's the only
command you run.

## Quick start (manual)

```bash
git clone https://github.com/raphaelmichalski29-stack/Viltreon-FREE.git viltreon
cd viltreon
npm run setup      # installs deps, configures, creates the SQLite DB, and can launch the app
```

### Running it day-to-day

`npm run setup` registers a global **`viltreon`** command (via `npm link`). After setup,
from any terminal:

```bash
viltreon            # starts the app at http://localhost:3000 (runs setup first if needed)
viltreon setup      # re-run setup, e.g. to change your keys
```

If `viltreon` isn't found: use `npm run viltreon` instead, or re-run `npm link` from the
project folder. (In PowerShell, a local script must be called as `.\viltreon`.)

`setup` is an interactive wizard. It will:

1. Generate all secrets (`NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_SALT`).
2. Set up a local **SQLite** database and **in-memory** queue — nothing to install.
3. Walk you through **Google sign-in** setup (the one part Google won't let anyone script).
4. Write `.env`, create the database schema, and offer to launch the app.

Then start the app:

```bash
viltreon           # builds once (~30s), then runs in production at http://localhost:3000
```

Viltreon runs in **production mode** — light on memory, far gentler than `next dev`, and the
sort worker runs in-process (no separate worker to start).

Open <http://localhost:3000>, sign in with the Google account you added as a test user,
add your Groq API key in settings, and define your sorting rules.

### Prerequisites

- **Node 20+** (22 LTS recommended)
- A **Google account** and a free **Google Cloud** project (steps below)

That's all. The database is a local **SQLite** file and the queue is **in-memory** — no
Postgres, no Redis, no Docker, no cloud. (Advanced users can switch to Postgres/Redis;
see [Configuration](#configuration).)

---

## Google Cloud setup (required, ~5 min, one-time)

Google requires this to be done by hand in the Console — it can't be automated for a
Gmail-scoped app. The wizard pauses and walks you through it; here it is for reference:

1. **Create a project** at <https://console.cloud.google.com/>.
2. **Enable the Gmail API:** APIs & Services → Library → search "Gmail API" → Enable.
3. **OAuth consent screen:** APIs & Services → OAuth consent screen → **External**.
   - Add the scopes: `gmail.modify`, `userinfo.email`, `userinfo.profile`.
   - Under **Test users**, add your own Gmail address. (While the app is in "Testing",
     only test users can sign in — that's fine for a personal self-hosted install.)
4. **Create credentials:** APIs & Services → Credentials → Create Credentials →
   **OAuth client ID** → **Web application**.
   - **Authorized redirect URI:** `http://localhost:3000/api/auth/callback/google`
   - Copy the **Client ID** and **Client Secret** into the wizard (or `.env`).

---

## Want 24/7 sorting? Use the hosted version

This open-source build sorts on demand, locally. For **always-on, real-time sorting** that
files every email the moment it arrives — with nothing to deploy, maintain, or keep
running — use the hosted version:

**→ [viltreon.com](https://viltreon.com) — 24/7 live sorting, fully managed.**

Same sorting engine, none of the server upkeep.

---

## Configuration

`npm run setup` writes these to `.env`. Required vars must be present or the app won't boot.

| Variable | Required | Notes |
|---|---|---|
| `NEXTAUTH_URL` | yes | `http://localhost:3000` for local |
| `NEXTAUTH_SECRET` | yes | auto-generated |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | from Google Cloud (above) |
| `DATABASE_URL` | yes | local SQLite file, e.g. `file:./dev.db` |
| `ENCRYPTION_KEY` / `ENCRYPTION_SALT` | yes | auto-generated — **back these up** |
| `REDIS_URL` | no | leave **blank** for the in-memory queue; set it only to use Redis |

Losing `ENCRYPTION_KEY` / `ENCRYPTION_SALT` makes all stored Google tokens
unrecoverable — every user would have to sign in again. Save them somewhere safe.

---

## Security

- Self-hosting means **you** are responsible for securing the server and the data.
- `.env` holds secrets and is git-ignored — never commit it.
- The app encrypts stored OAuth tokens and AI keys at rest using your `ENCRYPTION_KEY`.

## License

**AGPL-3.0** — see [`LICENSE`](LICENSE). You can self-host, modify, and redistribute it
freely; if you run a modified version as a network service, AGPL §13 requires you to offer
your users the source of that modified version.
