# Send the backup file with the share sheet

Status: draft
Issue: https://github.com/timoneiro/fronds/issues/42
Builds after: none

## Problem
On a phone, "Export backup" drops a file in Downloads (or a Safari download list), and people then
have to find it to send it to themselves or save it to Drive.

## Behavior
1. Settings → Backup & transfer: when the browser can share files
   (`navigator.canShare({ files: [file] })`), the main button reads "📤 Share backup…" and opens the
   system share sheet with `fronds-backup-YYYY-MM-DD.json`. The person picks WhatsApp, Drive, Mail,
   Files and so on. A smaller "Download instead" link keeps the old behaviour.
2. When file sharing is not supported (most desktops), the button stays "⬇️ Export backup" and
   downloads, as today.
3. Cancelling the share sheet shows nothing. A share error falls back to downloading, with the
   message "Couldn't share. Downloaded instead."
4. Safety snapshots get the same share-or-download behaviour on their ⬇️ button.

## Out of scope
- Google Drive sign-in backup (parked in `BACKLOG.md`).
- Scheduled or automatic backups.

## Constraints
- No new permissions or services: Web Share Level 2 only.
- The file content is exactly what Export produces today.

## Context for implementers
- `onExport` and the snapshot list in `src/ui/pages/SettingsPage.tsx`.
- `downloadJSON`, `downloadBlob` in `src/db/backupIO.ts`. `shareUrl` in `src/lib/shareSheet.ts`
  (same `AbortError` handling).

## Tasks
1. **shareFile helper**
   - Change: `canShareFiles()` and `shareFile(blob, filename, title): Promise<'shared' | 'cancelled' |
     'failed'>` in `src/lib/shareSheet.ts`, using a `File` with type `application/json`.
   - Depends on: none
   - Done when: `npm run typecheck` passes.
   - Executor: haiku
2. **Settings buttons**
   - Change: as in Behavior 1–4.
   - Depends on: 1
   - Done when: the manual checks below pass, and `npm run lint` passes.
   - Executor: sonnet
3. **Version and changelog**
   - Change: patch bump and a `CHANGELOG.md` entry.
   - Depends on: 2
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] Android Chrome and iPhone Safari: "Share backup…" opens the share sheet with a `.json` file.
- [ ] Desktop Firefox: the button downloads, as today.
- [ ] Cancelling the sheet shows no error.
- [ ] The shared file imports back with "Import & merge".

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Manual on one Android and one iPhone.

## Escalate when
- A share target rejects `application/json` everywhere (then consider `text/plain` and ask).

## Open questions
- None.

## Notes
- Small, and independent of the server.
