import type { Plant } from '../db/types.ts'
import { addDays, daysBetween, MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS, startOfDay } from './watering.ts'

/*
 * Read-only share links: a snapshot of a collection packed into the URL
 * fragment (#/view/<data>), so it never reaches a server. A sent link can't
 * be changed or taken back, so every format version ever shipped must keep
 * decoding: add a new version instead of changing an old one.
 *
 * Wire format 1 (JSON, before compression):
 *   [1, sharedOn "YYYY-MM-DD", sharedBy, rooms[], plants[]]
 * where each plant is
 *   [name, wateringIntervalDays, roomIndex, speciesId, speciesName, lastWateredDaysAgo, notes]
 * with null for anything missing and trailing nulls dropped.
 */

export const SHARE_FORMAT = 1

export interface SharedPlant {
  name: string
  wateringIntervalDays: number
  room?: string
  speciesId?: string
  speciesName?: string
  /** Whole days between the last watering and the day the link was made. */
  lastWateredDaysAgo?: number
  notes?: string
}

export interface SharedCollection {
  /** Local date the link was made, "YYYY-MM-DD". */
  sharedOn: string
  sharedBy?: string
  plants: SharedPlant[]
}

export interface ShareOptions {
  sharedBy?: string
  /** Rooms to leave out ("" = plants without a room). */
  excludeRooms?: string[]
  includeWatering: boolean
  includeNotes: boolean
}

export class ShareError extends Error {}

const LIMITS = { plants: 500, name: 200, notes: 2000, sharedBy: 60 }

export const roomOf = (plant: Pick<Plant, 'room'>) => plant.room?.trim() ?? ''

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Local midnight of a "YYYY-MM-DD" date. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Snapshot of the plants to share. Photos, history and ids are never included. */
export function buildShare(
  items: { plant: Plant; lastWateredAt?: Date }[],
  options: ShareOptions,
  now = new Date(),
): SharedCollection {
  const excluded = new Set(options.excludeRooms ?? [])
  const plants = items
    .filter(({ plant }) => !excluded.has(roomOf(plant)))
    .sort((a, b) => a.plant.name.localeCompare(b.plant.name))
    .map(({ plant, lastWateredAt }): SharedPlant => ({
      name: plant.name,
      wateringIntervalDays: plant.wateringIntervalDays,
      room: roomOf(plant) || undefined,
      speciesId: plant.speciesId,
      speciesName: plant.speciesId ? undefined : plant.speciesName,
      lastWateredDaysAgo:
        options.includeWatering && lastWateredAt ? Math.max(0, daysBetween(lastWateredAt, now)) : undefined,
      notes: options.includeNotes ? plant.notes?.trim() || undefined : undefined,
    }))
  return { sharedOn: isoDay(now), sharedBy: options.sharedBy?.trim() || undefined, plants }
}

const dropTrailingNulls = (row: unknown[]) => {
  while (row.length && row[row.length - 1] === null) row.pop()
  return row
}

export function encodeShare(share: SharedCollection): unknown[] {
  const rooms = [...new Set(share.plants.map((p) => p.room).filter((r): r is string => Boolean(r)))]
  return [
    SHARE_FORMAT,
    share.sharedOn,
    share.sharedBy ?? null,
    rooms,
    share.plants.map((p) =>
      dropTrailingNulls([
        p.name,
        p.wateringIntervalDays,
        p.room ? rooms.indexOf(p.room) : null,
        p.speciesId ?? null,
        p.speciesName ?? null,
        p.lastWateredDaysAgo ?? null,
        p.notes ?? null,
      ]),
    ),
  ]
}

const optString = (v: unknown, max: number): string | undefined => {
  if (v === null || v === undefined) return undefined
  if (typeof v !== 'string') throw new ShareError('Invalid share link')
  return v.slice(0, max) || undefined
}

const optInt = (v: unknown, min: number, max: number): number | undefined => {
  if (v === null || v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ShareError('Invalid share link')
  return v
}

/** Validates untrusted link data: anyone can craft a link. */
export function decodeShare(raw: unknown): SharedCollection {
  if (!Array.isArray(raw) || typeof raw[0] !== 'number') throw new ShareError('Invalid share link')
  if (raw[0] > SHARE_FORMAT) throw new ShareError('This link was made by a newer version of fronds. Update the app to open it.')
  if (raw[0] !== 1) throw new ShareError('Invalid share link')

  const [, sharedOn, sharedBy, rooms, plants] = raw
  if (typeof sharedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sharedOn)) throw new ShareError('Invalid share link')
  if (!Array.isArray(rooms) || !rooms.every((r) => typeof r === 'string')) throw new ShareError('Invalid share link')
  if (!Array.isArray(plants) || plants.length > LIMITS.plants) throw new ShareError('Invalid share link')

  return {
    sharedOn,
    sharedBy: optString(sharedBy, LIMITS.sharedBy),
    plants: plants.map((row): SharedPlant => {
      if (!Array.isArray(row)) throw new ShareError('Invalid share link')
      const [name, interval, roomIndex, speciesId, speciesName, lastWateredDaysAgo, notes] = row
      const plantName = optString(name, LIMITS.name)
      const days = optInt(interval, MIN_INTERVAL_DAYS, 365)
      if (!plantName || days === undefined) throw new ShareError('Invalid share link')
      const roomAt = optInt(roomIndex, 0, rooms.length - 1)
      return {
        name: plantName,
        wateringIntervalDays: days,
        room: roomAt === undefined ? undefined : (rooms[roomAt] as string),
        speciesId: optString(speciesId, 100),
        speciesName: optString(speciesName, LIMITS.name),
        lastWateredDaysAgo: optInt(lastWateredDaysAgo, 0, 100_000),
        notes: optString(notes, LIMITS.notes),
      }
    }),
  }
}

export interface ProjectedDue {
  dueDate: Date
  daysUntilDue: number
  status: 'today' | 'soon' | 'ok'
}

/**
 * When a shared plant is next due, as seen on `today`. The link is a snapshot,
 * so dates after it assume the owner kept to the schedule: a due date that has
 * passed rolls forward by the interval. Undefined without watering dates.
 */
export function projectDue(plant: SharedPlant, sharedOn: string, today = new Date()): ProjectedDue | undefined {
  if (plant.lastWateredDaysAgo === undefined) return undefined
  const day = startOfDay(today)
  const interval = plant.wateringIntervalDays
  let dueDate = addDays(parseDay(sharedOn), interval - plant.lastWateredDaysAgo)
  const behind = daysBetween(dueDate, day)
  if (behind > 0) dueDate = addDays(dueDate, Math.ceil(behind / interval) * interval)
  const daysUntilDue = daysBetween(day, dueDate)
  return { dueDate, daysUntilDue, status: daysUntilDue === 0 ? 'today' : daysUntilDue <= 2 ? 'soon' : 'ok' }
}

/** Interval to use when copying a shared plant into your own collection. */
export const clampInterval = (days: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, days))
