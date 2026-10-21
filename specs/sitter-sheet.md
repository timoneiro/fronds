# Vacation: plant-sitter sheet and paused reminders

Status: draft
Issue: 
Builds after: none

## Problem
Before a trip, people have to explain to a plant-sitter what to water and when, and their own phone
keeps sending reminders while they are away.

## Behavior
**Sitter sheet** (no server needed)
1. Plants → "Going away?" opens `#/plants/sitter`. Pick the first and last day away (defaults:
   tomorrow to 7 days later) and which rooms to include (same picker as Share).
2. The sheet lists, per room and plant: name, species, photo thumbnail (if any), "Water every N
   days", the catalog tip, the plant's notes (only if "Include notes" is on), and the dates to water
   within the trip. Dates are projected from the current due date, plus the interval each time.
   Overdue plants are first watered on day one.
3. A day-by-day summary lists each date and the plants to water then. Days with nothing are skipped.
4. "Print" calls `window.print()`, and the print stylesheet hides the tab bar and buttons.
   "Share as link" makes a normal share link (existing `#/view/` format) for the same rooms.

Example: Monstera every 7 days, next due on 4 Nov, trip 1–14 Nov. The sheet shows "Water on Tue 4
Nov, Tue 11 Nov".

**Pause reminders** (only with a server and reminders on)
5. Settings → Daily watering reminder → "Pause until…" (a date). While paused, the server sends no
   reminder to this phone. The setting shows "Paused until Sun 15 Nov · Resume". After that date,
   reminders resume on their own.
6. If the server is too old to pause, show "Update the server to pause reminders" and do nothing.

## Out of scope
- Accounts or access for the sitter, or the sitter logging waterings.
- Pausing other phones in the household.
- Changing intervals for the trip.

## Constraints
- Sheet: read-only and derived. No records, works offline.
- Pause: `PushSubscribeRequest` gets an optional field, so the protocol stays backward compatible. An
  old server ignores the field, and the app detects that from the server version.

## Context for implementers
- Schedule: `computeSchedule`, `addDays` in `src/domain/watering.ts`; `getSpecies` and `tip` in
  `src/species/catalog.ts`.
- Room picker and share link: `src/ui/pages/SharePage.tsx`, `buildShare`, `roomOf` in
  `src/domain/share.ts`, `shareLink` in `src/lib/shareLink.ts`.
- Routes: `src/App.tsx`. Plants page: `src/ui/pages/PlantsPage.tsx`.
- Reminders: `enableReminders` in `src/sync/push.ts`, `Reminders` in
  `src/ui/components/SyncSection.tsx`, `PushSubscribeRequest` in `src/domain/syncProtocol.ts`,
  `parseSubscribe` and `/api/push/subscribe` in `server/src/app.ts`, `runReminders` in
  `server/src/reminders.ts`, and the server `VERSION` in `server/src/app.ts`.
- Decided already: projected dates come from `computeSchedule(...).dueDate` stepping by
  `wateringIntervalDays`. The pause is stored on the server per subscription as `pausedUntil`
  ("YYYY-MM-DD", inclusive, server timezone).

## Tasks
1. **sitterPlan**
   - Change: `sitterPlan(items, from, to): { plant; dates: Date[] }[]` and `byDay(plan)` in
     `src/domain/sitter.ts`. A plant whose due date is before `from` is first watered on `from`.
   - Depends on: none
   - Done when: `src/domain/sitter.test.ts` covers due inside the trip, overdue, never watered (due on
     `from`), interval longer than the trip (no dates), and a one-day trip. `npm test` passes.
   - Executor: haiku
2. **Sitter page**
   - Change: `src/ui/pages/SitterPage.tsx` at `/plants/sitter`, a "Going away?" link on Plants, and a
     print stylesheet in `src/index.css` (`@media print`).
   - Depends on: 1
   - Done when: the manual check below passes, and `npm run lint` passes.
   - Executor: sonnet
3. **Server: pausedUntil**
   - Change: optional `pausedUntil` in `PushSubscribeRequest`, validated as `YYYY-MM-DD` in
     `parseSubscribe`. `runReminders` skips subscriptions where `localDate(now) <= pausedUntil`. Add
     `POST /api/push/pause { deviceId, pausedUntil | null }`. Bump the server `VERSION` and
     `server/package.json` minor.
   - Depends on: none
   - Done when: `server/src/reminders.test.ts` covers paused today (no send), the last paused day (no
     send) and the day after (send). `app.test.ts` covers the pause route. `npm test` passes.
   - Executor: sonnet
4. **App: pause control**
   - Change: `pauseReminders(until | null)` in `src/sync/push.ts`. Store `pausedUntil` in
     `ReminderConfig`. Add the UI in `Reminders`. If `/api/push/pause` returns 404, show the
     update-server message.
   - Depends on: 3
   - Done when: `npm run lint` passes, and the manual pause check passes against a local server
     (`npm start --prefix server`).
   - Executor: sonnet
5. **Version, changelog, README**
   - Change: minor app bump and a `CHANGELOG.md` entry (sheet, plus pausing with an updated server).
     Document the pause route in `server/README.md` under API.
   - Depends on: 2, 4
   - Done when: `npm test` and `npm run build` pass.
   - Executor: sonnet

## Acceptance criteria
- [ ] The Monstera example above gives exactly 4 Nov and 11 Nov.
- [ ] Print preview shows no tab bar or buttons, and each plant block is not split across pages
      (`break-inside: avoid`).
- [ ] Notes appear only with "Include notes" on.
- [ ] A paused phone gets no reminder on any day up to and including the pause date, and gets one
      the day after (server test).
- [ ] With an old server, pausing shows the update message and changes nothing.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual: build a sheet for a 2-week trip with 3 plants, then print preview on a phone and on desktop.

## Escalate when
- The sheet needs data not in `useGarden`.
- The server change would alter stored subscriptions beyond adding `pausedUntil`.

## Open questions
- Should "Share as link" add the trip dates to the share format (a new `SHARE_FORMAT` version)? The
  proposal is no: the sitter gets the printed sheet plus a normal link.
- Should the sheet include photos when printing (larger output)? The proposal is thumbnails only.

## Notes
- Pausing on the phone alone is not possible: a push must always show a notification
  (`src/sw.ts`), so the server must not send.
