import { useState } from 'react'
import { addEvent } from '../../db/actions'

/** "Watered" plus a small snooze menu for "checked the soil, still moist". */
export function WaterActions({ plantId, compact }: { plantId: string; compact?: boolean }) {
  const [snoozing, setSnoozing] = useState(false)

  if (snoozing) {
    return (
      <div className="water-actions" role="group" aria-label="Snooze watering">
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            className="btn btn-small"
            onClick={() => {
              void addEvent(plantId, 'snooze', { days: d })
              setSnoozing(false)
            }}
          >
            +{d}d
          </button>
        ))}
        <button className="btn btn-small btn-ghost" onClick={() => setSnoozing(false)} aria-label="Cancel snooze">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="water-actions">
      <button className="btn btn-primary btn-small" onClick={() => void addEvent(plantId, 'water')} aria-label="Mark watered">
        💧{compact ? '' : ' Watered'}
      </button>
      <button
        className="btn btn-small btn-ghost"
        onClick={() => setSnoozing(true)}
        title="Soil still moist — remind me later"
      >
        Later
      </button>
    </div>
  )
}
