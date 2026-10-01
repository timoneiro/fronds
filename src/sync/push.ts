import { getDeviceId, getReminderConfig, getSyncConfig, setReminderConfig } from '../db/syncState'
import type { PushSubscribeRequest } from '../domain/syncProtocol'
import { inIosBrowser } from '../lib/platform'
import { api, fetchServerInfo, SyncError } from './client'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iOS only allows web push for apps added to the home screen. */
export const needsHomeScreenInstall = inIosBrowser

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function deviceLabel() {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Device'
  return `${os} · ${new Date().toLocaleDateString()}`
}

async function requireServer() {
  const cfg = await getSyncConfig()
  if (!cfg) throw new SyncError('Connect a sync server first')
  return cfg
}

export async function enableReminders(time: string) {
  const cfg = await requireServer()
  if (!pushSupported()) throw new SyncError("This browser doesn't support push notifications")
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new SyncError('Notifications are blocked for this app — allow them in your browser/phone settings')
  }
  const { vapidPublicKey } = await fetchServerInfo(cfg)
  const registration = await navigator.serviceWorker.ready
  const applicationServerKey = base64UrlToBytes(vapidPublicKey)

  let subscription = await registration.pushManager.getSubscription()
  const sameKey =
    subscription?.options.applicationServerKey &&
    new Uint8Array(subscription.options.applicationServerKey).join() === applicationServerKey.join()
  if (subscription && !sameKey) {
    await subscription.unsubscribe() // subscribed to a different server before
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })

  const body: PushSubscribeRequest = {
    deviceId: await getDeviceId(),
    label: deviceLabel(),
    time,
    subscription: subscription.toJSON() as PushSubscribeRequest['subscription'],
  }
  await api(cfg, '/api/push/subscribe', body)
  await setReminderConfig({ enabled: true, time })
}

export async function disableReminders() {
  const cfg = await getSyncConfig()
  if (cfg) await api(cfg, '/api/push/unsubscribe', { deviceId: await getDeviceId() }).catch(() => undefined)
  if (pushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration()
    await (await registration?.pushManager.getSubscription())?.unsubscribe()
  }
  const time = (await getReminderConfig())?.time ?? '09:00'
  await setReminderConfig({ enabled: false, time })
}

export async function sendTestReminder() {
  const cfg = await requireServer()
  await api(cfg, '/api/push/test', { deviceId: await getDeviceId() })
}
