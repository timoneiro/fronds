import { mkdtemp, readFile, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Plant } from '../../src/db/types.ts'
import type { SyncResponse } from '../../src/domain/syncProtocol.ts'
import { createApp } from './app.ts'
import { loadConfig, type Config } from './config.ts'
import type { Sender } from './reminders.ts'
import { Store } from './store.ts'

let dir: string
let base: string
let config: Config
let close: () => void
const send = vi.fn<Sender>().mockResolvedValue('sent')

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fronds-server-'))
  config = await loadConfig({ DATA_DIR: dir, ALLOWED_ORIGINS: 'https://timoneiro.github.io' })
  const store = new Store(dir)
  await store.load()
  const server = createApp(config, store, send).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => server.close()
})

afterAll(async () => {
  close()
  await rm(dir, { recursive: true, force: true })
})

const call = (path: string, init: RequestInit = {}, key = config.key) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, Origin: 'https://timoneiro.github.io', ...init.headers },
  })

const plant: Plant = { id: 'p1', name: 'Monstera', wateringIntervalDays: 7, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }

describe('fronds-server HTTP API', () => {
  it('generates and persists a household key and VAPID keys', async () => {
    const secrets = JSON.parse(await readFile(join(dir, 'secrets.json'), 'utf8'))
    expect(secrets.key).toBe(config.key)
    expect(config.key.length).toBeGreaterThanOrEqual(32)
    expect((await loadConfig({ DATA_DIR: dir })).key).toBe(config.key)
  })

  it('health is public, everything else needs the key', async () => {
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
    expect((await call('/api/info', {}, 'wrong')).status).toBe(401)
    const info = await (await call('/api/info')).json()
    expect(info).toMatchObject({ app: 'fronds-server', protocol: 1, vapidPublicKey: config.vapid.publicKey })
  })

  it('answers CORS and private-network preflights for the allowed origin only', async () => {
    const pre = await fetch(`${base}/api/sync`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://timoneiro.github.io', 'Access-Control-Request-Private-Network': 'true' },
    })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://timoneiro.github.io')
    expect(pre.headers.get('access-control-allow-private-network')).toBe('true')
    const other = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('syncs between two devices and persists to disk', async () => {
    const pushA = await call('/api/sync', { method: 'POST', body: JSON.stringify({ cursor: 0, plants: [plant], events: [] }) })
    const a = (await pushA.json()) as SyncResponse
    expect(a.cursor).toBe(1)

    const b = (await (await call('/api/sync', { method: 'POST', body: JSON.stringify({ cursor: 0, plants: [], events: [] }) })).json()) as SyncResponse
    expect(b.plants).toEqual([plant])

    const onDisk = JSON.parse(await readFile(join(dir, 'store.json'), 'utf8'))
    expect(onDisk.plants.p1.rec.name).toBe('Monstera')
  })

  it('rejects malformed sync payloads with 400', async () => {
    const res = await call('/api/sync', { method: 'POST', body: JSON.stringify({ cursor: 0, plants: [{ nope: 1 }], events: [] }) })
    expect(res.status).toBe(400)
    expect((await call('/api/sync', { method: 'POST', body: '{not json' })).status).toBe(400)
  })

  it('registers a device for reminders and sends a test push', async () => {
    const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }
    const ok = await call('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ deviceId: 'd1', time: '08:30', subscription }) })
    expect(ok.status).toBe(200)
    expect((await call('/api/push/test', { method: 'POST', body: JSON.stringify({ deviceId: 'd1' }) })).status).toBe(200)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'd1', time: '08:30' }), expect.any(Object))

    const bad = await call('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ deviceId: 'd2', time: '25:00', subscription }) })
    expect(bad.status).toBe(400)

    await call('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ deviceId: 'd1' }) })
    expect((await call('/api/push/test', { method: 'POST', body: JSON.stringify({ deviceId: 'd1' }) })).status).toBe(404)
  })
})
