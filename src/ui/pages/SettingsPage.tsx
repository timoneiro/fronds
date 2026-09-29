import { useEffect, useState } from 'react'
import { downloadBlob, downloadJSON, exportBackup, importMerge, importReplace } from '../../db/backupIO'
import { requestPersistentStorage } from '../../db/db'
import { BackupError } from '../../domain/backup'
import { buildICS } from '../../domain/calendar'
import { useGarden } from '../hooks'

const stamp = () => new Date().toLocaleDateString('en-CA')

export function SettingsPage() {
  const { items } = useGarden()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>()
  const [persisted, setPersisted] = useState<boolean>()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false))
  }, [])

  const onExport = async () => {
    downloadJSON(await exportBackup(), `fronds-backup-${stamp()}.json`)
    setMessage({ kind: 'ok', text: 'Backup downloaded.' })
  }

  const onImport = async (file: File | undefined, mode: 'merge' | 'replace') => {
    if (!file) return
    if (mode === 'replace' && !confirm('Replace ALL plants on this device with the backup? This cannot be undone.')) return
    try {
      const text = await file.text()
      const r = mode === 'merge' ? await importMerge(text) : await importReplace(text)
      setMessage({ kind: 'ok', text: `Imported: ${r.plantsChanged} plant and ${r.eventsChanged} history changes.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'Import failed.' })
    }
  }

  const onCalendar = () => {
    if (!items?.length) return
    const ics = buildICS(items.map(({ plant, schedule }) => ({ plant, firstDue: schedule.dueDate })))
    downloadBlob(new Blob([ics], { type: 'text/calendar' }), `fronds-watering-${stamp()}.ics`)
  }

  return (
    <>
      <h2>Settings</h2>
      {message && <p className={`notice notice-${message.kind}`}>{message.text}</p>}

      <section className="card">
        <h3>Backup & transfer</h3>
        <p className="muted small">
          Your plants live only on this device. Export a backup file to keep it safe or move it to another phone,
          then import it there. “Merge” keeps the newest version of each plant from both sides.
        </p>
        <div className="stack">
          <button className="btn btn-primary" onClick={() => void onExport()}>
            ⬇️ Export backup
          </button>
          <label className="btn">
            ⬆️ Import & merge
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0], 'merge'); e.target.value = '' }} />
          </label>
          <label className="btn btn-ghost">
            Import & replace everything
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0], 'replace'); e.target.value = '' }} />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Calendar</h3>
        <p className="muted small">
          Download a calendar file with a recurring watering event per plant (9:00 alert). Open it on your phone to add
          it to Google Calendar or Apple Calendar. Events don't move when you water late — re-export after big changes.
        </p>
        <button className="btn" disabled={!items?.length} onClick={onCalendar}>
          📅 Download calendar (.ics)
        </button>
      </section>

      <section className="card">
        <h3>Storage</h3>
        {persisted ? (
          <p className="muted small">✅ Storage is persistent — the browser won't clear your plants to free space.</p>
        ) : (
          <>
            <p className="muted small">
              The browser may clear site data when space is low (especially on iPhone). Installing the app to your home
              screen and allowing persistent storage makes this much less likely — but keep a backup anyway.
            </p>
            <button className="btn btn-small" onClick={() => void requestPersistentStorage().then(setPersisted)}>
              Request persistent storage
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>About</h3>
        <p className="muted small">
          fronds v{__APP_VERSION__} · open source ·{' '}
          <a className="link" href="https://github.com/timoneiro/fronds" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <br />
          Plant descriptions and photos from Wikipedia. No account, no tracking.
        </p>
      </section>
    </>
  )
}
