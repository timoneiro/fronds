# Sync more than plants and events

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/45
Builds after: none

## Problem
Sync, backups and the server only know two record tables, `plants` and `events`. Rooms with light
levels (`room-light-levels`) and the wishlist (`wishlist`) each need a new synced table. Without
groundwork, each would have to rework the sync protocol, the server store and the backup format, and
an older server would silently drop records it does not know.

## Behavior
Nothing changes for people until a later spec registers a table. After this spec:
1. A table can be added to sync by registering it in one list (`EXTRA_TABLES`, see Tasks). Each entry has
   a name, a shape check and a size cap.
2. **Protocol 3.** `SyncRequest` and `SyncResponse` gain an optional `tables?: Record<string, SyncMeta[]>`.
   A server at protocol 3 stores and returns records of every registered table, merged by the same
   rule as plants (newest `updatedAt` wins, tombstones are records).
3. **Older servers.** The phone reads `protocol` from `GET /api/server`, which is already public. If
   it is below 3, the phone does not send `tables` and leaves those records in the outbox. Settings →
   Sync shows "Update the server to sync rooms and wishlist" (wording built from the registered
   tables' labels). Plants and events keep syncing.
4. **Older phones.** A protocol-2 phone never sends `tables`, so the server's response to it leaves
   out `tables` too. Its plants and events sync as before.
5. **Backups.** `Backup` gains an optional `tables?: Record<string, SyncMeta[]>`. Export includes
   every registered table. Import merge and import replace handle it. `SCHEMA_VERSION` stays 1:
   older app versions ignore the field when reading. An older app's "Import & replace" drops those
   records, which is acceptable because only the older app is affected.

Example: a phone on 0.8 with a server image from before this spec has two rooms. Plants keep
syncing, the rooms stay in the outbox, and Settings asks for a server update. After the server image
is updated, the next sync uploads the rooms.

## Out of scope
- Adding any real table: the first one is `room-light-levels` or `wishlist`.
- Changing how plants or events sync, or the share-link format.
- Photo sync (`photo-timeline` keeps photos local).

## Constraints
- CLAUDE.md "Existing users — never lose their data": the sync protocol stays backward compatible
  both ways, and the server store upgrades in `migrate()`.
- `src/domain/` files use `.ts` import extensions and no runtime deps (the server runs them directly).
- `src/sync/client.ts` runs in the service worker too: no DOM APIs.

## Context for implementers
- Wire format: `src/domain/syncProtocol.ts` (`PROTOCOL_VERSION`, `SyncRequest`, `SyncResponse`,
  `ServerHello`).
- Shape checks: `assertRecords` and `checkMeta` in `src/domain/backup.ts`, which backup import and
  server sync (`server/src/sync.ts` `parseSyncRequest`) both use.
- Server merge: `mergeTable` / `changesSince` / `applySync` in `server/src/sync.ts`; household shape
  and `migrate()` in `server/src/store.ts`.
- Client: `pendingRecords`, `applyPulled`, `clearSent`, `doSync` in `src/sync/client.ts`;
  `OutboxEntry.table` in `src/db/types.ts`; `markDirty` in `src/db/actions.ts`.
- Backup IO: `src/db/backupIO.ts`, `src/db/snapshots.ts` (`exportBackup`).
- Tests: `server/src/sync.test.ts`, `server/src/app.test.ts`, `src/domain/backup.test.ts`,
  `src/sync/sync.integration.test.ts`.
- Decided already: a generic `tables` map instead of one named field per table; record tables keep
  the `SyncMeta` shape; the store file stays `version: 2`, and a missing `tables` defaults to `{}`.

## Tasks
1. **Table registry**
   - Change: new `src/domain/records.ts` exporting `interface ExtraTable { name: string; label: string;
     max: number; check(r: unknown): void }` and `EXTRA_TABLES: ExtraTable[] = []`, plus
     `assertTables(tables: unknown, registry = EXTRA_TABLES): asserts tables is Record<string, SyncMeta[]>`,
     which drops unknown table names and calls `checkMeta` (export it from `backup.ts`) and `check` on
     each record. It throws `BackupError` when there are more than `max` records.
   - Depends on: none
   - Done when: `src/domain/records.test.ts` covers an unknown table being ignored, a bad record
     throwing, over the cap throwing and valid records passing, using a test registry passed as the
     argument. `npm test` passes.
   - Executor: sonnet
2. **Protocol 3 on the server**
   - Change: `PROTOCOL_VERSION = 3`. Add `tables?` to `SyncRequest` and `SyncResponse`. Add
     `tables: Record<string, Record<string, Stored<SyncMeta>>>` to `Household`; `newHousehold` and
     `migrate()` default it to `{}` for stores without it. `parseSyncRequest` validates `tables` with
     `assertTables`. `applySync` merges each table with `mergeTable` and returns `tables` only when the
     request had a `tables` key. `parseSyncRequest` and `applySync` take an optional last parameter
     `registry = EXTRA_TABLES` so tests can pass their own. `MAX_RECORDS` counts all tables. Bump the server `VERSION` and
     `server/package.json` minor.
   - Depends on: 1
   - Done when: `server/src/sync.test.ts` covers a protocol-2 request (no `tables`) whose response has
     no `tables`; a protocol-3 round trip using a test registry; and a v2 store file without `tables`
     loading. `npm test` passes.
   - Executor: sonnet
3. **Client sends and pulls registered tables**
   - Change: widen `OutboxEntry.table` and `markDirty` to `string`. In `src/sync/client.ts`, loop over
     `EXTRA_TABLES` in `pendingRecords`, `applyPulled` and `clearSent`. Send `tables` only when the
     server's protocol is 3 or higher. Store `protocol` in `SyncConfig` from `/api/server` (`checkServer`
     in `src/sync/households.ts`, and once per app start in `doSync` when it is missing). Leave unsent
     table records in the outbox.
   - Depends on: 2
   - Done when: `npm test` passes, including the existing `sync.integration.test.ts` unchanged, and
     `npm run typecheck` (it covers `tsconfig.sw.json`).
   - Executor: sonnet
4. **Backups carry tables**
   - Change: `Backup.tables?` in `src/domain/backup.ts`. `parseBackup` validates it with
     `assertTables`. `exportBackup` reads every registered table. `importMerge` and `importReplace`
     merge or replace each table and mark it dirty.
   - Depends on: 1
   - Done when: `backup.test.ts` has a backup without `tables` that still parses, and a backup with
     an unknown table that parses with that table ignored. `npm test` passes.
   - Executor: sonnet
5. **Settings notice for old servers**
   - Change: in `src/ui/components/SyncSection.tsx` (`Connected`), when `EXTRA_TABLES` is not empty and
     `config.protocol < 3`, show a `notice` naming the tables' labels and asking to update the server
     image.
   - Depends on: 3
   - Done when: `npm run lint` and `npm run build` pass. The notice is hidden while `EXTRA_TABLES` is empty.
   - Executor: sonnet
6. **Docs, no app release**
   - Change: `server/README.md` API section: document `tables` and protocol 3. No app version bump,
     because nothing is user-facing yet.
   - Depends on: 2
   - Done when: `grep -n "tables" server/README.md` finds the new paragraph.
   - Executor: haiku

## Acceptance criteria
- [ ] A protocol-2 request to the new server gets exactly the response it got before (test).
- [ ] A new phone talking to an old server (protocol 2) does not send `tables` and keeps those outbox
      entries (test with a stubbed hello).
- [ ] A store file written by server 0.2.0 loads, and saves with `tables: {}` on every household.
- [ ] A backup from 0.6.0 imports unchanged.
- [ ] With `EXTRA_TABLES` empty, the app looks and syncs exactly as before.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- An existing test in `sync.test.ts`, `app.test.ts`, `backup.test.ts` or `sync.integration.test.ts`
  would have to change.
- The store needs `version: 3` to be safe.
- Anything would hard-delete or overwrite stored records.

## Open questions
- Should the outbox notice wait until there are unsent table records, rather than showing whenever
  the server is old? The proposal shows it always, so people update before using the feature.

## Notes
- The generic map avoids a protocol change per table. Waypoints learned the same lesson
  (`new-table-checklist.md` there).
- Per-table steps after this spec are in `specs/new-table-checklist.md`.
