import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../server/src/app.ts'
import { loadConfig, type Config } from '../../server/src/config.ts'
import { Store, type Household } from '../../server/src/store.ts'
import type { Plant } from '../db/types'
import type { DeviceCredentials, InviteResponse, SyncResponse } from '../domain/syncProtocol'

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

const post = async <T>(path: string, body: object, token?: string) =>
  (await (
    await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  ).json()) as T

describe('sync client ↔ server', async () => {
  const { db } = await import('../db/db')
  const { addEvent, updatePlant } = await import('../db/actions')
  const { importReplace } = await import('../db/backupIO')
  const { getSyncConfig } = await import('../db/syncState')
  const { runSync, SyncError } = await import('./client')
  const { createHousehold, createInvite } = await import('./households')

  let household: () => Household
  let partner: DeviceCredentials // a second phone in the same household
  /** The partner's phone talking to the server directly. */
  const partnerSync = (body: object) => post<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [], ...body }, partner.token)

  it('rejects a wrong server code without touching local data', async () => {
    await db.plants.add(legacy) // pre-sync data: no outbox entries, like a v0.1 user
    await expect(createHousehold(url, 'WRONG-CODE-0000', 'Casa', 'Phone')).rejects.toBeInstanceOf(SyncError)
    expect(await getSyncConfig()).toBeUndefined()
    expect(await db.plants.count()).toBe(1)
  })

  it('creating a household snapshots, then uploads existing data', async () => {
    await createHousehold(url, config.serverCode, 'Casa', "Ricardo's phone")
    const cfg = await getSyncConfig()
    expect(cfg).toMatchObject({ household: { name: 'Casa' }, initialUploadDone: true, cursor: 1 })
    household = () => store.data.households[cfg!.household!.id]
    expect(await db.snapshots.count()).toBe(1)
    expect(household().plants.p1.rec).toEqual(legacy)
    expect(await db.outbox.count()).toBe(0)
  })

  it('pushes local edits through the outbox', async () => {
    await updatePlant('p1', { name: 'Big Monstera' })
    await addEvent('p1', 'water')
    expect(await db.outbox.count()).toBe(2)
    await runSync()
    expect(await db.outbox.count()).toBe(0)
    expect(household().plants.p1.rec.name).toBe('Big Monstera')
    expect(Object.keys(household().events)).toHaveLength(1)
  })

  it('a second phone joins with an invite and changes flow both ways', async () => {
    const { code, link } = await createInvite()
    expect(link).toContain(`invite=${encodeURIComponent(code)}`)
    partner = await post<DeviceCredentials>('/api/join', { inviteCode: code, deviceLabel: 'Partner' })
    expect((await partnerSync({})).plants.map((p) => p.name)).toEqual(['Big Monstera'])

    const pothos: Plant = { id: 'p2', name: 'Pothos', wateringIntervalDays: 7, createdAt: T0, updatedAt: new Date().toISOString() }
    await partnerSync({ plants: [pothos] })
    await runSync()
    expect((await db.plants.get('p2'))?.name).toBe('Pothos')
  })

  it('converges when this phone loses a conflict', async () => {
    const future = '2099-01-01T00:00:00.000Z'
    await partnerSync({ plants: [{ ...legacy, name: 'Renamed elsewhere', updatedAt: future }] })
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
    expect(Object.keys(household().plants)).toHaveLength(2)
  })

  it('a phone removed from the household keeps its plants and learns it was removed', async () => {
    const cfg = (await getSyncConfig())!
    await post('/api/devices/remove', { deviceId: cfg.serverDeviceId }, partner.token)
    await addEvent('p1', 'water')
    await expect(runSync()).rejects.toMatchObject({ status: 401 })
    expect(await getSyncConfig()).toMatchObject({ lastErrorStatus: 401 })
    expect(await db.plants.count()).toBe(2)
    expect(await db.outbox.count()).toBe(1)
  })

  it('invites for one household never grant access to another', async () => {
    const other = await post<DeviceCredentials>('/api/households', { serverCode: config.serverCode, householdName: 'Next door', deviceLabel: 'Ana' })
    const invite = await post<InviteResponse>('/api/invites', {}, other.token)
    const guest = await post<DeviceCredentials>('/api/join', { inviteCode: invite.code, deviceLabel: 'Guest' })
    expect(guest.household.name).toBe('Next door')
    const view = await post<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, guest.token)
    expect(view.plants).toEqual([])
  })
})
