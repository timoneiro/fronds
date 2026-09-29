import { getSetting, setSetting } from './db'

export interface SyncConfig {
  url: string
  key: string
  /** Server change cursor this device has pulled up to. */
  cursor: number
  /** False until this device's pre-existing data has been uploaded once. */
  initialUploadDone: boolean
  lastSyncAt?: string
  lastError?: string
  /** Timezone the server schedules reminders in. */
  timezone?: string
}

export interface ReminderConfig {
  enabled: boolean
  time: string
}

const SYNC = 'sync'
const REMINDERS = 'reminders'
const DEVICE_ID = 'deviceId'

export const getSyncConfig = () => getSetting<SyncConfig>(SYNC)
export const setSyncConfig = (c: SyncConfig | undefined) => setSetting(SYNC, c)
export const getReminderConfig = () => getSetting<ReminderConfig>(REMINDERS)
export const setReminderConfig = (c: ReminderConfig | undefined) => setSetting(REMINDERS, c)

/** Next sync re-uploads everything and pulls the full server state. */
export async function resetSyncCursor() {
  const c = await getSyncConfig()
  if (c) await setSyncConfig({ ...c, cursor: 0, initialUploadDone: false })
}

export async function getDeviceId(): Promise<string> {
  let id = await getSetting<string>(DEVICE_ID)
  if (!id) {
    id = crypto.randomUUID()
    await setSetting(DEVICE_ID, id)
  }
  return id
}
