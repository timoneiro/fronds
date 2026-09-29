/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import type { ReminderPayload } from './domain/reminders'
import { resolveReminder } from './sync/reminderCheck'

declare const self: ServiceWorkerGlobalScope

/*
 * Service worker. Keeps the same behaviour the generated one had in v0.1
 * (precache the app, auto-update, cache Wikipedia images) and adds push
 * reminders. It must stay at /sw.js with the same scope so installed apps
 * update in place.
 */

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ url }) => url.hostname === 'upload.wikimedia.org',
  new CacheFirst({
    cacheName: 'wiki-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 }),
    ],
  }),
)

self.addEventListener('push', (event) => {
  const show = async () => {
    let payload: ReminderPayload
    try {
      payload = await resolveReminder(event.data?.json() as ReminderPayload)
    } catch {
      payload = (event.data?.json() as ReminderPayload | undefined) ?? { kind: 'test', title: 'fronds', body: '', url: '#/', tag: 'fronds' }
    }
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: payload.url },
    })
  }
  event.waitUntil(show())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? '', self.registration.scope).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope))
      if (existing) {
        await existing.focus()
        if ('navigate' in existing) await existing.navigate(target).catch(() => undefined)
      } else {
        await self.clients.openWindow(target)
      }
    })(),
  )
})
