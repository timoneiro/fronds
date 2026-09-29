import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CareEvent, Plant } from '../../src/db/types.ts'
import type { PushSubscribeRequest } from '../../src/domain/syncProtocol.ts'
import { hashSecret, newId } from './secrets.ts'

export interface Stored<T> {
  rec: T
  /** Household change sequence number assigned when this version was stored. */
  seq: number
}

export interface DeviceSubscription extends PushSubscribeRequest {
  createdAt: string
  /** Server device the subscription belongs to (removed with the device). */
  serverDeviceId?: string
  /** Local date (YYYY-MM-DD, server timezone) the last daily reminder was handled. */
  lastSentDate?: string
}

export interface Device {
  id: string
  label: string
  /** sha256 of the device token — the token itself is never stored. */
  tokenHash: string
  createdAt: string
  lastSeenAt?: string
}

export interface Invite {
  codeHash: string
  createdAt: string
  expiresAt: string
  createdBy: string
}

/** Everything one household syncs. Households never see each other's data. */
export interface Household {
  id: string
  name: string
  createdAt: string
  seq: number
  plants: Record<string, Stored<Plant>>
  events: Record<string, Stored<CareEvent>>
  subscriptions: Record<string, DeviceSubscription>
  devices: Record<string, Device>
  /** Keyed by code hash. */
  invites: Record<string, Invite>
}

export interface StoreData {
  version: 2
  households: Record<string, Household>
}

export const emptyData = (): StoreData => ({ version: 2, households: {} })

export function newHousehold(name: string, now = new Date()): Household {
  return { id: newId(), name, createdAt: now.toISOString(), seq: 0, plants: {}, events: {}, subscriptions: {}, devices: {}, invites: {} }
}

/** Store format 1 (server 0.1): a single household authenticated by one shared key. */
interface StoreDataV1 {
  version?: 1
  seq: number
  plants: Household['plants']
  events: Household['events']
  subscriptions: Household['subscriptions']
}

/**
 * Upgrade older store files in memory. A v1 store that holds data becomes a
 * household called "Home"; its shared key keeps working as a device token so
 * phones already connected to a 0.1 server don't notice the upgrade.
 */
export function migrate(raw: unknown, legacyKey: string | undefined): { data: StoreData; migrated: boolean } {
  const r = raw as Partial<StoreData> & Partial<StoreDataV1>
  if (r.version === 2) return { data: { ...emptyData(), ...(r as StoreData) }, migrated: false }

  const data = emptyData()
  const v1 = r as StoreDataV1
  const hasData = [v1.plants, v1.events, v1.subscriptions].some((x) => x && Object.keys(x).length)
  if (hasData && legacyKey) {
    const home = newHousehold('Home')
    Object.assign(home, { seq: v1.seq ?? 0, plants: v1.plants ?? {}, events: v1.events ?? {}, subscriptions: v1.subscriptions ?? {} })
    home.devices.legacy = {
      id: 'legacy',
      label: 'Shared household key (from server 0.1)',
      tokenHash: hashSecret(legacyKey),
      createdAt: home.createdAt,
    }
    data.households[home.id] = home
  }
  return { data, migrated: true }
}

const FILE = 'store.json'
const KEEP_BACKUPS = 7

/**
 * All households fit comfortably in memory (tens of plants, thousands of
 * events each), so the store is a JSON file rewritten atomically on change.
 */
export class Store {
  data: StoreData = emptyData()
  private writing: Promise<void> = Promise.resolve()
  private readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  async load(legacyKey?: string) {
    await mkdir(this.dir, { recursive: true })
    const path = join(this.dir, FILE)
    let text: string | undefined
    try {
      text = await readFile(path, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    if (text === undefined) return

    await this.rotateBackups(path)
    // Refuse to start on a corrupt file rather than overwrite it with an empty store.
    const { data, migrated } = migrate(JSON.parse(text), legacyKey)
    this.data = data
    if (migrated) {
      await copyFile(path, join(this.dir, 'backups', 'store-before-households-upgrade.json'))
      await this.save()
    }
  }

  /** Daily copy on startup, keeping the last few — cheap insurance for people's data. */
  private async rotateBackups(path: string) {
    const dir = join(this.dir, 'backups')
    await mkdir(dir, { recursive: true })
    const today = new Date().toISOString().slice(0, 10)
    await copyFile(path, join(dir, `store-${today}.json`))
    const files = (await readdir(dir)).filter((f) => /^store-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) await rm(join(dir, f))
  }

  /** Serialised, atomic write (temp file + rename). */
  save(): Promise<void> {
    const snapshot = JSON.stringify(this.data)
    this.writing = this.writing.then(async () => {
      const path = join(this.dir, FILE)
      await writeFile(`${path}.tmp`, snapshot)
      await rename(`${path}.tmp`, path)
    })
    return this.writing
  }
}
