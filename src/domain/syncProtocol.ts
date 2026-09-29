import type { CareEvent, Plant } from '../db/types.ts'

/*
 * Wire format between the app and the optional fronds sync server.
 * Shared by both sides (the server imports this file directly), so keep it
 * free of runtime dependencies. Changes must stay backward compatible: old
 * app versions keep talking to new servers and vice versa.
 *
 * Protocol 2: one server hosts several isolated households. Each phone has
 * its own device token (Bearer) that belongs to exactly one household.
 * Protocol-1 clients keep working: their shared household key is migrated
 * into a device token of the household it was used for.
 */

export const PROTOCOL_VERSION = 2

/** Public, unauthenticated: GET /api/server */
export interface ServerHello {
  app: 'fronds-server'
  version: string
  protocol: number
}

/** GET /api/info (authenticated) */
export interface ServerInfo extends ServerHello {
  vapidPublicKey: string
  timezone: string
  /** Protocol ≥ 2 */
  household?: { id: string; name: string }
  /** Protocol ≥ 2: this device's id on the server */
  deviceId?: string
}

/** POST /api/households — needs the server code the server owner shares. */
export interface CreateHouseholdRequest {
  serverCode: string
  householdName: string
  deviceLabel: string
}

/** POST /api/join — needs a one-time invite created by a household member. */
export interface JoinRequest {
  inviteCode: string
  deviceLabel: string
}

/** Response to create/join: the new device's credentials. */
export interface DeviceCredentials {
  token: string
  deviceId: string
  household: { id: string; name: string }
}

/** POST /api/invites */
export interface InviteResponse {
  code: string
  expiresAt: string
}

/** GET /api/devices */
export interface DeviceSummary {
  id: string
  label: string
  createdAt: string
  lastSeenAt?: string
  current: boolean
}

/** Client → server: records changed locally, plus how far the client has already pulled. */
export interface SyncRequest {
  cursor: number
  plants: Plant[]
  events: CareEvent[]
}

/**
 * Server → client: every record changed in this household since `cursor`,
 * plus the server's version of any pushed record that lost the merge (so
 * both sides converge even with clock skew). The client stores `cursor`.
 */
export interface SyncResponse {
  cursor: number
  plants: Plant[]
  events: CareEvent[]
}

export interface PushSubscribeRequest {
  deviceId: string
  label?: string
  /** "HH:MM" in the server's timezone. */
  time: string
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
}

export const isValidTime = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

/** Codes are shown to people: uppercase, no ambiguous characters, dashes ignored when typed. */
export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
