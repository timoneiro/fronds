import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { getSetting, setSetting } from '../../db/db'
import { buildShare, roomOf } from '../../domain/share'
import { shareLink } from '../../lib/shareLink'
import { shareUrl } from '../../lib/shareSheet'
import { EmptyState } from '../components/bits'
import { useGarden, type PlantWithSchedule } from '../hooks'

/** Local only: the name last used on a share link. */
const SHARE_NAME = 'shareName'
const NO_ROOM = ''


export function SharePage() {
  const { items } = useGarden()
  const savedName = useLiveQuery(() => getSetting<string>(SHARE_NAME).then((n) => n ?? ''), [])
  if (!items || savedName === undefined) return null
  if (items.length === 0) {
    return (
      <EmptyState>
        <p>Add some plants first, then share them.</p>
        <Link className="btn btn-primary" to="/plants/new">
          Add a plant
        </Link>
      </EmptyState>
    )
  }
  return <ShareForm items={items} savedName={savedName} />
}

function ShareForm({ items, savedName }: { items: PlantWithSchedule[]; savedName: string }) {
  const [name, setName] = useState(savedName)
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [includeWatering, setIncludeWatering] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'shared' | 'copied'>()

  const roomCounts = new Map<string, number>()
  for (const { plant } of items) roomCounts.set(roomOf(plant), (roomCounts.get(roomOf(plant)) ?? 0) + 1)
  const rooms = [...roomCounts.keys()].sort((a, b) => (a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b)))

  const share = buildShare(
    items.map(({ plant, schedule }) => ({ plant, lastWateredAt: schedule.lastWateredAt })),
    { sharedBy: name, excludeRooms: [...excluded], includeWatering, includeNotes },
  )
  const count = share.plants.length
  const owner = name.trim()

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setResult(undefined)
  }
  const toggleRoom = changed((room: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (!next.delete(room)) next.add(room)
      return next
    }),
  )

  const onShare = async () => {
    setBusy(true)
    try {
      await setSetting(SHARE_NAME, owner || undefined)
      const url = await shareLink(share)
      const title = owner ? `${owner}'s plants` : 'My plants'
      const text = owner ? `${owner} shared ${count} plants with you on fronds 🪴` : `Have a look at my ${count} plants on fronds 🪴`
      setResult(await shareUrl(url, title, text))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>Share your plants</h2>
        <Link className="btn btn-small btn-ghost" to="/plants">
          Cancel
        </Link>
      </div>
      <p className="muted">
        Send a friend a link to look at your plants. It's a copy from today: they can't change anything, and it won't update.
      </p>

      <label className="field">
        <span>Your name</span>
        <input className="input" value={name} maxLength={60} autoComplete="given-name" placeholder="Optional" onChange={(e) => changed(setName)(e.target.value)} />
        <small className="muted">{owner ? `Shown as “${owner}'s plants”.` : 'Leave empty to share without a name.'}</small>
      </label>

      {rooms.length > 1 && (
        <div className="field">
          <span>Rooms</span>
          <div className="toggle-chips">
            {rooms.map((room) => (
              <button key={room} type="button" className="toggle-chip" aria-pressed={!excluded.has(room)} onClick={() => toggleRoom(room)}>
                {room || 'No room'} · {roomCounts.get(room)}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={includeWatering} onChange={(e) => changed(setIncludeWatering)(e.target.checked)} />
        <span>
          Watering dates
          <small>When each plant was last watered and is next due.</small>
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={includeNotes} onChange={(e) => changed(setIncludeNotes)(e.target.checked)} />
        <span>
          Notes
          <small>Your own notes on each plant. Off by default, since notes can be personal.</small>
        </span>
      </label>

      <section className="card">
        <p>
          <strong>
            {count} of {items.length} plants
          </strong>
        </p>
        <button className="btn btn-primary" disabled={busy || count === 0} onClick={() => void onShare()}>
          {result === 'copied' ? '✓ Link copied' : result === 'shared' ? '✓ Shared' : '🔗 Share link'}
        </button>
        <p className="muted small">
          Anyone with the link can see these plants, and a sent link can't be taken back. Photos and watering history are never
          included.
        </p>
      </section>
    </>
  )
}
