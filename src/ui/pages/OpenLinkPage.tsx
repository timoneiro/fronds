import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { shareRouteFrom } from '../../lib/shareLink'

const canReadClipboard = () => typeof navigator.clipboard?.readText === 'function'

/**
 * Opens a share link copied elsewhere. On iPhone, links always open in Safari,
 * whose storage is separate from the Home Screen app: this is how they get here.
 */
export function OpenLinkPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()

  const open = (value: string) => {
    const route = shareRouteFrom(value)
    if (route) navigate(route)
    else setError("That isn't a fronds share link. Copy the whole link and try again.")
  }

  const onPaste = async () => {
    setError(undefined)
    try {
      const pasted = await navigator.clipboard.readText()
      setText(pasted)
      open(pasted)
    } catch {
      setError("Couldn't paste. Press and hold the box below and choose Paste.")
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>Open a shared link</h2>
        <Link className="btn btn-small btn-ghost" to="/plants">
          Cancel
        </Link>
      </div>
      <p className="muted">Paste a link someone sent you to look at their plants.</p>
      {canReadClipboard() && (
        <button className="btn btn-primary" onClick={() => void onPaste()}>
          📋 Paste shared link
        </button>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          open(text)
        }}
      >
        <input
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
          placeholder="https://…/fronds/#/view/…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Share link"
        />
        {error && <p className="notice notice-error">{error}</p>}
        <button className="btn" type="submit" disabled={!text.trim()}>
          Open
        </button>
      </form>
    </>
  )
}
