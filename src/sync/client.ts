import { takeSnapshot } from '../db/snapshots'
import { db, nowISO } from '../db/db'
import { getSyncConfig, setSyncConfig, type SyncConfig } from '../db/syncState'
import type { CareEvent, Plant, SyncMeta } from '../db/types'
import { mergeRecords } from '../domain/backup'
import type { ServerInfo, SyncRequest, SyncResponse } from '../domain/syncProtocol'

export class SyncError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export function normaliseServerUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !local) throw new SyncError('The server address must start with https://')
  return parsed.origin + parsed.pathname.replace(/\/+$/, '')
}

export async function api<T>(cfg: Pick<SyncConfig, 'url' | 'key'>, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${cfg.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new SyncError("Couldn't reach the server — check the address and that you're on your network/Tailscale")
  }
  if (res.status === 401) throw new SyncError('The server rejected the household key', 401)
  if (!res.ok) {
    const msg = ((await res.json().catch(() => undefined)) as { error?: string } | undefined)?.error
    throw new SyncError(msg ?? `Server error (${res.status})`, res.status)
  }
  return (await res.json()) as T
}

export async function fetchServerInfo(cfg: Pick<SyncConfig, 'url' | 'key'>): Promise<ServerInfo> {
  const info = await api<ServerInfo>(cfg, '/api/info')
  if (info.app !== 'fronds-server') throw new SyncError("That address isn't a fronds server")
  return info
}

/** Connect this device to a server. Existing local data is snapshotted, then uploaded and merged. */
export async function connectServer(urlInput: string, key: string): Promise<ServerInfo> {
  const url = normaliseServerUrl(urlInput)
  const info = await fetchServerInfo({ url, key: key.trim() })
  await takeSnapshot('Before connecting to sync server')
  await setSyncConfig({ url, key: key.trim(), cursor: 0, initialUploadDone: false, timezone: info.timezone })
  await runSync()
  return info
}

/** Stop syncing. Local data is kept as-is. */
export async function disconnectServer() {
  await setSyncConfig(undefined)
}

async function pendingRecords(cfg: SyncConfig): Promise<{ plants: Plant[]; events: CareEvent[] }> {
  if (!cfg.initialUploadDone) {
    return { plants: await db.plants.toArray(), events: await db.events.toArray() }
  }
  const outbox = await db.outbox.toArray()
  const ids = (table: string) => outbox.filter((o) => o.table === table).map((o) => o.id)
  const defined = <T>(xs: (T | undefined)[]) => xs.filter((x): x is T => x !== undefined)
  return {
    plants: defined(await db.plants.bulkGet(ids('plants'))),
    events: defined(await db.events.bulkGet(ids('events'))),
  }
}

type SyncedTable = 'plants' | 'events'

async function applyPulled<T extends SyncMeta>(tableName: SyncedTable, pulled: T[]) {
  if (!pulled.length) return
  const table = db.table<T, string>(tableName)
  const local = (await table.bulkGet(pulled.map((r) => r.id))).filter((r): r is T => r !== undefined)
  const { changed } = mergeRecords(local, pulled)
  await table.bulkPut(changed)
}

async function clearSent<T extends SyncMeta>(tableName: SyncedTable, sent: T[]) {
  const current = await db.table<T, string>(tableName).bulkGet(sent.map((r) => r.id))
  // Only clear entries whose record hasn't been edited again while the request was in flight.
  const done = sent.filter((r, i) => !current[i] || current[i]!.updatedAt === r.updatedAt)
  await db.outbox.bulkDelete(done.map((r) => [tableName, r.id] as [string, string]))
}

let running: Promise<boolean> | undefined

/**
 * Push local changes and pull remote ones; resolves true when a sync completed.
 * No-op (false) when not connected or offline; concurrent calls share one run.
 */
export function runSync(): Promise<boolean> {
  running ??= doSync().finally(() => {
    running = undefined
  })
  return running
}

async function doSync(): Promise<boolean> {
  const cfg = await getSyncConfig()
  if (!cfg) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

  const pending = await pendingRecords(cfg)
  const request: SyncRequest = { cursor: cfg.cursor, ...pending }
  let response: SyncResponse
  try {
    response = await api<SyncResponse>(cfg, '/api/sync', request)
  } catch (err) {
    const latest = await getSyncConfig()
    if (latest) await setSyncConfig({ ...latest, lastError: (err as Error).message })
    throw err
  }

  return db.transaction('rw', [db.plants, db.events, db.outbox, db.settings], async () => {
    // Clear the outbox before applying pulled records, so server winners aren't re-pushed.
    await clearSent('plants', pending.plants)
    await clearSent('events', pending.events)
    await applyPulled('plants', response.plants)
    await applyPulled('events', response.events)
    const latest = await getSyncConfig()
    if (latest?.url !== cfg.url) return false // disconnected or switched servers meanwhile
    await setSyncConfig({ ...latest, cursor: response.cursor, initialUploadDone: true, lastSyncAt: nowISO(), lastError: undefined })
    return true
  })
}
