import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { db } from '../../db/db'
import { getReminderConfig, getSyncConfig, type SyncConfig } from '../../db/syncState'
import { connectServer, disconnectServer, runSync } from '../../sync/client'
import { disableReminders, enableReminders, needsHomeScreenInstall, pushSupported, sendTestReminder } from '../../sync/push'

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.round(mins / 60)
  return hours < 48 ? rtf.format(-hours, 'hour') : rtf.format(-Math.round(hours / 24), 'day')
}

type Status = { kind: 'ok' | 'error'; text: string } | undefined

/** Run an async action with a busy flag and a success/error message. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>()
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    setStatus(undefined)
    try {
      await fn()
      if (ok) setStatus({ kind: 'ok', text: ok })
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return { busy, status, run }
}

export function SyncSection() {
  const config = useLiveQuery(() => getSyncConfig().then((c) => c ?? null), [])
  if (config === undefined) return null
  return (
    <section className="card">
      <h3>Sync & reminders</h3>
      {config ? <Connected config={config} /> : <ConnectForm />}
    </section>
  )
}

function ConnectForm() {
  const [params] = useSearchParams()
  const [url, setUrl] = useState(params.get('server') ?? '')
  const [key, setKey] = useState(params.get('key') ?? '')
  const { busy, status, run } = useAction()

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => connectServer(url, key))
      }}
    >
      <p className="muted small">
        Optional. Connect to a fronds server — for example one running on your home NAS — to keep several phones in sync
        and get push reminders. Your plants stay on this phone either way, and a safety snapshot is taken before the
        first sync.
      </p>
      <label className="field">
        <span>Server address</span>
        <input className="input" type="url" inputMode="url" required placeholder="https://my-nas.example.ts.net:10443" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
      </label>
      <label className="field">
        <span>Household key</span>
        <input className="input" required value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        <small className="muted">Shown in the server's log when it starts.</small>
      </label>
      {status && <p className={`notice notice-${status.kind}`}>{status.text}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  )
}

function Connected({ config }: { config: SyncConfig }) {
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0
  const sync = useAction()
  const [copied, setCopied] = useState(false)

  const inviteLink = `${location.origin}${location.pathname}#/settings?server=${encodeURIComponent(config.url)}&key=${encodeURIComponent(config.key)}`

  const onDisconnect = () => {
    if (!confirm('Stop syncing on this phone? Your plants stay here; the server keeps its copy.')) return
    void sync.run(async () => {
      await disableReminders()
      await disconnectServer()
    })
  }

  return (
    <div className="stack">
      <p className="small">
        Connected to <strong>{new URL(config.url).host}</strong>
      </p>
      {config.lastError ? (
        <p className="notice notice-warn small">
          Couldn't sync{config.lastSyncAt ? ` (last success ${ago(config.lastSyncAt)})` : ''}: {config.lastError}.{' '}
          {pending > 0 && `${pending} change${pending === 1 ? '' : 's'} saved on this phone will sync once the server is reachable again — e.g. when you're back on Tailscale.`}
        </p>
      ) : (
        <p className="muted small">
          {config.lastSyncAt ? `✅ Synced ${ago(config.lastSyncAt)}` : 'Waiting for first sync…'}
          {pending > 0 && ` · ${pending} change${pending === 1 ? '' : 's'} to upload`}
        </p>
      )}
      {sync.status && <p className={`notice notice-${sync.status.kind}`}>{sync.status.text}</p>}
      <div className="row">
        <button className="btn btn-small" disabled={sync.busy} onClick={() => void sync.run(runSync, 'Synced.')}>
          🔄 Sync now
        </button>
        <button
          className="btn btn-small"
          onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({ title: 'Join my fronds', url: inviteLink })
                return
              }
              await navigator.clipboard.writeText(inviteLink)
              setCopied(true)
              setTimeout(() => setCopied(false), 2500)
            } catch (err) {
              if ((err as Error).name !== 'AbortError') prompt('Copy this link and open it on the other phone:', inviteLink)
            }
          }}
        >
          {copied ? '✓ Link copied' : '🔗 Link for another phone'}
        </button>
        <button className="btn btn-small btn-ghost" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
      <Reminders timezone={config.timezone} />
    </div>
  )
}

function Reminders({ timezone }: { timezone?: string }) {
  const reminders = useLiveQuery(() => getReminderConfig().then((c) => c ?? null), [])
  const [time, setTime] = useState<string>()
  const action = useAction()
  if (reminders === undefined) return null

  const enabled = reminders?.enabled ?? false
  const chosen = time ?? reminders?.time ?? '09:00'
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  let blocker: string | undefined
  if (!pushSupported()) blocker = "This browser can't receive push notifications."
  if (needsHomeScreenInstall()) {
    blocker = 'On iPhone, first add fronds to your Home Screen (Share → Add to Home Screen), then open it from there to turn on reminders.'
  }

  return (
    <div className="stack subsection">
      <h4>Daily watering reminder</h4>
      {blocker ? (
        <p className="muted small">{blocker}</p>
      ) : (
        <>
          <div className="row">
            <input className="input input-time" type="time" value={chosen} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" />
            {enabled ? (
              <>
                {chosen !== reminders?.time && (
                  <button className="btn btn-small btn-primary" disabled={action.busy} onClick={() => void action.run(() => enableReminders(chosen), 'Reminder time updated.')}>
                    Save time
                  </button>
                )}
                <button className="btn btn-small" disabled={action.busy} onClick={() => void action.run(sendTestReminder, 'Test sent — check your notifications.')}>
                  Send test
                </button>
                <button className="btn btn-small btn-ghost" disabled={action.busy} onClick={() => void action.run(disableReminders, 'Reminders turned off.')}>
                  Turn off
                </button>
              </>
            ) : (
              <button className="btn btn-small btn-primary" disabled={action.busy} onClick={() => void action.run(() => enableReminders(chosen), 'Reminders on.')}>
                🔔 Turn on
              </button>
            )}
          </div>
          {action.status && <p className={`notice notice-${action.status.kind}`}>{action.status.text}</p>}
          <p className="muted small">
            {enabled ? `On — every day at ${reminders?.time}` : 'Off'}, only when something needs water.
            {timezone && timezone !== localTz && ` Times are in the server's timezone (${timezone}).`} Reminders arrive even
            when you're away from your home network; plants you watered meanwhile are checked on this phone first, so you
            won't be nagged about them.
          </p>
        </>
      )}
    </div>
  )
}
