# Highlight plants that are toxic to pets

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/33
Builds after: none

## Problem
The catalog knows each species' pet toxicity (ASPCA), but it only shows on a plant's Care card. A
person with a cat cannot see at a glance which of their plants, or which species they are about to
add, are a risk.

## Behavior
1. Settings → new "Pets" card: a toggle "I have cats or dogs". It is off by default, stored on this
   phone only, and the card says so.
2. When it is on:
   - Plant rows (Today, Plants) show a small "⚠️ Toxic to pets" badge for `toxic` and a red "⚠️
     Highly toxic to pets" badge for `highly-toxic`. Non-toxic and unknown species show nothing.
   - The species picker on the plant form shows "⚠️" after toxic species and "🐾" after pet-safe
     ones.
   - Choosing a toxic species on the form shows a warning under the picker using `TOXICITY_LABEL`.
   - The Plants page header shows "3 toxic to pets" when there are any, as a tap-to-filter chip.
     Tapping again clears the filter.
3. When it is off, nothing changes from today.
4. Plants with a free-text species (not in the catalog) never get a badge. When the toggle is on,
   their plant page says "Pet safety unknown for this species."

Example: toggle on, with Monstera (toxic), Spider plant (non-toxic) and "Olive tree" (free text, not in the catalog).
Monstera gets the badge, the Spider plant nothing, and the Olive tree's page says safety is unknown.

## Out of scope
- Separate cat and dog settings (the catalog does not distinguish them).
- Syncing the setting to other phones.
- Toxicity in shared views and share links.

## Constraints
- Local setting via `getSetting`/`setSetting` (`src/db/db.ts`). Not synced, not in backups.
- No new data, no Dexie version.

## Context for implementers
- `TOXICITY_LABEL`, `PetToxicity`, `getSpecies` in `src/species/catalog.ts`. Badge styles
  `badge-toxic`, `badge-highly-toxic`, `badge-safe` already exist (see `CareCard` in
  `src/ui/components/SpeciesCards.tsx` and `src/index.css`).
- Rows: `PlantRow` in `src/ui/components/bits.tsx`. Picker: `src/ui/components/SpeciesPicker.tsx`.
  Form: `src/ui/pages/PlantFormPage.tsx`. Plants page: `src/ui/pages/PlantsPage.tsx`. Settings:
  `src/ui/pages/SettingsPage.tsx`.
- Pattern for a live local setting: `useLiveQuery(() => getSetting<boolean>('hasPets'))`. Add a
  `useHasPets()` hook in `src/ui/hooks.ts`.

## Tasks
1. **Setting and hook**
   - Change: `useHasPets()` in `src/ui/hooks.ts` (key `hasPets`), and the "Pets" card with the toggle
     in `SettingsPage.tsx`.
   - Depends on: none
   - Done when: `npm run lint` passes, and the toggle survives a reload.
   - Executor: sonnet
2. **Badges, picker, form warning, filter**
   - Change: as in Behavior 2 and 4. Add a `PetBadge` component in `bits.tsx`.
   - Depends on: 1
   - Done when: the example above passes manually, and `npm run lint` passes.
   - Executor: sonnet
3. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry.
   - Depends on: 2
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] With the toggle off, Today, Plants, the form and the picker render as before.
- [ ] With it on, the example above shows exactly the described badges and notes.
- [ ] The filter chip shows only toxic and highly toxic plants, and its count matches.
- [ ] The setting is not in an exported backup (`grep hasPets` on the exported file finds nothing).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- The badge needs data not in the catalog.

## Open questions
- None.

## Notes
- Per-phone on purpose: a pet-free household member is not forced to see warnings.
