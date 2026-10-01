import { Link } from 'react-router'
import { waterPlants } from '../../db/actions'
import { needsWater } from '../../domain/watering'
import { EmptyState, PlantRow } from '../components/bits'
import { WaterActions } from '../components/WaterActions'
import { WhatsNewCard } from '../components/WhatsNew'
import { useGarden } from '../hooks'

export function TodayPage() {
  const { items } = useGarden()
  if (!items) return null

  if (items.length === 0) {
    return (
      <EmptyState>
        <p className="big-emoji">🌱</p>
        <p>No plants yet.</p>
        <Link className="btn btn-primary" to="/plants/new">
          Add your first plant
        </Link>
      </EmptyState>
    )
  }

  const due = items.filter((x) => needsWater(x.schedule))
  const upcoming = items.filter((x) => !needsWater(x.schedule) && x.schedule.daysUntilDue <= 7)

  return (
    <>
      <WhatsNewCard />
      <section>
        <div className="section-head">
          <h2>Needs water {due.length > 0 && <span className="count">{due.length}</span>}</h2>
          {due.length > 1 && (
            <button className="btn btn-small" onClick={() => void waterPlants(due.map((x) => x.plant.id))}>
              💧 Water all
            </button>
          )}
        </div>
        {due.length === 0 ? (
          <p className="muted">All caught up — nothing to water today. 🎉</p>
        ) : (
          <ul className="plant-list">
            {due.map(({ plant, schedule }) => (
              <PlantRow key={plant.id} plant={plant} schedule={schedule} action={<WaterActions plantId={plant.id} compact />} />
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2>Coming up this week</h2>
          <ul className="plant-list">
            {upcoming.map(({ plant, schedule }) => (
              <PlantRow key={plant.id} plant={plant} schedule={schedule} action={<WaterActions plantId={plant.id} compact />} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
