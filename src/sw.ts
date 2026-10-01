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
 * (precache the app, cache Wikipedia images) and adds push reminders. It must
 * stay at /sw.js with the same scope so installed apps update in place.
 *
 * A new version waits until the page asks it to take over (src/lib/updates.ts),
 * or until no page runs the old one. Until then the old version keeps serving
 * its own files and handling reminders.
 */

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Wikipedia serves thumbnails from thumb.wikimedia.org; summaries cached before that still use upload.
const WIKI_IMAGE_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org']
registerRoute(
  ({ url }) => WIKI_IMAGE_HOSTS.includes(url.hostname),
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
