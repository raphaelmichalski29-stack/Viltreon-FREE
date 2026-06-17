# Viltreon

**The open-source, self-hosted AI email sorter for Gmail.** Your email never leaves
infrastructure you control — no third-party SaaS sees your inbox. You bring your own
Google AI key; Viltreon reads incoming mail and files it into your labels automatically.

> ⚠️ **Running 24/7 needs an always-on server.** A localhost install only sorts mail
> while your computer and the app are running. Gmail's real-time push (Google Cloud
> Pub/Sub) **cannot reach `localhost`** — it requires a public HTTPS endpoint. For
> continuous, hands-off sorting you must run Viltreon on a server that's up 24/7 with a
> public domain. See [Running 24/7](#running-247) below.

---

## Install — one command

Once the repo is public, this clones it and launches setup in a single line:

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/<you>/viltreon/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/<you>/viltreon/main/install.ps1 | iex
```

The wizard is still interactive — Google sign-in can't be automated — but that's the only
command you run.

## Quick start (manual)

```bash
git clone https://github.com/<you>/viltreon.git viltreon
cd viltreon
npm run setup      # installs deps, configures, creates the SQLite DB, and can launch the app
```

### Running it day-to-day

The `viltreon` command is smart — the **first** run does setup, **every run after** starts the app:

```bash
npm run viltreon      # first time -> setup wizard;  after that -> starts http://localhost:3000
npm run setup         # re-run setup any time (e.g. to change your keys)
```

Prefer to type just `viltreon` from anywhere? Link it once with `npm link`, then run
`viltreon` (or `viltreon setup` to reconfigure).

`setup` is an interactive wizard. It will:

1. Generate all secrets (`NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_SALT`).
2. Set up a local **SQLite** database and **in-memory** queue — nothing to install.
3. Walk you through **Google sign-in** setup (the one part Google won't let anyone script).
4. Write `.env`, create the database schema, and offer to launch the app.

Then start the app:

```bash
npm run dev        # web app -> http://localhost:3000
```

Without Redis (the default local setup) the app sorts **in-process — no separate worker
needed**. If you configured Redis, also run the worker in a second terminal:

```bash
npm run worker
```

Open <http://localhost:3000>, sign in with the Google account you added as a test user,
add your Google AI (Gemini) key in settings, and define your sorting rules.

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

### Optional: real-time push (Pub/Sub)

Push is what makes sorting instant and continuous. **It does not work on `localhost`**
(Pub/Sub can only push to a public HTTPS URL). Set it up only when you deploy to a real
server, or when tunneling localhost (e.g. ngrok) for testing:

```bash
gcloud pubsub topics create email-sorter-push
gcloud pubsub subscriptions create email-sorter-push-sub \
  --topic=email-sorter-push \
  --push-endpoint=https://YOUR_DOMAIN/api/gmail/webhook \
  --ack-deadline=60
```

Then set `GOOGLE_PROJECT_ID` and `PUBSUB_TOPIC_NAME` in `.env`. Without push, the app
falls back to manual / periodic sync.

**Want instant sorting on your own machine without renting a server?** See
**[docs/REALTIME.md](docs/REALTIME.md)** — a full ngrok + Pub/Sub walkthrough.

---

## Running 24/7

A laptop that sleeps doesn't sort email. For always-on, hands-off sorting you need:

- A server that runs **24/7** (a small VPS is plenty).
- A **public domain + HTTPS** (so Gmail Pub/Sub push can reach `/api/gmail/webhook`).
- The web app **and** the worker running as managed processes (e.g. pm2/systemd).

This repository is set up for the **localhost** experience. Productionizing (reverse
proxy, TLS, process manager, Pub/Sub push) is your responsibility — deploy it wherever
you like.

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
| `STRIPE_*` | yes to boot | placeholders are fine locally; billing stays off |
| `GOOGLE_PROJECT_ID` / `PUBSUB_TOPIC_NAME` | no | only for real-time push (not on localhost) |
| `REDIS_URL` | no | leave **blank** for the in-memory queue; set it only to use Redis |

Losing `ENCRYPTION_KEY` / `ENCRYPTION_SALT` makes all stored Google tokens
unrecoverable — every user would have to sign in again. Save them somewhere safe.

---

## Security

- Self-hosting means **you** are responsible for securing the server and the data.
- `.env` holds secrets and is git-ignored — never commit it.
- The app encrypts stored OAuth tokens and AI keys at rest using your `ENCRYPTION_KEY`.

## License

See [`LICENSE`](LICENSE). _(If self-hosting a paid/commercial service, note the license
terms.)_
