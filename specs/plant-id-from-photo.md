# Identify a plant from a photo (Pl@ntNet, own key)

Status: shipped (0.7.0)
Issue: https://github.com/timoneiro/fronds/issues/49
Builds after: none

## Problem
People often don't know what their plant is called. That's especially true when they only know a
common name in another language, so the catalog and the Wikipedia search can't find it. Today
fronds has no way to go from "I have this plant in front of me" to a species.

## Behavior
1. **Settings → new "Plant identification (optional)" card.**
   - Text: "Identify plants from a photo with Pl@ntNet. Needs a free Pl@ntNet account and your own
     API key (500 identifications a day). Your key is stored on this phone only. When you tap
     Identify, the photo is sent to Pl@ntNet."
   - These steps as an ordered list: create a free account at my.plantnet.org (linked) / open the
     Pl@ntNet API key settings (linked to `https://my.plantnet.org/settings/api-key`) and tick
     **expose my API key** / paste this app's address (`location.origin`, shown with a **Copy**
     button) under **Authorized domains** / copy the key, paste it below and tap Save. Pl@ntNet
     rejects browser requests whose `Origin` isn't an authorized domain (added in 0.7.1).
   - A text input "Pl@ntNet API key" (`autocomplete="off"`, `spellcheck={false}`) and a **Save** button.
     Saving trims the value; saving an empty value removes the key. When a key is saved, the card
     shows "Key saved on this phone." and a **Remove key** button.
2. **Without a key, nothing changes anywhere.** The form shows no identify button and no hint.
3. **With a key, the plant form shows "📷 Identify from photo"** under the species picker. It shows
   only while no species is chosen (the picker shows its search box), on both the new and edit forms.
   - Tapping it opens the file chooser (`accept="image/*"`), which offers the camera or the gallery on phones.
   - If the device is offline (`navigator.onLine === false`), show "You're offline. Identification
     needs a connection." and send nothing.
   - Otherwise the button reads "Identifying…" and is disabled until the request finishes.
4. **Results:** up to 3 matches, best first. Each match is one button showing the English common name
   (or the scientific name if there is none), the scientific name in italics, and the confidence as a
   whole percent. A match whose scientific name is in the catalog also shows "In catalog".
   - If the best score is under 30%, show above the list: "Pl@ntNet isn't sure. Compare with your
     plant before choosing."
   - Below the list: "Identified by Pl@ntNet" (a link to `https://plantnet.org/`) and a **None of
     these** button that hides the results.
5. **Choosing a match:**
   - In the catalog: the same as picking that species in the picker. The species is set, the name
     defaults to the catalog common name, and the watering interval to the catalog value unless the
     user has already changed it.
   - Not in the catalog: the species is set as free text to the scientific name (so Wikipedia finds
     the description and photo), and the plant name defaults to the common name, or the scientific
     name if there is none. As today, a name the user already typed is kept.
   - If the form's Photo is empty, the identify photo becomes the plant photo, resized like
     "Add photo" does. An existing photo is never replaced.
   - The results disappear.
6. **Errors** (shown under the button; the form keeps working, and the user can still search or type):
   - HTTP 404 → "That doesn't look like a plant. Try a closer photo of the leaves or a flower."
   - 401 or 403 → "Pl@ntNet didn't accept your key. Check the key and your Pl@ntNet authorized domains (see Settings)."
   - 429 → "You've used today's free identifications. Try again tomorrow."
   - Network failure or any other status → "Couldn't reach Pl@ntNet. Try again later."

Example: key saved, new plant, photo of a Monstera. Results: "Monstera *Monstera deliciosa* 92% In
catalog", then two others. Tapping the first sets the species to Monstera, the name to "Monstera" and
the interval to 7 days, and the Photo field (empty before) now shows the photo.

## Out of scope
- A shared or bundled key, or calling Pl@ntNet through the sync server.
- Syncing the key to other phones, or putting it in backups or share links.
- Common names in languages other than English (`lang` stays `en`).
- Several photos per request, organ selection, related images, and health diagnosis.
- Identifying from the plant detail page or from an existing plant photo.
- iNaturalist search and catalog growth (separate specs).

## Constraints
- **Keys are an optional add-on** (CLAUDE.md "Minimise accounts and API keys"). Without a key the
  app behaves exactly as before.
- The key is a local setting (`getSetting`/`setSetting`, key `plantnetKey`). The `settings` table is
  not in backups (`exportBackup` reads only plants and events) and is not synced. No Dexie version.
- CSP: `connect-src` already allows any `https:` address, so no CSP change is needed. Don't load
  Pl@ntNet images (`include-related-images` stays off), so `img-src` is unchanged.
- No new dependencies.

## Context for implementers
- Pl@ntNet API (decided):
  - **Request:** `POST https://my-api.plantnet.org/v2/identify/all?api-key=<key>&lang=en&nb-results=3`
    with a multipart body. Send one field `images` holding a JPEG Blob named `photo.jpg`, and omit
    `organs` (it defaults to `auto`).
  - **Response:** `{ bestMatch, results: [{ score: 0..1, species: { scientificNameWithoutAuthor,
    commonNames: string[] } }], remainingIdentificationRequests }`.
  - **Errors:** a non-plant photo answers 404 "Species not found". A bad key answers 401
    `{"message":"Bad token"}` (checked 2026-10-21). 403 and 429 are mapped defensively; any other
    status falls back to the generic message. On the free plan a failed request still uses one of the
    day's 500, so never retry automatically.
  - **Browser access works as is:** the API sends `access-control-allow-origin` for
    `https://timoneiro.github.io` (checked with curl on 2026-10-21), so users don't configure any
    domain. Pl@ntNet's optional domain/IP restriction is only for protecting a key.
- Species picker: `src/ui/components/SpeciesPicker.tsx`. Its `SpeciesChoice` is either
  `{ speciesId, species }` or `{ speciesName }`. Form: `src/ui/pages/PlantFormPage.tsx`, where
  `onSpecies` applies a choice and `onPhoto` sets the photo via `resizeImage`.
- Catalog: `CATALOG`, `getSpecies`, and the private `norm` helper (case- and accent-insensitive) in
  `src/species/catalog.ts`. Some entries are genus-level (`scientificName: 'Spathiphyllum'`).
- Image: `resizeImage(file, maxSize, quality)` in `src/lib/image.ts` returns a data URL. Don't
  `fetch()` a data URL to get a Blob: the CSP `connect-src` blocks `data:`.
- Local settings pattern: `useLiveQuery(() => getSetting<string>('plantnetKey'))`. Add the hook in
  `src/ui/hooks.ts`. Settings cards are `<section className="card">` with an `<h3>` in
  `src/ui/pages/SettingsPage.tsx`, and notices use `notice notice-ok|error`.
- Tests run in Node (`vite.config.ts` `test.environment: 'node'`). Node has `fetch`, `Blob` and
  `FormData`, so stub `fetch` with `vi.stubGlobal`. There's no canvas, so `image.ts` isn't
  unit-tested.
- Don't touch: `src/db/db.ts` (no schema change), backup and sync code, `vite.config.ts`.

## Tasks
1. **Catalog lookup by scientific name**
   - Change: `findByScientificName(name: string): Species | undefined` in `src/species/catalog.ts`.
     It first looks for a `norm`-equal `scientificName`. If there is none, it tries the first word
     (the genus) against entries whose `scientificName` is a single word. Add cases to
     `catalog.test.ts`:
     - `'Monstera deliciosa'` → `monstera-deliciosa`
     - `'monstera DELICIOSA'` → `monstera-deliciosa`
     - `'Spathiphyllum wallisii'` → `spathiphyllum`
     - `'Quercus robur'` → `undefined`
     - `''` → `undefined`
   - Depends on: none
   - Done when: `npx vitest run src/species/catalog.test.ts` passes.
   - Executor: haiku
2. **Pl@ntNet client**
   - Change: new `src/species/plantnet.ts`, exporting:
     - `PlantNetMatch { scientificName; commonName?; score; species?: Species }`
     - `PlantNetError extends Error` with `kind: 'not-a-plant' | 'bad-key' | 'quota' | 'network'`
     - `parsePlantNetResponse(json): PlantNetMatch[]`: top 3 by score, `commonName` =
       `commonNames[0]`, `species` via `findByScientificName`
     - `identifyPlant(image: Blob, apiKey: string, signal?): Promise<PlantNetMatch[]>`: the request
       above, statuses mapped as in Behavior 6, and a thrown fetch = `network`
     
     New `src/species/plantnet.test.ts` with a stubbed `fetch`. It covers: a parsed sample with
     4 results → 3 matches in score order, with the catalog match set; the request URL contains
     `api-key=`, `lang=en` and `nb-results=3`, and the body has an `images` part; 404 → `not-a-plant`,
     401 → `bad-key`, 429 → `quota`, 500 → `network`, and a rejected fetch → `network`.
   - Depends on: 1
   - Done when: `npx vitest run src/species/plantnet.test.ts` passes.
   - Executor: sonnet
3. **JPEG Blob for upload**
   - Change: in `src/lib/image.ts`, add `resizeImageBlob(file, maxSize = 1280, quality = 0.9):
     Promise<Blob>` (canvas `toBlob`, `image/jpeg`). Share the drawing code with `resizeImage`, whose
     signature and output stay the same.
   - Depends on: none
   - Done when: `npm run typecheck` and `npm run lint` pass.
   - Executor: haiku
4. **Key setting**
   - Change: `usePlantNetKey()` in `src/ui/hooks.ts`, and the Settings card from Behavior 1 in
     `SettingsPage.tsx`, placed after the Backup card.
   - Depends on: none
   - Done when: `npm run lint` passes; manually, a saved key survives a reload, Remove clears it, and
     the key isn't in an exported backup file (search the file for the key text).
   - Executor: sonnet
5. **Identify on the plant form**
   - Change: new `src/ui/components/IdentifyFromPhoto.tsx` covering Behavior 3, 4 and 6, which calls
     `identifyPlant(await resizeImageBlob(file), key)`. Add an optional `suggestedName?: string` to
     the `{ speciesName }` variant of `SpeciesChoice`, and have `onSpecies` in `PlantFormPage.tsx` use
     `suggestedName ?? speciesName` as the default name. Render the component under the picker when
     a key is set and no species is chosen. On choose, call `onSpecies`, and if `form.photo` is
     empty, set it with `resizeImage(file)`.
   - Depends on: 2, 3, 4
   - Done when: `npm run typecheck` and `npm run lint` pass, and the Behavior example passes manually
     with a real key.
   - Executor: sonnet
6. **Version and changelog**
   - Change: minor bump in `package.json` and `package-lock.json`, and a `CHANGELOG.md` entry
     ("Identify a plant from a photo", which mentions the free Pl@ntNet key and that it is optional).
   - Depends on: 5
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] With no key saved, the plant form and Settings (apart from the new card) look and work as before.
- [ ] `findByScientificName` and `plantnet.ts` tests pass (`npm test`).
- [ ] With a valid key, the Behavior example works end to end on a phone.
- [ ] A photo of a non-plant (e.g. a mug) shows the "doesn't look like a plant" message.
- [ ] A wrong key shows "didn't accept your key".
- [ ] In airplane mode, tapping Identify shows the offline message, and no request appears in DevTools.
- [ ] Choosing a non-catalog match sets the species to its scientific name, and the plant page shows
      its Wikipedia description.
- [ ] An existing plant photo is not replaced by the identify photo.
- [ ] An exported backup doesn't contain the key text.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual checks above, using a real free Pl@ntNet key on the built app (`npm run build`, then
  `npx vite preview`).

## Escalate when
- Pl@ntNet answers in a shape other than the one described above, or a browser request is refused
  for a reason other than the key (CORS).
- The change needs a Dexie version, backup or sync change, or a CSP edit.
- Any check fails after two attempts.

## Open questions
- None.

## Notes
- Each user brings their own key rather than sharing a fronds key. That keeps fronds' "keys are
  optional add-ons" rule, avoids one shared 500-a-day quota tied to a single account, and puts no
  secret in the build.
- The key stays on each phone (not synced or backed up): it belongs to a person, and syncing it
  would put it on the server.
- English common names only. Other-language names are the job of the iNaturalist search spec.
- No overlap that needs ordering. `wishlist` also uses `SpeciesChoice`, but the new field is optional.
  `photo-timeline` uses `resizeImage`, whose signature is unchanged. Several draft specs edit
  `PlantFormPage.tsx` in different sections, so expect only textual merge conflicts.
- As shipped (0.7.0):
  - Tests also cover 403 → `bad-key` and a match with no common name. A 200 response that can't be
    parsed counts as `network`.
  - Importing a backup keeps the key, because `importReplace` doesn't clear `settings`.
  - Not done (follow-ups): the Identify button isn't dimmed while it works (there's no `.btn.disabled`
    style), and a 200 response with no results shows an empty list with no "No matches" line. The
    README privacy section isn't updated (the issue lists it, but the spec didn't).
