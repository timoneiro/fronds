import { mergeRecords, parseBackup, type MergeSummary } from '../domain/backup'
import { markDirty } from './actions'
import { db } from './db'
import { exportBackup, takeSnapshot } from './snapshots'
import { resetSyncCursor } from './syncState'

export { exportBackup, takeSnapshot }

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
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
  return db.transaction('rw', db.plants, db.events, db.outbox, async () => {
    const [plants, events] = await Promise.all([db.plants.toArray(), db.events.toArray()])
    const p = mergeRecords(plants, backup.plants)
    const e = mergeRecords(events, backup.events)
    await db.plants.bulkPut(p.changed)
    await db.events.bulkPut(e.changed)
    await markDirty('plants', p.changed.map((r) => r.id))
    await markDirty('events', e.changed.map((r) => r.id))
    return { plantsChanged: p.changed.length, eventsChanged: e.changed.length }
  })
}

/**
 * Wipe this device's data and load the backup as-is. A snapshot is taken
 * first. If sync is on, the next sync re-uploads everything and merges the
 * server's copy back in — replace never deletes data on other devices.
 */
export async function importReplace(text: string): Promise<MergeSummary> {
  const backup = parseBackup(text)
  await takeSnapshot('Before import & replace')
  await db.transaction('rw', db.plants, db.events, db.outbox, db.settings, async () => {
    await db.plants.clear()
    await db.events.clear()
    await db.outbox.clear()
    await db.plants.bulkAdd(backup.plants)
    await db.events.bulkAdd(backup.events)
    await resetSyncCursor()
  })
  return { plantsChanged: backup.plants.length, eventsChanged: backup.events.length }
}
