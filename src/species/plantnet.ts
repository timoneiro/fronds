/**
 * Pl@ntNet identification client. Needs the user's own API key (optional add-on).
 * A failed request still uses one of the day's free identifications, so never retry automatically.
 */

import { findByScientificName, type Species } from './catalog'

const ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all'

export interface PlantNetMatch {
  scientificName: string
  commonName?: string
  score: number
  species?: Species
}

export type PlantNetErrorKind = 'not-a-plant' | 'bad-key' | 'quota' | 'network'

export class PlantNetError extends Error {
  kind: PlantNetErrorKind
  constructor(kind: PlantNetErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'PlantNetError'
    this.kind = kind
  }
}

interface RawResult {
  score?: unknown
  species?: { scientificNameWithoutAuthor?: unknown; commonNames?: unknown }
}

export function parsePlantNetResponse(json: unknown): PlantNetMatch[] {
  const results = (json as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const matches: PlantNetMatch[] = []
  for (const r of results as RawResult[]) {
    const name = r?.species?.scientificNameWithoutAuthor
    if (typeof name !== 'string' || !name) continue
    const score = typeof r.score === 'number' ? r.score : 0
    const names = r.species?.commonNames
    const first = Array.isArray(names) && typeof names[0] === 'string' ? names[0] : undefined
    matches.push({
      scientificName: name,
      commonName: first || undefined,
      score,
      species: findByScientificName(name),
    })
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 3)
}

export async function identifyPlant(
  image: Blob,
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlantNetMatch[]> {
  const url = `${ENDPOINT}?api-key=${encodeURIComponent(apiKey)}&lang=en&nb-results=3`
  const body = new FormData()
  body.append('images', image, 'photo.jpg')
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', body, signal })
  } catch {
    throw new PlantNetError('network')
  }
  if (res.status === 404) throw new PlantNetError('not-a-plant')
  if (res.status === 401 || res.status === 403) throw new PlantNetError('bad-key')
  if (res.status === 429) throw new PlantNetError('quota')
  if (!res.ok) throw new PlantNetError('network')
  try {
    return parsePlantNetResponse(await res.json())
  } catch {
    throw new PlantNetError('network')
  }
}
