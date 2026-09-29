import type { CareEvent, Plant } from '../db/types.ts'

/*
 * Wire format between the app and the optional fronds sync server.
 * Shared by both sides (the server imports this file directly), so keep it
 * free of runtime dependencies. Changes must stay backward compatible: old
 * app versions keep talking to new servers and vice versa.
 */

export const PROTOCOL_VERSION = 1

export interface ServerInfo {
  app: 'fronds-server'
  version: string
  protocol: number
  vapidPublicKey: string
  timezone: string
}

/** Client → server: records changed locally, plus how far the client has already pulled. */
export interface SyncRequest {
  cursor: number
  plants: Plant[]
  events: CareEvent[]
}

/**
 * Server → client: every record changed on the server since `cursor`, plus
 * the server's version of any pushed record that lost the merge (so both
 * sides converge even with clock skew). The client stores the new `cursor`.
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
