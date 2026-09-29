import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dueReminder, testReminder } from '../../src/domain/reminders.ts'
import {
  isValidTime,
  PROTOCOL_VERSION,
  type CreateHouseholdRequest,
  type DeviceCredentials,
  type DeviceSummary,
  type InviteResponse,
  type JoinRequest,
  type PushSubscribeRequest,
  type ServerHello,
  type ServerInfo,
} from '../../src/domain/syncProtocol.ts'
import type { Config } from './config.ts'
import { localDate, localTime, plantsNeedingWater, type Sender } from './reminders.ts'
import { codesMatch, hashCode, hashSecret, newCode, newId, newToken } from './secrets.ts'
import { newHousehold, type Device, type Household, type Store } from './store.ts'
import { applySync, BadRequest, parseSyncRequest } from './sync.ts'

export const VERSION = '0.2.0'
const MAX_BODY = 30 * 1024 * 1024 // first sync uploads every plant photo
const INVITE_DAYS = 7
const MAX_CODE_FAILURES = 20 // per 10 minutes, across all clients
const LAST_SEEN_RESOLUTION_MS = 60 * 60_000

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

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

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim().slice(0, max)
  return t || undefined
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
    label: str(b.label, 100),
    subscription: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
  }
}

interface Session {
  household: Household
  device: Device
}

type Handler = (req: IncomingMessage, session: Session) => Promise<unknown>
type PublicHandler = (req: IncomingMessage) => Promise<unknown>

export function createApp(config: Config, store: Store, send: Sender) {
  /** Brute-force brake for server codes and invite codes. */
  let codeFailures: number[] = []
  const guardCodes = () => {
    const now = Date.now()
    codeFailures = codeFailures.filter((t) => now - t < 10 * 60_000)
    if (codeFailures.length >= MAX_CODE_FAILURES) throw new HttpError(429, 'Too many wrong codes — try again in a few minutes')
  }
  const codeFailed = (message: string): never => {
    codeFailures.push(Date.now())
    throw new HttpError(403, message)
  }

  const authenticate = (req: IncomingMessage): Session => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
    if (token) {
      const hash = hashSecret(token)
      for (const household of Object.values(store.data.households)) {
        for (const device of Object.values(household.devices)) {
          if (device.tokenHash === hash) return { household, device }
        }
      }
    }
    throw new HttpError(401, 'This phone is not (or no longer) part of a household on this server')
  }

  const addDevice = (household: Household, label: string): DeviceCredentials => {
    const token = newToken()
    const device: Device = { id: newId(), label, tokenHash: hashSecret(token), createdAt: new Date().toISOString() }
    household.devices[device.id] = device
    return { token, deviceId: device.id, household: { id: household.id, name: household.name } }
  }

  const hello = (): ServerHello => ({ app: 'fronds-server', version: VERSION, protocol: PROTOCOL_VERSION })

  const publicRoutes: Record<string, PublicHandler> = {
    'GET /api/health': async () => ({ ok: true }),
    'GET /api/server': async () => hello(),

    'POST /api/households': async (req) => {
      guardCodes()
      const b = (await readJson(req)) as Partial<CreateHouseholdRequest> | null
      const name = str(b?.householdName, 60)
      const label = str(b?.deviceLabel, 60) ?? 'Phone'
      if (!name || typeof b?.serverCode !== 'string') throw new HttpError(400, 'Household name and server code are required')
      if (!codesMatch(b.serverCode, config.serverCode)) codeFailed('Wrong server code')
      const household = newHousehold(name)
      store.data.households[household.id] = household
      const creds = addDevice(household, label)
      await store.save()
      return creds
    },

    'POST /api/join': async (req) => {
      guardCodes()
      const b = (await readJson(req)) as Partial<JoinRequest> | null
      if (typeof b?.inviteCode !== 'string') throw new HttpError(400, 'Invite code is required')
      const hash = hashCode(b.inviteCode)
      const household = Object.values(store.data.households).find((h) => h.invites[hash])
      const invite = household?.invites[hash]
      if (!household || !invite) return codeFailed('That invite is not valid — ask for a new one')
      delete household.invites[hash] // single use, even if expired
      if (Date.parse(invite.expiresAt) < Date.now()) {
        await store.save()
        throw new HttpError(403, 'That invite has expired — ask for a new one')
      }
      const creds = addDevice(household, str(b.deviceLabel, 60) ?? 'Phone')
      await store.save()
      return creds
    },
  }

  const routes: Record<string, Handler> = {
    'GET /api/info': async (_req, { household, device }): Promise<ServerInfo> => ({
      ...hello(),
      vapidPublicKey: config.vapid.publicKey,
      timezone: config.timezone,
      household: { id: household.id, name: household.name },
      deviceId: device.id,
    }),

    'POST /api/sync': async (req, { household }) => {
      const { response, changed } = applySync(household, parseSyncRequest(await readJson(req)))
      if (changed) await store.save()
      return response
    },

    'POST /api/invites': async (_req, { household, device }): Promise<InviteResponse> => {
      const now = new Date()
      // Drop expired invites while we're here.
      for (const [hash, inv] of Object.entries(household.invites)) if (Date.parse(inv.expiresAt) < now.getTime()) delete household.invites[hash]
      const code = newCode()
      const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString()
      household.invites[hashCode(code)] = { codeHash: hashCode(code), createdAt: now.toISOString(), expiresAt, createdBy: device.id }
      await store.save()
      return { code, expiresAt }
    },

    'GET /api/devices': async (_req, { household, device }): Promise<DeviceSummary[]> =>
      Object.values(household.devices)
        .map((d) => ({ id: d.id, label: d.label, createdAt: d.createdAt, lastSeenAt: d.lastSeenAt, current: d.id === device.id }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

    /** Remove a device from the household (any member may; removing yourself = leaving). */
    'POST /api/devices/remove': async (req, { household }) => {
      const b = (await readJson(req)) as { deviceId?: unknown } | null
      if (typeof b?.deviceId !== 'string' || !household.devices[b.deviceId]) throw new HttpError(404, 'No such device in this household')
      delete household.devices[b.deviceId]
      for (const [id, sub] of Object.entries(household.subscriptions)) if (sub.serverDeviceId === b.deviceId) delete household.subscriptions[id]
      await store.save()
      return { ok: true }
    },

    'POST /api/push/subscribe': async (req, { household, device }) => {
      const sub = parseSubscribe(await readJson(req))
      const existing = household.subscriptions[sub.deviceId]
      const now = new Date()
      // If today's reminder time already passed, start tomorrow instead of firing right away.
      const lastSentDate = sub.time <= localTime(now) ? localDate(now) : existing?.lastSentDate
      household.subscriptions[sub.deviceId] = {
        ...sub,
        serverDeviceId: device.id,
        createdAt: existing?.createdAt ?? now.toISOString(),
        lastSentDate,
      }
      await store.save()
      return { ok: true }
    },

    'POST /api/push/unsubscribe': async (req, { household }) => {
      const body = (await readJson(req)) as { deviceId?: unknown } | null
      if (typeof body?.deviceId !== 'string') throw new HttpError(400, 'Missing deviceId')
      delete household.subscriptions[body.deviceId]
      await store.save()
      return { ok: true }
    },

    'POST /api/push/test': async (req, { household }) => {
      const body = (await readJson(req)) as { deviceId?: unknown } | null
      const sub = typeof body?.deviceId === 'string' ? household.subscriptions[body.deviceId] : undefined
      if (!sub) throw new HttpError(404, 'This device has no reminders set up')
      const due = plantsNeedingWater(household, new Date())
      const result = await send(sub, due.length ? dueReminder(due) : testReminder())
      if (result === 'gone') {
        delete household.subscriptions[sub.deviceId]
        await store.save()
      }
      if (result !== 'sent') throw new HttpError(502, 'The push service rejected the notification')
      return { ok: true }
    },
  }

  const cors = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    if (config.allowedOrigins === '*') res.setHeader('Access-Control-Allow-Origin', '*')
    else if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
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

    const key = `${req.method} ${path}`
    try {
      let result: unknown
      if (publicRoutes[key]) {
        result = await publicRoutes[key](req)
      } else if (routes[key]) {
        const session = authenticate(req)
        const seen = Date.parse(session.device.lastSeenAt ?? '') || 0
        if (Date.now() - seen > LAST_SEEN_RESOLUTION_MS) {
          session.device.lastSeenAt = new Date().toISOString()
          void store.save()
        }
        result = await routes[key](req, session)
      } else {
        throw new HttpError(404, 'Not found')
      }
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
