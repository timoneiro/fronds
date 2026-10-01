import { describe, expect, it } from 'vitest'
import type { Plant } from '../db/types'
import { buildShare, decodeShare, encodeShare, projectDue, ShareError, type SharedCollection } from './share'

const NOW = new Date(2026, 9, 1, 15, 30) // Thu 1 Oct 2026, local

function plant(name: string, extra: Partial<Plant> = {}): Plant {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name,
    wateringIntervalDays: 7,
    ...extra,
  }
}

const items = [
  { plant: plant('Monty', { speciesId: 'monstera-deliciosa', room: 'Living room', notes: 'Moss pole', photo: 'data:image/jpeg;base64,xx' }), lastWateredAt: new Date(2026, 8, 27, 9) },
  { plant: plant('Basil', { speciesName: 'Sweet basil', room: ' Kitchen ', wateringIntervalDays: 2 }) },
  { plant: plant('Fern', { speciesId: 'nephrolepis-exaltata', wateringIntervalDays: 3 }), lastWateredAt: new Date(2026, 9, 1, 8) },
]

describe('buildShare', () => {
  it('keeps watering dates, leaves out notes, and never includes photos or ids', () => {
    const share = buildShare(items, { sharedBy: ' Sam ', includeWatering: true, includeNotes: false }, NOW)
    expect(share).toEqual({
      sharedOn: '2026-10-01',
      sharedBy: 'Sam',
      plants: [
        { name: 'Basil', wateringIntervalDays: 2, room: 'Kitchen', speciesName: 'Sweet basil' },
        { name: 'Fern', wateringIntervalDays: 3, speciesId: 'nephrolepis-exaltata', lastWateredDaysAgo: 0 },
        { name: 'Monty', wateringIntervalDays: 7, room: 'Living room', speciesId: 'monstera-deliciosa', lastWateredDaysAgo: 4 },
      ],
    })
    expect(JSON.stringify(share)).not.toMatch(/data:image|Moss pole/)
  })

  it('filters rooms and includes notes when asked', () => {
    const share = buildShare(items, { excludeRooms: ['Kitchen', ''], includeWatering: false, includeNotes: true }, NOW)
    expect(share.sharedBy).toBeUndefined()
    expect(share.plants).toEqual([
      { name: 'Monty', wateringIntervalDays: 7, room: 'Living room', speciesId: 'monstera-deliciosa', notes: 'Moss pole' },
    ])
  })
})

describe('encodeShare / decodeShare', () => {
  const share: SharedCollection = buildShare(items, { sharedBy: 'Sam', includeWatering: true, includeNotes: true }, NOW)

  it('round-trips', () => {
    expect(decodeShare(JSON.parse(JSON.stringify(encodeShare(share))))).toEqual(share)
  })

  it('uses the compact format 1 layout', () => {
    expect(encodeShare(share)).toEqual([
      1,
      '2026-10-01',
      'Sam',
      ['Kitchen', 'Living room'],
      [
        ['Basil', 2, 0, null, 'Sweet basil'],
        ['Fern', 3, null, 'nephrolepis-exaltata', null, 0],
        ['Monty', 7, 1, 'monstera-deliciosa', null, 4, 'Moss pole'],
      ],
    ])
  })

  it('reads a format 1 link exactly as shipped', () => {
    // Links already sent can't be re-made: this exact payload must keep decoding.
    expect(decodeShare([1, '2026-10-01', null, ['Bathroom'], [['Fern', 3, 0, 'nephrolepis-exaltata', null, 1]]])).toEqual({
      sharedOn: '2026-10-01',
      plants: [{ name: 'Fern', wateringIntervalDays: 3, room: 'Bathroom', speciesId: 'nephrolepis-exaltata', lastWateredDaysAgo: 1 }],
    })
  })

  it('rejects malformed data', () => {
    const bad: unknown[] = [
      null,
      {},
      [],
      ['1', '2026-10-01', null, [], []],
      [1, 'yesterday', null, [], []],
      [1, '2026-10-01', null, [], [['No interval']]],
      [1, '2026-10-01', null, [], [['Zero', 0]]],
      [1, '2026-10-01', null, [], [['', 7]]],
      [1, '2026-10-01', null, ['Kitchen'], [['Bad room', 7, 3]]],
      [1, '2026-10-01', null, [], [['Fractional', 7, null, null, null, 1.5]]],
      [1, '2026-10-01', null, [], ['not a row']],
    ]
    for (const raw of bad) expect(() => decodeShare(raw), JSON.stringify(raw)).toThrow(ShareError)
  })

  it('asks for an update on links from a newer format', () => {
    expect(() => decodeShare([2, '2026-10-01'])).toThrow(/newer version of fronds/)
  })
})

describe('projectDue', () => {
  const fern = { name: 'Fern', wateringIntervalDays: 3, lastWateredDaysAgo: 1 }

  it('matches the owner’s schedule on the day it was shared', () => {
    const due = projectDue(fern, '2026-10-01', NOW)!
    expect(due.dueDate).toEqual(new Date(2026, 9, 3))
    expect(due).toMatchObject({ daysUntilDue: 2, status: 'soon' })
  })

  it('rolls passed due dates forward by the interval', () => {
    // Due 3 Oct; viewed 10 Oct → 3, 6, 9, 12 Oct.
    const due = projectDue(fern, '2026-10-01', new Date(2026, 9, 10, 20))!
    expect(due.dueDate).toEqual(new Date(2026, 9, 12))
    expect(due.daysUntilDue).toBe(2)
    // Viewed exactly on a projected due day.
    expect(projectDue(fern, '2026-10-01', new Date(2026, 9, 9))).toMatchObject({ daysUntilDue: 0, status: 'today' })
  })

  it('has nothing to project without watering dates', () => {
    expect(projectDue({ name: 'Basil', wateringIntervalDays: 2 }, '2026-10-01', NOW)).toBeUndefined()
  })
})
