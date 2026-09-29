import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CareEvent, Plant } from '../db/types'
import { dueReminder } from '../domain/reminders'

await Dexie.delete('fronds')
const { db } = await import('../db/db')
const { resolveReminder } = await import('./reminderCheck')

const T = '2026-03-01T12:00:00.000Z'
const now = new Date(2026, 2, 10, 9, 0)
const plant = (id: string, name: string): Plant => ({ id, name, wateringIntervalDays: 7, createdAt: T, updatedAt: T })
const water = (plantId: string, at: Date): CareEvent => ({
  id: `w-${plantId}-${at.getTime()}`,
  plantId,
  type: 'water',
  at: at.toISOString(),
  createdAt: T,
  updatedAt: T,
})

beforeEach(async () => {
  await db.plants.clear()
  await db.events.clear()
  // Both last watered on the 1st → due on the 8th → overdue on the 10th.
  await db.plants.bulkAdd([plant('a', 'Monstera'), plant('b', 'Pothos'), plant('c', 'Cactus')])
  await db.events.bulkAdd([water('a', new Date(2026, 2, 1)), water('b', new Date(2026, 2, 1)), water('c', new Date(2026, 2, 8))])
})

const serverSays = dueReminder([plant('a', 'Monstera'), plant('b', 'Pothos')])
const offline = async () => false

describe('resolveReminder (phone off Tailscale)', () => {
  it('drops plants watered on this phone that the server has not heard about', async () => {
    await db.events.add(water('a', new Date(2026, 2, 9))) // logged offline yesterday
    const r = await resolveReminder(serverSays, now, offline)
    expect(r.title).toBe('💧 Pothos needs water')
  })

  it('says "all caught up" instead of a false reminder when everything was watered offline', async () => {
    await db.events.bulkAdd([water('a', new Date(2026, 2, 9)), water('b', new Date(2026, 2, 9))])
    const r = await resolveReminder(serverSays, now, offline)
    expect(r.title).toBe('🌿 All caught up')
  })

  it('trusts the server about plants watered on other devices it could not pull', async () => {
    // Locally a and b look due; the server (knowing another device watered b) only says a.
    const r = await resolveReminder(dueReminder([plant('a', 'Monstera')]), now, offline)
    expect(r.plantIds).toEqual(['a'])
  })

  it('uses complete local data once a sync succeeds', async () => {
    const r = await resolveReminder(dueReminder([plant('a', 'Monstera')]), now, async () => true)
    expect(r.plantIds).toEqual(['a', 'b'])
  })

  it('passes test notifications through untouched', async () => {
    const test = { kind: 'test' as const, title: 'hi', body: '', url: '#/', tag: 't' }
    expect(await resolveReminder(test, now, offline)).toBe(test)
  })
})
