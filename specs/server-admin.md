# Server admin page

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/41
Builds after: none

## Problem
A server owner cannot see or manage the households on their server without editing `store.json` by
hand: listing households, removing a phone that was lost, deleting a household, or changing a
leaked server code.

## Behavior
1. Settings → Sync & reminders → "Manage a server" (shown whether or not this phone is in a
   household) opens `#/server-admin`. Enter the server address (prefilled from the current
   connection) and the server code. The code is kept in memory only and forgotten when leaving the
   page.
2. The overview lists households: name, created date, number of live plants, phones (label, added,
   last active) and open invites. It never shows plant names or any other plant data.
3. Actions, each with a confirmation:
   - **Remove a phone** from any household: "Remove 'Ana's iPhone' from Casa? It stops syncing."
   - **Delete a household**: type the household's name to confirm. The server first copies
     `store.json` to `backups/store-before-delete-<household-id>-<date>.json`, then removes it.
     Phones in it get "This phone is no longer part of the household" (existing 401 handling) and
     keep their plants locally.
   - **Change the server code**: shows the new code once. Existing households and phones are
     unaffected. If the code comes from the `FRONDS_SERVER_CODE` env var, the button is replaced
     by "Set by FRONDS_SERVER_CODE: change it there".
4. Wrong code: "Wrong server code". This counts towards the existing brute-force brake (429 after
   20 failures in 10 minutes).
5. Old server: "This server is too old for admin. Update its image."

## Out of scope
- Seeing or editing plant data.
- Creating households from the admin page (the normal Create flow does that).
- A web page served by the server itself.

## Constraints
- CLAUDE.md: never regenerate existing secrets. Changing the server code rewrites only `serverCode`
  in `secrets.json`, and VAPID keys stay byte-identical.
- Deleting a household removes data, so the backup copy comes first, and the delete only happens if
  that copy succeeded.
- The code travels in POST bodies (CORS already allows `Content-Type`), never in URLs or logs.

## Context for implementers
- Routes, `guardCodes`, `codeFailed`, `codesMatch`, `HttpError`, `str` in `server/src/app.ts`.
  `Store`, `rotateBackups` pattern in `server/src/store.ts`. `loadSecrets`, `Config.serverCode` in
  `server/src/config.ts`. `newCode` in `server/src/secrets.ts`.
- Protocol types: `src/domain/syncProtocol.ts`. Add admin request and response types and
  `ServerHello.admin?: true`.
- Tests: `server/src/app.test.ts` (`startServer` helper).
- App: `api` and `normaliseServerUrl` in `src/sync/client.ts`. Settings UI in
  `src/ui/components/SyncSection.tsx`. Routes in `src/App.tsx`.

## Tasks
1. **Server: admin routes**
   - Change: `POST /api/admin/overview`, `/api/admin/devices/remove`, `/api/admin/households/delete`
     and `/api/admin/server-code`, each taking `serverCode` in the body and guarded like
     `/api/households`. `ServerHello` gets `admin: true`. Add a `Store.backupCopy(name)` helper. Bump
     the server `VERSION` and `server/package.json` minor.
   - Depends on: none
   - Done when: `app.test.ts` covers a wrong code (403, counts as a failure), the overview with no
     plant names in the JSON, remove phone (that token gets 401), delete household (backup file
     exists, the other household is untouched), and code change (old code refused, new accepted,
     `secrets.json` VAPID keys unchanged, env-set code refused with 409). `npm test` passes.
   - Executor: sonnet
2. **App: admin page**
   - Change: `src/sync/admin.ts` (API calls) and `src/ui/pages/ServerAdminPage.tsx` at
     `/server-admin`, plus the link in `SyncSection`.
   - Depends on: 1
   - Done when: the manual run against `npm start --prefix server` covers every action.
     `npm run lint` passes.
   - Executor: sonnet
3. **Docs, version, changelog**
   - Change: `server/README.md` (admin API and what deleting does), the README "Hosting other
     households" section, a minor app bump and a `CHANGELOG.md` entry.
   - Depends on: 2
   - Done when: `npm test` and `npm run build` pass.
   - Executor: sonnet

## Acceptance criteria
- [ ] The overview response contains no plant names (test greps the JSON for a seeded plant name).
- [ ] Deleting a household leaves a backup file containing it, and the other households work.
- [ ] After a code change, creating a household with the old code fails, and existing phones keep
      syncing.
- [ ] VAPID keys are identical before and after (test compares `secrets.json`).
- [ ] 21 wrong codes in a row give 429.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Anything would rewrite VAPID keys or delete without the backup copy.
- The admin needs a household token.

## Open questions
- Should admin be reachable without Tailscale (via Funnel)? Same as other routes: whatever the
  owner exposes. The proposal is to document it, with no extra gate.
- Should deleted-household backups be cleaned up after N days? The proposal is to keep them (the
  owner deletes them by hand).

## Notes
- A page inside the app, not one served by the server, keeps the server a JSON API only.
