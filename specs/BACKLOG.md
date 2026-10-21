# fronds: parked and dropped ideas

Ideas that are not specced yet. To build one, run `/spec <idea>`; it becomes `specs/<name>.md`.
Specced ideas live in their own files in this folder. Shipped features are in `CHANGELOG.md`.

Guiding constraint: keep accounts and API keys to a minimum. Anything that needs one must be
optional, and the app must keep working without it.

## Parked

### Conflicts with "no accounts or keys unless optional" (optional add-on only)
- **Google Drive backup**: the backup JSON in Drive's hidden `appDataFolder` (scope `drive.appdata`,
  non-sensitive, so no Google verification). One opt-in "Sign in with Google". Reuse `buildBackup`
  and `mergeRecords`: on open, pull, merge and push. Needs a public OAuth client ID with the Pages
  origin authorised. Open: automatic or manual "Back up now"? Keep N dated versions?
- **Adaptive Google Calendar sync**: one "next watering" event per plant that moves when watered.
  Calendar scope is sensitive (Google verification). `calendar-feed` covers most of this keylessly.
- **Weather-aware intervals** (Open-Meteo, keyless): heatwaves shorten balcony plants' intervals.
  Needs a CSP `connect-src` entry and location.
- **Plant ID from a photo**: specced in `plant-id-from-photo.md` (Pl@ntNet, each user's own key).
  Proxying a key via the self-hosted server stays parked.
- **Health diagnosis from a photo**: Plant.id / Kindwise (paid) or an LLM with the user's own key,
  clearly labelled as a suggestion.
- **Perenual** as an optional richer data source (user key) for species outside the catalog.

### Sync server and reminders
- **ntfy / Telegram** as extra reminder channels (server env var, no app change). A **Telegram bot**
  with inline "Watered" buttons.
- **Notification actions** ("Mark all watered" from the notification): Android and desktop only (iOS
  has no actions). Logs waterings from the service worker, then syncs.
- **Several reminders per day**, or **per-plant opt-out** of reminders.
- **Periodic Background Sync** (Chrome/Android installed PWAs) to push offline changes without
  opening the app.
- **Encrypt the store at rest** or end-to-end encrypt sync payloads with a key derived from the
  household, so a leaked NAS backup reveals nothing. Low value for plant data.
- **"Who watered it"** on events (multi-user households). Needs per-device identity on events, which
  the device tokens now make possible.
- **Move to a new phone via QR**: a small backup (no photos) in QR codes, or a one-time link via the
  server.

### Care and collection
- **Pot and placement factors**: pot size and material (terracotta dries faster), distance from the
  window, drainage. These nudge the suggested interval.
- **Bulk actions** (partly done: "Water all" on Today): water a whole room, multi-select on Plants.
- **Watering amount and method** notes per plant (bottom watering, soak).
- **Propagation tracking**: cuttings linked to a parent plant, a "family tree".
- **Purchase info**: date, shop, price.
- **Grow the bundled catalog** to about 150 species. Accept community PRs, and maybe split it into JSON.

### Convenience
- **Home screen shortcuts** (manifest `shortcuts`: Today, Add plant) and an **app icon badge**
  (Badging API) with the number of plants due.

### Homelab (via the optional server)
- **Soil moisture sensors** (Xiaomi MiFlora/BLE, Zigbee) via Home Assistant: auto-log waterings and
  switch plants to sensor-driven reminders.
- **Home Assistant** sensors per plant (days until due) and an HA notification channel.

### Platform and quality
- i18n scaffolding if other languages are ever wanted (English only by decision).
- End-to-end tests with Playwright (add → water → export → import, two phones syncing).
- Encrypted backups (passphrase) before uploading anywhere.
- Accessibility pass (screen reader labels, focus states, reduced motion).

## Dropped (with the reason, so they are not re-proposed)
- None yet.
