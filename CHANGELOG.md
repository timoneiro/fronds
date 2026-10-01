# Changelog

What's new in fronds, newest first. This file is shown in the app (Settings → What's new) and each new
version's entry is emailed to subscribers when it's deployed.

<!--
Every user-facing change bumps "version" in package.json and adds an entry here (a test enforces it).
Heading: "## x.y.z — YYYY-MM-DD". Body: short paragraphs and "- " bullets; inline **bold** and `code`.
Write for people who use the app, not for developers.
-->

## 0.6.0 — 2026-10-01

- **Change your server's address** — if the sync server you use is now reached at a new address
  (for example, it moved to a different Tailscale network), go to **Settings → Sync & reminders →
  Change address** and enter the new one. Your household, plants and reminders stay as they are,
  and nothing needs to be joined again. Each phone in the household does this once.
- fronds checks that your household really is at the new address before switching, so a typo
  can't disconnect you.

## 0.5.0 — 2026-10-01

- **Share your plants** — tap Share on the Plants page to send a friend a link to look at your
  collection. They see your plants, their care info and when each one is next due, but can't change
  anything. No account needed: everything is inside the link.
- Choose which rooms to share, and whether to include watering dates and your notes (notes are left
  out unless you turn them on). Photos and watering history are never shared.
- The link is a copy from the day you send it and doesn't update. Send a new one any time.
- Opening a shared link never mixes it with your own plants. Tap **Add to my plants** on one you like
  to start your own with the same species and watering interval.
- **On iPhone**, links open in Safari, which keeps its plants separate from the fronds app on your
  Home Screen. So there, **Add in the fronds app** copies the link: open fronds from your Home Screen
  and go to Plants → **Open a shared link** to paste it.

## 0.4.1 — 2026-10-01

- **Updates ask first** — when a new version is ready while you're using fronds, a bar at the bottom
  offers to reload, so nothing you're typing is lost. Tap Later to finish first, and it asks again
  the next time you come back to the app.
- fronds also checks for a new version when you come back to it, not only when it starts.
- Plant pictures from Wikipedia now show when you're offline too.

## 0.4.0 — 2026-10-01

- **What's new** — after an update, fronds now shows what changed. The full history is in
  Settings → What's new.
- **Updates by email** — subscribe in Settings to get a short email when a new version comes out.
  Optional, and you can unsubscribe from any email.
- The watering interval field only accepts whole days from 1 to 90, with a number keypad on phones.

## 0.3.1 — 2026-09-29

- A small "Support it on Ko-fi" link in Settings → About. fronds stays free.

## 0.3.0 — 2026-09-29

- **Households** — one fronds server can host several separate households. Create one with the
  server code, then invite other phones with a one-time invite.
- See the phones in your household and remove any of them. A removed phone keeps its plants.

## 0.2.0 — 2026-09-29

- **Sync & push reminders (optional)** — run your own fronds server to share one plant collection
  between the phones in your home and get a daily notification when plants need water.
- Safety snapshots are taken automatically before risky operations like replacing all your data.

## 0.1.0 — 2026-09-29

- First release: track your houseplants and when to water them, with no account and no API keys.
- Watering log, snooze, and interval suggestions based on how you actually water.
- Built-in care guide for ~60 houseplants, including pet toxicity, plus Wikipedia descriptions.
- Backup export/import and calendar reminders.
