import { describe, expect, it } from 'vitest'
import type { Plant } from '../db/types'
import { BackupError, buildBackup, mergeRecords, parseBackup, SCHEMA_VERSION } from './backup'

const plant = (id: string, updatedAt: string, extra: Partial<Plant> = {}): Plant => ({
  id,
  name: id,
  wateringIntervalDays: 7,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  ...extra,
})

describe('mergeRecords', () => {
  it('keeps the newer side of each record and adds unknown ones', () => {
    const local = [plant('a', '2026-01-02T00:00:00Z', { name: 'local-a' }), plant('b', '2026-01-05T00:00:00Z', { name: 'local-b' })]
    const incoming = [
      plant('a', '2026-01-03T00:00:00Z', { name: 'remote-a' }),
      plant('b', '2026-01-04T00:00:00Z', { name: 'remote-b' }),
      plant('c', '2026-01-01T00:00:00Z'),
    ]
    const { merged, changed } = mergeRecords(local, incoming)
    const byId = Object.fromEntries(merged.map((p) => [p.id, p.name]))
    expect(byId).toEqual({ a: 'remote-a', b: 'local-b', c: 'c' })
    expect(changed.map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('lets a newer deletion win over an older edit', () => {
    const local = [plant('a', '2026-01-02T00:00:00Z')]
    const incoming = [plant('a', '2026-01-03T00:00:00Z', { deletedAt: '2026-01-03T00:00:00Z' })]
    expect(mergeRecords(local, incoming).merged[0].deletedAt).toBeDefined()
  })

  it('is idempotent', () => {
    const local = [plant('a', '2026-01-02T00:00:00Z')]
    expect(mergeRecords(local, local).changed).toHaveLength(0)
  })
})

describe('parseBackup', () => {
  it('round-trips a built backup', () => {
    const b = buildBackup([plant('a', '2026-01-02T00:00:00Z')], [])
    expect(parseBackup(JSON.stringify(b)).plants).toHaveLength(1)
  })

  it.each([
    ['not json', 'File is not valid JSON'],
    ['{"app":"other"}', 'Not a fronds backup file'],
    [JSON.stringify({ app: 'fronds', schemaVersion: SCHEMA_VERSION + 1, plants: [], events: [] }), 'newer version'],
    [JSON.stringify({ app: 'fronds', schemaVersion: 1, plants: [{ id: 1 }], events: [] }), 'Invalid plant'],
  ])('rejects %s', (text, msg) => {
    expect(() => parseBackup(text)).toThrow(BackupError)
    expect(() => parseBackup(text)).toThrow(msg)
  })
})
