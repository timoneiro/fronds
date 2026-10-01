import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { db } from '../../db/db'
import { getReminderConfig, getSyncConfig, type SyncConfig } from '../../db/syncState'
import type { DeviceSummary } from '../../domain/syncProtocol'
import { shareUrl } from '../../lib/shareSheet'
import { disconnectServer, runSync } from '../../sync/client'
import {
  createHousehold,
  createInvite,
  defaultDeviceLabel,
  joinHousehold,
  leaveHousehold,
  listDevices,
  parseInvite,
  removeDevice,
} from '../../sync/households'
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
  const [mode, setMode] = useState<'join' | 'create'>(params.get('invite') || !params.get('server') ? 'join' : 'create')
  const [server, setServer] = useState(params.get('server') ?? '')
  const [invite, setInvite] = useState(params.get('invite') ?? '')
  const [serverCode, setServerCode] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [deviceLabel, setDeviceLabel] = useState(defaultDeviceLabel)
  const { busy, status, run } = useAction()

  const onInviteInput = (text: string) => {
    const parsed = parseInvite(text)
    if (parsed.server) {
      setServer(parsed.server)
      setInvite(parsed.code ?? '')
    } else setInvite(text)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void run(() =>
      mode === 'join'
        ? joinHousehold(server, parseInvite(invite).code ?? invite, deviceLabel)
        : createHousehold(server, serverCode, householdName, deviceLabel),
    )
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <p className="muted small">
        Optional. Connect to a fronds server — for example one running on a home NAS — to share your plants between the
        phones in your household and get push reminders. Your plants stay on this phone either way, and a safety
        snapshot is taken before the first sync.
      </p>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
          Join a household
        </button>
        <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
          Create a household
        </button>
      </div>

      {mode === 'join' ? (
        <label className="field">
          <span>Invite link or code</span>
          <input className="input" required value={invite} onChange={(e) => onInviteInput(e.target.value)} placeholder="Paste the link, or a code like K7QM-2XRP-9HTW" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          <small className="muted">Ask someone already in the household for an invite (Settings → Invite a phone).</small>
        </label>
      ) : null}

      <label className="field">
        <span>Server address</span>
        <input className="input" type="url" inputMode="url" required placeholder="https://my-nas.example.ts.net:10443" value={server} onChange={(e) => setServer(e.target.value)} autoComplete="off" />
      </label>

      {mode === 'create' && (
        <>
          <label className="field">
            <span>Server code</span>
            <input className="input" required value={serverCode} onChange={(e) => setServerCode(e.target.value)} placeholder="From whoever runs the server" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </label>
          <label className="field">
            <span>Household name</span>
            <input className="input" required maxLength={60} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="e.g. Casa Lisboa" />
          </label>
        </>
      )}

      <label className="field">
        <span>This phone's name</span>
        <input className="input" required maxLength={60} value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />
        <small className="muted">Shown to your household in the list of connected phones.</small>
      </label>

      {status && <p className={`notice notice-${status.kind}`}>{status.text}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Connecting…' : mode === 'join' ? 'Join household' : 'Create household'}
      </button>
    </form>
  )
}

function Connected({ config }: { config: SyncConfig }) {
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0
  const sync = useAction()
  const revoked = config.lastErrorStatus === 401
  const host = new URL(config.url).host

  const onLeave = () => {
    const msg = 'Leave this household? This phone stops syncing and its access is revoked. Your plants stay on this phone; the household keeps its copy.'
    if (confirm(msg)) void sync.run(leaveHousehold)
  }

  if (revoked) {
    return (
      <div className="stack">
        <p className="notice notice-warn small">
          This phone was removed from {config.household ? `“${config.household.name}”` : 'the household'}. Your plants are
          still here{pending > 0 ? `, including ${pending} change${pending === 1 ? '' : 's'} that never reached the server` : ''}.
        </p>
        <button className="btn" onClick={() => void sync.run(disconnectServer)}>
          Forget this server
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="small">
        {config.household ? (
          <>
            🏡 <strong>{config.household.name}</strong> <span className="muted">on {host}</span>
          </>
        ) : (
          <>
            Connected to <strong>{host}</strong>
          </>
        )}
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
        <button className="btn btn-small btn-ghost" onClick={onLeave}>
          Leave household
        </button>
      </div>
      {config.household && <Invite householdName={config.household.name} />}
      {config.household && <Devices />}
      <Reminders timezone={config.timezone} />
    </div>
  )
}

function Invite({ householdName }: { householdName: string }) {
  const [invite, setInvite] = useState<{ code: string; link: string; expiresAt: string }>()
  const [shared, setShared] = useState<string>()
  const action = useAction()

  return (
    <div className="stack subsection">
      <h4>Invite a phone</h4>
      <p className="muted small">Each invite works once, for 7 days. The new phone gets its own access, which you can remove later.</p>
      {invite ? (
        <div className="invite">
          <code className="invite-code">{invite.code}</code>
          <span className="muted small">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
          <div className="row">
            <button className="btn btn-small btn-primary" onClick={() => void shareUrl(invite.link, `Join ${householdName} on fronds`).then((r) => r && setShared(r))}>
              {shared === 'copied' ? '✓ Link copied' : '🔗 Share invite link'}
            </button>
            <button className="btn btn-small btn-ghost" onClick={() => setInvite(undefined)}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-small" disabled={action.busy} onClick={() => void action.run(async () => setInvite(await createInvite()))}>
          ➕ Create invite
        </button>
      )}
      {action.status && <p className={`notice notice-${action.status.kind}`}>{action.status.text}</p>}
    </div>
  )
}

function Devices() {
  const [devices, setDevices] = useState<DeviceSummary[]>()
  const action = useAction()
  const load = () => action.run(async () => setDevices(await listDevices()))

  const onRemove = (d: DeviceSummary) => {
    if (!confirm(`Remove “${d.label}” from the household? It stops syncing immediately. Its plants stay on that phone.`)) return
    void action.run(async () => {
      await removeDevice(d.id)
      setDevices(await listDevices())
    })
  }

  return (
    <details className="subsection" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !devices && void load()}>
      <summary>
        <h4>Phones in this household</h4>
      </summary>
      {action.status && <p className={`notice notice-${action.status.kind}`}>{action.status.text}</p>}
      {devices && (
        <ul className="history">
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                {d.label} {d.current && <span className="chip">this phone</span>}
                <br />
                <span className="muted small">{d.lastSeenAt ? `Active ${ago(d.lastSeenAt)}` : `Added ${ago(d.createdAt)}`}</span>
              </span>
              {!d.current && (
                <button className="btn btn-small btn-ghost" disabled={action.busy} onClick={() => onRemove(d)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
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
