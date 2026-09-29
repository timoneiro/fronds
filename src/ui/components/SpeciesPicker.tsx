import { useState } from 'react'
import { searchCatalog, type Species } from '../../species/catalog'
import { searchWikipedia, type WikiHit } from '../../species/wikipedia'

export type SpeciesChoice = { speciesId: string; species: Species } | { speciesName: string }

interface Props {
  label: string | undefined
  onChoose: (choice: SpeciesChoice | undefined) => void
}

/** Search the bundled catalog first; fall back to Wikipedia or free text. */
export function SpeciesPicker({ label, onChoose }: Props) {
  const [query, setQuery] = useState('')
  const [wiki, setWiki] = useState<WikiHit[] | 'loading' | 'error' | undefined>()

  const catalogHits = searchCatalog(query)

  const lookUpWikipedia = async () => {
    setWiki('loading')
    try {
      setWiki(await searchWikipedia(query))
    } catch {
      setWiki('error')
    }
  }

  const choose = (c: SpeciesChoice) => {
    onChoose(c)
    setQuery('')
    setWiki(undefined)
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
          setWiki(undefined)
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
          {Array.isArray(wiki) &&
            wiki.map((hit) => (
              <li key={hit.title}>
                <button type="button" onClick={() => choose({ speciesName: hit.title })}>
                  <strong>{hit.title}</strong> <span className="muted small">{hit.description ?? 'Wikipedia'}</span>
                </button>
              </li>
            ))}
          <li className="options-footer">
            {wiki === undefined && (
              <button type="button" className="link" onClick={lookUpWikipedia}>
                Not listed? Search Wikipedia
              </button>
            )}
            {wiki === 'loading' && <span className="muted small">Searching Wikipedia…</span>}
            {wiki === 'error' && <span className="muted small">Couldn't reach Wikipedia (offline?)</span>}
            <button type="button" className="link" onClick={() => choose({ speciesName: query.trim() })}>
              Use “{query.trim()}” as typed
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
