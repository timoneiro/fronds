# fronds server (optional)

A small self-hosted server that lets the phones in a household share one plant collection and
sends **daily push reminders** when plants need water. One server can host **several households**
(you, your family, friends), each completely separate. The fronds app works fully without it —
this is for people who want sync and notifications.

- **No accounts.** Whoever has the **server code** can create a household. Each extra phone joins with
  a **one-time invite** from someone already in the household and gets its own access token, which any
  member can revoke later (lost phone, someone moves out) without affecting the other phones.
- **Households are isolated.** A phone only ever sees the household it belongs to.
- **No third-party keys.** Push notifications use Web Push with keys the server generates itself.
- **Your data stays with you.** Everything is kept in one JSON file in the data folder, with a
  daily copy in `data/backups/` (last 7 days).

## Run it

```yaml
# docker-compose.yml
services:
  fronds:
    image: ghcr.io/timoneiro/fronds-server:latest
    ports: ["8787:8787"]
    volumes: ["./data:/data"]
    environment:
      - TZ=Etc/UTC                                    # your timezone, e.g. Europe/London
      - ALLOWED_ORIGINS=https://timoneiro.github.io   # the app's origin
    restart: unless-stopped
```

On every start the server prints its **server code** in the log (it's also in `data/secrets.json`).
Share it only with people who may create a household.

1. **First phone of a household:** Settings → Sync & reminders → **Create a household** → server
   address, server code, a household name.
2. **Every other phone:** someone in the household taps **Create invite** and shares the link (or
   reads out the code); the new phone opens it and taps **Join household**. Invites work once, for
   7 days.
3. **Phones in this household** lists every phone, with a **Remove** button.

Device tokens are stored only as hashes. As the server's owner you can still read the data file
(plant names and watering dates) — households are protected from each other, not from the server
admin.

### It must be served over HTTPS

The app runs on `https://timoneiro.github.io`, and browsers won't let an HTTPS page call a plain
`http://` server. Put the server behind HTTPS, for example:

- **Tailscale (tailnet only):** `tailscale serve --bg --https=10443 localhost:8787`
  → `https://<machine>.<tailnet>.ts.net:10443`. Requires HTTPS certificates to be enabled in the
  Tailscale admin console (DNS → HTTPS Certificates).
- **Tailscale Funnel (reachable from anywhere):** `tailscale funnel --bg --https=10000 localhost:8787`.
  Syncing then also works when a phone isn't on Tailscale. The server is on the public internet,
  guarded by per-phone tokens (256 random bits), the server code for creating households and a brake
  on repeated wrong codes — only do this if you're comfortable with that.
- Any reverse proxy with a certificate (Caddy, Traefik, Nginx Proxy Manager…).

Don't move the *app* itself to your server: browsers keep each website's data separately, so
opening fronds from a different address would start with an empty collection.

## When a phone isn't on the server's network

- **Reminders still arrive.** The server hands them to Google's/Apple's push service, which reaches
  the phone over the normal internet.
- **Changes made away from the server are kept on the phone** and uploaded the next time the server is
  reachable (the app shows how many are waiting).
- **No false alarms.** When a reminder arrives, the phone first tries to sync; if it can't, it
  double-checks against its own log and leaves out plants you already watered.
- On iPhone, reminders need fronds to be **added to the Home Screen** (iOS 16.4+).

## Upgrading from server 0.1

0.1 served a single household with one shared key. On first start, 0.2 moves existing data into a
household called "Home" and keeps the old key working for phones already connected, so nothing needs
re-pairing. A copy of the old file is kept as `data/backups/store-before-households-upgrade.json`.
The push keys in `data/secrets.json` are kept, so existing reminders keep working.

## Configuration

| Variable | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `DATA_DIR` | `/data` | Store, secrets and daily backups |
| `TZ` | `UTC` | Timezone for reminder times and "due today" |
| `ALLOWED_ORIGINS` | `*` | Comma-separated origins allowed to call the API from a browser |
| `FRONDS_SERVER_CODE` | generated | Use your own server code instead of the generated one |
| `VAPID_SUBJECT` | project URL | Contact for push services (`mailto:` or `https:`) |

## API

The wire format lives in [`src/domain/syncProtocol.ts`](../src/domain/syncProtocol.ts). Endpoints
marked *public* need no token; all others need `Authorization: Bearer <device token>` and only ever
touch that device's household.

| | |
|---|---|
| `GET /api/health` · `GET /api/server` | Liveness · version and protocol (*public*) |
| `POST /api/households` | Create a household with the server code → first phone's token (*public*) |
| `POST /api/join` | Redeem a one-time invite → new phone's token (*public*) |
| `GET /api/info` | Household, device id, VAPID public key, timezone |
| `POST /api/invites` | Create a one-time invite for this household |
| `GET /api/devices` · `POST /api/devices/remove` | List / revoke phones in this household |
| `POST /api/sync` | Push changed records, pull everything changed since `cursor` (last-writer-wins per record) |
| `POST /api/push/subscribe` · `/unsubscribe` · `/test` | Manage this phone's daily reminder |

## Development

```sh
cd server && npm install && cd ..
DATA_DIR=./server/data node server/src/main.ts   # runs the TypeScript directly (Node ≥ 23.6)
npm test                                          # includes server + client↔server tests
```
