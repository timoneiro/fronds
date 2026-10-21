import { describe, expect, it } from 'vitest'
import { CATALOG, findByScientificName, norm, searchCatalog } from './catalog'

describe('catalog', () => {
  it('has unique ids and sane intervals', () => {
    expect(new Set(CATALOG.map((s) => s.id)).size).toBe(CATALOG.length)
    for (const s of CATALOG) expect(s.waterEveryDays).toBeGreaterThan(0)
  })

  it('finds by common name, alias and scientific name', () => {
    expect(searchCatalog('snake')[0].id).toBe('dracaena-trifasciata')
    expect(searchCatalog('sansevieria')[0].id).toBe('dracaena-trifasciata')
    expect(searchCatalog('Epipremnum aureum')[0].id).toBe('epipremnum-aureum')
    expect(searchCatalog('   ')).toEqual([])
  })

  it('finds by scientific name, falling back to the genus', () => {
    expect(findByScientificName('Monstera deliciosa')?.id).toBe('monstera-deliciosa')
    expect(findByScientificName('monstera DELICIOSA')?.id).toBe('monstera-deliciosa')
    expect(findByScientificName('Spathiphyllum wallisii')?.id).toBe('spathiphyllum')
    expect(findByScientificName('Sansevieria trifasciata')?.id).toBe('dracaena-trifasciata')
    expect(findByScientificName('sansevieria TRIFASCIATA')?.id).toBe('dracaena-trifasciata')
    expect(findByScientificName('Quercus robur')).toBeUndefined()
    expect(findByScientificName('')).toBeUndefined()
  })

  it('finds the batch A aroids and climbers', () => {
    expect(findByScientificName('Philodendron erubescens')?.id).toBe('philodendron-erubescens')
    expect(findByScientificName('Philodendron xanadu')?.id).toBe('thaumatophyllum-xanadu')
    expect(searchCatalog('pink princess')[0].id).toBe('philodendron-erubescens')
  })

  it('keeps names unambiguous across entries', () => {
    const shared = new Set(['split-leaf philodendron', 'ribbon plant', 'dracaena', 'money tree'])
    expect(new Set(CATALOG.map((s) => norm(s.scientificName))).size).toBe(CATALOG.length)
    for (const s of CATALOG) {
      const others = CATALOG.filter((o) => o !== s).map((o) => norm(o.scientificName))
      for (const a of s.aliases ?? []) expect(others, `${s.id}: alias "${a}"`).not.toContain(norm(a))
    }
    const owners = new Map<string, Set<string>>()
    for (const s of CATALOG) {
      for (const name of [s.commonName, s.scientificName, ...(s.aliases ?? [])]) {
        const key = norm(name)
        const ids = owners.get(key) ?? new Set<string>()
        ids.add(s.id)
        owners.set(key, ids)
      }
    }
    const clashes = [...owners]
      .filter(([name, ids]) => ids.size > 1 && !shared.has(name))
      .map(([name, ids]) => `${name}: ${[...ids].join(', ')}`)
    expect(clashes).toEqual([])
  })

  it('gives every entry a wiki title, a tip and a whole-day interval from 1 to 30', () => {
    for (const s of CATALOG) {
      expect(s.wiki.trim(), s.id).not.toBe('')
      expect(s.tip.trim(), s.id).not.toBe('')
      expect(Number.isInteger(s.waterEveryDays) && s.waterEveryDays >= 1 && s.waterEveryDays <= 30, s.id).toBe(true)
    }
  })
})
