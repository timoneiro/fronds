import { db, isLive } from '../db/db'
import type { Plant } from '../db/types'
import { allCaughtUp, dueReminder, type ReminderPayload } from '../domain/reminders'
import { computeSchedule, needsWater } from '../domain/watering'
import { runSync } from './client'

// No DOM APIs in here: runs in the service worker when a reminder push arrives.

const SYNC_TIMEOUT_MS = 5000

export async function plantsDueLocally(now = new Date()): Promise<Plant[]> {
  const [plants, events] = await Promise.all([db.plants.toArray(), db.events.toArray()])
  const liveEvents = events.filter(isLive)
  return plants
    .filter((p) => isLive(p) && needsWater(computeSchedule(p, liveEvents, now)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The server builds reminders from what it knows, but this phone may have
 * logged waterings it couldn't upload (e.g. off Tailscale). So before showing
 * a reminder: try a quick sync; if that works, local data is complete and
 * decides. If not, only mention plants that both the server and this phone
 * think need water — each side can only be missing waterings, never extra ones.
 */
export async function resolveReminder(payload: ReminderPayload, now = new Date(), sync = runSync): Promise<ReminderPayload> {
  if (payload.kind !== 'due' || !payload.plantIds) return payload
  const synced = await Promise.race([
    sync().catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SYNC_TIMEOUT_MS)),
  ])
  const local = await plantsDueLocally(now)
  const serverSaysDue = new Set(payload.plantIds)
  const due = synced ? local : local.filter((p) => serverSaysDue.has(p.id))
  // A push must always show a notification (browsers penalise silent pushes).
  return due.length ? dueReminder(due) : allCaughtUp()
}
