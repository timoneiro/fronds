# Find species by any common name (iNaturalist search)

Status: ready
Issue: <issue link>
Builds after: plant-id-from-photo

## Problem
People often know their plant only by a local common name, such as "costela-de-adão" in Portuguese
for a Monstera. The bundled catalog only knows English names, and the Wikipedia search only finds
English article titles, so these people can't find their species without already knowing its
scientific name.

## Behavior
1. In the species picker, the footer link "Not listed? Search Wikipedia" becomes **"Not listed?
   Search online"**. One tap searches iNaturalist and Wikipedia at the same time. "Use “…” as typed"
   stays as it is.
2. While searching: "Searching online…". Results then show under the catalog hits in this order:
   - **iNaturalist results** (up to 5). Each shows the English common name in bold (or the scientific
     name if there is none) and the scientific name in italics. If the search matched a different
     name, it also shows "matches “Costela-de-adão”" in muted text. A result whose species is in the
     catalog shows "In catalog".
   - **Wikipedia results**, exactly as today, except a hit whose title equals an iNaturalist
     result's scientific name (case- and accent-insensitive) is hidden.
   - No thumbnails.
3. Filtering iNaturalist results:
   - Only plants, and only genus rank or below (no families or subfamilies).
   - A result that maps to a catalog species already shown in the catalog hits is hidden.
4. **Choosing an iNaturalist result.** The *searched name* is the matched name, unless it equals the
   scientific name, in which case there is none.
   - In the catalog: the same as picking that catalog species, except the plant name defaults to the
     searched name if there is one.
   - Not in the catalog: the species is set as free text to the scientific name (the plant page then
     shows its Wikipedia description). The plant name defaults to the searched name, then the English
     common name, then the scientific name.
   - As today, a name the user already typed is never replaced.
5. **Failures:**
   - Each source fails on its own: if one fails, the other's results still show, with no message.
   - If both fail: "Couldn't search online (offline?)".
   - If both succeed with nothing: "No matches online."
   - Typing in the search box clears the online results, as today.

Example: typing "costela-de-adão" finds nothing in the catalog, so the user taps "Search online".
iNaturalist lists "**Swiss Cheese Plant** *Monstera deliciosa* matches “Costela-de-adão” · In
catalog", then "**Tree Philodendron** *Thaumatophyllum bipinnatifidum* matches “Costela-de-adão” · In
catalog". Tapping the first sets the species to Monstera (interval 7 days) and the name to
"Costela-de-adão".

## Out of scope
- Live search while typing (online search runs only on the button).
- Photos or thumbnails from iNaturalist, and any CSP change.
- Saving iNaturalist ids or names on plants (no new fields, no Dexie version).
- Showing common names in languages other than English (only the matched name is shown).
- iNaturalist's photo identification (it needs an approved app).
- Growing the catalog (separate spec).

## Constraints
- No key or account: the iNaturalist read API is public and sends `Access-Control-Allow-Origin: *`
  (checked 2026-10-21). `connect-src` already allows `https:`, so the CSP is unchanged.
- One request per tap; no retries or prefetching (iNaturalist asks for ~1 request/second at most).
- No new data or Dexie version. The plant keeps `speciesId` or `speciesName` as today.
- Privacy text: the search term goes to iNaturalist, so README "Privacy & data" and Settings
  "About" must say so.

## Context for implementers
- iNaturalist (decided):
  - **Request:** `GET https://api.inaturalist.org/v1/taxa/autocomplete?q=<query>&taxon_id=47126&is_active=true&locale=en&per_page=10`.
    `47126` is Plantae.
  - **Response:** `{ results: [{ name, rank, rank_level, preferred_common_name?, matched_term }] }`.
    `name` is the scientific name, `preferred_common_name` is English with `locale=en`, and
    `matched_term` is the name the query matched, in any language.
  - **Filtering:** keep results with `rank_level <= 20` (genus is 20, species is 10).
  - **Sample for tests**, from the real response to `q=costela-de-adão`:
    `Monstera deliciosa` / "Swiss Cheese Plant" / matched "Costela-de-adão", and
    `Thaumatophyllum bipinnatifidum` / "Tree Philodendron" / matched "Costela-de-adão".
    For `q=zamioculca`, the response also contains `Zamioculcadoideae` with `rank_level: 27`, which
    must be filtered out.
- Picker: `src/ui/components/SpeciesPicker.tsx`. Its `wiki` state and `lookUpWikipedia` show the
  existing loading/error pattern. Wikipedia client: `searchWikipedia` in `src/species/wikipedia.ts`.
- From `plant-id-from-photo` (must be merged first):
  - `findByScientificName` in `src/species/catalog.ts`.
  - The optional `suggestedName` on the `{ speciesName }` variant of `SpeciesChoice`, and
    `onSpecies` in `src/ui/pages/PlantFormPage.tsx`.
- Catalog: the snake plant (`dracaena-trifasciata`) is listed by iNaturalist as `Sansevieria
  trifasciata`. `norm` in `catalog.ts` is the shared case- and accent-insensitive compare.
- Tests run in Node; stub `fetch` with `vi.stubGlobal` (as in `src/species/plantnet.test.ts`).
- Don't touch: `src/db/`, backup and sync code, `vite.config.ts`, `src/species/wikipedia.ts`.

## Tasks
1. **Catalog matching by alias**
   - Change: in `src/species/catalog.ts`, `findByScientificName` also matches an entry when the name
     is `norm`-equal to one of its `aliases`. This comes after the exact `scientificName` match and
     before the genus fallback. Add the alias `'Sansevieria trifasciata'` to `dracaena-trifasciata`.
     New cases in `catalog.test.ts`: `'Sansevieria trifasciata'` → `dracaena-trifasciata`; the
     existing cases still pass.
   - Depends on: none
   - Done when: `npx vitest run src/species/catalog.test.ts` passes.
   - Executor: haiku
2. **iNaturalist client**
   - Change: new `src/species/inaturalist.ts`, exporting:
     - `INatHit { scientificName; commonName?; searchedName?; species?: Species }`
     - `parseINatResponse(json): INatHit[]`: filters `rank_level <= 20`, sets `searchedName` to
       `matched_term` unless it is `norm`-equal to `name` (export `norm` from `catalog.ts` if needed),
       sets `species` via `findByScientificName`, and returns at most 5 hits
     - `searchINaturalist(query, signal?): Promise<INatHit[]>`: the request above; throws on a
       non-OK status, like `searchWikipedia`

     New `src/species/inaturalist.test.ts`. It covers:
     - the costela-de-adão sample: 2 hits, both with `searchedName` "Costela-de-adão" and with
       `species` ids `monstera-deliciosa` and `thaumatophyllum-bipinnatifidum`
     - the subfamily is filtered out
     - a hit whose `matched_term` equals its name has no `searchedName`
     - the request URL contains `taxon_id=47126`, `locale=en` and the encoded query
     - a 500 rejects
   - Depends on: 1
   - Done when: `npx vitest run src/species/inaturalist.test.ts` passes.
   - Executor: sonnet
3. **Picker and form**
   - Change: in `SpeciesPicker.tsx`, replace the Wikipedia-only lookup with "Search online", which
     runs `Promise.allSettled([searchINaturalist(q), searchWikipedia(q)])` and renders per Behavior
     2, 3 and 5. Add an optional `suggestedName` to the `{ speciesId, species }` variant of
     `SpeciesChoice`, and make `onSpecies` in `PlantFormPage.tsx` default the name to
     `choice.suggestedName ?? choice.species.commonName`. Build the choices per Behavior 4.
   - Depends on: 2
   - Done when: `npm run typecheck` and `npm run lint` pass, and the Behavior example passes
     manually (`npm run dev`).
   - Executor: sonnet
4. **Privacy text**
   - Change:
     - README "Privacy & data": "species look-ups to Wikipedia" becomes "species look-ups to
       Wikipedia and iNaturalist".
     - README feature list: one bullet "**Search by any common name**" (iNaturalist, any language).
     - `SettingsPage.tsx` About: "Plant descriptions and photos from Wikipedia. Name search by
       iNaturalist. No account, no tracking."
   - Depends on: 3
   - Done when: `grep -c "iNaturalist" README.md` prints 2 or more, `grep -n "Name search by
     iNaturalist" src/ui/pages/SettingsPage.tsx` matches, and `npm run lint` passes.
   - Executor: haiku
5. **Version, changelog, CLAUDE.md**
   - Change: minor bump in `package.json` and `package-lock.json`, and a `CHANGELOG.md` entry
     ("Find your plant by the name you know", in any language). In CLAUDE.md "Layout", the
     `src/species/` line becomes "bundled catalog (ASPCA pet toxicity) + Wikipedia, iNaturalist and
     Pl@ntNet clients."
   - Depends on: 4
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] `npm test` passes, including the new `inaturalist.test.ts` and `catalog.test.ts` cases.
- [ ] The Behavior example works on the dev server: Monstera chosen, name "Costela-de-adão",
      interval 7.
- [ ] Searching "jiboia" lists "Golden Pothos *Epipremnum aureum* matches “Jiboia” · In catalog" first,
      and choosing it sets the catalog Pothos with the name "Jiboia".
- [ ] Searching "espada-de-são-jorge" lists *Sansevieria trifasciata* marked "In catalog", and
      choosing it sets the snake plant.
- [ ] Searching "monstera" doesn't list iNaturalist's *Monstera deliciosa* (the catalog hit already
      shows it).
- [ ] With DevTools set to offline, "Search online" shows "Couldn't search online (offline?)".
- [ ] With the Wikipedia request blocked in DevTools (request blocking), iNaturalist results still
      show.
- [ ] The README privacy section names iNaturalist.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual checks above on `npm run dev`.

## Escalate when
- iNaturalist answers in a shape other than the one above, or blocks browser requests.
- `plant-id-from-photo` isn't merged (`findByScientificName` is missing).
- The change needs a new plant field, a Dexie version or a CSP edit.
- Any check fails after two attempts.

## Open questions
- None.

## Notes
- iNaturalist rather than a bigger multilingual catalog: it matches common names in every language
  without a key, and the app stays English-only.
- One "Search online" button for both sources: one tap. Wikipedia stays for descriptions and photos
  on the plant page.
- No thumbnails: they'd need two CSP image hosts, and many iNaturalist photos are "all rights
  reserved".
- The name defaults to what the user searched, because that's the name they know the plant by.
- Builds after `plant-id-from-photo`: it reuses `findByScientificName` and extends `SpeciesChoice` and
  `onSpecies`, which that spec changes first. `wishlist` also uses `SpeciesChoice`, but the new field
  is optional.
