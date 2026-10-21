import { afterEach, describe, expect, it, vi } from 'vitest'
import { identifyPlant, parsePlantNetResponse, PlantNetError } from './plantnet'

const sample = {
  bestMatch: 'Monstera deliciosa Liebm.',
  results: [
    { score: 0.05, species: { scientificNameWithoutAuthor: 'Quercus robur', commonNames: [] } },
    {
      score: 0.92,
      species: { scientificNameWithoutAuthor: 'Monstera deliciosa', commonNames: ['Swiss cheese plant', 'Monstera'] },
    },
    { score: 0.3, species: { scientificNameWithoutAuthor: 'Philodendron hederaceum', commonNames: ['Heartleaf'] } },
    { score: 0.1, species: { scientificNameWithoutAuthor: 'Acer rubrum', commonNames: ['Red maple'] } },
  ],
  remainingIdentificationRequests: 499,
}

function stubFetch(status: number, body: unknown = sample) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('parsePlantNetResponse', () => {
  it('returns the top 3 by score with catalog matches', () => {
    const m = parsePlantNetResponse(sample)
    expect(m.map((x) => x.scientificName)).toEqual([
      'Monstera deliciosa',
      'Philodendron hederaceum',
      'Acer rubrum',
    ])
    expect(m[0].commonName).toBe('Swiss cheese plant')
    expect(m[0].species?.id).toBe('monstera-deliciosa')
    expect(m[2].species).toBeUndefined()
  })

  it('has no common name when none is given', () => {
    const m = parsePlantNetResponse({ results: [sample.results[0]] })
    expect(m[0].commonName).toBeUndefined()
  })
})

describe('identifyPlant', () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' })

  it('sends a multipart request with the key', async () => {
    const fn = stubFetch(200)
    const m = await identifyPlant(blob, 'abc123')
    expect(m).toHaveLength(3)
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('api-key=abc123')
    expect(url).toContain('lang=en')
    expect(url).toContain('nb-results=3')
    expect((init.body as FormData).has('images')).toBe(true)
  })

  it.each([
    [404, 'not-a-plant'],
    [401, 'bad-key'],
    [403, 'bad-key'],
    [429, 'quota'],
    [500, 'network'],
  ])('maps status %i to %s', async (status, kind) => {
    stubFetch(status, { message: 'x' })
    await expect(identifyPlant(blob, 'k')).rejects.toMatchObject({ kind })
  })

  it('maps a rejected fetch to network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))))
    const err = await identifyPlant(blob, 'k').catch((e) => e)
    expect(err).toBeInstanceOf(PlantNetError)
    expect(err.kind).toBe('network')
  })
})
