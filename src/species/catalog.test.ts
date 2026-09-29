import { describe, expect, it } from 'vitest'
import { CATALOG, searchCatalog } from './catalog'

describe('catalog', () => {
  it('has unique ids and sane intervals', () => {
    expect(new Set(CATALOG.map((s) => s.id)).size).toBe(CATALOG.length)
    for (const s of CATALOG) expect(s.waterEveryDays).toBeGreaterThan(0)
  })

  it('finds by common name, alias and scientific name', () => {
    expect(searchCatalog('snake')[0].id).toBe('dracaena-trifasciata')
    expect(searchCatalog('sansevieria')[0].id).toBe('dracaena-trifasciata')
    expect(searchCatalog('Epipremnum')[0].id).toBe('epipremnum-aureum')
    expect(searchCatalog('   ')).toEqual([])
  })
})
