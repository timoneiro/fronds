import Dexie, { type EntityTable } from 'dexie'
import type { CareEvent, Plant, WikiCacheEntry } from './types'

export const db = new Dexie('fronds') as Dexie & {
  plants: EntityTable<Plant, 'id'>
  events: EntityTable<CareEvent, 'id'>
  wikiCache: EntityTable<WikiCacheEntry, 'title'>
}

db.version(1).stores({
  plants: 'id, updatedAt, room',
  events: 'id, plantId, at, updatedAt',
  wikiCache: 'title',
})

export const nowISO = () => new Date().toISOString()

export const newId = () => crypto.randomUUID()

export const isLive = <T extends { deletedAt?: string }>(r: T) => !r.deletedAt

/** Ask the browser not to evict our data (matters on iOS Safari). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
