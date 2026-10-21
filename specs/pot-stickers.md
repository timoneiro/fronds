# QR and NFC stickers on pots

Status: draft
Issue: 
Builds after: qr-invites

## Problem
Logging a watering means opening the app and finding the plant. With a sticker on the pot, a scan
could open that plant ready to mark it watered.

## Behavior
1. **Deep link.** `#/plants/<id>?water=1` opens the plant page with a banner at the top: "💧 Mark
   Monstera watered?" with "Watered" and "Not now". Tapping Watered logs it (undo toast if
   `undo-watering` shipped) and removes `?water=1` from the URL. If the plant was already watered
   today, the banner says "Already watered today ✓" instead. The link never logs anything without
   the tap.
2. **Sticker sheet.** Plants page → "Pot stickers" link opens `#/plants/stickers`. Pick plants
   (all ticked by default, grouped by room) and a size (Small 3 cm, Large 5 cm). The sheet shows a
   grid of QR codes, each with the plant name under it. "Print" uses `window.print()`, and the print
   stylesheet hides everything else.
3. **NFC.** Each plant on the stickers page has "Copy link" so it can be written to an NFC tag with
   any NFC writer app. A short help text explains this.
4. **Unknown plant.** A deep link to a plant not on this device (deleted, or another browser's
   storage) shows the existing "This plant doesn't exist (any more)" state. When `inIosBrowser()`
   is true, it adds: "On iPhone, scanned links open in Safari, not the Home Screen app."

Example: print a sheet for 6 plants and stick one on the Monstera pot. Scanning it on Android opens
the installed app on Monstera with the banner, and one tap logs the watering.

## Out of scope
- Writing NFC tags from the app (Web NFC is Android-only).
- Logging care tasks other than watering from a sticker.
- Stickers for shared or friends' plants.

## Constraints
- Links are absolute URLs to the app's own origin and path (`location.origin + location.pathname`),
  so they keep working (CLAUDE.md: never change the base path).
- Plant ids are UUIDs, so stickers reveal nothing on their own.

## Context for implementers
- `QrCode` from `qr-invites` (`src/ui/components/QrCode.tsx`).
- Plant page: `src/ui/pages/PlantDetailPage.tsx` (use `useSearchParams` for `water`). `addEvent`,
  `computeSchedule().lastWateredAt`, `startOfDay` in `src/domain/watering.ts`.
- Routes: `src/App.tsx` (add `/plants/stickers` **before** `/plants/:id`). Plants page links:
  `src/ui/pages/PlantsPage.tsx`.
- Print styles: `src/index.css`. If `sitter-sheet` shipped first, extend its `@media print` block.
- Platform: `inIosBrowser` in `src/lib/platform.ts`.

## Tasks
1. **Deep-link banner**
   - Change: the banner in `PlantDetailPage.tsx` as in Behavior 1 and 4.
   - Depends on: none
   - Done when: opening `#/plants/<id>?water=1` shows the banner, Watered logs once, and the param
     is gone. `npm run lint` passes.
   - Executor: sonnet
2. **plantLink helper**
   - Change: `plantLink(id, appUrl)` in `src/lib/links.ts`, returning
     `${appUrl}#/plants/${id}?water=1`.
   - Depends on: none
   - Done when: a test in `src/lib/links.test.ts` passes.
   - Executor: haiku
3. **Stickers page**
   - Change: `src/ui/pages/StickersPage.tsx`, the route, the link from Plants, and print CSS (`break-inside:
     avoid`, sizes in cm).
   - Depends on: 2
   - Done when: print preview shows only the grid, and each code scans to the right plant.
     `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry (mentions the iPhone limitation).
   - Depends on: 1, 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Opening the deep link never logs a watering without a tap.
- [ ] Tapping Watered once creates exactly one water event.
- [ ] Already watered today shows the ✓ text and no button.
- [ ] Printed small stickers are 3 cm wide (measure the print preview at 100%).
- [ ] An unknown id shows the not-found state, plus the iPhone line in iPhone Safari.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual on Android with the app installed: scan a printed sticker.

## Escalate when
- Routing `/plants/stickers` conflicts with `/plants/:id`.

## Open questions
- iPhone: scanning opens Safari, not the Home Screen app, so people who installed fronds see "not
  found". Is Android-plus-Safari-users enough, or should the not-found page offer to copy the link
  for pasting in the app (like share links)?
- Sticker sizes: are 3 cm and 5 cm right?

## Notes
- Builds after `qr-invites` for the shared QR component and its dependency.
