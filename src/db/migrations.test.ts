import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import type { CareEvent, Plant } from './types'

/*
 * Guards existing users' data: open a database exactly as v0.1 of the app
 * created it, then open it with the current schema and check nothing was
 * lost. When adding db.version(n), keep this test and add the new tables'
 * expectations — never delete the v1 seeding below.
 */

const T = '2026-09-01T10:00:00.000Z'
const plants: Plant[] = [
  { id: 'p1', name: 'Monstera', speciesId: 'monstera-deliciosa', room: 'Living room', wateringIntervalDays: 7, photo: 'data:image/jpeg;base64,AAAA', createdAt: T, updatedAt: T },
  { id: 'p2', name: 'Old fern', wateringIntervalDays: 3, createdAt: T, updatedAt: T, deletedAt: T },
]
const events: CareEvent[] = [
  { id: 'e1', plantId: 'p1', type: 'water', at: T, createdAt: T, updatedAt: T },
  { id: 'e2', plantId: 'p1', type: 'snooze', days: 2, at: T, createdAt: T, updatedAt: T },
]

it('upgrading a v0.1 database keeps every plant, event and cached entry', async () => {
  await Dexie.delete('fronds')
  const v1 = new Dexie('fronds')
  v1.version(1).stores({ plants: 'id, updatedAt, room', events: 'id, plantId, at, updatedAt', wikiCache: 'title' })
  await v1.open()
  await v1.table('plants').bulkAdd(plants)
  await v1.table('events').bulkAdd(events)
  await v1.table('wikiCache').add({ title: 'Monstera deliciosa', fetchedAt: T, extract: 'A plant.' })
  v1.close()

  const { db } = await import('./db')
  await db.open()

  expect(db.verno).toBeGreaterThanOrEqual(2)
  expect(await db.plants.orderBy('id').toArray()).toEqual(plants)
  expect(await db.events.orderBy('id').toArray()).toEqual(events)
  expect(await db.wikiCache.get('Monstera deliciosa')).toMatchObject({ extract: 'A plant.' })
  // v2 tables exist and start empty
  expect(await db.outbox.count()).toBe(0)
  expect(await db.snapshots.count()).toBe(0)
  expect(await db.settings.count()).toBe(0)
  db.close()
})
