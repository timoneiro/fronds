import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { downloadBlob, downloadJSON, exportBackup, importMerge, importReplace } from '../../db/backupIO'
import { db, setSetting } from '../../db/db'
import { LINKS } from '../../lib/links'
import { BUTTONDOWN_USERNAME } from '../../lib/newsletter'
import { requestPersistentStorage } from '../../lib/storage'
import { BackupError } from '../../domain/backup'
import { buildICS } from '../../domain/calendar'
import { SubscribeForm } from '../components/SubscribeForm'
import { SyncSection } from '../components/SyncSection'
import { useGarden, usePlantNetKey } from '../hooks'

const stamp = () => new Date().toLocaleDateString('en-CA')

export function SettingsPage() {
  const { items } = useGarden()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>()
  const [persisted, setPersisted] = useState<boolean>()
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), [])

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false))
  }, [])

  const onExport = async () => {
    downloadJSON(await exportBackup(), `fronds-backup-${stamp()}.json`)
    setMessage({ kind: 'ok', text: 'Backup downloaded.' })
  }

  const onImport = async (file: File | undefined, mode: 'merge' | 'replace') => {
    if (!file) return
    const replaceWarning =
      "Replace ALL plants on this device with the backup? A safety snapshot of the current data is kept below. If sync is on, the server's copy will be merged back in."
    if (mode === 'replace' && !confirm(replaceWarning)) return
    try {
      const text = await file.text()
      const r = mode === 'merge' ? await importMerge(text) : await importReplace(text)
      setMessage({ kind: 'ok', text: `Imported: ${r.plantsChanged} plant and ${r.eventsChanged} history changes.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof BackupError ? err.message : 'Import failed.' })
    }
  }

  const savedKey = usePlantNetKey()
  const [keyDraft, setKeyDraft] = useState<string>()
  const keyText = keyDraft ?? savedKey ?? ''

  const onSaveKey = async () => {
    await setSetting('plantnetKey', keyText.trim() || undefined)
    setKeyDraft(undefined)
  }

  const onRemoveKey = async () => {
    await setSetting('plantnetKey', undefined)
    setKeyDraft(undefined)
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
          Your plants are stored on this device. Export a backup file to keep it safe or move it to another phone,
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
        {snapshots && snapshots.length > 0 && (
          <details className="small">
            <summary className="muted">Safety snapshots ({snapshots.length})</summary>
            <p className="muted">Taken automatically before risky operations. Download one and use Import to restore it.</p>
            <ul className="history">
              {snapshots.map((snap) => (
                <li key={snap.id}>
                  <span>
                    {snap.reason} <span className="muted">· {new Date(snap.createdAt).toLocaleString()} · {snap.plants} plants</span>
                  </span>
                  <button className="btn btn-small btn-ghost" onClick={() => downloadJSON(snap.data, `fronds-snapshot-${snap.createdAt.slice(0, 10)}.json`)}>
                    ⬇️
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card">
        <h3>Plant identification (optional)</h3>
        <p className="muted small">
          Identify plants from a photo with Pl@ntNet. Needs a free Pl@ntNet account and your own API key (500
          identifications a day). Your key is stored on this phone only. When you tap Identify, the photo is sent to
          Pl@ntNet.
        </p>
        <p className="small">
          <a className="link" href="https://my.plantnet.org/" target="_blank" rel="noreferrer">
            Get a free key
          </a>
        </p>
        <ol className="muted small">
          <li>Create a free account at my.plantnet.org.</li>
          <li>Copy your API key from your account page.</li>
          <li>Paste it below and tap Save.</li>
        </ol>
        <div className="row">
          <input
            className="input"
            type="text"
            value={keyText}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Pl@ntNet API key"
            aria-label="Pl@ntNet API key"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn" onClick={() => void onSaveKey()}>
            Save
          </button>
        </div>
        {savedKey && (
          <p className="small">
            <span className="muted">Key saved on this phone.</span>{' '}
            <button className="btn btn-small btn-ghost" onClick={() => void onRemoveKey()}>
              Remove key
            </button>
          </p>
        )}
      </section>

      <SyncSection />

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
        <h3>Updates</h3>
        <p className="muted small">
          fronds updates itself. See what changed in each version
          {BUTTONDOWN_USERNAME ? ', or get a short email when a new one comes out.' : '.'}
        </p>
        <Link className="btn btn-small" to="/whats-new">
          ✨ What's new
        </Link>
        <SubscribeForm />
      </section>

      <section className="card">
        <h3>About</h3>
        <p className="muted small">
          fronds v{__APP_VERSION__} · open source ·{' '}
          <a className="link" href={LINKS.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <br />
          Plant descriptions and photos from Wikipedia. No account, no tracking.
          <br />
          Updates arrive on their own, like any website. Your plants stay on this device, and every
          change is public on GitHub.
        </p>
        <p className="small">
          ☕ Enjoying fronds? It's free and always will be.{' '}
          <a className="link" href={LINKS.donate} target="_blank" rel="noreferrer">
            Support it on Ko-fi
          </a>
        </p>
      </section>
    </>
  )
}
