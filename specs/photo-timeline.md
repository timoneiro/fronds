# Photo timeline per plant

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/34
Builds after: none

## Problem
A plant has one photo. People want to see how it grew over months, but adding a new photo replaces
the old one.

## Behavior
1. Plant page: a "Timeline" card with photos newest first, each with its date and an optional caption.
   "📷 Add photo" uses the camera or library, resized like plant photos but larger (max 1280 px).
2. Tapping a photo opens it full-screen with "Use as main photo" (sets `plant.photo` from a 640 px
   copy), "Edit caption" and "Delete" (confirm first).
3. The first time, the plant's current photo is not copied into the timeline automatically.
4. **Storage.** Timeline photos stay on this phone. They are not synced, and they are not in the
   normal backup file. Settings → Backup gets "Export backup with photos", which writes the same JSON
   plus a `photos` array. "Import & merge" adds photos from such a file by id.
5. The Timeline card shows "Photos are kept on this phone only" under the button, and Settings →
   Storage shows the photos' total size.
6. Deleting a plant keeps its photos, hidden. They show again if the plant comes back (for example from a backup import).

Example: add photos in January and June. The timeline shows June then January. Choose January as
main, and the plant row thumbnail changes.

## Out of scope
- Syncing photos through the server (open question).
- Side-by-side or slideshow views.
- Photos in share links.

## Constraints
- New **local-only** Dexie table `photos` (`'id, plantId, takenAt'`), added in a new `db.version(n)`.
  Use the next free number: check `src/db/db.ts`, because other specs add versions too. Not in the
  outbox.
- These are people's own photos. Delete only on an explicit confirmed action. `takeSnapshot` stays
  photo-free (size), so the confirm text says deleted photos cannot be restored.
- Backup format: an optional `photos` field. Older apps ignore it, and `SCHEMA_VERSION` stays 1.
- CSP already allows `data:` images.

## Context for implementers
- `resizeImage(file, maxSize, quality)` in `src/lib/image.ts`.
- Schema history rules in `src/db/db.ts`. `src/db/migrations.test.ts` must be extended.
- Backup: `Backup`, `parseBackup` in `src/domain/backup.ts`; `exportBackup` in `src/db/snapshots.ts`;
  `importMerge`, `downloadJSON` in `src/db/backupIO.ts`; Settings backup card in
  `src/ui/pages/SettingsPage.tsx`.
- Plant page: `src/ui/pages/PlantDetailPage.tsx`. Writes: `updatePlant` for "Use as main photo".

## Tasks
1. **Table**
   - Change: `PlantPhoto { id; plantId; takenAt; data; caption?; createdAt }` in `src/db/types.ts`,
     a new `db.version(n)` adding `photos`, and a migration test update.
   - Depends on: none
   - Done when: `migrations.test.ts` passes with the v1 seeding intact and `photos` empty. `npm test`
     passes.
   - Executor: sonnet
2. **Backup with photos**
   - Change: optional `photos?: PlantPhoto[]` in `Backup`, validated in `parseBackup` (strings,
     `data` must start with `data:image/`). `exportBackup({ withPhotos })`. `importMerge` adds photos
     whose id is new. `importReplace` replaces photos only when the file has them.
   - Depends on: 1
   - Done when: `backup.test.ts` covers a file with photos, a bad photo refused, and a 0.6.0 file
     unchanged. `npm test` passes.
   - Executor: sonnet
3. **Timeline UI**
   - Change: Timeline card, full-screen view, and actions in `PlantDetailPage.tsx` (or a new
     `src/ui/components/Timeline.tsx`). Add `addPhoto`, `deletePhoto`, `setCaption` in a new
     `src/db/photos.ts`.
   - Depends on: 1
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
4. **Settings**
   - Change: an "Export backup with photos" button and the photo size line in Storage.
   - Depends on: 2
   - Done when: the exported file contains `"photos"`, and the normal export does not.
   - Executor: sonnet
5. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry (photos stay on this phone, and how to back them up).
   - Depends on: 3, 4
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Photos survive a reload and an app update (migration test).
- [ ] Normal export has no `photos` key. Export with photos plus import & merge on a fresh install
      restores them.
- [ ] Deleting a photo asks first, and it is gone after a reload.
- [ ] Sync requests never contain photos (integration test: the outbox has no `photos` entries).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual on a phone: add 3 photos, export with photos, import on desktop.

## Escalate when
- The Dexie version number conflicts with another spec's version already on `main`.
- Storage quota errors appear (show them, do not silently drop photos).

## Open questions
- Sync photos? The server keeps everything in one JSON file rewritten on each change (`Store.save`),
  so many photos would make every sync slow. Options: a separate photo store on the server, or keep
  them local (proposed).
- Should "Plant died" (`plant-graveyard`) keep showing the timeline on the lost plant's page? The
  proposal is yes.

## Notes
- Local-only avoids the server-store size problem and needs no `synced-tables`.
