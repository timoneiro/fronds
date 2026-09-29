# 🌿 fronds

A small, installable web app for keeping track of your houseplants and when to water them.
Built for phones (Android and iPhone), works offline, and needs **no account and no API keys**.

**Use it:** https://timoneiro.github.io/fronds/ → open on your phone → *Add to Home Screen*.

## Features

- **Today view** — what needs water now and what's coming up this week; one tap to log a watering,
  "Later" to snooze a plant whose soil is still moist, "Water all" for a watering round.
- **Plant collection** — name, species, room, photo and notes, grouped by room and searchable.
- **Built-in care guide** for ~60 common houseplants: light, humidity, difficulty, a care tip,
  a baseline watering interval and **pet toxicity** (ASPCA). Works offline.
- **Wikipedia descriptions and photos** for any species — including ones outside the catalog.
- **Adaptive watering** — after a few waterings, fronds suggests an interval based on what you actually do.
- **Calendar reminders** — "Add to Google Calendar" link per plant, or download an `.ics` file for
  Google/Apple Calendar with every plant's recurring watering.
- **Backup & transfer** — export a single JSON file and import it on another device. Imports *merge*
  record-by-record (newest edit wins, deletions included), so it's safe to import the same file twice.
  Automatic safety snapshots are kept before risky operations.
- **Optional sync & push reminders** — run the small [fronds server](server/README.md) (one Docker
  container, e.g. on a home NAS) to share one collection between the phones in a household and get a
  daily notification when plants need water. One server can host several separate households;
  phones join with one-time invites and can be removed individually. No accounts, no third-party keys.

## Privacy & data

Everything is stored locally in your browser (IndexedDB). Nothing is sent anywhere except species
look-ups to Wikipedia — and, only if you connect one, your own sync server. Browsers can evict site
data under storage pressure — especially iOS Safari — so install the app to your home screen and
**export a backup now and then**.

## Run your own server (sync & reminders)

The app works on its own. Run a fronds server if you want **the phones in your home to share one
plant collection** and **a daily notification when plants need water**. One server can also host
other households (family, friends), each completely separate from yours.

Setup takes about 15 minutes. You need:

- **A computer that's always on**, with Docker: a NAS (Synology, Ugreen, QNAP… usually have a Docker
  app), a Raspberry Pi, a home server or an old PC.
- **A free [Tailscale](https://tailscale.com) account.** It gives the server a private HTTPS address
  your phones can reach from home or away. (The app runs on an `https://` site, and browsers only let
  it talk to `https://` servers. Tailscale is the easiest way to get that; any reverse proxy with a
  certificate works too.)

### 1. Start the server

Create a folder (e.g. `fronds`) with this `docker-compose.yml`:

```yaml
services:
  fronds:
    container_name: fronds
    image: ghcr.io/timoneiro/fronds-server:latest
    pull_policy: always
    ports:
      - 8787:8787
    volumes:
      - ./data:/data
    environment:
      - TZ=Europe/London   # your timezone — reminders are sent in it
      - ALLOWED_ORIGINS=https://timoneiro.github.io
    restart: unless-stopped
```

Start it with `docker compose up -d` in that folder, or create a "project"/"stack" from this file
in your NAS's Docker app. Everything the server stores lives in the `data` folder next to it.

### 2. Give it an HTTPS address with Tailscale

1. Install Tailscale on the server machine and on every phone that will use fronds, and sign in to
   the same account on all of them.
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), enable **MagicDNS** and
   **HTTPS Certificates**.
3. On the server machine, run:

   ```sh
   tailscale serve --bg --https=10443 localhost:8787
   ```

   On a Linux host you may need `sudo`. If Tailscale itself runs as a Docker container (common on
   NAS), run the command in that container's console instead; the container must use
   `network_mode: host` so that `localhost:8787` reaches fronds.
4. Your server address is now `https://<machine-name>.<your-tailnet>.ts.net:10443`. Find the exact
   name in the admin console under **Machines**. Open the address on your phone: you should see
   *"fronds sync server is running"*.

### 3. Create your household

1. Find the **server code** in the server's log: `docker logs fronds`, or the container's log view
   in your NAS app. Look for a line like `Server code: K7QM-2XRP-9HTW`.
2. On your phone, with Tailscale on, open [fronds](https://timoneiro.github.io/fronds/) →
   **Settings → Sync & reminders → Create a household**.
3. Enter the server address, the server code, a name for your household and a name for this phone,
   then tap **Create household**. The plants already on your phone are uploaded. A safety copy stays
   on the phone first.

### 4. Add the other phones in your home

1. On a phone that's already connected: **Create invite → Share invite link**.
2. On the new phone (Tailscale on), open the link, check the phone's name and tap
   **Join household**. You can also paste the link or type the code in *Join a household*.

Each invite works once and expires after 7 days, so create one per phone. Every phone gets its own
access. **Phones in this household** lists them all, and you can remove one at any time (a lost
phone, someone moving out). A removed phone keeps its plants but stops syncing.

### 5. Turn on reminders

On each phone: **Settings → Daily watering reminder** → pick a time → **Turn on** → allow
notifications → **Send test**.

- **iPhone:** first add fronds to the Home Screen (Safari → Share → *Add to Home Screen*) and
  open it from there. iOS only allows notifications for installed web apps (iOS 16.4+).
- **Android:** works in Chrome. Installing the app is recommended.

Reminders arrive even when a phone isn't on Tailscale. Waterings logged while away wait on the phone
and sync the next time it's connected, and the phone double-checks them before showing a reminder,
so you won't be told to water a plant you already watered.

### Hosting other households

Give someone the **server address** and the **server code**. They install Tailscale (you can
[share the server machine](https://tailscale.com/kb/1084/sharing) with them, or add them to your
tailnet), then follow step 3 to create their own household and step 4 to add their phones. They
can't see your plants and you can't see theirs in the app. Only share the server code with people
you trust to create households. As the server's owner, you can technically read the data file.

### Updating and backups

- **Update:** `docker compose pull && docker compose up -d`, or redeploy in your NAS app
  (`pull_policy: always` fetches the latest image). Your data and codes are kept.
- **Back up** the `data` folder. It holds everything, including `secrets.json`. If you lose that
  file, every phone has to join again. The server also keeps a daily copy of its data in
  `data/backups/` for the last 7 days.

See the [server README](server/README.md) for configuration options, Tailscale Funnel (reaching the
server without Tailscale on the phone), and the API.

## Roadmap

- **Google Drive backup** — sign in with Google only if you want it; stores the same backup file in the
  app's private Drive folder.
- Care tasks beyond watering (fertilising, repotting, misting), seasonal interval adjustments,
  photo timeline.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck
npm run build      # production build into dist/
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, React Router (hash routing so
deep links work on GitHub Pages). Pushes to `main` are tested and deployed to GitHub Pages by
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

```
src/
  db/        Dexie schema (append-only versions), write actions, backup import/export, snapshots
  domain/    pure logic: watering schedule, backup merge, calendar export (unit-tested)
  species/   bundled care catalog + Wikipedia client
  sync/      sync client, push reminders, reminder check (shared with the service worker)
  ui/        pages, components, hooks
  sw.ts      service worker: offline cache + push notifications
server/      optional sync & reminder server (Node, runs the shared domain code directly)
```

### Adding a species

Append an entry to [`src/species/catalog.ts`](src/species/catalog.ts). `wiki` must be an existing
English Wikipedia article title; pet toxicity should follow the
[ASPCA plant list](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants).
PRs welcome.

## License

[MIT](LICENSE)
