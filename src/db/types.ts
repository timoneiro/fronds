/**
 * Persisted records. Every synced record carries `id` (UUID), `updatedAt` and
 * an optional `deletedAt` tombstone so backups from different devices can be
 * merged record-by-record (newest `updatedAt` wins) instead of overwriting.
 */

export type ISODate = string

export interface SyncMeta {
  id: string
  createdAt: ISODate
  updatedAt: ISODate
  deletedAt?: ISODate
}

export interface Plant extends SyncMeta {
  name: string
  /** Catalog species id (see src/species/catalog.ts), if matched. */
  speciesId?: string
  /** Free-text species / Wikipedia title for plants outside the catalog. */
  speciesName?: string
  room?: string
  notes?: string
  /** Resized JPEG data URL, kept small so it fits in backups. */
  photo?: string
  wateringIntervalDays: number
}

export type CareEventType = 'water' | 'snooze'

export interface CareEvent extends SyncMeta {
  plantId: string
  type: CareEventType
  at: ISODate
  /** For `snooze`: how many days to push the next watering back. */
  days?: number
  note?: string
}

/** Local-only key/value settings (never synced or exported). */
export interface SettingEntry {
  key: string
  value: unknown
}

/** A synced record changed locally that the sync server hasn't seen yet. */
export interface OutboxEntry {
  table: 'plants' | 'events'
  id: string
}

/** Automatic local backup taken before risky operations (import-replace, first sync). */
export interface Snapshot {
  id?: number
  createdAt: ISODate
  reason: string
  /** Serialised Backup JSON. */
  data: string
  plants: number
  events: number
}

export interface WikiCacheEntry {
  title: string
  fetchedAt: ISODate
  extract?: string
  thumbnail?: string
  url?: string
}
