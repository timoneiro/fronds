import { buildBackup, mergeRecords, parseBackup, type Backup, type MergeSummary } from '../domain/backup'
import { db } from './db'

export async function exportBackup(): Promise<Backup> {
  const [plants, events] = await Promise.all([db.plants.toArray(), db.events.toArray()])
  return buildBackup(plants, events)
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Merge a backup into this device's data (safe to run repeatedly). */
export async function importMerge(text: string): Promise<MergeSummary> {
  const backup = parseBackup(text)
  return db.transaction('rw', db.plants, db.events, async () => {
    const [plants, events] = await Promise.all([db.plants.toArray(), db.events.toArray()])
    const p = mergeRecords(plants, backup.plants)
    const e = mergeRecords(events, backup.events)
    await db.plants.bulkPut(p.changed)
    await db.events.bulkPut(e.changed)
    return { plantsChanged: p.changed.length, eventsChanged: e.changed.length }
  })
}

/** Wipe this device's data and load the backup as-is. */
export async function importReplace(text: string): Promise<MergeSummary> {
  const backup = parseBackup(text)
  await db.transaction('rw', db.plants, db.events, async () => {
    await db.plants.clear()
    await db.events.clear()
    await db.plants.bulkAdd(backup.plants)
    await db.events.bulkAdd(backup.events)
  })
  return { plantsChanged: backup.plants.length, eventsChanged: backup.events.length }
}
