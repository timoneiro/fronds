import { buildBackup, type Backup } from '../domain/backup'
import { db, nowISO } from './db'

// No DOM APIs in here: also used by the service worker (via the sync client).

const MAX_SNAPSHOTS = 5

export async function exportBackup(): Promise<Backup> {
  const [plants, events] = await Promise.all([db.plants.toArray(), db.events.toArray()])
  return buildBackup(plants, events)
}

/** Keep a local copy of everything before an operation that could lose data. */
export async function takeSnapshot(reason: string) {
  const backup = await exportBackup()
  if (!backup.plants.length && !backup.events.length) return
  await db.transaction('rw', db.snapshots, async () => {
    await db.snapshots.add({
      createdAt: nowISO(),
      reason,
      data: JSON.stringify(backup),
      plants: backup.plants.filter((p) => !p.deletedAt).length,
      events: backup.events.filter((e) => !e.deletedAt).length,
    })
    const keys = await db.snapshots.orderBy('createdAt').primaryKeys()
    if (keys.length > MAX_SNAPSHOTS) await db.snapshots.bulkDelete(keys.slice(0, keys.length - MAX_SNAPSHOTS))
  })
}
