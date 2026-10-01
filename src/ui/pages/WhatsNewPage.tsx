import { useEffect } from 'react'
import { BUTTONDOWN_USERNAME } from '../../lib/newsletter'
import { markReleasesSeen, RELEASES } from '../../lib/releases'
import { SubscribeForm } from '../components/SubscribeForm'
import { ReleaseNotes } from '../components/WhatsNew'

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })

export function WhatsNewPage() {
  useEffect(() => {
    void markReleasesSeen()
  }, [])

  return (
    <>
      <h2>What's new</h2>
      {BUTTONDOWN_USERNAME && (
        <section className="card">
          <h3>Get updates by email</h3>
          <SubscribeForm />
        </section>
      )}
      {RELEASES.map((release) => (
        <section key={release.version} className="card">
          <h3>
            fronds {release.version} <span className="muted small">· {formatDate(release.date)}</span>
          </h3>
          <ReleaseNotes release={release} />
        </section>
      ))}
    </>
  )
}
