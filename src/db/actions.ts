import { db, newId, nowISO } from './db'
import type { CareEvent, CareEventType, Plant } from './types'

export type PlantInput = Omit<Plant, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

/*
 * All writes to synced tables go through here (or backupIO) so they also land
 * in the outbox for the sync server. Callers must include db.outbox in any
 * surrounding transaction.
 */

export function markDirty(table: 'plants' | 'events', ids: string[]) {
  return db.outbox.bulkPut(ids.map((id) => ({ table, id })))
}

export async function createPlant(input: PlantInput, lastWateredAt?: string): Promise<string> {
  const now = nowISO()
  const id = newId()
  await db.transaction('rw', db.plants, db.events, db.outbox, async () => {
    await db.plants.add({ ...input, id, createdAt: now, updatedAt: now })
    await markDirty('plants', [id])
    if (lastWateredAt) await addEvent(id, 'water', { at: lastWateredAt })
  })
  return id
}

export async function updatePlant(id: string, changes: Partial<PlantInput>) {
  await db.transaction('rw', db.plants, db.outbox, async () => {
    await db.plants.update(id, { ...changes, updatedAt: nowISO() })
    await markDirty('plants', [id])
  })
}

export async function deletePlant(id: string) {
  const now = nowISO()
  await db.transaction('rw', db.plants, db.events, db.outbox, async () => {
    await db.plants.update(id, { deletedAt: now, updatedAt: now })
    await markDirty('plants', [id])
    const eventIds = (await db.events.where('plantId').equals(id).primaryKeys()) as string[]
    await db.events.where('plantId').equals(id).modify({ deletedAt: now, updatedAt: now })
    await markDirty('events', eventIds)
  })
}

export async function addEvent(
  plantId: string,
  type: CareEventType,
  extra: Partial<Pick<CareEvent, 'at' | 'days' | 'note'>> = {},
) {
  const now = nowISO()
  const event: CareEvent = { id: newId(), plantId, type, at: now, createdAt: now, updatedAt: now, ...extra }
  await db.transaction('rw', db.events, db.outbox, async () => {
    await db.events.add(event)
    await markDirty('events', [event.id])
  })
  return event.id
}

export async function waterPlants(plantIds: string[]) {
  await db.transaction('rw', db.events, db.outbox, async () => {
    for (const id of plantIds) await addEvent(id, 'water')
  })
}

export async function deleteEvent(id: string) {
  const now = nowISO()
  await db.transaction('rw', db.events, db.outbox, async () => {
    await db.events.update(id, { deletedAt: now, updatedAt: now })
    await markDirty('events', [id])
  })
}
