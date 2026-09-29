# fronds — notes for Claude

Houseplant care PWA. Local-first: all data in IndexedDB via Dexie; hosted as a static site on GitHub Pages.

## Principles
- **Minimise accounts and API keys.** Core features must work with no sign-in and no keys. Keyed or
  account-based services (Google Drive, plant-ID APIs) are optional add-ons the user opts into.
- **Local-first.** The app must work fully offline and without the optional sync server.
- **One data format.** `src/domain/backup.ts` defines the backup JSON used for export/import and,
  later, Drive backup and server sync. Changing `Plant`/`CareEvent` incompatibly means bumping
  `SCHEMA_VERSION` and adding a migration in `parseBackup`.
- **Sync-ready records.** Every record has a UUID `id`, `createdAt`, `updatedAt` and a `deletedAt`
  tombstone. Never hard-delete synced records; set `deletedAt` and `updatedAt`. Always bump
  `updatedAt` on writes (use helpers in `src/db/actions.ts`).
- Target scale: 10–50 plants per user, single user per household (for now).
- English only.

## Layout
- `src/domain/` — pure, unit-tested logic (no DOM/Dexie). Put new logic here with tests.
- `src/db/` — Dexie schema (`db.ts`), write actions, backup IO.
- `src/species/` — bundled catalog (pet toxicity per ASPCA) and Wikipedia client (cached in IndexedDB).
- `src/ui/` — React pages/components. Plain CSS with tokens in `src/index.css` (light + dark).

## Commands
`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`

On Windows Git Bash, set `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/fronds/` to a local build,
otherwise the path is rewritten to a Windows path.

## Ideas
`FEATURE_IDEAS.md` is a local, gitignored backlog — add future ideas there, not in issues or the README.
