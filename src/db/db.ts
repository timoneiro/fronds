import Dexie, { type EntityTable } from 'dexie'
import type { CareEvent, OutboxEntry, Plant, SettingEntry, Snapshot, WikiCacheEntry } from './types'

export const db = new Dexie('fronds') as Dexie & {
  plants: EntityTable<Plant, 'id'>
  events: EntityTable<CareEvent, 'id'>
  wikiCache: EntityTable<WikiCacheEntry, 'title'>
  settings: EntityTable<SettingEntry, 'key'>
  outbox: Dexie.Table<OutboxEntry, [string, string]>
  snapshots: EntityTable<Snapshot, 'id'>
}

/*
 * SCHEMA HISTORY — people's plants live in this database, so versions are
 * append-only: never edit or delete an existing version, never change a
 * primary key, never drop a table that holds user data. Add a new
 * `db.version(n)` and extend src/db/migrations.test.ts to cover it.
 */
db.version(1).stores({
  plants: 'id, updatedAt, room',
  events: 'id, plantId, at, updatedAt',
  wikiCache: 'title',
})

// v2 (0.2.0): sync + safety. Only adds tables; existing data is untouched.
db.version(2).stores({
  settings: 'key',
  outbox: '[table+id]',
  snapshots: '++id, createdAt',
})

export const nowISO = () => new Date().toISOString()

export const newId = () => crypto.randomUUID()

export const isLive = <T extends { deletedAt?: string }>(r: T) => !r.deletedAt

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting<T>(key: string, value: T | undefined) {
  if (value === undefined) await db.settings.delete(key)
  else await db.settings.put({ key, value })
}
