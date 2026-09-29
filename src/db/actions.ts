import { db, newId, nowISO } from './db'
import type { CareEvent, CareEventType, Plant } from './types'

export type PlantInput = Omit<Plant, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export async function createPlant(input: PlantInput, lastWateredAt?: string): Promise<string> {
  const now = nowISO()
  const id = newId()
  await db.transaction('rw', db.plants, db.events, async () => {
    await db.plants.add({ ...input, id, createdAt: now, updatedAt: now })
    if (lastWateredAt) await addEvent(id, 'water', { at: lastWateredAt })
  })
  return id
}

export async function updatePlant(id: string, changes: Partial<PlantInput>) {
  await db.plants.update(id, { ...changes, updatedAt: nowISO() })
}

export async function deletePlant(id: string) {
  const now = nowISO()
  await db.transaction('rw', db.plants, db.events, async () => {
    await db.plants.update(id, { deletedAt: now, updatedAt: now })
    await db.events.where('plantId').equals(id).modify({ deletedAt: now, updatedAt: now })
  })
}

export async function addEvent(
  plantId: string,
  type: CareEventType,
  extra: Partial<Pick<CareEvent, 'at' | 'days' | 'note'>> = {},
) {
  const now = nowISO()
  const event: CareEvent = { id: newId(), plantId, type, at: now, createdAt: now, updatedAt: now, ...extra }
  await db.events.add(event)
  return event.id
}

export async function waterPlants(plantIds: string[]) {
  await db.transaction('rw', db.events, async () => {
    for (const id of plantIds) await addEvent(id, 'water')
  })
}

export async function deleteEvent(id: string) {
  const now = nowISO()
  await db.events.update(id, { deletedAt: now, updatedAt: now })
}
