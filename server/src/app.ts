import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isValidTime, PROTOCOL_VERSION, type PushSubscribeRequest, type ServerInfo } from '../../src/domain/syncProtocol.ts'
import type { Config } from './config.ts'
import { dueReminder, testReminder } from '../../src/domain/reminders.ts'
import { localDate, localTime, plantsNeedingWater, type Sender } from './reminders.ts'
import type { Store } from './store.ts'
import { applySync, BadRequest, parseSyncRequest } from './sync.ts'

export const VERSION = '0.1.0'
const MAX_BODY = 30 * 1024 * 1024 // first sync uploads every plant photo

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const digest = (s: string) => createHash('sha256').update(s).digest()

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'))
      } catch {
        reject(new HttpError(400, 'Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function parseSubscribe(body: unknown): PushSubscribeRequest {
  const b = body as Partial<PushSubscribeRequest> | null
  const s = b?.subscription
  if (
    !b ||
    typeof b.deviceId !== 'string' ||
    !isValidTime(b.time) ||
    !s ||
    typeof s.endpoint !== 'string' ||
    !/^https:\/\//.test(s.endpoint) ||
    typeof s.keys?.p256dh !== 'string' ||
    typeof s.keys?.auth !== 'string'
  ) {
    throw new HttpError(400, 'Invalid subscription')
  }
  return {
    deviceId: b.deviceId,
    time: b.time,
    label: typeof b.label === 'string' ? b.label.slice(0, 100) : undefined,
    subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
  }
}

export function createApp(config: Config, store: Store, send: Sender) {
  const keyDigest = digest(config.key)
  const authorized = (req: IncomingMessage) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
    return token !== undefined && timingSafeEqual(digest(token), keyDigest)
  }

  const cors = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    if (config.allowedOrigins === '*') res.setHeader('Access-Control-Allow-Origin', '*')
    else if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
  }

  const routes: Record<string, (req: IncomingMessage) => Promise<unknown>> = {
    'GET /api/health': async () => ({ ok: true }),

    'GET /api/info': async (): Promise<ServerInfo> => ({
      app: 'fronds-server',
      version: VERSION,
      protocol: PROTOCOL_VERSION,
      vapidPublicKey: config.vapid.publicKey,
      timezone: config.timezone,
    }),

    'POST /api/sync': async (req) => {
      const { response, changed } = applySync(store.data, parseSyncRequest(await readJson(req)))
      if (changed) await store.save()
      return response
    },

    'POST /api/push/subscribe': async (req) => {
      const sub = parseSubscribe(await readJson(req))
      const existing = store.data.subscriptions[sub.deviceId]
      const now = new Date()
      // If today's reminder time already passed, start tomorrow instead of firing right away.
      const lastSentDate = sub.time <= localTime(now) ? localDate(now) : existing?.lastSentDate
      store.data.subscriptions[sub.deviceId] = { ...sub, createdAt: existing?.createdAt ?? now.toISOString(), lastSentDate }
      await store.save()
      return { ok: true }
    },

    'POST /api/push/unsubscribe': async (req) => {
      const body = (await readJson(req)) as { deviceId?: unknown } | null
      if (typeof body?.deviceId !== 'string') throw new HttpError(400, 'Missing deviceId')
      delete store.data.subscriptions[body.deviceId]
      await store.save()
      return { ok: true }
    },

    'POST /api/push/test': async (req) => {
      const body = (await readJson(req)) as { deviceId?: unknown } | null
      const sub = typeof body?.deviceId === 'string' ? store.data.subscriptions[body.deviceId] : undefined
      if (!sub) throw new HttpError(404, 'This device has no reminders set up')
      const due = plantsNeedingWater(store.data, new Date())
      const payload = due.length ? dueReminder(due) : testReminder()
      const result = await send(sub, payload)
      if (result === 'gone') {
        delete store.data.subscriptions[sub.deviceId]
        await store.save()
      }
      if (result !== 'sent') throw new HttpError(502, 'The push service rejected the notification')
      return { ok: true }
    },
  }

  return createServer(async (req, res) => {
    cors(req, res)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Max-Age', '86400')
      // Chrome's Private/Local Network Access preflight (public site → tailnet/LAN address).
      if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true')
      res.writeHead(204).end()
      return
    }

    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('fronds sync server is running. Connect from the fronds app: Settings → Sync & reminders.\n')
      return
    }

    const handler = routes[`${req.method} ${path}`]
    try {
      if (!handler) throw new HttpError(404, 'Not found')
      if (path !== '/api/health' && !authorized(req)) throw new HttpError(401, 'Wrong or missing household key')
      const result = await handler(req)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
    } catch (err) {
      const status = err instanceof HttpError ? err.status : err instanceof BadRequest ? 400 : 500
      if (status === 500) console.error(err)
      const message = status === 500 ? 'Internal error' : (err as Error).message
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
    }
  })
}
