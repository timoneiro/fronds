import { useRef, useState } from 'react'
import { resizeImageBlob } from '../../lib/image'
import { identifyPlant, PlantNetError, type PlantNetMatch } from '../../species/plantnet'
import type { SpeciesChoice } from './SpeciesPicker'

interface Props {
  apiKey: string
  onChoose: (choice: SpeciesChoice, file: File) => void
}

const ERROR_TEXT: Record<PlantNetError['kind'], string> = {
  'not-a-plant': "That doesn't look like a plant. Try a closer photo of the leaves or a flower.",
  'bad-key': "Pl@ntNet didn't accept your key. Check it in Settings.",
  quota: "You've used today's free identifications. Try again tomorrow.",
  network: "Couldn't reach Pl@ntNet. Try again later.",
}

/** Sends one photo to Pl@ntNet (user's own key) and offers the best matches as species choices. */
export function IdentifyFromPhoto({ apiKey, onChoose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [matches, setMatches] = useState<PlantNetMatch[]>()
  const fileRef = useRef<File | undefined>(undefined)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(undefined)
    setMatches(undefined)
    if (navigator.onLine === false) {
      setError("You're offline. Identification needs a connection.")
      return
    }
    setBusy(true)
    try {
      const found = await identifyPlant(await resizeImageBlob(file), apiKey)
      fileRef.current = file
      setMatches(found)
    } catch (e) {
      setError(ERROR_TEXT[e instanceof PlantNetError ? e.kind : 'network'])
    } finally {
      setBusy(false)
    }
  }

  const choose = (m: PlantNetMatch) => {
    const file = fileRef.current
    if (!file) return
    const choice: SpeciesChoice = m.species
      ? { speciesId: m.species.id, species: m.species }
      : { speciesName: m.scientificName, suggestedName: m.commonName ?? m.scientificName }
    onChoose(choice, file)
    setMatches(undefined)
  }

  return (
    <div className="identify">
      <label className={`btn btn-small${busy ? ' disabled' : ''}`} aria-disabled={busy}>
        {busy ? 'Identifying…' : '📷 Identify from photo'}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void onFile(file)
          }}
        />
      </label>
      {error && <p className="notice notice-error">{error}</p>}
      {matches && (
        <>
          {matches[0] && matches[0].score < 0.3 && (
            <p className="muted small">Pl@ntNet isn't sure. Compare with your plant before choosing.</p>
          )}
          <ul className="options">
            {matches.map((m) => (
              <li key={m.scientificName}>
                <button type="button" onClick={() => choose(m)}>
                  <strong>{m.commonName ?? m.scientificName}</strong> <em className="muted">{m.scientificName}</em>{' '}
                  <span className="muted small">{Math.round(m.score * 100)}%</span>
                  {m.species && <span className="muted small"> In catalog</span>}
                </button>
              </li>
            ))}
            <li className="options-footer">
              <span className="muted small">
                Identified by <a href="https://plantnet.org/" target="_blank" rel="noreferrer">Pl@ntNet</a>
              </span>
              <button type="button" className="link" onClick={() => setMatches(undefined)}>
                None of these
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
