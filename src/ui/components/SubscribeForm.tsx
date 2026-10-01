import { useState } from 'react'
import { BUTTONDOWN_USERNAME } from '../../lib/newsletter'

/**
 * Release-email signup. A plain form post to Buttondown (no API key, no backend); it opens in a new
 * tab because Buttondown may ask for a CAPTCHA, and it sends the confirmation email (double opt-in).
 */
export function SubscribeForm() {
  const [status, setStatus] = useState<'sent' | 'offline'>()
  if (!BUTTONDOWN_USERNAME) return null

  return (
    <form
      className="stack"
      action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`}
      method="post"
      target="_blank"
      onSubmit={(e) => {
        if (navigator.onLine) return setStatus('sent')
        e.preventDefault()
        setStatus('offline')
      }}
    >
      <input type="hidden" name="embed" value="1" />
      <div className="row">
        <input className="input subscribe-email" type="email" name="email" required placeholder="you@example.com" autoComplete="email" aria-label="Email address" />
        <button className="btn btn-primary" type="submit">
          Subscribe
        </button>
      </div>
      {status === 'sent' && <p className="notice notice-ok small">Almost done — confirm with the link in the email we just sent you.</p>}
      {status === 'offline' && <p className="notice notice-warn small">You're offline. Try again when you're connected.</p>}
      <p className="muted small">
        One short email per new version, nothing else. Your address is kept by Buttondown, our newsletter service — not
        in the app, which still has no account. Unsubscribe from any email.
      </p>
    </form>
  )
}
