import { describe, expect, it } from 'vitest'
import type { CareEvent, Plant } from '../../src/db/types.ts'
import { newHousehold } from './store.ts'
import { applySync, BadRequest, parseSyncRequest } from './sync.ts'

const plant = (id: string, updatedAt: string, name = id): Plant => ({
  id,
  name,
  wateringIntervalDays: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
})
const event = (id: string, updatedAt: string): CareEvent => ({
  id,
  plantId: 'a',
  type: 'water',
  at: updatedAt,
  createdAt: updatedAt,
  updatedAt,
})

describe('applySync', () => {
  it('stores pushed records without echoing them back', () => {
    const data = newHousehold('Test')
    const { response, changed } = applySync(data, { cursor: 0, plants: [plant('a', '2026-01-02')], events: [event('e1', '2026-01-02')] })
    expect(changed).toBe(true)
    expect(response.cursor).toBe(2)
    expect(response.plants).toEqual([])
    expect(response.events).toEqual([])
    expect(data.plants.a.rec.name).toBe('a')
  })

  it('returns changes from other devices since the cursor', () => {
    const data = newHousehold('Test')
    applySync(data, { cursor: 0, plants: [plant('a', '2026-01-02')], events: [] }) // device A, seq 1
    const b = applySync(data, { cursor: 0, plants: [plant('b', '2026-01-03')], events: [] }) // device B
    expect(b.response.plants.map((p) => p.id)).toEqual(['a'])
    const a = applySync(data, { cursor: 1, plants: [], events: [] }) // device A pulls
    expect(a.response.plants.map((p) => p.id)).toEqual(['b'])
    expect(a.changed).toBe(false)
  })

  it('keeps the newer version and hands the winner back to a stale pusher', () => {
    const data = newHousehold('Test')
    applySync(data, { cursor: 0, plants: [plant('a', '2026-01-05', 'new')], events: [] })
    const { response } = applySync(data, { cursor: 1, plants: [plant('a', '2026-01-04', 'old')], events: [] })
    expect(data.plants.a.rec.name).toBe('new')
    expect(response.plants).toEqual([expect.objectContaining({ id: 'a', name: 'new' })])
  })

  it('ignores an identical re-push', () => {
    const data = newHousehold('Test')
    applySync(data, { cursor: 0, plants: [plant('a', '2026-01-05')], events: [] })
    const again = applySync(data, { cursor: 1, plants: [plant('a', '2026-01-05')], events: [] })
    expect(again.changed).toBe(false)
    expect(again.response.plants).toEqual([])
  })
})

describe('parseSyncRequest', () => {
  it.each([
    [null, 'Expected a JSON object'],
    [{ cursor: -1, plants: [], events: [] }, 'Invalid cursor'],
    [{ cursor: 0, plants: {}, events: [] }, 'arrays'],
    [{ cursor: 0, plants: [{ id: 'x' }], events: [] }, 'Invalid plant'],
  ])('rejects %j', (body, msg) => {
    expect(() => parseSyncRequest(body)).toThrow(BadRequest)
    expect(() => parseSyncRequest(body)).toThrow(msg)
  })
})
