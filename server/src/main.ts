import webpush from 'web-push'
import { createApp, VERSION } from './app.ts'
import { loadConfig } from './config.ts'
import { runReminders, type Sender } from './reminders.ts'
import { Store } from './store.ts'

const config = await loadConfig()
const store = new Store(config.dataDir)
await store.load()

webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey)

const send: Sender = async (sub, payload) => {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload), { TTL: 12 * 3600, urgency: 'normal' })
    return 'sent'
  } catch (err) {
    // 404/410: the browser dropped this subscription (app uninstalled, permission revoked).
    if (err instanceof webpush.WebPushError && (err.statusCode === 404 || err.statusCode === 410)) return 'gone'
    console.error(`Push to ${sub.label ?? sub.deviceId} failed:`, err instanceof Error ? err.message : err)
    return 'failed'
  }
}

let ticking = false
setInterval(async () => {
  if (ticking) return
  ticking = true
  try {
    if (await runReminders(store.data, new Date(), send)) await store.save()
  } catch (err) {
    console.error('Reminder run failed:', err)
  } finally {
    ticking = false
  }
}, 30_000)

createApp(config, store, send).listen(config.port, () => {
  console.log(`fronds-server ${VERSION} listening on :${config.port} (timezone ${config.timezone})`)
  console.log(`Household key: ${config.key}`)
  console.log('Enter the server URL and this key in the app: Settings → Sync & reminders.')
})

const shutdown = async () => {
  await store.save()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
