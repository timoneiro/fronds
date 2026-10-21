# "Check the soil" mode

Status: draft
Issue: 
Builds after: undo-watering

## Problem
Succulents and other plants that should be watered only when the soil is dry do not fit "water every
N days". People get told to water, check, find the soil moist, and snooze, every time.

## Behavior
1. Plant form: a "Remind me to" choice, either "Water" (default) or "Check the soil". The interval
   label changes to "Check every N days".
2. For check-soil plants, rows and the plant page say "Check soil today", "Check soil in 3 days" and
   so on instead of "Water …". Today lists them under "Needs water" with a 🔍 marker.
3. Actions on a check-soil plant: "Dry → watered" (logs a `water` event, same as 💧) and "Still
   moist" (logs a `snooze` of the plant's `checkAgainDays`, default 3). Both show the undo toast.
4. Push reminders count check-soil plants as due, and the notification wording is unchanged ("needs
   water"), so the server needs no change.
5. Switching a plant between modes keeps its history and interval.

Example: an Aloe set to "Check every 14 days, check again after 4". On day 14, Today shows "🔍 Check
soil today". Tap "Still moist" and it shows "Check soil in 4 days".

## Out of scope
- New event types: results map onto existing `water` and `snooze` events.
- Sensor readings (homelab ideas in `BACKLOG.md`).
- Changing the push text.

## Constraints
- Optional plant fields only (`checkSoil?: boolean`, `checkAgainDays?: number`). No Dexie version,
  and `SCHEMA_VERSION` stays 1.
- Old app versions ignore the fields and show these plants as normal watering plants. This is
  harmless.

## Context for implementers
- `describeDue` in `src/domain/watering.ts` (wording), `DueChip` and `PlantRow` in
  `src/ui/components/bits.tsx`.
- `WaterActions` in `src/ui/components/WaterActions.tsx`. After `undo-watering` it has a `plantName`
  prop and calls the toast.
- `PlantFormPage.tsx` and `PlantDetailPage.tsx`. `assertRecords` in `src/domain/backup.ts`.
- Do not touch: `computeSchedule` maths, reminders, the server.

## Tasks
1. **Fields and wording**
   - Change: add the two optional fields to `Plant`. `describeDue(s, plant?)` returns "Check soil …"
     wording when `plant?.checkSoil`. `assertRecords` validates `checkAgainDays` (integer 1–30) and
     `checkSoil` (boolean) when present.
   - Depends on: none
   - Done when: `watering.test.ts` covers both wordings for each status, and `backup.test.ts` covers
     an invalid `checkAgainDays`. `npm test` passes.
   - Executor: sonnet
2. **Form**
   - Change: the mode choice plus the "Check again after N days" box in `PlantFormPage.tsx`.
   - Depends on: 1
   - Done when: `npm run lint` passes, and saving and reopening shows the chosen mode.
   - Executor: sonnet
3. **Actions and rows**
   - Change: `WaterActions` shows "Dry → watered" and "Still moist" for check-soil plants. `DueChip`
     and the plant page pass the plant to `describeDue`. Today adds the 🔍 marker.
   - Depends on: 1
   - Done when: the example above works manually, and `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry.
   - Depends on: 2, 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] The Aloe example works end to end.
- [ ] A check-soil plant's due date equals a normal plant's with the same history (no maths change).
- [ ] "Still moist" logs a snooze of `checkAgainDays` days, defaulting to 3.
- [ ] Undo works on both buttons.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Needing a new event type or a server change.

## Open questions
- Should the push mention "check" separately ("💧 2 to water · 🔍 1 to check")? The proposal is no
  for now.

## Notes
- Builds after `undo-watering` because both change `WaterActions`, and this spec reuses its toast.
