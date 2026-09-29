import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db/db'
import { getSyncConfig } from '../db/syncState'
import { runSync } from './client'

const PERIODIC_MS = 5 * 60_000
const DEBOUNCE_MS = 1500

// Failures are recorded in the sync config (shown in Settings); nothing to do here.
const syncQuietly = () => void runSync().catch(() => undefined)

/** Keep this device in sync while the app is open. No-op unless a server is connected. */
export function useAutoSync() {
  const connected = useLiveQuery(async () => Boolean(await getSyncConfig()), [])
  const pending = useLiveQuery(() => db.outbox.count(), [])

  useEffect(() => {
    if (!connected) return
    syncQuietly()
    const onVisible = () => document.visibilityState === 'visible' && syncQuietly()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', syncQuietly)
    const timer = setInterval(syncQuietly, PERIODIC_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', syncQuietly)
      clearInterval(timer)
    }
  }, [connected])

  // Push local edits shortly after they happen.
  useEffect(() => {
    if (!connected || !pending) return
    const timer = setTimeout(syncQuietly, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [connected, pending])
}
