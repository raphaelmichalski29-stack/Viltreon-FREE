# Real-time sorting on your own machine (ngrok + Pub/Sub)

By default a localhost install sorts only when you trigger a sync. To get **instant,
hands-off sorting** — new mail classified the moment it lands — Gmail needs to *push*
notifications to your app. Google's push (Cloud Pub/Sub) can only reach a **public HTTPS
URL**, never `http://localhost`. [ngrok](https://ngrok.com) gives your local app exactly
that: a temporary public HTTPS address that tunnels to `localhost:3000`.

> ⚠️ **This is "fully functional while your computer + the tunnel are running."** If your
> machine sleeps or ngrok stops, push stops. For true 24/7 you still want a deployed
> server (see the main README → *Running 24/7*). This guide is the real-time experience
> for personal use without renting a server.

## How it works

```
new email -> Gmail -> Pub/Sub topic -> push subscription
                                          |
                                          v
                       https://<your>.ngrok-free.app/api/gmail/webhook
                                          |
                                          v
                          your local app  ->  sorts the message
```

## Before you start

- A working local install (`npm run setup` done, app runs at `http://localhost:3000`).
- The **Google Cloud project** you created during setup, with the Gmail API enabled.
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
  (`gcloud auth login`, `gcloud config set project YOUR_PROJECT_ID`).
- A free [ngrok](https://ngrok.com) account.

---

## 1. Install and authenticate ngrok

```bash
# macOS:    brew install ngrok
# Windows:  winget install ngrok.ngrok   (or download from ngrok.com)
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

## 2. Start the app, then the tunnel

```bash
npm run dev                # terminal 1  -> http://localhost:3000
ngrok http 3000            # terminal 2
```

ngrok prints a forwarding URL like `https://abc123.ngrok-free.app`. Copy it — referred to
below as `YOUR_URL`.

## 3. Point the app at the public URL

Edit **`.env`**:

```
NEXTAUTH_URL=https://abc123.ngrok-free.app
```

Edit **`next.config.js`** — add your ngrok host to `allowedDevOrigins`:

```js
allowedDevOrigins: ['abc123.ngrok-free.app'],
```

In the **Google Cloud Console** → APIs & Services → Credentials → your OAuth client → add
an Authorized redirect URI:

```
https://abc123.ngrok-free.app/api/auth/callback/google
```

## 4. Create the Pub/Sub topic and let Gmail publish to it

```bash
gcloud pubsub topics create email-sorter-push

gcloud pubsub topics add-iam-policy-binding email-sorter-push \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## 5. Create a service account + push subscription (OIDC auth)

The webhook authenticates Google's push with an OIDC token, so Pub/Sub needs a service
account to sign as:

```bash
# Service account that Pub/Sub signs push requests as
gcloud iam service-accounts create pubsub-push-invoker

# Let the Pub/Sub system mint OIDC tokens for that SA
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding \
  pubsub-push-invoker@$(gcloud config get-value project).iam.gserviceaccount.com \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator

# Push subscription -> your ngrok webhook
gcloud pubsub subscriptions create email-sorter-push-sub \
  --topic=email-sorter-push \
  --push-endpoint=https://abc123.ngrok-free.app/api/gmail/webhook \
  --push-auth-service-account=pubsub-push-invoker@$(gcloud config get-value project).iam.gserviceaccount.com \
  --push-auth-token-audience=https://abc123.ngrok-free.app/api/gmail/webhook \
  --ack-deadline=60
```

## 6. Add the Pub/Sub settings to `.env`

```
GOOGLE_PROJECT_ID=your-project-id
PUBSUB_TOPIC_NAME=projects/your-project-id/topics/email-sorter-push
PUBSUB_OIDC_AUDIENCE=https://abc123.ngrok-free.app/api/gmail/webhook
PUBSUB_OIDC_SERVICE_ACCOUNT=pubsub-push-invoker@your-project-id.iam.gserviceaccount.com
```

## 7. Restart and register the watch

1. Stop and restart `npm run dev` so the new `.env` loads.
2. Open **`YOUR_URL`** (the ngrok address, not localhost) and sign in.
3. In the dashboard, **enable auto-sort**. That calls `/api/gmail/watch`, which tells
   Gmail to start publishing your mailbox changes to the topic.

## 8. Test it

Send yourself an email. Within a few seconds it should be classified and labeled
automatically — no manual sync. Watch `npm run dev`'s logs for the `webhook.gmail` entry.

---

## Caveats and gotchas

- **Free ngrok URLs change every restart.** When the URL changes you must redo steps 3, 5
  (`--push-endpoint` / audience), and 6. A reserved ngrok domain (paid) or a
  [Cloudflare named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  gives you a stable URL so you set this up once.
- **Your computer must stay awake.** Sleep = no sorting. (This is why a server is the real
  24/7 answer.)
- **Gmail watches expire every 7 days.** The `renew-watches` job re-registers them, but it
  only runs while the app is running.
- **Personal use only.** This wires real-time sorting for *your* account; multi-user, 24/7
  operation belongs on a deployed server.

## Troubleshooting

- **401 at the webhook** → audience mismatch. `PUBSUB_OIDC_AUDIENCE`, the subscription's
  `--push-auth-token-audience`, and the actual endpoint must be byte-for-byte identical.
  Also confirm the `serviceAccountTokenCreator` binding in step 5.
- **No notifications at all** → the watch isn't registered (re-toggle auto-sort), or
  auto-sort is off in settings.
- **`stale historyId` in logs** → harmless; the app clears it and recovers on the next push.
