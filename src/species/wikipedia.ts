import { db, nowISO } from '../db/db'
import type { WikiCacheEntry } from '../db/types'

/**
 * Wikipedia is the keyless source for descriptions and photos. Responses are
 * cached in IndexedDB so plant pages keep working offline.
 */

const API = 'https://en.wikipedia.org'
const CACHE_DAYS = 30

export interface WikiHit {
  title: string
  description?: string
}

export async function searchWikipedia(query: string, signal?: AbortSignal): Promise<WikiHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${query} plant`,
    gsrlimit: '6',
    prop: 'description',
  })
  const res = await fetch(`${API}/w/api.php?${params}`, { signal })
  if (!res.ok) throw new Error(`Wikipedia search failed (${res.status})`)
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; index: number; description?: string }> }
  }
  return Object.values(json.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .map(({ title, description }) => ({ title, description }))
}

export async function getWikiSummary(title: string): Promise<WikiCacheEntry | undefined> {
  const cached = await db.wikiCache.get(title)
  const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_DAYS * 86_400_000
  if (fresh || (cached && !navigator.onLine)) return cached

  try {
    const res = await fetch(`${API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
    if (!res.ok) return cached
    const json = (await res.json()) as {
      extract?: string
      thumbnail?: { source: string }
      content_urls?: { desktop?: { page?: string } }
    }
    const entry: WikiCacheEntry = {
      title,
      fetchedAt: nowISO(),
      extract: json.extract,
      thumbnail: json.thumbnail?.source,
      url: json.content_urls?.desktop?.page,
    }
    await db.wikiCache.put(entry)
    return entry
  } catch {
    return cached
  }
}
