# Adding a new synced record table: checklist

Shared by every spec that adds a synced table (`room-light-levels`, `wishlist`). It needs
`synced-tables` to be built first. Read `CLAUDE.md` ("Existing users — never lose their data") first.

1. `src/db/types.ts`: the record interface (extends `SyncMeta`).
2. `src/domain/records.ts`: an entry in `EXTRA_TABLES` with a `label` for the "update the server"
   notice, a `max` record count, and a `check` that validates every field. Free text gets a length
   cap. Ids are strings.
3. `src/db/db.ts`: add the typed table to `db`, and a **new** `db.version(n)` that adds the store
   (`'id, updatedAt'` plus any index the UI needs). Never edit an existing version. Use the next free
   number: check the file, because other specs add versions too.
4. `src/db/migrations.test.ts`: extend it so the v0.1 database still opens and the new table starts
   empty. Never delete the v1 seeding.
5. Writes only through `src/db/actions.ts` functions that call `markDirty('<table>', ids)` inside the
   same transaction. Never hard-delete: a delete sets `deletedAt` and `updatedAt`.
6. Read live records with `isLive` (the `useGarden` pattern in `src/ui/hooks.ts`).
7. Tests: one round trip of the table in `src/sync/sync.integration.test.ts`, and a backup export and
   import in `src/domain/backup.test.ts`.
8. Server: no code change. The table is accepted because it is in `EXTRA_TABLES`, which the server
   imports from `src/domain/`. It still needs a **new server image**: mention it in `CHANGELOG.md`
   ("update your server to sync …").
9. `package.json` minor version bump and a `CHANGELOG.md` entry written for users. A test enforces
   both.
10. Older phones ignore the table. Older servers trigger the Settings notice from `synced-tables`.
    Share links do not change.
