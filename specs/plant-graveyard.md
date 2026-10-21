# Graveyard: plants you lost

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/35
Builds after: none

## Problem
When a plant dies, the only option is "Delete plant", which also deletes its history. There is no
record of what was lost or why, so the same mistake gets repeated.

## Behavior
1. Plant page: next to "Delete plant", a "Plant died" button. It asks "What happened? (optional)"
   with a short text field and quick picks: Overwatered, Underwatered, Pests, Too little light, Too
   cold, Unknown. Saving marks the plant lost on that day.
2. Lost plants disappear from Today, Plants, reminders, calendar export and share links. Their
   history is kept.
3. Plants → "Graveyard (3)" link at the bottom, shown only when there are lost plants. It lists each
   one with photo, name, species, "Lived 1 year 2 months" (from the first logged watering or
   `createdAt` to the loss date), the date and what happened.
4. A lost plant's page is read-only apart from "Bring back" (clears the loss fields) and "Delete
   plant".
5. Graveyard insight: when 2 or more lost plants share a reason, the graveyard shows "2 lost to
   overwatering. Consider longer intervals." The text comes from a fixed table per reason.

Example: mark Fiddle-leaf fig as died with "Too cold". It leaves Today and Plants, and the graveyard
shows "Fiddle-leaf fig · lived 8 months · 3 Jan 2027 · Too cold".

## Out of scope
- Photos of the dead plant beyond the existing `photo`.
- Statistics beyond the reason insight (see `stats`).

## Constraints
- New optional fields `lostAt?: ISODate` and `lostNote?: string` (max 200) on `Plant`. No Dexie
  version, and `SCHEMA_VERSION` stays 1.
- Old app versions and old server images do not know `lostAt`: they show lost plants as alive and
  may remind about them. The changelog asks households to update every phone and the server image.
  The phone's reminder check (`resolveReminder`) already hides them when it can sync.
- Never hard-delete. "Plant died" is an `updatePlant`.

## Context for implementers
- `Plant` in `src/db/types.ts`. `assertRecords` in `src/domain/backup.ts`.
- Live lists: `useGarden` in `src/ui/hooks.ts` (add a `lost` filter there, so every page gets it).
- Reminders: `plantsNeedingWater` in `server/src/reminders.ts` and `plantsDueLocally` in
  `src/sync/reminderCheck.ts`. Both must skip lost plants.
- Calendar: `onCalendar` in `src/ui/pages/SettingsPage.tsx` uses `useGarden` (covered by the filter).
- UI: `src/ui/pages/PlantDetailPage.tsx`, `src/ui/pages/PlantsPage.tsx`, routes in `src/App.tsx`.
- Decided already: a plant field, not a table, so the history stays attached.

## Tasks
1. **Domain**
   - Change: `Plant.lostAt?` and `lostNote?`; `isLost(p)` in `src/domain/watering.ts`.
     `assertRecords` validates the types and lengths. Add `LOSS_REASONS` and `graveyardInsights(plants)`
     in a new `src/domain/graveyard.ts`.
   - Depends on: none
   - Done when: tests cover insights (none, one reason twice, two reasons) and an invalid `lostNote`.
     `npm test` passes.
   - Executor: sonnet
2. **Exclude lost plants everywhere**
   - Change: `useGarden` drops lost plants and exposes `lost` separately. `plantsNeedingWater` and
     `plantsDueLocally` skip them.
   - Depends on: 1
   - Done when: `server/src/reminders.test.ts` and `src/sync/reminderCheck.test.ts` each have a lost
     plant that is not reminded. `npm test` passes.
   - Executor: sonnet
3. **UI**
   - Change: the "Plant died" dialog, a read-only lost page with "Bring back", the `/plants/graveyard`
     page, and the link on Plants.
   - Depends on: 2
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry, including the update-every-phone and server note.
   - Depends on: 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] A lost plant appears in none of: Today, Plants, the .ics export, a new share link, or a push
      reminder from an updated server (tests for reminders).
- [ ] Its history is still listed on its page.
- [ ] "Bring back" restores it to every list with the same schedule as before.
- [ ] A backup with a lost plant round-trips, and a 0.6.0 backup imports unchanged.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Excluding lost plants needs changes to sync or merge.

## Open questions
- Should the share view or sitter sheet ever show lost plants? The proposal is never.
- Should lost plants count in the Plants header count? The proposal is no.

## Notes
- `wishlist` is separate (a new table). The two can ship independently.
