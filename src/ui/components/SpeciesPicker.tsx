import { useState } from 'react'
import { norm, searchCatalog, type Species } from '../../species/catalog'
import { searchINaturalist, type INatHit } from '../../species/inaturalist'
import { searchWikipedia, type WikiHit } from '../../species/wikipedia'

export type SpeciesChoice =
  | { speciesId: string; species: Species; suggestedName?: string }
  | { speciesName: string; suggestedName?: string }

interface Props {
  label: string | undefined
  onChoose: (choice: SpeciesChoice | undefined) => void
}

type Online = { inat: INatHit[]; wiki: WikiHit[] }

/** Search the bundled catalog first; fall back to iNaturalist + Wikipedia or free text. */
export function SpeciesPicker({ label, onChoose }: Props) {
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<Online | 'loading' | 'error' | undefined>()

  const catalogHits = searchCatalog(query)
  const shownIds = new Set(catalogHits.map((sp) => sp.id))
  const inatHits =
    typeof online === 'object' ? online.inat.filter((h) => !h.species || !shownIds.has(h.species.id)) : []
  const inatNames = new Set(inatHits.map((h) => norm(h.scientificName)))
  const wikiHits = typeof online === 'object' ? online.wiki.filter((h) => !inatNames.has(norm(h.title))) : []
  const noneOnline = typeof online === 'object' && inatHits.length === 0 && wikiHits.length === 0

  const searchOnline = async () => {
    setOnline('loading')
    const [inat, wiki] = await Promise.allSettled([searchINaturalist(query), searchWikipedia(query)])
    if (inat.status === 'rejected' && wiki.status === 'rejected') {
      setOnline('error')
      return
    }
    setOnline({
      inat: inat.status === 'fulfilled' ? inat.value : [],
      wiki: wiki.status === 'fulfilled' ? wiki.value : [],
    })
  }

  const choose = (c: SpeciesChoice) => {
    onChoose(c)
    setQuery('')
    setOnline(undefined)
  }

  const chooseINat = (hit: INatHit) => {
    if (hit.species) {
      choose({ speciesId: hit.species.id, species: hit.species, suggestedName: hit.searchedName })
    } else {
      choose({
        speciesName: hit.scientificName,
        suggestedName: hit.searchedName ?? hit.commonName ?? hit.scientificName,
      })
    }
  }

  if (label) {
    return (
      <div className="species-chosen">
        <span>🌿 {label}</span>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => onChoose(undefined)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="species-picker">
      <input
        className="input"
        type="search"
        placeholder="e.g. monstera, snake plant, pothos…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOnline(undefined)
        }}
        aria-label="Search species"
      />
      {query.trim() && (
        <ul className="options">
          {catalogHits.map((sp) => (
            <li key={sp.id}>
              <button type="button" onClick={() => choose({ speciesId: sp.id, species: sp })}>
                <strong>{sp.commonName}</strong> <em className="muted">{sp.scientificName}</em>
              </button>
            </li>
          ))}
          {inatHits.map((hit) => (
            <li key={`inat-${hit.scientificName}`}>
              <button type="button" onClick={() => chooseINat(hit)}>
                <strong>{hit.commonName ?? hit.scientificName}</strong>
                {hit.commonName && <> <em className="muted">{hit.scientificName}</em></>}
                {hit.searchedName && <span className="muted small"> matches “{hit.searchedName}”</span>}
                {hit.species && <span className="muted small"> · In catalog</span>}
              </button>
            </li>
          ))}
          {wikiHits.map((hit) => (
            <li key={hit.title}>
              <button type="button" onClick={() => choose({ speciesName: hit.title })}>
                <strong>{hit.title}</strong> <span className="muted small">{hit.description ?? 'Wikipedia'}</span>
              </button>
            </li>
          ))}
          <li className="options-footer">
            {online === undefined && (
              <button type="button" className="link" onClick={searchOnline}>
                Not listed? Search online
              </button>
            )}
            {online === 'loading' && <span className="muted small">Searching online…</span>}
            {online === 'error' && <span className="muted small">Couldn't search online (offline?)</span>}
            {noneOnline && <span className="muted small">No matches online.</span>}
            <button type="button" className="link" onClick={() => choose({ speciesName: query.trim() })}>
              Use “{query.trim()}” as typed
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
