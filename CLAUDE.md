# fronds — notes for Claude

Houseplant care PWA. Local-first: all data in IndexedDB via Dexie; hosted as a static site on GitHub Pages
(https://timoneiro.github.io/fronds/). Optional self-hosted sync & push-reminder server in `server/`.

## Existing users — never lose their data
The app has real users whose only copy of their plants may be in their browser. Every change must be
non-destructive for existing data:
- **Dexie versions are append-only** (`src/db/db.ts`): never edit/delete an existing `db.version(n)`,
  never change a primary key, never drop a table holding user data. Add a new version, and extend
  `src/db/migrations.test.ts` (it opens a v0.1-shaped database with the current code).
- **Never change the app's origin/base path** (`/fronds/` on GitHub Pages). Browser storage is per
  origin — moving the app would show users an empty collection.
- **Service worker** stays at `sw.js` with the same scope (custom `src/sw.ts`, injectManifest).
- **Backup format** (`src/domain/backup.ts`): add optional fields only; bumping `SCHEMA_VERSION`
  makes older app versions reject new backups — needs a migration in `parseBackup`.
- **Sync protocol** (`src/domain/syncProtocol.ts`): backward compatible both ways.
- **Server store** (`server/src/store.ts`): upgrade old formats in `migrate()` (keeps a pre-upgrade copy);
  never regenerate existing secrets — VAPID keys changing would break every push subscription.
- Take a snapshot (`takeSnapshot`) before any operation that removes or overwrites local data.
- Ship through a PR (CI runs tests + builds); merging to `main` deploys to users immediately.

## Releases & changelog
Every user-facing change (feature or noticeable fix) bumps `version` in `package.json` and adds a
`## x.y.z — YYYY-MM-DD` entry at the top of `CHANGELOG.md`, written for users, not developers
(`src/domain/changelog.test.ts` fails CI if the entry is missing). That entry is the "What's new" card
in the app, and after the merge to `main` deploys, `scripts/announce-release.ts` emails it to the
Buttondown subscribers. It sends once per version, so internal-only changes (refactors, CI, docs) skip
the bump and send nothing. Preview the email with `node scripts/announce-release.ts --dry-run`.
Repo secrets: `BUTTONDOWN_API_KEY` (sending) and `BUTTONDOWN_USERNAME` (the subscribe form, injected
at build time as `VITE_BUTTONDOWN_USERNAME` — never commit it; locally use `.env.local`).

## Content-Security-Policy
The built app ships a CSP `<meta>` (defined in `vite.config.ts`, build only — the dev server needs
inline scripts). Only the app's own scripts and styles run; images from `'self'`, `data:` and
`*.wikimedia.org`; connections to any `https:` address (households enter their own sync server).
Loading anything from a new host (API, image CDN, embed) means adding it there, or it's silently blocked.

## Principles
- **Minimise accounts and API keys.** Core features work with no sign-in and no keys. Keyed or
  account-based services (Google Drive, plant-ID APIs) are optional add-ons.
- **Local-first.** Fully usable offline and without the server.
- **Sync-ready records.** UUID `id`, `createdAt`, `updatedAt`, `deletedAt` tombstone. Never
  hard-delete synced records. All writes go through `src/db/actions.ts` / `backupIO.ts`, which also
  add the record to the `outbox` for sync.
- Users of a server may be off its network (Tailscale) for a while: sync failures are normal, not
  errors — changes wait in the outbox; reminders are re-checked on the phone (`sync/reminderCheck.ts`).
- Target scale: 10–50 plants per household; a server hosts several isolated households (server code to
  create one, one-time invites to join, per-device tokens stored hashed). English only.

## Layout
- `src/domain/` — pure, unit-tested logic shared with the server. Relative imports here use explicit
  `.ts` extensions (the server runs these files directly with Node type stripping). No runtime deps.
- `src/db/` — Dexie schema, write actions, backup IO, snapshots, local settings.
- `src/sync/` — sync client, push subscription, reminder check. `client.ts`/`reminderCheck.ts` run in
  the service worker too: no DOM APIs there (type-checked by `tsconfig.sw.json`).
- `src/species/` — bundled catalog (ASPCA pet toxicity) + Wikipedia client.
- `src/ui/` — React pages/components; plain CSS tokens in `src/index.css` (light + dark).
- `server/` — Node HTTP server, JSON-file store, Web Push. Image: `ghcr.io/timoneiro/fronds-server`.

## Commands
`npm run dev` · `npm test` (app + server + client↔server integration) · `npm run lint` ·
`npm run typecheck` · `npm run build`. Server deps: `npm ci --prefix server`.

On Windows Git Bash, set `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/fronds/` to a local build.

## Ideas
`FEATURE_IDEAS.md` is a local, gitignored backlog — add future ideas there, not in issues or the README.
