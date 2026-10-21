# Rooms with light and humidity

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/39
Builds after: synced-tables

## Problem
Rooms are free text on each plant. fronds cannot tell that a sun-loving plant sits in a dark
hallway, even though the catalog knows each species' light and humidity needs.

## Behavior
1. Plants → "Rooms" opens `#/rooms`. It lists every room in use (from plants' `room`) plus any saved
   room records, each with its light (Low, Medium, Bright indirect, Bright with some sun, or Not set)
   and humidity (Low, Medium, High, or Not set).
2. Tapping a room edits its light, humidity and name. Renaming updates `room` on every plant in it
   (confirm: "Rename for 6 plants?").
3. **Mismatch hints.** When a plant's room has light set and the plant has a catalog species:
   - room light rank < species light rank: "⚠️ Needs more light than the Hallway gets".
   - species `low` in a `bright-direct` room: "⚠️ May get too much direct sun".
   - room humidity `low` with species humidity `high`: "💧 Likes more humidity than this room has".
   Ranks: low 0, medium 1, bright-indirect 2, bright-direct 3. Humidity: low 0, medium 1, high 2.
4. Hints show on the plant page (in the Care card) and as one "⚠️" mark on plant rows. Rooms with
   any mismatch show a count on the Rooms page.
5. Room records sync and are backed up via `synced-tables`.

Example: Hallway set to Low light. The Fiddle-leaf fig (bright-direct) there shows "Needs more light
than the Hallway gets", and the Snake plant (low) shows nothing.

## Out of scope
- Moving the plant's room into a reference id. Plants keep `room` as text and match by trimmed,
  case-insensitive name.
- Suggestions of which room to move a plant to (open question).
- Temperature, drafts, window direction.

## Constraints
- New synced table: follow `specs/new-table-checklist.md`.
- Renaming writes every affected plant through `updatePlant` (outbox), in one transaction.
- A room record whose name no plant uses is kept and listed, so it can be set up before plants
  move in.

## Context for implementers
- Checklist: `specs/new-table-checklist.md`.
- `Light`, `Level`, `LIGHT_LABEL`, `getSpecies` in `src/species/catalog.ts`.
- Room grouping: `PlantsPage.tsx` (`NO_ROOM`, room map), `roomOf` in `src/domain/share.ts`.
- Plant page Care card: `src/ui/components/SpeciesCards.tsx` (`CareCard`). Rows: `PlantRow` in
  `src/ui/components/bits.tsx`.
- Writes: add `saveRoom`, `renameRoom` in `src/db/actions.ts`.

## Tasks
1. **Table**
   - Change: `Room extends SyncMeta { name; light?: Light; humidity?: Level }`, following checklist
     steps 1–6 (label "rooms", max 200, name ≤ 60).
   - Depends on: none
   - Done when: the checklist tests pass. `npm test` passes.
   - Executor: sonnet
2. **roomHints**
   - Change: `roomHints(species, room): Hint[]` and `sameRoom(a, b)` in `src/domain/rooms.ts`, with
     the rules in Behavior 3.
   - Depends on: none
   - Done when: `src/domain/rooms.test.ts` covers each rule, no hints when the room has no light
     set, and name matching ignoring case and spaces. `npm test` passes.
   - Executor: haiku
3. **Actions**
   - Change: `saveRoom(input)` (create or update by matching name) and `renameRoom(oldName, newName)`
     in `src/db/actions.ts`.
   - Depends on: 1
   - Done when: a test shows a rename updating 3 plants and the room, all in the outbox. `npm test`
     passes.
   - Executor: sonnet
4. **Rooms page and hints in UI**
   - Change: `src/ui/pages/RoomsPage.tsx` at `/rooms`, the link on Plants, hints in `CareCard` and the
     row mark.
   - Depends on: 2, 3
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
5. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry (server update note).
   - Depends on: 4
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] The Hallway example gives exactly the described hints.
- [ ] Renaming "Living room" to "Lounge" moves all its plants and keeps their schedules.
- [ ] A room with no light or humidity set gives no hints.
- [ ] Rooms sync between two phones (integration test) and survive export and import.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Matching rooms by name turns out ambiguous (two records that are the same apart from case).
- `synced-tables` has not shipped.

## Open questions
- Should the Rooms page suggest a better room for a mismatched plant ("Move to Living room: bright
  indirect")? The proposal is a follow-up.
- Should a mismatch also nudge the watering interval (an idea in `BACKLOG.md`, "Pot & placement
  factors")? The proposal is no.

## Notes
- Keeping `room` as text avoids touching every plant record and the share-link format.
