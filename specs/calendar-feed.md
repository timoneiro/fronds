# Subscribable calendar feed

Status: draft
Issue: 
Builds after: none

## Problem
The .ics export and the Google Calendar link create recurring events that do not move when a plant
is watered late. A household with a server could have a calendar that always shows the real next
watering.

## Behavior
1. Settings → Sync & reminders → "Calendar feed" → "Get feed link". The server creates a secret feed
   URL for the household, `https://<server>/calendar/<token>.ics`, and the app shows it with "Copy"
   and "Add to Apple Calendar" (`webcal://` link).
2. The feed has one all-day event per live plant on its next due date ("💧 Water Monstera"), or today
   if overdue or never watered, with a 9:00 alert. Event UIDs are stable per plant
   (`next-water-<plantId>@fronds`), so the event moves when the plant is watered.
3. Calendar apps refresh on their own schedule: Apple every 5 min to 1 week (user setting), Google
   about every 12–24 h. The feed suggests 6 hours (`REFRESH-INTERVAL`, `X-PUBLISHED-TTL`).
4. Only one feed per household. "Get feed link" again asks "Replace the current link? Calendars
   using the old link stop updating." and then issues a new token. "Turn off feed" disables it.
5. **Reachability.** Apple Calendar on a phone with Tailscale fetches the feed directly. Google
   Calendar fetches from Google's servers, so it only works if the server is reachable from the
   internet (Tailscale Funnel). The app says this in one line under the link.
6. Old server: "Update the server to use a calendar feed."

## Out of scope
- Care tasks in the feed.
- Per-phone or per-room feeds.
- Changing the existing .ics export or Google link.

## Constraints
- The feed URL is a read-only capability exposing plant names and due dates. The token is 32+
  random bytes, the store keeps only its hash, and the URL is shown once (getting it again replaces
  it).
- The `GET /calendar/...` route is public and unauthenticated by design. Wrong tokens return 404 and are
  never logged. They do **not** count towards the code brake (`guardCodes`): calendar apps keep
  polling replaced links, which would lock people out of joining. A 32-byte token cannot be guessed.
- Store change: an optional `calendarTokenHash?: string` on `Household`. No store version bump, and
  `migrate()` needs nothing.

## Context for implementers
- `buildICS`, `fold`, `escapeText` in `src/domain/calendar.ts`, which the server can import (domain
  rules: `.ts` extensions, no deps).
- `computeSchedule` in `src/domain/watering.ts`. `plantsNeedingWater` in `server/src/reminders.ts`
  shows how the server reads household records.
- Routes and the non-JSON `GET /` handling in `server/src/app.ts`. `newToken`, `hashSecret` in
  `server/src/secrets.ts`.
- App: `api` in `src/sync/client.ts`, `Connected` in `src/ui/components/SyncSection.tsx`.

## Tasks
1. **buildFeedICS**
   - Change: `buildFeedICS(items: { plant; dueDate }[], now)` in `src/domain/calendar.ts`, with
     non-recurring all-day events, stable UIDs, a VALARM at 9:00, `REFRESH-INTERVAL;VALUE=DURATION:PT6H`
     and `X-PUBLISHED-TTL:PT6H`.
   - Depends on: none
   - Done when: `calendar.test.ts` covers UID stability, an overdue plant set to today, no RRULE,
     and line folding. `npm test` passes.
   - Executor: haiku
2. **Server routes**
   - Change: `POST /api/calendar` (auth: create or replace, returns `{ url }`), `POST /api/calendar/off`,
     and public `GET /calendar/<token>.ics` (`Content-Type: text/calendar; charset=utf-8`, live plants
     only, overdue → today in the server's timezone). `ServerHello.calendarFeed?: true`. Bump the server
     `VERSION` and `server/package.json` minor.
   - Depends on: 1
   - Done when: `app.test.ts` covers create, fetch (contains the plant), replace (old 404), off (404),
     wrong token (404, and joining still works after 30 wrong feed fetches), and another household's plants absent. `npm test`
     passes.
   - Executor: sonnet
3. **App UI**
   - Change: a "Calendar feed" subsection in `SyncSection.tsx` with get/replace/off, Copy, the
     `webcal://` link and the reachability note.
   - Depends on: 2
   - Done when: `npm run lint` passes. Manual: subscribe from Apple Calendar on a tailnet phone.
   - Executor: sonnet
4. **Docs, version, changelog**
   - Change: `server/README.md` (feed route, Funnel note), a minor app bump and a `CHANGELOG.md` entry.
   - Depends on: 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: sonnet

## Acceptance criteria
- [ ] Watering a plant moves its feed event on the next fetch (test: fetch, add a water event via
      sync, fetch again, and the date changes).
- [ ] Only the hash of the token is in `store.json` (test).
- [ ] An old link stops working after replace or off.
- [ ] The feed validates (manual: Apple Calendar subscribes without errors).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Serving the feed needs a CORS or auth change to existing routes.

## Open questions
- Should the feed also list the following 2–3 projected waterings (so a week view is useful), or
  only the next one? The proposal is only the next one, because it is always correct.

## Notes
- The phone's .ics export stays for people without a server.
