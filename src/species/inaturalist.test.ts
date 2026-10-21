import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseINatResponse, searchINaturalist } from './inaturalist'

const sample = {
  results: [
    {
      name: 'Monstera deliciosa',
      rank: 'species',
      rank_level: 10,
      preferred_common_name: 'Swiss Cheese Plant',
      matched_term: 'Costela-de-adão',
    },
    {
      name: 'Thaumatophyllum bipinnatifidum',
      rank: 'species',
      rank_level: 10,
      preferred_common_name: 'Tree Philodendron',
      matched_term: 'Costela-de-adão',
    },
  ],
}

function stubFetch(status: number, body: unknown = sample) {
  const fn = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('parseINatResponse', () => {
  it('maps the costela-de-adão sample to catalog species', () => {
    const hits = parseINatResponse(sample)
    expect(hits).toHaveLength(2)
    expect(hits.map((h) => h.searchedName)).toEqual(['Costela-de-adão', 'Costela-de-adão'])
    expect(hits.map((h) => h.species?.id)).toEqual(['monstera-deliciosa', 'thaumatophyllum-bipinnatifidum'])
    expect(hits[0].commonName).toBe('Swiss Cheese Plant')
  })

  it('filters out ranks above genus', () => {
    const hits = parseINatResponse({
      results: [
        { name: 'Zamioculcadoideae', rank: 'subfamily', rank_level: 27, matched_term: 'zamioculca' },
        { name: 'Zamioculcas zamiifolia', rank: 'species', rank_level: 10, matched_term: 'Zamioculca' },
      ],
    })
    expect(hits.map((h) => h.scientificName)).toEqual(['Zamioculcas zamiifolia'])
  })

  it('has no searchedName when the matched term is the scientific name', () => {
    const hits = parseINatResponse({
      results: [{ name: 'Monstera deliciosa', rank_level: 10, matched_term: 'monstera deliciosa' }],
    })
    expect(hits[0].searchedName).toBeUndefined()
  })

  it('returns at most 5 hits', () => {
    const results = Array.from({ length: 8 }, (_, i) => ({ name: `Genus species${i}`, rank_level: 10 }))
    expect(parseINatResponse({ results })).toHaveLength(5)
  })
})

describe('searchINaturalist', () => {
  it('requests plants in English with the encoded query', async () => {
    const fn = stubFetch(200)
    await searchINaturalist('costela-de-adão')
    const url = String(fn.mock.calls[0][0])
    expect(url).toContain('taxon_id=47126')
    expect(url).toContain('locale=en')
    expect(url).toContain(`q=${encodeURIComponent('costela-de-adão')}`)
  })

  it('rejects on a non-OK status', async () => {
    stubFetch(500)
    await expect(searchINaturalist('x')).rejects.toThrow()
  })
})
