# Undo after "Watered"

Status: draft
Issue: 
Builds after: none

## Problem
A mistaken tap on 💧 (wrong plant, or "Water all" by accident) can only be undone by opening each
plant and removing the entry from its history.

## Behavior
1. After 💧 / "Watered", "Water all" or a snooze (+1d/+2d/+3d), a toast appears at the bottom above
   the tab bar for 6 seconds: "💧 Watered Monstera · Undo". For several plants: "💧 Watered 4 plants ·
   Undo". For a snooze: "⏰ Snoozed Monstera 2 days · Undo".
2. Undo tombstones exactly the events that action created and hides the toast. The plant returns to
   where it was in the list.
3. A new action replaces the toast, and only the newest action can be undone.
4. The toast does not cover the tab bar, and screen readers announce it (`role="status"`).
5. Leaving the page keeps the toast until it times out (it lives in the app shell).

Example: Today shows 3 plants due. Tap "Water all". The toast says "Watered 3 plants · Undo". Tap
Undo, and all 3 are back under "Needs water".

## Out of scope
- Undo for edits, deletes or imports.
- Undo on the plant page's history ✕.

## Constraints
- Undo is a normal delete: `deleteEvent` (tombstone plus outbox). No hard deletes.
- `prefers-reduced-motion`: no slide animation.

## Context for implementers
- `addEvent` and `waterPlants` in `src/db/actions.ts`. `addEvent` returns the id, but `waterPlants`
  currently returns nothing.
- Callers: `src/ui/components/WaterActions.tsx`, and "Water all" in `src/ui/pages/TodayPage.tsx`.
- Shell: `src/App.tsx` (`Shell`). Styles and tokens in `src/index.css` (`.notice`, `.tabbar`).
- Do not touch: sync, the schedule.

## Tasks
1. **Return ids**
   - Change: `waterPlants` returns `Promise<string[]>`, the ids of the events it created.
   - Depends on: none
   - Done when: `npm run typecheck` passes.
   - Executor: haiku
2. **Toast**
   - Change: `src/ui/components/Toast.tsx` with a small context: `useToast().show({ text, onUndo })`,
     rendered once in `Shell`, auto-hiding after 6 s. Styles in `src/index.css` for light and dark.
   - Depends on: none
   - Done when: `npm run lint` and `npm run build` pass.
   - Executor: sonnet
3. **Wire it up**
   - Change: `WaterActions` and Today's "Water all" call `show` with the plant name(s) and an undo
     that calls `deleteEvent` for each id. `WaterActions` gets a `plantName` prop, and callers pass it.
   - Depends on: 1, 2
   - Done when: the manual checks below pass, and `npm run lint` passes.
   - Executor: sonnet
4. **Version and changelog**
   - Change: patch bump and a `CHANGELOG.md` entry.
   - Depends on: 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Watering one plant then tapping Undo leaves no live water event for it (its history is
      unchanged from before).
- [ ] "Water all" on 3 plants then Undo restores all 3 to "Needs water".
- [ ] Snooze then Undo restores the previous due text.
- [ ] The toast disappears after about 6 s and does not block the tab bar on a 360 px screen.
- [ ] Undo after sync works: the tombstone syncs like any history removal.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual: the three flows above, in light and dark mode.

## Escalate when
- Undo would need anything other than `deleteEvent`.

## Open questions
- None.

## Notes
- The toast component is generic, so later specs (care tasks, check-soil mode) can reuse it.
