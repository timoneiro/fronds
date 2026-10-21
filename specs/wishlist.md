# Wishlist of plants to get

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/47
Builds after: synced-tables

## Problem
People keep a list of plants they want (seen in a shop, a cutting a friend offered) in notes apps.
fronds already knows the species and its care, but has nowhere to keep wishes.

## Behavior
1. Plants page: a "Wishlist (4)" link next to "Graveyard". The wishlist page lists wishes with species,
   care summary (light, water every N days, pet toxicity from the catalog) and the note.
2. "+ Add wish": a species (same picker as the plant form) or just a name, plus an optional note
   ("Ask Ana for a cutting", "Garden centre, ~€15").
3. On a wish: "Got it!" opens the new-plant form prefilled with the species, name and note. Saving
   creates the plant and removes the wish. Cancelling keeps the wish.
4. ✕ removes a wish after confirmation (tombstone).
5. Wishes sync to the household like plants (via `synced-tables`), and are included in backups.
6. Share link: out of scope.

Example: add a wish "String of pearls" with note "Leroy Merlin". Later tap "Got it!", which opens the
form with species String of pearls and notes "Leroy Merlin". Save, and it is in Plants and gone from
the wishlist.

## Out of scope
- Prices, shop lists, reminders to buy.
- Sharing the wishlist.

## Constraints
- New synced table: follow `specs/new-table-checklist.md` fully.
- Older servers: the notice from `synced-tables` names "wishlist" (table label).

## Context for implementers
- Checklist: `specs/new-table-checklist.md`.
- Species picker: `src/ui/components/SpeciesPicker.tsx` (`SpeciesChoice`). Care facts: `getSpecies`,
  `LIGHT_LABEL`, `TOXICITY_LABEL` in `src/species/catalog.ts`.
- New-plant form: `src/ui/pages/PlantFormPage.tsx`. Prefill via router state
  (`navigate('/plants/new', { state: { fromWish: id } })`), and the form reads `useLocation().state`.
- Writes: add `createWish`, `deleteWish` in `src/db/actions.ts`. Creating the plant and tombstoning
  the wish happen in one transaction (`createPlant` plus the tombstone).

## Tasks
1. **Table**
   - Change: `Wish extends SyncMeta { name; speciesId?; speciesName?; note? }`, following checklist
     steps 1–6 (registry label "wishlist", max 500, name ≤ 200, note ≤ 500).
   - Depends on: none
   - Done when: `migrations.test.ts` and the checklist tests pass. `npm test` passes.
   - Executor: sonnet
2. **Actions**
   - Change: `createWish`, `deleteWish`, and `createPlantFromWish(input, wishId, lastWateredAt?)` in
     `src/db/actions.ts`.
   - Depends on: 1
   - Done when: a test with `fake-indexeddb` shows the plant created, the wish tombstoned, and both in
     the outbox. `npm test` passes.
   - Executor: sonnet
3. **Pages**
   - Change: `src/ui/pages/WishlistPage.tsx` at `/plants/wishlist`, the add form, "Got it!" prefill in
     `PlantFormPage.tsx`, and the link on Plants.
   - Depends on: 2
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry (says the server image needs updating to sync wishes).
   - Depends on: 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] The example above works.
- [ ] A wish added on phone A appears on phone B after sync (integration test).
- [ ] Cancelling "Got it!" leaves the wish in place.
- [ ] A backup with wishes imports on a fresh install, and a 0.6.0 backup still imports.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- Anything from the checklist cannot be done as written.
- `synced-tables` has not shipped.

## Open questions
- Should wishes sync, or stay on the phone? The proposal is sync, because households shop together.

## Notes
- Paired with `plant-graveyard` in the original idea. Split because that one needs no table.
