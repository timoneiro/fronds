import { findByScientificName, norm, type Species } from './catalog'

/**
 * iNaturalist's public read API (no key, CORS open) finds plants by common
 * name in any language. Only the search term is sent.
 */

const API = 'https://api.inaturalist.org/v1/taxa/autocomplete'
const PLANTAE = 47126
const MAX_HITS = 5

export interface INatHit {
  scientificName: string
  commonName?: string
  /** The name the query matched, unless it is just the scientific name. */
  searchedName?: string
  species?: Species
}

interface INatTaxon {
  name: string
  rank_level: number
  preferred_common_name?: string
  matched_term?: string
}

export function parseINatResponse(json: unknown): INatHit[] {
  const results = (json as { results?: INatTaxon[] } | null)?.results ?? []
  return results
    .filter((t) => typeof t.name === 'string' && t.rank_level <= 20)
    .slice(0, MAX_HITS)
    .map((t) => ({
      scientificName: t.name,
      commonName: t.preferred_common_name || undefined,
      searchedName: t.matched_term && norm(t.matched_term) !== norm(t.name) ? t.matched_term : undefined,
      species: findByScientificName(t.name),
    }))
}

export async function searchINaturalist(query: string, signal?: AbortSignal): Promise<INatHit[]> {
  const params = new URLSearchParams({
    q: query,
    taxon_id: String(PLANTAE),
    is_active: 'true',
    locale: 'en',
    per_page: '10',
  })
  const res = await fetch(`${API}?${params}`, { signal })
  if (!res.ok) throw new Error(`iNaturalist search failed (${res.status})`)
  return parseINatResponse(await res.json())
}
