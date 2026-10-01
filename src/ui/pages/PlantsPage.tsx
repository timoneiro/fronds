import { useState } from 'react'
import { Link } from 'react-router'
import { speciesLabel } from '../../species/catalog'
import { EmptyState, PlantRow } from '../components/bits'
import { useGarden } from '../hooks'

const NO_ROOM = 'No room'

export function PlantsPage() {
  const { items } = useGarden()
  const [query, setQuery] = useState('')
  if (!items) return null

  const q = query.trim().toLowerCase()
  const filtered = items
    .filter(({ plant }) => !q || [plant.name, speciesLabel(plant), plant.room].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.plant.name.localeCompare(b.plant.name))

  const rooms = new Map<string, typeof filtered>()
  for (const item of filtered) {
    const room = item.plant.room?.trim() || NO_ROOM
    rooms.set(room, [...(rooms.get(room) ?? []), item])
  }
  const roomNames = [...rooms.keys()].sort((a, b) => (a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b)))

  return (
    <>
      <div className="section-head">
        <h2>
          My plants <span className="count">{items.length}</span>
        </h2>
        <div className="row">
          {items.length > 0 && (
            <Link className="btn btn-small" to="/plants/share">
              Share
            </Link>
          )}
          <Link className="btn btn-primary btn-small" to="/plants/new">
            + Add
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState>
          <p>Your collection is empty.</p>
          <Link className="btn btn-primary" to="/plants/new">
            Add a plant
          </Link>
          <Link className="link small" to="/plants/open">
            Open a shared link
          </Link>
        </EmptyState>
      ) : (
        <>
          <input
            className="input"
            type="search"
            placeholder="Search by name, species or room"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {roomNames.map((room) => (
            <section key={room}>
              <h3 className="room-title">{room}</h3>
              <ul className="plant-list">
                {rooms.get(room)!.map(({ plant, schedule }) => (
                  <PlantRow key={plant.id} plant={plant} schedule={schedule} />
                ))}
              </ul>
            </section>
          ))}
          {filtered.length === 0 && <p className="muted">No plants match “{query}”.</p>}
          <Link className="link small" to="/plants/open">
            Open a shared link
          </Link>
        </>
      )}
    </>
  )
}
