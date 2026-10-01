/*
 * Emails this version's CHANGELOG.md entry to the Buttondown subscribers.
 *
 * Runs in CI after each deploy of main. Sends at most once per version: if Buttondown already has an
 * email with the same subject, it does nothing — so re-runs and deploys without a version bump are safe.
 * Without BUTTONDOWN_API_KEY it does nothing either. `--dry-run` only prints the email.
 *
 *   node scripts/announce-release.ts --dry-run
 */
import { readFileSync } from 'node:fs'
import { findRelease, parseChangelog, releaseEmail } from '../src/domain/changelog.ts'
import { LINKS } from '../src/lib/links.ts'

const API = 'https://api.buttondown.com/v1'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const { version } = JSON.parse(read('../package.json')) as { version: string }
const release = findRelease(parseChangelog(read('../CHANGELOG.md')), version)
if (!release) {
  console.error(`CHANGELOG.md has no entry for ${version}.`)
  process.exit(1)
}
const email = releaseEmail(release, LINKS.app)

if (process.argv.includes('--dry-run')) {
  console.log(`Subject: ${email.subject}\n\n${email.body}`)
  process.exit(0)
}

const key = process.env.BUTTONDOWN_API_KEY
if (!key) {
  console.log('::notice::BUTTONDOWN_API_KEY is not set, so no release email was sent.')
  process.exit(0)
}

async function buttondown<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Buttondown ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

const existing = await buttondown<{ results: { subject: string; status: string }[] }>(
  `/emails?subject=${encodeURIComponent(email.subject)}`,
)
if (existing.results.some((e) => e.subject === email.subject && e.status !== 'deleted')) {
  console.log(`Already in Buttondown, not sending again: "${email.subject}"`)
  process.exit(0)
}

await buttondown('/emails', {
  method: 'POST',
  // Buttondown requires this opt-in header the first time an API key sends straight away (not a draft).
  headers: { 'X-Buttondown-Live-Dangerously': 'true' },
  body: JSON.stringify({ subject: email.subject, body: email.body, status: 'about_to_send' }),
})
console.log(`::notice::Release email queued for subscribers: "${email.subject}"`)
