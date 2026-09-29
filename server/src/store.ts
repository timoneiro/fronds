import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CareEvent, Plant } from '../../src/db/types.ts'
import type { PushSubscribeRequest } from '../../src/domain/syncProtocol.ts'

export interface Stored<T> {
  rec: T
  /** Server change sequence number assigned when this version was stored. */
  seq: number
}

export interface DeviceSubscription extends PushSubscribeRequest {
  createdAt: string
  /** Local date (YYYY-MM-DD, server timezone) the last daily reminder was handled. */
  lastSentDate?: string
}

export interface StoreData {
  version: 1
  seq: number
  plants: Record<string, Stored<Plant>>
  events: Record<string, Stored<CareEvent>>
  subscriptions: Record<string, DeviceSubscription>
}

export const emptyData = (): StoreData => ({ version: 1, seq: 0, plants: {}, events: {}, subscriptions: {} })

const FILE = 'store.json'
const KEEP_BACKUPS = 7

/**
 * The whole household fits comfortably in memory (tens of plants, thousands
 * of events), so the store is a JSON file rewritten atomically on change.
 */
export class Store {
  data: StoreData = emptyData()
  private writing: Promise<void> = Promise.resolve()
  private readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  async load() {
    await mkdir(this.dir, { recursive: true })
    const path = join(this.dir, FILE)
    let text: string | undefined
    try {
      text = await readFile(path, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    if (text !== undefined) {
      // Refuse to start on a corrupt file rather than overwrite it with an empty store.
      this.data = { ...emptyData(), ...(JSON.parse(text) as StoreData) }
      await this.rotateBackups(path)
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
