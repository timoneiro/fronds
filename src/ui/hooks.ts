import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, isLive } from '../db/db'
import type { CareEvent, Plant, WikiCacheEntry } from '../db/types'
import { findRelease, unseenReleases, type Release } from '../domain/changelog'
import { computeSchedule, type Schedule } from '../domain/watering'
import { getLastSeenVersion, markReleasesSeen, RELEASES } from '../lib/releases'
import { getWikiSummary } from '../species/wikipedia'

export interface PlantWithSchedule {
  plant: Plant
  schedule: Schedule
}

/** Everything in the collection, live. 10–50 plants: loading it all is fine. */
export function useGarden() {
  const plants = useLiveQuery(() => db.plants.toArray().then((ps) => ps.filter(isLive)), [])
  const events = useLiveQuery(() => db.events.toArray().then((es) => es.filter(isLive)), [])
  const today = useToday()

  const items = useMemo<PlantWithSchedule[] | undefined>(() => {
    if (!plants || !events) return undefined
    return plants
      .map((plant) => ({ plant, schedule: computeSchedule(plant, events, today) }))
      .sort((a, b) => a.schedule.daysUntilDue - b.schedule.daysUntilDue || a.plant.name.localeCompare(b.plant.name))
  }, [plants, events, today])

  return { items, events: events as CareEvent[] | undefined, loading: !items }
}

/** Re-renders at local midnight and when the app comes back to the foreground. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setToday((prev) => (prev.toDateString() === new Date().toDateString() ? prev : new Date()))
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(refresh, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])
  return today
}

export function useWikiSummary(title: string | undefined) {
  const [loaded, setLoaded] = useState<{ title: string; entry?: WikiCacheEntry }>()
  useEffect(() => {
    let cancelled = false
    if (title) getWikiSummary(title).then((entry) => !cancelled && setLoaded({ title, entry }))
    return () => {
      cancelled = true
    }
  }, [title])
  return loaded && loaded.title === title ? loaded.entry : undefined
}

/** Releases this device hasn't seen the notes for yet, newest first. */
export function useUnseenReleases(): Release[] {
  const state = useLiveQuery(async () => ({ lastSeen: await getLastSeenVersion(), hasPlants: (await db.plants.count()) > 0 }), [])
  const isNewInstall = state !== undefined && !state.lastSeen && !state.hasPlants
  useEffect(() => {
    // Nothing is "new" on a fresh install.
    if (isNewInstall) void markReleasesSeen()
  }, [isNewInstall])

  if (!state || isNewInstall) return []
  if (!state.lastSeen) {
    // Existing user updating from a version before "What's new": show just this release.
    const current = findRelease(RELEASES, __APP_VERSION__)
    return current ? [current] : []
  }
  return unseenReleases(RELEASES, state.lastSeen, __APP_VERSION__)
}
