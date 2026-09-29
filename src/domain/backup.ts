import type { CareEvent, Plant, SyncMeta } from '../db/types'

/**
 * The single data format used for export/import today and for Drive backup
 * and server sync later. Bump SCHEMA_VERSION and add a migration in
 * `parseBackup` whenever the shape of Plant/CareEvent changes incompatibly.
 */
export const SCHEMA_VERSION = 1

export interface Backup {
  app: 'fronds'
  schemaVersion: number
  exportedAt: string
  plants: Plant[]
  events: CareEvent[]
}

export function buildBackup(plants: Plant[], events: CareEvent[], now = new Date()): Backup {
  return { app: 'fronds', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), plants, events }
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function checkMeta(r: unknown, kind: string): asserts r is SyncMeta {
  if (!isObj(r) || typeof r.id !== 'string' || typeof r.updatedAt !== 'string' || typeof r.createdAt !== 'string') {
    throw new BackupError(`Invalid ${kind} record in backup`)
  }
}

export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('File is not valid JSON')
  }
  if (!isObj(data) || data.app !== 'fronds') throw new BackupError('Not a fronds backup file')
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('Backup was made by a newer version of fronds — update the app first')
  }
  if (!Array.isArray(data.plants) || !Array.isArray(data.events)) throw new BackupError('Backup is missing data')

  for (const p of data.plants) {
    checkMeta(p, 'plant')
    if (typeof (p as unknown as Plant).name !== 'string') throw new BackupError('Invalid plant record in backup')
  }
  for (const e of data.events) {
    checkMeta(e, 'event')
    const ev = e as unknown as CareEvent
    if (typeof ev.plantId !== 'string' || typeof ev.at !== 'string') throw new BackupError('Invalid event record in backup')
  }
  return data as unknown as Backup
}

/**
 * Record-level merge: for each id keep whichever side has the newer
 * `updatedAt`. Tombstones (`deletedAt`) are records too, so a deletion on one
 * device wins over an older edit on another.
 */
export function mergeRecords<T extends SyncMeta>(local: T[], incoming: T[]): { merged: T[]; changed: T[] } {
  const byId = new Map(local.map((r) => [r.id, r]))
  const changed: T[] = []
  for (const r of incoming) {
    const mine = byId.get(r.id)
    if (!mine || r.updatedAt > mine.updatedAt) {
      byId.set(r.id, r)
      changed.push(r)
    }
  }
  return { merged: [...byId.values()], changed }
}

export interface MergeSummary {
  plantsChanged: number
  eventsChanged: number
}
