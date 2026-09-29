import type { Plant } from '../db/types.ts'

/**
 * Calendar reminders without any Google/Apple API: a prefilled "Add to Google
 * Calendar" link per plant, and an .ics file that any calendar app imports.
 * These are static recurring events — they don't move when a plant is watered
 * late. Adaptive reminders need the optional push server (see README roadmap).
 */

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const dayAfter = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

export function googleCalendarLink(plant: Plant, firstDue: Date, appUrl?: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `💧 Water ${plant.name}`,
    dates: `${ymd(firstDue)}/${ymd(dayAfter(firstDue))}`,
    details: `Every ${plant.wateringIntervalDays} days.${appUrl ? `\n${appUrl}` : ''}`,
    recur: `RRULE:FREQ=DAILY;INTERVAL=${plant.wateringIntervalDays}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545 line folding: max 75 octets per line, continuation lines start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildICS(items: { plant: Plant; firstDue: Date }[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fronds//watering//EN', 'CALSCALE:GREGORIAN']
  for (const { plant, firstDue } of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:water-${plant.id}@fronds`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(firstDue)}`,
      `DTEND;VALUE=DATE:${ymd(dayAfter(firstDue))}`,
      `RRULE:FREQ=DAILY;INTERVAL=${plant.wateringIntervalDays}`,
      `SUMMARY:${escapeText(`💧 Water ${plant.name}`)}`,
      `DESCRIPTION:${escapeText(`Every ${plant.wateringIntervalDays} days.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Water ${plant.name}`)}`,
      'TRIGGER;RELATED=START:PT9H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
