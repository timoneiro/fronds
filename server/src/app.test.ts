import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Plant } from '../../src/db/types.ts'
import type { DeviceCredentials, DeviceSummary, InviteResponse, SyncResponse } from '../../src/domain/syncProtocol.ts'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import type { Sender } from './reminders.ts'
import { Store } from './store.ts'

const ORIGIN = 'https://timoneiro.github.io'
const send = vi.fn<Sender>().mockResolvedValue('sent')

async function startServer(dir: string, env: Record<string, string> = {}) {
  const config = await loadConfig({ DATA_DIR: dir, ALLOWED_ORIGINS: ORIGIN, ...env })
  const store = new Store(dir)
  await store.load(config.legacyKey)
  const server = createApp(config, store, send).listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const call = (path: string, body?: unknown, token?: string) =>
    fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const json = async <T>(path: string, body?: unknown, token?: string) => {
    const res = await call(path, body, token)
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(await res.json())}`)
    return (await res.json()) as T
  }
  return { config, store, base, call, json, close: () => server.close() }
}

const plant = (id: string, name: string): Plant => ({
  id,
  name,
  wateringIntervalDays: 7,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('fronds-server: households', () => {
  let dir: string
  let s: Awaited<ReturnType<typeof startServer>>
  let home: DeviceCredentials // Ricardo's phone
  let neighbour: DeviceCredentials // another household on the same server

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fronds-server-'))
    s = await startServer(dir)
  })
  afterAll(async () => {
    s.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('generates a server code once and keeps it (and the push keys) across restarts', async () => {
    const secrets = JSON.parse(await readFile(join(dir, 'secrets.json'), 'utf8'))
    expect(secrets.serverCode).toBe(s.config.serverCode)
    expect(s.config.serverCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    const again = await loadConfig({ DATA_DIR: dir })
    expect(again.serverCode).toBe(s.config.serverCode)
    expect(again.vapid.publicKey).toBe(s.config.vapid.publicKey)
  })

  it('public endpoints identify the server; everything else needs a device token', async () => {
    expect(await s.json('/api/server')).toMatchObject({ app: 'fronds-server', protocol: 2 })
    expect((await s.call('/api/info')).status).toBe(401)
    expect((await s.call('/api/info', undefined, 'made-up')).status).toBe(401)
  })

  it('creating a household needs the server code (typed loosely is fine)', async () => {
    const bad = await s.call('/api/households', { serverCode: 'NOPE-NOPE-NOPE', householdName: 'Mine', deviceLabel: 'x' })
    expect(bad.status).toBe(403)

    const loose = s.config.serverCode.toLowerCase().replace(/-/g, ' ')
    home = await s.json<DeviceCredentials>('/api/households', { serverCode: loose, householdName: 'Casa', deviceLabel: "Ricardo's phone" })
    expect(home.household.name).toBe('Casa')
    neighbour = await s.json<DeviceCredentials>('/api/households', { serverCode: s.config.serverCode, householdName: 'Next door', deviceLabel: 'Ana' })
    expect(neighbour.household.id).not.toBe(home.household.id)

    const info = await s.json('/api/info', undefined, home.token)
    expect(info).toMatchObject({ household: { name: 'Casa' }, deviceId: home.deviceId, vapidPublicKey: s.config.vapid.publicKey })
  })

  it('never stores device tokens in plain text', async () => {
    await s.store.save()
    const onDisk = await readFile(join(dir, 'store.json'), 'utf8')
    expect(onDisk).not.toContain(home.token)
    expect(onDisk).not.toContain(neighbour.token)
  })

  it('keeps households isolated', async () => {
    await s.json('/api/sync', { cursor: 0, plants: [plant('p-home', 'Monstera')], events: [] }, home.token)
    await s.json('/api/sync', { cursor: 0, plants: [plant('p-next', 'Cactus')], events: [] }, neighbour.token)

    const homeView = await s.json<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, home.token)
    expect(homeView.plants.map((p) => p.name)).toEqual(['Monstera'])
    const nextView = await s.json<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, neighbour.token)
    expect(nextView.plants.map((p) => p.name)).toEqual(['Cactus'])

    // Same record id pushed by another household doesn't touch ours.
    await s.json('/api/sync', { cursor: 0, plants: [{ ...plant('p-home', 'Hijacked'), updatedAt: '2099-01-01T00:00:00Z' }], events: [] }, neighbour.token)
    const again = await s.json<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, home.token)
    expect(again.plants.map((p) => p.name)).toEqual(['Monstera'])
  })

  it('adds more phones to a household with one-time invites', async () => {
    const invite = await s.json<InviteResponse>('/api/invites', {}, home.token)
    expect(invite.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)

    const tablet = await s.json<DeviceCredentials>('/api/join', { inviteCode: invite.code, deviceLabel: 'Tablet' })
    expect(tablet.household.id).toBe(home.household.id)
    const view = await s.json<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, tablet.token)
    expect(view.plants.map((p) => p.name)).toEqual(['Monstera'])

    const reused = await s.call('/api/join', { inviteCode: invite.code, deviceLabel: 'Someone else' })
    expect(reused.status).toBe(403)

    const devices = await s.json<DeviceSummary[]>('/api/devices', undefined, home.token)
    expect(devices.map((d) => [d.label, d.current])).toEqual([
      ["Ricardo's phone", true],
      ['Tablet', false],
    ])
  })

  it('rejects expired invites', async () => {
    const invite = await s.json<InviteResponse>('/api/invites', {}, home.token)
    const household = s.store.data.households[home.household.id]
    for (const inv of Object.values(household.invites)) inv.expiresAt = '2000-01-01T00:00:00Z'
    expect((await s.call('/api/join', { inviteCode: invite.code, deviceLabel: 'Late' })).status).toBe(403)
  })

  it('removing a device revokes it immediately and drops its reminders', async () => {
    const invite = await s.json<InviteResponse>('/api/invites', {}, home.token)
    const lost = await s.json<DeviceCredentials>('/api/join', { inviteCode: invite.code, deviceLabel: 'Lost phone' })
    const subscription = { endpoint: 'https://push.example/lost', keys: { p256dh: 'p', auth: 'a' } }
    await s.json('/api/push/subscribe', { deviceId: 'client-lost', time: '08:00', subscription }, lost.token)

    // A device from another household can't remove it.
    expect((await s.call('/api/devices/remove', { deviceId: lost.deviceId }, neighbour.token)).status).toBe(404)

    await s.json('/api/devices/remove', { deviceId: lost.deviceId }, home.token)
    expect((await s.call('/api/info', undefined, lost.token)).status).toBe(401)
    expect(s.store.data.households[home.household.id].subscriptions['client-lost']).toBeUndefined()
  })

  it('sends a test push only to the asking household', async () => {
    const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }
    await s.json('/api/push/subscribe', { deviceId: 'client-1', time: '08:30', subscription }, home.token)
    expect((await s.call('/api/push/test', { deviceId: 'client-1' }, home.token)).status).toBe(200)
    expect((await s.call('/api/push/test', { deviceId: 'client-1' }, neighbour.token)).status).toBe(404)
    expect((await s.call('/api/push/subscribe', { deviceId: 'd2', time: '25:00', subscription }, home.token)).status).toBe(400)
  })

  it('answers CORS and private-network preflights for the allowed origin only', async () => {
    const pre = await fetch(`${s.base}/api/sync`, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Private-Network': 'true' },
    })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(pre.headers.get('access-control-allow-private-network')).toBe('true')
    const other = await fetch(`${s.base}/api/health`, { headers: { Origin: 'https://evil.example' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects malformed sync payloads with 400', async () => {
    expect((await s.call('/api/sync', { cursor: 0, plants: [{ nope: 1 }], events: [] }, home.token)).status).toBe(400)
  })

  it('slows down code guessing', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await s.call('/api/join', { inviteCode: `GUESS-${i}`, deviceLabel: 'x' })).status)
    expect(statuses).toContain(429)
  })
})

describe('upgrading a server 0.1 data folder', () => {
  it('turns the single household into "Home" and keeps its old key working', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fronds-legacy-'))
    const legacyKey = 'old-shared-household-key-from-0-1'
    await writeFile(join(dir, 'secrets.json'), JSON.stringify({ key: legacyKey, vapidPublicKey: 'BPUB', vapidPrivateKey: 'priv' }))
    await writeFile(
      join(dir, 'store.json'),
      JSON.stringify({ version: 1, seq: 1, plants: { p1: { seq: 1, rec: plant('p1', 'Old monstera') } }, events: {}, subscriptions: {} }),
    )

    const s = await startServer(dir)
    try {
      expect(s.config.vapid.publicKey).toBe('BPUB') // push keys untouched
      const view = await s.json<SyncResponse>('/api/sync', { cursor: 0, plants: [], events: [] }, legacyKey)
      expect(view.plants.map((p) => p.name)).toEqual(['Old monstera'])
      expect(await s.json('/api/info', undefined, legacyKey)).toMatchObject({ household: { name: 'Home' } })

      const backup = JSON.parse(await readFile(join(dir, 'backups', 'store-before-households-upgrade.json'), 'utf8'))
      expect(backup.version).toBe(1)
      expect(JSON.parse(await readFile(join(dir, 'store.json'), 'utf8')).version).toBe(2)
    } finally {
      s.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('an empty 0.1 server just starts fresh', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fronds-legacy-empty-'))
    await writeFile(join(dir, 'secrets.json'), JSON.stringify({ key: 'k', vapidPublicKey: 'B', vapidPrivateKey: 'p' }))
    const s = await startServer(dir)
    try {
      expect(Object.keys(s.store.data.households)).toHaveLength(0)
      expect((await s.call('/api/info', undefined, 'k')).status).toBe(401)
    } finally {
      s.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
