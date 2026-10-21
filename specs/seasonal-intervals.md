# Seasonal watering intervals

Status: draft
Issue: 
Builds after: none

## Problem
Most houseplants need water much less often in winter, but fronds uses one interval all year. In
winter people either snooze constantly or edit every plant twice a year.

## Behavior
1. Plant form, under "Water every": an optional "In winter, every N days" box (1–90, empty = same
   all year). Catalog species prefill nothing; the hint says "Most plants need about half as much
   water in winter."
2. Winter is November to February (northern hemisphere). Whether a date is in winter is decided by
   the local month of the last watering, because the next due date is computed from the last
   watering. Example: watered 30 Oct with intervals 7 / winter 12 gives due 6 Nov (October is not
   winter). Watered 6 Nov gives due 18 Nov.
3. The plant page shows "Every 7 days · every 12 in winter", and the due chip uses the winter
   interval when it applies.
4. The suggestion "You've been watering about every N days" compares against the interval in effect
   now, and "Use that" updates the interval in effect now (the winter one in winter).
5. Push reminders follow the same rule on the server and on the phone, because both use the same
   domain code.
6. Calendar export (.ics and the Google link) keeps the summer interval and says "(winter: every 12
   days)" in the description. Recurring events cannot change by season.

## Out of scope
- Southern hemisphere and custom winter months (open question).
- Weather or daylight-based adjustment.
- Seasons for care tasks other than watering.

## Constraints
- New optional field on `Plant`. No Dexie version, and `SCHEMA_VERSION` stays 1.
- Old app versions and old server images ignore the field and use the summer interval. During
  winter, a phone on the new version can then get an "All caught up" push from an old server. The
  changelog says to update the server image.

## Context for implementers
- `computeSchedule`, `suggestInterval`, `describeDue`, `cleanIntervalInput`, `MAX_INTERVAL_DAYS` in
  `src/domain/watering.ts`. Tests in `src/domain/watering.test.ts`.
- `Plant` in `src/db/types.ts`. `assertRecords` in `src/domain/backup.ts`.
- `src/domain/calendar.ts` (`googleCalendarLink`, `buildICS`) and its test.
- UI: `src/ui/pages/PlantFormPage.tsx` (interval stepper), `src/ui/pages/PlantDetailPage.tsx`.
- Share links: `buildShare` sends `wateringIntervalDays` only. Leave it unchanged.
- Decided already: field `winterIntervalDays?: number`, winter months fixed to Nov–Feb,
  `intervalAt(plant, date)` as the one place that decides.

## Tasks
1. **intervalAt**
   - Change: `WINTER_MONTHS = [10, 11, 0, 1]` (JS months) and `intervalAt(plant, date)` in `watering.ts`.
     `computeSchedule` uses `intervalAt(plant, lastWateredAt)`. `suggestInterval` takes the interval
     in effect at `now`.
   - Depends on: none
   - Done when: `watering.test.ts` covers the two examples above, a plant without the field (all
     existing tests unchanged), and snooze still applying on top. `npm test` passes.
   - Executor: haiku
2. **Field validation**
   - Change: `Plant.winterIntervalDays?`. `assertRecords` refuses a value that is not an integer from
     1 to 90.
   - Depends on: none
   - Done when: `backup.test.ts` has a valid and an invalid case. `npm test` passes.
   - Executor: sonnet
3. **Form and plant page**
   - Change: winter box in `PlantFormPage.tsx` (empty saves `undefined`). "Every … · every … in winter"
     and "Use that" target in `PlantDetailPage.tsx`.
   - Depends on: 1, 2
   - Done when: the manual check below passes, and `npm run lint` passes.
   - Executor: sonnet
4. **Calendar text**
   - Change: append " (winter: every N days)" to the descriptions in `googleCalendarLink` and
     `buildICS` when set.
   - Depends on: 2
   - Done when: `calendar.test.ts` has a case with the field. `npm test` passes.
   - Executor: haiku
5. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry (mentions updating the server image for reminders).
   - Depends on: 3, 4
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Watered 6 Nov, 7 / winter 12: due 18 Nov (test).
- [ ] Watered 30 Oct, same plant: due 6 Nov (test).
- [ ] Plants without a winter interval behave exactly as before (all existing watering tests pass
      unchanged).
- [ ] The server's `plantsNeedingWater` honours the winter interval (a test in
      `server/src/reminders.test.ts`).
- [ ] A backup with `winterIntervalDays: 0` is refused.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual: set a winter interval on a plant watered last week, then change the device date into
  December and check the due text.

## Escalate when
- Any existing `watering.test.ts` case would need changing.

## Open questions
- Southern hemisphere: a local setting would make the phone and server disagree. Options are a
  per-plant month range, a household setting synced via `synced-tables`, or Nov–Feb only (proposed
  for now).
- Should winter start from the date being checked rather than the last watering? The proposal uses
  the last watering, which is simpler and never moves a due date backwards.

## Notes
- Keeping the rule in `src/domain/watering.ts` means the server and the service worker get it for
  free once their code is updated.
