import type { CareEvent, Plant } from '../db/types'

const DAY_MS = 86_400_000

export type WaterStatus = 'never' | 'overdue' | 'today' | 'soon' | 'ok'

export interface Schedule {
  lastWateredAt?: Date
  /** Local midnight of the day the plant next needs water. */
  dueDate: Date
  /** Negative = overdue by that many days. */
  daysUntilDue: number
  status: WaterStatus
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** Whole calendar days from `a` to `b` (DST-safe). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

const liveOfPlant = (events: CareEvent[], plantId: string) =>
  events.filter((e) => e.plantId === plantId && !e.deletedAt)

export function computeSchedule(plant: Plant, events: CareEvent[], now = new Date()): Schedule {
  const mine = liveOfPlant(events, plant.id)
  const waters = mine.filter((e) => e.type === 'water').map((e) => new Date(e.at))
  const lastWateredAt = waters.length ? new Date(Math.max(...waters.map((d) => d.getTime()))) : undefined
  const today = startOfDay(now)

  if (!lastWateredAt) {
    return { dueDate: today, daysUntilDue: 0, status: 'never' }
  }

  let dueDate = addDays(lastWateredAt, plant.wateringIntervalDays)
  for (const s of mine) {
    if (s.type !== 'snooze' || new Date(s.at) < lastWateredAt) continue
    const snoozedTo = addDays(new Date(s.at), s.days ?? 1)
    if (snoozedTo > dueDate) dueDate = snoozedTo
  }

  const daysUntilDue = daysBetween(today, dueDate)
  const status: WaterStatus =
    daysUntilDue < 0 ? 'overdue' : daysUntilDue === 0 ? 'today' : daysUntilDue <= 2 ? 'soon' : 'ok'
  return { lastWateredAt, dueDate, daysUntilDue, status }
}

export const needsWater = (s: Schedule) => s.status === 'overdue' || s.status === 'today' || s.status === 'never'

/**
 * Suggest a new interval from how often the plant is actually watered:
 * the median gap of the last few waterings. Returns undefined when there is
 * too little history or the current interval is already close.
 */
export function suggestInterval(plant: Plant, events: CareEvent[], sample = 6): number | undefined {
  const days = liveOfPlant(events, plant.id)
    .filter((e) => e.type === 'water')
    .map((e) => startOfDay(new Date(e.at)).getTime())
    .sort((a, b) => a - b)
  const unique = [...new Set(days)].slice(-(sample + 1))
  if (unique.length < 4) return undefined
  const gaps = unique.slice(1).map((t, i) => Math.round((t - unique[i]) / DAY_MS))
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2)
  return Math.abs(median - plant.wateringIntervalDays) >= 2 ? Math.max(1, median) : undefined
}

export function describeDue(s: Schedule): string {
  switch (s.status) {
    case 'never':
      return 'No watering logged yet'
    case 'overdue':
      return s.daysUntilDue === -1 ? 'Overdue by 1 day' : `Overdue by ${-s.daysUntilDue} days`
    case 'today':
      return 'Water today'
    default:
      return s.daysUntilDue === 1 ? 'Water tomorrow' : `Water in ${s.daysUntilDue} days`
  }
}
