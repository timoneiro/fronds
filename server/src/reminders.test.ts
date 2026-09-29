import { describe, expect, it, vi } from 'vitest'
import type { Plant } from '../../src/db/types.ts'
import { dueReminder } from '../../src/domain/reminders.ts'
import { runReminders, type Sender } from './reminders.ts'
import { newHousehold, type DeviceSubscription, type Household } from './store.ts'

const T = '2026-01-01T00:00:00.000Z'
const at = (day: number, h: number, m = 0) => new Date(2026, 2, day, h, m)

function household(): Household {
  const data = newHousehold('Test')
  const add = (id: string, name: string, lastWatered?: Date) => {
    data.plants[id] = { seq: 1, rec: { id, name, wateringIntervalDays: 7, createdAt: T, updatedAt: T } }
    if (lastWatered) {
      data.events[`w-${id}`] = {
        seq: 1,
        rec: { id: `w-${id}`, plantId: id, type: 'water', at: lastWatered.toISOString(), createdAt: T, updatedAt: T },
      }
    }
  }
  add('a', 'Monstera', at(1, 12)) // due on the 8th
  add('b', 'Pothos', at(5, 12)) // due on the 12th
  return data
}

const subscribe = (data: Household, deviceId: string, time: string) => {
  const sub: DeviceSubscription = {
    deviceId,
    time,
    createdAt: T,
    subscription: { endpoint: `https://push.example/${deviceId}`, keys: { p256dh: 'k', auth: 'a' } },
  }
  data.subscriptions[deviceId] = sub
}

describe('runReminders', () => {
  it('sends once per day, at or after the chosen time, listing due plants', async () => {
    const data = household()
    subscribe(data, 'phone', '09:00')
    const send = vi.fn<Sender>().mockResolvedValue('sent')

    expect(await runReminders(data, at(8, 8, 59), send)).toBe(false)
    expect(send).not.toHaveBeenCalled()

    await runReminders(data, at(8, 9, 0), send)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toMatchObject({ title: '💧 Monstera needs water', plantIds: ['a'] })

    await runReminders(data, at(8, 18, 0), send)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stays silent on days with nothing due but still marks the day handled', async () => {
    const data = household()
    subscribe(data, 'phone', '09:00')
    const send = vi.fn<Sender>().mockResolvedValue('sent')
    expect(await runReminders(data, at(6, 9, 0), send)).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect(data.subscriptions.phone.lastSentDate).toBe('2026-03-06')
  })

  it('drops subscriptions the push service says are gone', async () => {
    const data = household()
    subscribe(data, 'old-phone', '07:00')
    await runReminders(data, at(9, 7, 0), vi.fn<Sender>().mockResolvedValue('gone'))
    expect(data.subscriptions['old-phone']).toBeUndefined()
  })
})

describe('dueReminder', () => {
  const p = (name: string) => ({ id: name, name }) as Plant
  it('summarises many plants', () => {
    const payload = dueReminder(['A', 'B', 'C', 'D', 'E', 'F'].map(p))
    expect(payload.title).toBe('💧 6 plants need water')
    expect(payload.body).toBe('A, B, C, D and 2 more')
  })
})
