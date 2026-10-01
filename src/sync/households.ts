import { takeSnapshot } from '../db/snapshots'
import { getSyncConfig, setSyncConfig, type SyncConfig } from '../db/syncState'
import {
  normaliseCode,
  type CreateHouseholdRequest,
  type DeviceCredentials,
  type DeviceSummary,
  type InviteResponse,
  type JoinRequest,
  type ServerHello,
} from '../domain/syncProtocol'
import { api, fetchServerInfo, normaliseServerUrl, runSync, SyncError } from './client'
import { disableReminders } from './push'

/*
 * A server hosts several households. Creating one needs the server code its
 * owner shares; joining one needs a one-time invite from a member. Every
 * phone gets its own token, so one phone can be removed without affecting
 * the others.
 */

async function checkServer(url: string) {
  let hello: ServerHello
  try {
    hello = await api<ServerHello>({ url }, '/api/server')
  } catch (err) {
    if (err instanceof SyncError && err.status === 404) {
      throw new SyncError("This fronds server is too old for households — update its Docker image first")
    }
    throw err
  }
  if (hello.app !== 'fronds-server') throw new SyncError("That address isn't a fronds server")
}

/** First sync with a new household: local data is snapshotted, then uploaded and merged. */
async function connect(url: string, creds: DeviceCredentials) {
  const { timezone } = await api<{ timezone: string }>({ url, key: creds.token }, '/api/info')
  await takeSnapshot(`Before joining household “${creds.household.name}”`)
  const config: SyncConfig = {
    url,
    key: creds.token,
    household: creds.household,
    serverDeviceId: creds.deviceId,
    cursor: 0,
    initialUploadDone: false,
    timezone,
  }
  await setSyncConfig(config)
  await runSync()
}

export async function createHousehold(urlInput: string, serverCode: string, householdName: string, deviceLabel: string) {
  const url = normaliseServerUrl(urlInput)
  await checkServer(url)
  const body: CreateHouseholdRequest = { serverCode, householdName: householdName.trim(), deviceLabel: deviceLabel.trim() }
  await connect(url, await api<DeviceCredentials>({ url }, '/api/households', body))
}

export async function joinHousehold(urlInput: string, inviteCode: string, deviceLabel: string) {
  const url = normaliseServerUrl(urlInput)
  await checkServer(url)
  const body: JoinRequest = { inviteCode, deviceLabel: deviceLabel.trim() }
  await connect(url, await api<DeviceCredentials>({ url }, '/api/join', body))
}

async function current() {
  const cfg = await getSyncConfig()
  if (!cfg) throw new SyncError('Not connected to a household')
  return cfg
}

/**
 * The server is now reached at a different address (e.g. it moved to another
 * tailnet). Only the address changes: this phone keeps its token, household,
 * sync position and reminders. The new address must answer for the same
 * household, so a typo or an empty new server can't take its place.
 */
export async function changeServerAddress(urlInput: string) {
  const cfg = await current()
  const url = normaliseServerUrl(urlInput)
  if (url === cfg.url) return
  let info
  try {
    info = await fetchServerInfo({ url, key: cfg.key })
  } catch (err) {
    if (err instanceof SyncError && err.status === 401) throw new SyncError(notThere(cfg))
    throw err
  }
  if (cfg.household && info.household?.id !== cfg.household.id) throw new SyncError(notThere(cfg))
  const latest = await current() // a sync may have moved the cursor meanwhile
  await setSyncConfig({
    ...latest,
    url,
    household: info.household ?? latest.household,
    timezone: info.timezone,
    lastError: undefined,
    lastErrorStatus: undefined,
  })
  await runSync().catch(() => undefined) // failures are recorded in the config and shown in Settings
}

const notThere = (cfg: SyncConfig) =>
  `${cfg.household ? `“${cfg.household.name}”` : 'Your household'} isn't on the server at that address. ` +
  "If you set up a new server, copy the old one's data folder to it first"

export async function createInvite(): Promise<InviteResponse & { link: string }> {
  const cfg = await current()
  const invite = await api<InviteResponse>(cfg, '/api/invites', {})
  return { ...invite, link: inviteLink(cfg.url, invite.code) }
}

const currentAppUrl = () => (typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`)

export function inviteLink(serverUrl: string, code: string, appUrl = currentAppUrl()) {
  return `${appUrl}#/settings?server=${encodeURIComponent(serverUrl)}&invite=${encodeURIComponent(code)}`
}

/** Accept a pasted invite link or a bare code. */
export function parseInvite(input: string): { code?: string; server?: string } {
  const text = input.trim()
  const query = text.includes('invite=') ? text.slice(text.indexOf('?') + 1) : undefined
  if (query) {
    const params = new URLSearchParams(query)
    return { code: params.get('invite') ?? undefined, server: params.get('server') ?? undefined }
  }
  return normaliseCode(text) ? { code: text } : {}
}

export async function listDevices(): Promise<DeviceSummary[]> {
  return api<DeviceSummary[]>(await current(), '/api/devices')
}

export async function removeDevice(deviceId: string) {
  await api(await current(), '/api/devices/remove', { deviceId })
}

/** Leave the household: this phone's token is revoked on the server; its plants stay on the phone. */
export async function leaveHousehold() {
  const cfg = await current()
  await disableReminders().catch(() => undefined)
  if (cfg.serverDeviceId) await api(cfg, '/api/devices/remove', { deviceId: cfg.serverDeviceId }).catch(() => undefined)
  await setSyncConfig(undefined)
}

export function defaultDeviceLabel() {
  const ua = navigator.userAgent
  if (/iPad/.test(ua)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet'
  return /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Device'
}
