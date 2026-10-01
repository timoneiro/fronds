import type { WikiCacheEntry } from '../../db/types'
import { LIGHT_LABEL, TOXICITY_LABEL, type Species } from '../../species/catalog'

export function CareCard({ species }: { species: Species }) {
  return (
    <section className="card">
      <h3>Care</h3>
      {species.petToxicity !== 'non-toxic' ? (
        <p className={`badge badge-${species.petToxicity}`}>⚠️ {TOXICITY_LABEL[species.petToxicity]}</p>
      ) : (
        <p className="badge badge-safe">🐾 {TOXICITY_LABEL['non-toxic']}</p>
      )}
      <dl className="facts">
        <dt>Light</dt>
        <dd>{LIGHT_LABEL[species.light]}</dd>
        <dt>Water</dt>
        <dd>About every {species.waterEveryDays} days</dd>
        <dt>Humidity</dt>
        <dd className="cap">{species.humidity}</dd>
        <dt>Difficulty</dt>
        <dd className="cap">{species.difficulty}</dd>
      </dl>
      <p>💡 {species.tip}</p>
      <p className="muted small">General guidance only. Toxicity per ASPCA lists — ask a vet if in doubt.</p>
    </section>
  )
}

export function AboutCard({ wiki }: { wiki: WikiCacheEntry }) {
  if (!wiki.extract) return null
  return (
    <section className="card">
      <h3>About</h3>
      <p>{wiki.extract}</p>
      {wiki.url && (
        <a className="link small" href={wiki.url} target="_blank" rel="noreferrer">
          Read more on Wikipedia
        </a>
      )}
    </section>
  )
}
