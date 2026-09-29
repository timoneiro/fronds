import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../server/src/app.ts'
import { loadConfig, type Config } from '../../server/src/config.ts'
import { Store } from '../../server/src/store.ts'
import type { Plant } from '../db/types'
import type { SyncResponse } from '../domain/syncProtocol'

/*
 * End-to-end: the real client sync engine (on fake IndexedDB) against the
 * real server, starting from a v0.1 user's existing data.
 */

let dir: string
let url: string
let config: Config
let store: Store
let close: () => void

const T0 = '2026-09-01T10:00:00.000Z'
const legacy: Plant = { id: 'p1', name: 'Monstera', wateringIntervalDays: 7, createdAt: T0, updatedAt: T0 }

beforeAll(async () => {
  await Dexie.delete('fronds')
  dir = await mkdtemp(join(tmpdir(), 'fronds-sync-'))
  config = await loadConfig({ DATA_DIR: dir })
  store = new Store(dir)
  await store.load()
  const server = createApp(config, store, async () => 'sent').listen(0)
  await new Promise((r) => server.once('listening', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => server.close()
})

afterAll(async () => {
  close()
  await rm(dir, { recursive: true, force: true })
})

/** Another device talking to the server directly. */
const otherDevice = async (body: object) =>
  (await (
    await fetch(`${url}/api/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: 0, plants: [], events: [], ...body }),
    })
  ).json()) as SyncResponse

describe('sync client ↔ server', async () => {
  const { db } = await import('../db/db')
  const { addEvent, updatePlant } = await import('../db/actions')
  const { importReplace } = await import('../db/backupIO')
  const { getSyncConfig } = await import('../db/syncState')
  const { connectServer, runSync, SyncError } = await import('./client')

  it('rejects a wrong key without touching local data', async () => {
    await db.plants.add(legacy) // pre-sync data: no outbox entries, like a v0.1 user
    await expect(connectServer(url, 'nope')).rejects.toBeInstanceOf(SyncError)
    expect(await getSyncConfig()).toBeUndefined()
    expect(await db.plants.count()).toBe(1)
  })

  it('first connect snapshots, then uploads existing data', async () => {
    await connectServer(url, config.key)
    expect(await db.snapshots.count()).toBe(1)
    expect(store.data.plants.p1.rec).toEqual(legacy)
    expect(await getSyncConfig()).toMatchObject({ initialUploadDone: true, cursor: 1 })
    expect(await db.outbox.count()).toBe(0)
  })

  it('pushes local edits through the outbox', async () => {
    await updatePlant('p1', { name: 'Big Monstera' })
    await addEvent('p1', 'water')
    expect(await db.outbox.count()).toBe(2)
    await runSync()
    expect(await db.outbox.count()).toBe(0)
    expect(store.data.plants.p1.rec.name).toBe('Big Monstera')
    expect(Object.keys(store.data.events)).toHaveLength(1)
  })

  it('pulls changes made on another device', async () => {
    const other: Plant = { id: 'p2', name: 'Pothos', wateringIntervalDays: 7, createdAt: T0, updatedAt: new Date().toISOString() }
    await otherDevice({ plants: [other] })
    await runSync()
    expect((await db.plants.get('p2'))?.name).toBe('Pothos')
  })

  it('converges when this device loses a conflict', async () => {
    const future = '2099-01-01T00:00:00.000Z'
    await otherDevice({ plants: [{ ...legacy, name: 'Renamed elsewhere', updatedAt: future }] })
    await updatePlant('p1', { notes: 'edited here, but earlier' }) // older timestamp than `future`
    await runSync()
    expect((await db.plants.get('p1'))?.name).toBe('Renamed elsewhere')
    expect(await db.outbox.count()).toBe(0)
    await runSync() // stable afterwards
    expect((await db.plants.get('p1'))?.name).toBe('Renamed elsewhere')
  })

  it('import & replace never deletes data on the server; sync merges it back', async () => {
    const backup = { app: 'fronds', schemaVersion: 1, exportedAt: T0, plants: [], events: [] }
    await importReplace(JSON.stringify(backup))
    expect(await db.plants.count()).toBe(0)
    expect(await db.snapshots.count()).toBe(2)
    await runSync()
    expect(await db.plants.count()).toBe(2)
    expect(Object.keys(store.data.plants)).toHaveLength(2)
  })
})
