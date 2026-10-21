# Rename a household or a phone

Status: draft
Issue: 
Builds after: none

## Problem
A household's name and each phone's label are fixed when created. A typo, a new home, or a vague
label like "iPhone" (in a household with three iPhones) cannot be fixed without leaving and joining
again.

## Behavior
1. Settings → Sync & reminders: next to the household name, a "Rename" link opens an inline field
   (max 60). Saving renames the household for every phone.
2. Phones in this household: each phone has "Rename" (max 60). Any member can rename any phone in
   the household, the same rule as removing.
3. Other phones see the new household name the next time they open Settings: `Connected` fetches
   `/api/info` once on mount and updates the stored name if it changed. Errors are ignored silently,
   because being off Tailscale is normal.
4. Empty or whitespace-only names are refused in the form ("Enter a name").
5. Old server (404): "Update the server to rename."

Example: rename "Casa Lisboa" to "Casa Porto" on phone A. Phone B shows "Casa Porto" when its Settings
page is next opened while it can reach the server.

## Out of scope
- Renaming via the admin page (`server-admin`).
- Changing a phone's own default label logic (`defaultDeviceLabel`).

## Constraints
- Protocol stays backward compatible: new routes only, and existing responses are unchanged.
- The household name is stored locally in `SyncConfig.household`. Update it with `setSyncConfig`
  after a successful rename, keeping all other fields (re-read the config first, as
  `changeServerAddress` does).

## Context for implementers
- Server routes in `server/src/app.ts` (`/api/devices/remove` is the pattern, and `str(v, 60)` for
  trimming). `Household.name`, `Device.label` in `server/src/store.ts`.
- App: `src/sync/households.ts` (add `renameHousehold`, `renameDevice`, `refreshHouseholdName`).
  `fetchServerInfo` in `src/sync/client.ts`. `Connected` and `Devices` in
  `src/ui/components/SyncSection.tsx`.
- Tests: `server/src/app.test.ts`, `src/sync/sync.integration.test.ts`.

## Tasks
1. **Server routes**
   - Change: `POST /api/household/rename { name }` and `POST /api/devices/rename { deviceId, label }`,
     authenticated, scoped to the caller's household, 400 on empty, 404 on an unknown device. Bump the
     server `VERSION` and `server/package.json` minor.
   - Depends on: none
   - Done when: `app.test.ts` covers both renames, an empty name (400), and renaming a device from
     another household (404). `npm test` passes.
   - Executor: sonnet
2. **Client functions**
   - Change: `renameHousehold`, `renameDevice` and `refreshHouseholdName` in `households.ts`. A
     404 maps to `SyncError('Update the server to rename')`.
   - Depends on: 1
   - Done when: `sync.integration.test.ts` shows phone B picking up a new name via
     `refreshHouseholdName`. `npm test` passes.
   - Executor: sonnet
3. **UI**
   - Change: inline rename in `Connected` and in each `Devices` row. `useEffect` calls
     `refreshHouseholdName` once.
   - Depends on: 2
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor app bump and a `CHANGELOG.md` entry (needs an updated server image).
   - Depends on: 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Renaming the household on A shows the new name on B after B opens Settings (integration test).
- [ ] A phone renamed by another member shows the new label in every phone's list.
- [ ] Empty names are refused by the form and the server.
- [ ] Against an old server, the rename shows the update message and nothing changes locally.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- The rename needs a change to `DeviceCredentials` or `ServerInfo` beyond reading `household.name`.

## Open questions
- None.

## Notes
- The original idea listed "rename a household" and "rename a phone" separately. One spec, because
  they share the UI and the server pattern.
