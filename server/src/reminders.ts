import type { Plant } from '../../src/db/types.ts'
import { dueReminder, type ReminderPayload } from '../../src/domain/reminders.ts'
import { computeSchedule, needsWater } from '../../src/domain/watering.ts'
import type { DeviceSubscription, Household } from './store.ts'

/** The part of a household reminders look at. */
export type ReminderState = Pick<Household, 'plants' | 'events' | 'subscriptions'>

/*
 * Daily reminders, per household. Dates and times use the server process's timezone (the
 * TZ env var), which should be the household's timezone.
 */

const pad = (n: number) => String(n).padStart(2, '0')
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function plantsNeedingWater(data: ReminderState, now: Date): Plant[] {
  const events = Object.values(data.events).map((s) => s.rec).filter((e) => !e.deletedAt)
  return Object.values(data.plants)
    .map((s) => s.rec)
    .filter((p) => !p.deletedAt && needsWater(computeSchedule(p, events, now)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type SendResult = 'sent' | 'gone' | 'failed'
export type Sender = (sub: DeviceSubscription, payload: ReminderPayload) => Promise<SendResult>

/**
 * Called every minute. Each device gets at most one reminder per day, at or
 * after its chosen time (so a restart past that time still sends it), and
 * only if something needs water. Returns true if the store changed.
 */
export async function runReminders(data: ReminderState, now: Date, send: Sender): Promise<boolean> {
  const today = localDate(now)
  const time = localTime(now)
  const due = Object.values(data.subscriptions).filter((s) => s.lastSentDate !== today && s.time <= time)
  if (!due.length) return false

  const payload = (() => {
    const plants = plantsNeedingWater(data, now)
    return plants.length ? dueReminder(plants) : undefined
  })()

  for (const sub of due) {
    sub.lastSentDate = today
    if (!payload) continue
    const result = await send(sub, payload)
    if (result === 'gone') delete data.subscriptions[sub.deviceId]
  }
  return true
}
