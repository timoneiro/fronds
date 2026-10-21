# Watering stats

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/44
Builds after: none

## Problem
The watering history is there, but people cannot see how they are doing: are they keeping up, which
plant always gets forgotten, how much watering happens each month.

## Behavior
A "Stats" page (`#/stats`, linked from the Plants header) with four cards:
1. **Streak.** "🔥 12 days with nothing overdue". These are consecutive days up to today on which no
   live plant was overdue at the end of the day, capped at 365 ("365+ days"). Today counts if nothing
   is overdue right now.
2. **On time.** "84% on time in the last 90 days". This is the share of waterings in the last 90 days
   done on or before the due date that applied just before them. The card also shows "Average 1.2 days
   late when late".
3. **Needs more love.** The plant with the highest average lateness over the last 90 days, with at
   least 2 waterings: "Calathea · usually 2.5 days late". It is hidden when no plant is late on
   average.
4. **Per month.** A simple bar list of waterings per calendar month for the last 12 months, with
   numbers on the bars.

Empty state: under 5 waterings logged in total, show "Log a few waterings to see stats."

Example: Monstera every 7 days, watered 1, 8 and 17 Oct. The 17 Oct watering was 2 days late (due
15 Oct), so it is on time 1 out of 2 measured waterings. The first watering has no prior due date
and is not measured.

## Out of scope
- Charts libraries (plain HTML and CSS bars).
- Care tasks other than watering.
- Comparing household members.

## Constraints
- Read-only and derived. No records, no settings.
- The interval used is the plant's current one (interval history is not stored). The page notes this
  in small print: "Based on each plant's current interval."

## Context for implementers
- `computeSchedule`, `startOfDay`, `addDays`, `daysBetween` in `src/domain/watering.ts`. To get the
  due date that applied before a watering, call `computeSchedule(plant, eventsBefore(w), w.at)` with
  events strictly before that watering.
- Data: `useGarden` in `src/ui/hooks.ts` (live plants and events).
- Routes: `src/App.tsx`. Link: `src/ui/pages/PlantsPage.tsx`. Styles: `src/index.css`.
- Performance: 50 plants × 365 days is fine. Pre-filter events per plant once.

## Tasks
1. **stats domain**
   - Change: `src/domain/stats.ts` with `streak(plants, events, now)`, `onTime(plants, events, now,
     days = 90)` returning `{ measured, onTime, avgLateWhenLate }`, `mostLate(...)`, and
     `perMonth(events, now, months = 12)`.
   - Depends on: none
   - Done when: `src/domain/stats.test.ts` covers the Monstera example, a snooze making a watering on
     time, a deleted plant ignored, a streak broken yesterday, the 365 cap, and the month boundary
     in local time. `npm test` passes.
   - Executor: sonnet
2. **Stats page**
   - Change: `src/ui/pages/StatsPage.tsx`, the route and the link.
   - Depends on: 1
   - Done when: `npm run lint` passes. Manual check with sample data.
   - Executor: sonnet
3. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry.
   - Depends on: 2
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] The Monstera example gives 50% on time and an average of 2 days late (test).
- [ ] A watering after a snooze that moved the due date counts as on time if done by the snoozed
      date (test).
- [ ] The empty state shows with under 5 waterings.
- [ ] The page renders in under 200 ms with 50 plants and 3 years of history (manual, dev tools).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- An exact definition above is ambiguous for a real data case.

## Open questions
- Are these four stats the right ones? Other candidates: total waterings ever, the plant you have
  had longest, busiest weekday.
- Should lost plants (`plant-graveyard`) count in past stats? The proposal is yes for history, but
  not for the streak after their loss date.

## Notes
- Uses the same schedule code as everything else, so snoozes are respected.
