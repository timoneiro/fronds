import { describe, expect, it } from 'vitest'
import type { CareEvent, Plant } from '../db/types'
import { computeSchedule, daysBetween, suggestInterval } from './watering'

const T = '2026-01-01T00:00:00.000Z'
const plant = (interval = 7): Plant => ({ id: 'p1', name: 'Monty', wateringIntervalDays: interval, createdAt: T, updatedAt: T })
let n = 0
const ev = (type: CareEvent['type'], at: Date, extra: Partial<CareEvent> = {}): CareEvent => ({
  id: `e${n++}`,
  plantId: 'p1',
  type,
  at: at.toISOString(),
  createdAt: T,
  updatedAt: T,
  ...extra,
})
const day = (d: number, h = 12) => new Date(2026, 2, d, h) // March 2026, local time

describe('computeSchedule', () => {
  it('is due immediately when never watered', () => {
    const s = computeSchedule(plant(), [], day(10))
    expect(s.status).toBe('never')
    expect(s.daysUntilDue).toBe(0)
  })

  it('counts calendar days from the last watering', () => {
    const events = [ev('water', day(1, 8)), ev('water', day(5, 22))]
    expect(computeSchedule(plant(7), events, day(10)).daysUntilDue).toBe(2)
    expect(computeSchedule(plant(7), events, day(10)).status).toBe('soon')
    expect(computeSchedule(plant(7), events, day(12, 1)).status).toBe('today')
    expect(computeSchedule(plant(7), events, day(14)).daysUntilDue).toBe(-2)
    expect(computeSchedule(plant(7), events, day(14)).status).toBe('overdue')
  })

  it('pushes the due date with a snooze made after the last watering', () => {
    const events = [ev('water', day(1)), ev('snooze', day(8), { days: 2 })]
    const s = computeSchedule(plant(7), events, day(8))
    expect(s.daysUntilDue).toBe(2)
  })

  it('ignores snoozes from before the last watering and deleted events', () => {
    const events = [
      ev('snooze', day(1), { days: 30 }),
      ev('water', day(2)),
      ev('water', day(9), { deletedAt: T }),
    ]
    expect(computeSchedule(plant(7), events, day(9)).daysUntilDue).toBe(0)
  })

  it('ignores other plants', () => {
    const events = [ev('water', day(9), { plantId: 'other' })]
    expect(computeSchedule(plant(), events, day(9)).status).toBe('never')
  })
})

describe('daysBetween', () => {
  it('is DST-safe', () => {
    // Europe/US DST changes happen in late March; whole days must still be whole.
    expect(daysBetween(new Date(2026, 2, 20, 23), new Date(2026, 3, 3, 1))).toBe(14)
  })
})

describe('suggestInterval', () => {
  it('needs enough history', () => {
    expect(suggestInterval(plant(7), [ev('water', day(1)), ev('water', day(5))])).toBeUndefined()
  })

  it('suggests the median real gap when it differs from the setting', () => {
    const events = [1, 5, 9, 14, 18].map((d) => ev('water', day(d)))
    expect(suggestInterval(plant(10), events)).toBe(4)
  })

  it('stays quiet when the setting is already close', () => {
    const events = [1, 8, 15, 22].map((d) => ev('water', day(d)))
    expect(suggestInterval(plant(8), events)).toBeUndefined()
  })
})
