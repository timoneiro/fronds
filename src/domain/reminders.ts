import type { Plant } from '../db/types.ts'

/*
 * Daily watering reminder content. Built by the sync server when it sends the
 * push, and rebuilt by the service worker on the phone from local data, since
 * the phone may have logged waterings the server hasn't seen yet (e.g. while
 * off Tailscale).
 */

export interface ReminderPayload {
  kind: 'due' | 'test'
  title: string
  body: string
  url: string
  tag: string
  /** For `due`: the plants the server believes need water. */
  plantIds?: string[]
}

export function dueReminder(plants: Pick<Plant, 'id' | 'name'>[]): ReminderPayload {
  const names = plants.map((p) => p.name)
  const shown = names.slice(0, 4).join(', ')
  return {
    kind: 'due',
    title: plants.length === 1 ? `💧 ${names[0]} needs water` : `💧 ${plants.length} plants need water`,
    body: plants.length === 1 ? 'Tap to open fronds.' : names.length > 4 ? `${shown} and ${names.length - 4} more` : shown,
    url: '#/',
    tag: 'fronds-due',
    plantIds: plants.map((p) => p.id),
  }
}

export const testReminder = (): ReminderPayload => ({
  kind: 'test',
  title: '🌿 fronds reminders work',
  body: "You'll get a notification like this when plants need water.",
  url: '#/',
  tag: 'fronds-test',
})

export const allCaughtUp = (): ReminderPayload => ({
  kind: 'due',
  title: '🌿 All caught up',
  body: 'Everything has been watered — nothing needs water today.',
  url: '#/',
  tag: 'fronds-due',
})
