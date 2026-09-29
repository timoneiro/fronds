import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { createPlant, updatePlant, type PlantInput } from '../../db/actions'
import { db, isLive } from '../../db/db'
import type { Plant } from '../../db/types'
import { resizeImage } from '../../lib/image'
import { getSpecies } from '../../species/catalog'
import { SpeciesPicker, type SpeciesChoice } from '../components/SpeciesPicker'

const DEFAULT_INTERVAL = 7
const todayInput = () => new Date().toLocaleDateString('en-CA') // yyyy-mm-dd in local time

/** Loads the plant being edited (if any), then mounts the form with it. */
export function PlantFormPage() {
  const { id } = useParams()
  // `null` = loaded but not found; `undefined` = still loading.
  const existing = useLiveQuery(async () => (id ? ((await db.plants.get(id)) ?? null) : null), [id])
  if (existing === undefined) return null
  if (id && !existing) return <p className="muted">Plant not found.</p>
  return <PlantForm key={id ?? 'new'} existing={existing ?? undefined} />
}

function PlantForm({ existing }: { existing?: Plant }) {
  const id = existing?.id
  const editing = Boolean(existing)
  const navigate = useNavigate()
  const rooms = useLiveQuery(async () => {
    const plants = (await db.plants.toArray()).filter(isLive)
    return [...new Set(plants.map((p) => p.room?.trim()).filter(Boolean))].sort() as string[]
  }, [])

  const [form, setForm] = useState<PlantInput>(() => {
    if (!existing) return { name: '', wateringIntervalDays: DEFAULT_INTERVAL }
    const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = existing
    return rest
  })
  const [intervalTouched, setIntervalTouched] = useState(editing)
  const [lastWatered, setLastWatered] = useState<string>(todayInput())
  const [photoBusy, setPhotoBusy] = useState(false)

  const set = <K extends keyof PlantInput>(key: K, value: PlantInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const catalogSpecies = getSpecies(form.speciesId)
  const speciesLabel = catalogSpecies?.commonName ?? form.speciesName

  const onSpecies = (choice: SpeciesChoice | undefined) => {
    if (!choice) {
      setForm((f) => ({ ...f, speciesId: undefined, speciesName: undefined }))
    } else if ('speciesId' in choice) {
      setForm((f) => ({
        ...f,
        speciesId: choice.speciesId,
        speciesName: undefined,
        name: f.name || choice.species.commonName,
        wateringIntervalDays: intervalTouched ? f.wateringIntervalDays : choice.species.waterEveryDays,
      }))
    } else {
      setForm((f) => ({ ...f, speciesId: undefined, speciesName: choice.speciesName, name: f.name || choice.speciesName }))
    }
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoBusy(true)
    try {
      set('photo', await resizeImage(file))
    } finally {
      setPhotoBusy(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean: PlantInput = {
      ...form,
      name: form.name.trim(),
      room: form.room?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      wateringIntervalDays: Math.max(1, Math.round(form.wateringIntervalDays)),
    }
    if (id) {
      await updatePlant(id, clean)
      navigate(`/plants/${id}`, { replace: true })
    } else {
      // Log the first watering at noon so it lands on the chosen calendar day.
      const at = lastWatered ? new Date(`${lastWatered}T12:00:00`).toISOString() : undefined
      const newId = await createPlant(clean, at)
      navigate(`/plants/${newId}`, { replace: true })
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <h2>{editing ? 'Edit plant' : 'New plant'}</h2>

      <div className="field">
        <span>Species</span>
        <SpeciesPicker label={speciesLabel} onChoose={onSpecies} />
      </div>

      <label className="field">
        <span>Name</span>
        <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Big Monstera" />
      </label>

      <label className="field">
        <span>Room</span>
        <input className="input" list="rooms" value={form.room ?? ''} onChange={(e) => set('room', e.target.value)} placeholder="e.g. Living room" />
        <datalist id="rooms">{rooms?.map((r) => <option key={r} value={r} />)}</datalist>
      </label>

      <div className="field">
        <span>Water every</span>
        <div className="stepper">
          <button type="button" className="btn btn-small" onClick={() => { setIntervalTouched(true); set('wateringIntervalDays', Math.max(1, form.wateringIntervalDays - 1)) }} aria-label="Fewer days">−</button>
          <input
            className="input input-number"
            type="number"
            min={1}
            max={90}
            required
            value={form.wateringIntervalDays}
            onChange={(e) => { setIntervalTouched(true); set('wateringIntervalDays', Number(e.target.value)) }}
          />
          <button type="button" className="btn btn-small" onClick={() => { setIntervalTouched(true); set('wateringIntervalDays', form.wateringIntervalDays + 1) }} aria-label="More days">+</button>
          <span>days</span>
        </div>
        {catalogSpecies && (
          <small className="muted">
            Typical for {catalogSpecies.commonName}: every {catalogSpecies.waterEveryDays} days. Adjust for your home.
          </small>
        )}
      </div>

      {!editing && (
        <label className="field">
          <span>Last watered</span>
          <div className="row">
            <input className="input" type="date" max={todayInput()} value={lastWatered} onChange={(e) => setLastWatered(e.target.value)} />
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setLastWatered('')}>
              Not sure
            </button>
          </div>
        </label>
      )}

      <div className="field">
        <span>Photo</span>
        <div className="row">
          {form.photo && <img className="thumb" src={form.photo} alt="" width={72} height={72} />}
          <label className="btn btn-small">
            {photoBusy ? 'Processing…' : form.photo ? 'Replace photo' : '📷 Add photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </label>
          {form.photo && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => set('photo', undefined)}>
              Remove
            </button>
          )}
        </div>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea className="input" rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Where you got it, quirks, soil mix…" />
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={photoBusy}>
          {editing ? 'Save' : 'Add plant'}
        </button>
      </div>
    </form>
  )
}
