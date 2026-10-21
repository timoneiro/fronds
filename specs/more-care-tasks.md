# Care tasks beyond watering

Status: draft
Issue: 
Builds after: none

## Problem
fronds only tracks watering. Fertilising, repotting, misting and the rest are done on their own
rhythm and forgotten, and there is nowhere to log them.

## Behavior
1. **Tasks.** Fertilise, repot, mist, rotate, prune, pest check, clean leaves. Each has an emoji and
   a label (`CARE_TASKS` in Tasks).
2. **Per-plant intervals.** On the plant form, a collapsed "Other care" section lists each task with
   an optional "every N days" box (1–365). Empty means not scheduled. Example: Fertilise every 30,
   Rotate every 7.
3. **Log it.** On the plant page, a "Care" card lists the scheduled tasks with their due text ("Due
   today", "In 5 days", "Overdue by 2 days", "Never done") and a "Done" button. The card also has a
   "Log other care" menu to log any task, scheduled or not.
4. **Today page.** Below "Needs water", a "Other care due" section lists plant + task rows that are
   due or overdue, each with a "Done" button. It is hidden when nothing is due.
5. **History** shows each entry with its emoji and label, for example "🌱 Fertilised · Tue 3 Nov".
   Entries can be removed with ✕ as today.
6. A task that has never been logged is due today ("Never done"). It does not wait one full
   interval.
7. Watering, snooze, reminders, calendar export and share links are unchanged.

## Out of scope
- Push reminders or calendar events for care tasks (open question).
- Snoozing care tasks.
- Seasonal changes to care intervals.
- Sharing care intervals in share links.

## Constraints
- CLAUDE.md: records stay backward compatible. New fields are optional, `SCHEMA_VERSION` stays 1, and
  there is no Dexie version (no new index).
- Old app versions render any non-water event as "⏰ Snoozed" in history
  (`PlantDetailPage.tsx`) and ignore it in the schedule. This is acceptable and noted in the
  changelog ("update every phone in your household").

## Context for implementers
- `CareEventType` and `Plant` in `src/db/types.ts`.
- Schedule maths in `src/domain/watering.ts` (`computeSchedule`, `addDays`, `daysBetween`,
  `startOfDay`). Tests in `src/domain/watering.test.ts`.
- Writes: `addEvent`, `deleteEvent`, `updatePlant` in `src/db/actions.ts`.
- UI: `src/ui/pages/PlantDetailPage.tsx` (history list, cards), `src/ui/pages/PlantFormPage.tsx`,
  `src/ui/pages/TodayPage.tsx`, the `useGarden` hook in `src/ui/hooks.ts`. Styles in `src/index.css`.
- Shape checks: `assertRecords` in `src/domain/backup.ts`.
- Do not touch: `computeSchedule`'s watering behaviour, `src/domain/reminders.ts`, the server.
- Decided already: intervals live on the plant as `careIntervals?: Partial<Record<CareTask, number>>`.
  Events reuse `CareEvent` with new `type` values.

## Tasks
1. **Types and task list**
   - Change: `CareTask = 'fertilise' | 'repot' | 'mist' | 'rotate' | 'prune' | 'pest-check' | 'clean'`.
     `CareEventType = 'water' | 'snooze' | CareTask`. Add `Plant.careIntervals?`. In
     `src/domain/care.ts`, add `CARE_TASKS: { id: CareTask; emoji: string; label: string; done: string }[]`,
     where `done` is the past tense for history ("Fertilised").
   - Depends on: none
   - Done when: `npm run typecheck` passes.
   - Executor: sonnet
2. **careSchedule**
   - Change: `careSchedule(plant, events, task, now): { lastDoneAt?: Date; dueDate: Date; daysUntilDue: number }
     | undefined` in `src/domain/care.ts`. It returns undefined when there is no interval. Without a
     log, the task is due today (`daysUntilDue` 0, like watering's `never`). Also add `careDue(plant, events,
     now)`, which lists the tasks with `daysUntilDue <= 0`.
   - Depends on: 1
   - Done when: `src/domain/care.test.ts` covers no interval, never done, done yesterday with a
     7-day interval, overdue, deleted events ignored, and other tasks' events ignored. `npm test`
     passes.
   - Executor: haiku
3. **Validate the new field**
   - Change: in `assertRecords`, if `careIntervals` is present it must be an object whose values are
     integers from 1 to 365, otherwise throw `BackupError`.
   - Depends on: 1
   - Done when: `backup.test.ts` has one valid and one invalid case. `npm test` passes.
   - Executor: haiku
4. **Plant form**
   - Change: an "Other care" `<details>` section in `PlantFormPage.tsx` with one numeric box per task,
     reusing `cleanIntervalInput` (but capped at 365). Empty removes the key, and an empty object is
     saved as `undefined`.
   - Depends on: 1
   - Done when: the manual check "set Fertilise 30, save, reopen: 30 is shown" passes, and `npm run lint`
     passes.
   - Executor: sonnet
5. **Plant page and Today**
   - Change: Care card and history labels in `PlantDetailPage.tsx`; "Other care due" section in
     `TodayPage.tsx`; `addEvent(plantId, task)` for Done.
   - Depends on: 2, 4
   - Done when: the manual checks in Verification pass, and `npm run lint` passes.
   - Executor: sonnet
6. **Version and changelog**
   - Change: minor bump in `package.json` and a `CHANGELOG.md` entry. The entry says older versions
     show care entries as "Snoozed" until updated.
   - Depends on: 5
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] A plant with Fertilise every 30 days and no log shows "Fertilise" in "Other care due" on Today.
- [ ] Tapping Done removes it from Today and the Care card shows "In 30 days".
- [ ] The history shows "🌱 Fertilised" (or the chosen emoji) with the date. ✕ removes it, and the
      task is due again.
- [ ] Watering due dates are identical before and after logging any care task (test in
      `care.test.ts`, running `computeSchedule` with care events).
- [ ] A 0.6.0 backup imports unchanged. A backup with `careIntervals: { mist: 0 }` is refused.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual: set two tasks on one plant, mark one done, reload, and check Today and the plant page.

## Escalate when
- Showing care tasks needs a Dexie index or a new table.
- `computeSchedule` behaviour would have to change.

## Open questions
- Should the daily push reminder mention care tasks ("💧 2 to water · 🌱 1 to fertilise")? That
  needs `dueReminder` and the server's `plantsNeedingWater` to change. Proposed: a follow-up spec.
- Are the seven tasks right, and which emoji should each have?

## Notes
- No new table: care events are `CareEvent`s, so sync, backup and merge work unchanged.
