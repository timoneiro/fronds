import { Link } from 'react-router'
import type { Plant } from '../../db/types'
import { describeDue, type Schedule } from '../../domain/watering'
import { speciesLabel } from '../../species/catalog'

export function DueChip({ schedule }: { schedule: Schedule }) {
  return <span className={`chip chip-${schedule.status}`}>{describeDue(schedule)}</span>
}

export function PlantThumb({ plant, size = 56 }: { plant: Plant; size?: number }) {
  return plant.photo ? (
    <img className="thumb" src={plant.photo} alt="" width={size} height={size} />
  ) : (
    <span className="thumb thumb-empty" style={{ width: size, height: size }} aria-hidden>
      🪴
    </span>
  )
}

export function PlantRow({ plant, schedule, action }: { plant: Plant; schedule: Schedule; action?: React.ReactNode }) {
  const species = speciesLabel(plant)
  return (
    <li className="plant-row">
      <Link to={`/plants/${plant.id}`} className="plant-row-link">
        <PlantThumb plant={plant} />
        <span className="plant-row-text">
          <strong>{plant.name}</strong>
          <span className="muted small">
            {[species !== plant.name ? species : undefined, plant.room].filter(Boolean).join(' · ') || ' '}
          </span>
          <DueChip schedule={schedule} />
        </span>
      </Link>
      {action}
    </li>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}
