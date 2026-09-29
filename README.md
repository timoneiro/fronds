# 🌿 fronds

A small, installable web app for keeping track of your houseplants and when to water them.
Built for phones (Android and iPhone), works offline, and needs **no account and no API keys**.

**Use it:** https://timoneiro.github.io/fronds/ → open on your phone → *Add to Home Screen*.

## Features

- **Today view** — what needs water now and what's coming up this week; one tap to log a watering,
  "Later" to snooze a plant whose soil is still moist, "Water all" for a watering round.
- **Plant collection** — name, species, room, photo and notes, grouped by room and searchable.
- **Built-in care guide** for ~60 common houseplants: light, humidity, difficulty, a care tip,
  a baseline watering interval and **pet toxicity** (ASPCA). Works offline.
- **Wikipedia descriptions and photos** for any species — including ones outside the catalog.
- **Adaptive watering** — after a few waterings, fronds suggests an interval based on what you actually do.
- **Calendar reminders** — "Add to Google Calendar" link per plant, or download an `.ics` file for
  Google/Apple Calendar with every plant's recurring watering.
- **Backup & transfer** — export a single JSON file and import it on another device. Imports *merge*
  record-by-record (newest edit wins, deletions included), so it's safe to import the same file twice.

## Privacy & data

Everything is stored locally in your browser (IndexedDB). Nothing is sent anywhere except species
look-ups to Wikipedia. Browsers can evict site data under storage pressure — especially iOS Safari —
so install the app to your home screen and **export a backup now and then**.

## Roadmap

- **Google Drive backup** — sign in with Google only if you want it; stores the same backup file in the
  app's private Drive folder.
- **Optional self-hosted sync & reminder server** — a single Docker container (e.g. on a home NAS)
  that syncs devices and sends real push notifications when a plant is due. The app keeps working
  fully without it.
- Care tasks beyond watering (fertilising, repotting, misting), seasonal interval adjustments,
  photo timeline.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck
npm run build      # production build into dist/
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, React Router (hash routing so
deep links work on GitHub Pages). Pushes to `main` are tested and deployed to GitHub Pages by
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

```
src/
  db/        Dexie schema, write actions, backup import/export
  domain/    pure logic: watering schedule, backup merge, calendar export (unit-tested)
  species/   bundled care catalog + Wikipedia client
  ui/        pages, components, hooks
```

### Adding a species

Append an entry to [`src/species/catalog.ts`](src/species/catalog.ts). `wiki` must be an existing
English Wikipedia article title; pet toxicity should follow the
[ASPCA plant list](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants).
PRs welcome.

## License

[MIT](LICENSE)
