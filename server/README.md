# fronds server (optional)

A small self-hosted server that lets several phones share one plant collection and sends
**daily push reminders** when plants need water. The fronds app works fully without it —
this is for people who want sync and notifications.

- **No accounts.** One server = one household, protected by a random household key.
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

On first start the server prints a **household key** in its log (it's also stored in
`data/secrets.json`). In the app: **Settings → Sync & reminders** → server address + key → Connect.
Other phones can then use **Link for another phone**.

### It must be served over HTTPS

The app runs on `https://timoneiro.github.io`, and browsers won't let an HTTPS page call a plain
`http://` server. Put the server behind HTTPS, for example:

- **Tailscale (tailnet only):** `tailscale serve --bg --https=10443 localhost:8787`
  → `https://<machine>.<tailnet>.ts.net:10443`. Requires HTTPS certificates to be enabled in the
  Tailscale admin console (DNS → HTTPS Certificates).
- **Tailscale Funnel (reachable from anywhere):** `tailscale funnel --bg --https=10000 localhost:8787`.
  Syncing then also works when a phone isn't on Tailscale. The server is on the public internet,
  guarded by the household key (192 random bits), so only do this if you're comfortable with that.
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

## Configuration

| Variable | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `DATA_DIR` | `/data` | Store, secrets and daily backups |
| `TZ` | `UTC` | Timezone for reminder times and "due today" |
| `ALLOWED_ORIGINS` | `*` | Comma-separated origins allowed to call the API from a browser |
| `FRONDS_KEY` | generated | Set your own household key instead of the generated one |
| `VAPID_SUBJECT` | project URL | Contact for push services (`mailto:` or `https:`) |

## API

All endpoints except `/api/health` require `Authorization: Bearer <household key>`.
The wire format lives in [`src/domain/syncProtocol.ts`](../src/domain/syncProtocol.ts).

| | |
|---|---|
| `GET /api/health` | Liveness |
| `GET /api/info` | Version, protocol, VAPID public key, timezone |
| `POST /api/sync` | Push changed records, pull everything changed since `cursor` (last-writer-wins per record) |
| `POST /api/push/subscribe` · `/unsubscribe` · `/test` | Manage this device's daily reminder |

## Development

```sh
cd server && npm install && cd ..
DATA_DIR=./server/data node server/src/main.ts   # runs the TypeScript directly (Node ≥ 23.6)
npm test                                          # includes server + client↔server tests
```
