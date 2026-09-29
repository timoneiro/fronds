import type { SyncMeta } from '../../src/db/types.ts'
import { assertRecords, BackupError } from '../../src/domain/backup.ts'
import type { SyncRequest, SyncResponse } from '../../src/domain/syncProtocol.ts'
import type { Stored, StoreData } from './store.ts'

export class BadRequest extends Error {}

const MAX_RECORDS = 50_000

export function parseSyncRequest(body: unknown): SyncRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('Expected a JSON object')
  const { cursor, plants, events } = body as Record<string, unknown>
  if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) throw new BadRequest('Invalid cursor')
  if (!Array.isArray(plants) || !Array.isArray(events)) throw new BadRequest('Expected plants and events arrays')
  if (plants.length + events.length > MAX_RECORDS) throw new BadRequest('Too many records in one sync')
  try {
    assertRecords(plants, events)
  } catch (err) {
    throw new BadRequest(err instanceof BackupError ? err.message : 'Invalid records')
  }
  return body as SyncRequest
}

function mergeTable<T extends SyncMeta>(
  table: Record<string, Stored<T>>,
  incoming: T[],
  nextSeq: () => number,
): { accepted: Set<string>; losers: T[] } {
  const accepted = new Set<string>()
  const losers: T[] = []
  for (const rec of incoming) {
    const current = table[rec.id]
    if (!current || rec.updatedAt > current.rec.updatedAt) {
      table[rec.id] = { rec, seq: nextSeq() }
      accepted.add(rec.id)
    } else if (rec.updatedAt < current.rec.updatedAt) {
      losers.push(current.rec)
    }
  }
  return { accepted, losers }
}

function changesSince<T extends SyncMeta>(
  table: Record<string, Stored<T>>,
  cursor: number,
  accepted: Set<string>,
  losers: T[],
): T[] {
  const out = new Map<string, T>()
  for (const { rec, seq } of Object.values(table)) {
    // Skip records the client just sent us — it already has exactly that version.
    if (seq > cursor && !accepted.has(rec.id)) out.set(rec.id, rec)
  }
  for (const rec of losers) out.set(rec.id, rec)
  return [...out.values()]
}

/**
 * Record-level last-writer-wins merge, the same rule as backup import.
 * Mutates `data`; returns whether anything changed so the caller can persist.
 */
export function applySync(data: StoreData, req: SyncRequest): { response: SyncResponse; changed: boolean } {
  const before = data.seq
  const nextSeq = () => ++data.seq
  const p = mergeTable(data.plants, req.plants, nextSeq)
  const e = mergeTable(data.events, req.events, nextSeq)
  return {
    changed: data.seq !== before,
    response: {
      cursor: data.seq,
      plants: changesSince(data.plants, req.cursor, p.accepted, p.losers),
      events: changesSince(data.events, req.cursor, e.accepted, e.losers),
    },
  }
}
