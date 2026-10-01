import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { createPlant } from '../../db/actions'
import { clampInterval, parseDay, projectDue, ShareError, type SharedCollection, type SharedPlant } from '../../domain/share'
import { addDays, daysBetween } from '../../domain/watering'
import { inIosBrowser } from '../../lib/platform'
import { readShareData } from '../../lib/shareLink'
import { getSpecies, speciesLabel } from '../../species/catalog'
import { EmptyState } from '../components/bits'
import { AboutCard, CareCard } from '../components/SpeciesCards'
import { useToday, useWikiSummary } from '../hooks'

/*
 * Read-only view of someone else's plants, decoded from the link itself.
 * Nothing here touches the viewer's own collection except "Add to my plants".
 */

const STALE_DAYS = 14
const NO_ROOM = 'No room'

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const titleOf = (share: SharedCollection) => (share.sharedBy ? `${share.sharedBy}'s plants` : 'Shared plants')

export function SharedViewPage() {
  const { data = '', index } = useParams()
  const today = useToday()
  const [loaded, setLoaded] = useState<{ data: string; share?: SharedCollection; error?: string }>()

  useEffect(() => {
    let cancelled = false
    readShareData(data).then(
      (share) => !cancelled && setLoaded({ data, share }),
      (err) => !cancelled && setLoaded({ data, error: err instanceof ShareError ? err.message : "This link couldn't be opened." }),
    )
    return () => {
      cancelled = true
    }
  }, [data])

  if (!loaded || loaded.data !== data) return null
  if (!loaded.share) {
    return (
      <EmptyState>
        <p className="big-emoji">🥀</p>
        <p>{loaded.error}</p>
        <Link className="btn" to="/plants">
          Go to my plants
        </Link>
      </EmptyState>
    )
  }

  const share = loaded.share
  if (index === undefined) return <SharedList share={share} data={data} today={today} />
  const plant = share.plants[Number(index)]
  if (!plant) {
    return (
      <EmptyState>
        <p>This plant isn't in the link.</p>
        <Link to={`/view/${data}`}>Back to {titleOf(share)}</Link>
      </EmptyState>
    )
  }
  return <SharedPlantDetail key={index} share={share} plant={plant} data={data} today={today} />
}

function CopyAge({ share, today }: { share: SharedCollection; today: Date }) {
  const sharedOn = parseDay(share.sharedOn)
  const age = daysBetween(sharedOn, today)
  const owner = share.sharedBy ?? 'the owner'
  const hasDates = share.plants.some((p) => p.lastWateredDaysAgo !== undefined)
  if (age <= 0) return <p className="notice notice-ok">A copy from today. Nothing here is added to your plants.</p>
  if (!hasDates) return <p className="notice notice-info">A copy from {fmtDate(sharedOn)}.</p>
  if (age < STALE_DAYS) {
    return (
      <p className="notice notice-info">
        A copy from {fmtDate(sharedOn)}. Watering dates after that assume {owner} kept to the schedule.
      </p>
    )
  }
  return (
    <p className="notice notice-warn">
      This copy is {age} days old, so the watering dates are probably out of date. Ask {owner} for a new link.
    </p>
  )
}

function SharedDue({ plant, share, today }: { plant: SharedPlant; share: SharedCollection; today: Date }) {
  const due = projectDue(plant, share.sharedOn, today)
  if (!due) return <span className="muted small">Every {plant.wateringIntervalDays} days</span>
  const text = due.daysUntilDue === 0 ? 'Due today' : due.daysUntilDue === 1 ? 'Due tomorrow' : `Due ${fmtDate(due.dueDate)}`
  return <span className={`chip chip-${due.status}`}>{text}</span>
}

function SharedList({ share, data, today }: { share: SharedCollection; data: string; today: Date }) {
  const rooms = new Map<string, { plant: SharedPlant; index: number }[]>()
  share.plants.forEach((plant, index) => {
    const room = plant.room || NO_ROOM
    rooms.set(room, [...(rooms.get(room) ?? []), { plant, index }])
  })
  const roomNames = [...rooms.keys()].sort((a, b) => (a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b)))

  return (
    <>
      <h2>
        {titleOf(share)} <span className="count">{share.plants.length}</span>
      </h2>
      <CopyAge share={share} today={today} />
      {share.plants.length === 0 && <p className="muted">There are no plants in this link.</p>}
      {roomNames.map((room) => (
        <section key={room}>
          <h3 className="room-title">{room}</h3>
          <ul className="plant-list">
            {rooms.get(room)!.map(({ plant, index }) => {
              const species = speciesLabel(plant)
              return (
                <li key={index} className="plant-row">
                  <Link to={`/view/${data}/${index}`} className="plant-row-link">
                    <span className="thumb thumb-empty" style={{ width: 56, height: 56 }} aria-hidden>
                      🪴
                    </span>
                    <span className="plant-row-text">
                      <strong>{plant.name}</strong>
                      <span className="muted small">{(species !== plant.name && species) || ' '}</span>
                      <SharedDue plant={plant} share={share} today={today} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

function SharedPlantDetail(props: { share: SharedCollection; plant: SharedPlant; data: string; today: Date }) {
  const { share, plant, data, today } = props
  const species = getSpecies(plant.speciesId)
  const wiki = useWikiSummary(species?.wiki ?? plant.speciesName)
  const [addedId, setAddedId] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [handOff, setHandOff] = useState(inIosBrowser)

  const onAdd = async () => {
    setBusy(true)
    try {
      // Only what describes the plant: no room, notes or history of someone else's home.
      setAddedId(
        await createPlant({
          name: plant.name,
          speciesId: species?.id,
          speciesName: species ? undefined : plant.speciesName,
          wateringIntervalDays: clampInterval(plant.wateringIntervalDays),
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  const sharedOn = parseDay(share.sharedOn)
  const lastWatered = plant.lastWateredDaysAgo === undefined ? undefined : addDays(sharedOn, -plant.lastWateredDaysAgo)

  return (
    <article className="detail">
      <Link className="link small" to={`/view/${data}`}>
        ← {titleOf(share)}
      </Link>
      {wiki?.thumbnail && <img className="hero" src={wiki.thumbnail} alt={plant.name} />}

      <header>
        <h2>{plant.name}</h2>
        <p className="muted">{[speciesLabel(plant), species?.scientificName, plant.room].filter(Boolean).join(' · ')}</p>
      </header>

      <section className="card">
        <SharedDue plant={plant} share={share} today={today} />
        <p className="muted small">
          Watered every {plant.wateringIntervalDays} days
          {lastWatered && ` · last watered ${fmtDate(lastWatered)}`}
          {lastWatered && daysBetween(sharedOn, today) > 0 && ` (as of ${fmtDate(sharedOn)})`}
        </p>
      </section>

      {plant.notes && (
        <section className="card">
          <h3>{share.sharedBy ? `${share.sharedBy}'s notes` : 'Notes'}</h3>
          <p className="prewrap">{plant.notes}</p>
        </section>
      )}

      {species && <CareCard species={species} />}
      {wiki && <AboutCard wiki={wiki} />}

      {addedId ? (
        <p className="notice notice-ok">
          Added {plant.name} to your plants.{' '}
          <Link className="link" to={`/plants/${addedId}`}>
            Open it
          </Link>
        </p>
      ) : handOff ? (
        <HandOffToApp onAddHere={() => setHandOff(false)} />
      ) : (
        <div className="stack">
          <button className="btn btn-primary" disabled={busy} onClick={() => void onAdd()}>
            + Add to my plants
          </button>
          <p className="muted small">Copies the name, species and watering interval, not the history.</p>
        </div>
      )}
    </article>
  )
}

/**
 * iPhone links always open in Safari, whose storage is separate from the Home
 * Screen app, so a plant added here wouldn't show up there. Hand the link over
 * by copy and paste (Plants → Open a shared link) instead.
 */
function HandOffToApp({ onAddHere }: { onAddHere: () => void }) {
  const [copied, setCopied] = useState<boolean>()
  const link = location.href

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card">
      <button className="btn btn-primary" onClick={() => void copy()}>
        {copied ? '✓ Link copied' : '+ Add in the fronds app'}
      </button>
      {copied === undefined && (
        <p className="muted small">
          Safari keeps its own copy of fronds, separate from the app on your Home Screen. This copies the link so you can
          add the plant there.
        </p>
      )}
      {copied === false && (
        <label className="field">
          <span>Copy this link</span>
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
      {copied !== undefined && (
        <>
          <ol className="steps">
            <li>Open fronds from your Home Screen.</li>
            <li>
              Go to <strong>Plants → Open a shared link</strong> and tap Paste.
            </li>
          </ol>
          <p className="muted small">No fronds on your Home Screen yet? Tap Share → Add to Home Screen in Safari first.</p>
        </>
      )}
      <button className="link small" onClick={onAddHere}>
        Add it here in Safari instead
      </button>
    </section>
  )
}
