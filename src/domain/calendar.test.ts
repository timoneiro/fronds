import { describe, expect, it } from 'vitest'
import type { Plant } from '../db/types'
import { buildICS, googleCalendarLink } from './calendar'

const plant: Plant = {
  id: 'abc',
  name: 'Big Monstera, living room; the one by the window with the extra long name',
  wateringIntervalDays: 9,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}
const due = new Date(2026, 9, 3)

describe('googleCalendarLink', () => {
  it('prefills an all-day recurring event', () => {
    const url = new URL(googleCalendarLink(plant, due))
    expect(url.searchParams.get('dates')).toBe('20261003/20261004')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;INTERVAL=9')
  })
})

describe('buildICS', () => {
  const ics = buildICS([{ plant, firstDue: due }], new Date('2026-09-29T10:00:00Z'))

  it('uses CRLF, escapes text and folds long lines', () => {
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261003')
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=9')
    expect(ics).toContain('Monstera\\, living room\\; the')
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(lines.some((l) => l.startsWith(' '))).toBe(true)
  })
})
