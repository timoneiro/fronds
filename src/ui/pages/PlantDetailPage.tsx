import { Link, useNavigate, useParams } from 'react-router'
import { deleteEvent, deletePlant, updatePlant } from '../../db/actions'
import { googleCalendarLink } from '../../domain/calendar'
import { suggestInterval } from '../../domain/watering'
import { getSpecies, speciesLabel } from '../../species/catalog'
import { DueChip, EmptyState } from '../components/bits'
import { AboutCard, CareCard } from '../components/SpeciesCards'
import { WaterActions } from '../components/WaterActions'
import { useGarden, useWikiSummary } from '../hooks'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function PlantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, events } = useGarden()
  const item = items?.find((x) => x.plant.id === id)
  const species = getSpecies(item?.plant.speciesId)
  const wiki = useWikiSummary(species?.wiki ?? item?.plant.speciesName)

  if (!items) return null
  if (!item) {
    return (
      <EmptyState>
        <p>This plant doesn't exist (any more).</p>
        <Link to="/plants">Back to plants</Link>
      </EmptyState>
    )
  }

  const { plant, schedule } = item
  const history = (events ?? [])
    .filter((e) => e.plantId === plant.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20)
  const suggestion = suggestInterval(plant, events ?? [])
  const heroImage = plant.photo ?? wiki?.thumbnail

  const onDelete = async () => {
    if (!confirm(`Delete ${plant.name}? Its watering history is deleted too.`)) return
    await deletePlant(plant.id)
    navigate('/plants', { replace: true })
  }

  return (
    <article className="detail">
      {heroImage && <img className="hero" src={heroImage} alt={plant.name} />}

      <header className="detail-head">
        <div>
          <h2>{plant.name}</h2>
          <p className="muted">
            {[speciesLabel(plant), species?.scientificName, plant.room].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Link className="btn btn-small btn-ghost" to={`/plants/${plant.id}/edit`}>
          Edit
        </Link>
      </header>

      <section className="card">
        <div className="row spread">
          <div>
            <DueChip schedule={schedule} />
            <p className="muted small">
              Every {plant.wateringIntervalDays} days
              {schedule.lastWateredAt && ` · last watered ${fmtDate(schedule.lastWateredAt.toISOString())}`}
            </p>
          </div>
          <WaterActions plantId={plant.id} />
        </div>
        {suggestion && (
          <div className="hint">
            You've been watering about every <strong>{suggestion} days</strong>.{' '}
            <button className="link" onClick={() => void updatePlant(plant.id, { wateringIntervalDays: suggestion })}>
              Use that
            </button>
          </div>
        )}
        <a className="link small" href={googleCalendarLink(plant, schedule.dueDate, location.href)} target="_blank" rel="noreferrer">
          📅 Add a recurring reminder to Google Calendar
        </a>
      </section>

      {species && <CareCard species={species} />}

      {wiki && <AboutCard wiki={wiki} />}

      {plant.notes && (
        <section className="card">
          <h3>Notes</h3>
          <p className="prewrap">{plant.notes}</p>
        </section>
      )}

      <section className="card">
        <h3>History</h3>
        {history.length === 0 ? (
          <p className="muted">Nothing logged yet.</p>
        ) : (
          <ul className="history">
            {history.map((e) => (
              <li key={e.id}>
                <span>
                  {e.type === 'water' ? '💧 Watered' : `⏰ Snoozed ${e.days ?? 1}d`} <span className="muted">· {fmtDate(e.at)}</span>
                </span>
                <button className="btn btn-small btn-ghost" onClick={() => void deleteEvent(e.id)} aria-label="Remove entry">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="btn btn-danger" onClick={() => void onDelete()}>
        Delete plant
      </button>
    </article>
  )
}
