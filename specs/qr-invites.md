# QR code for household invites

Status: draft
Issue: 
Builds after: none

## Problem
Adding a phone to a household means sending yourself the invite link through a messaging app, even
when both phones are in the same room.

## Behavior
1. Settings → Sync & reminders → Invite a phone → "Create invite" now shows a QR code of the invite
   link above the code and the share button. It is about 220 px, with a white quiet zone so it scans
   in dark mode.
2. The new phone scans it with its camera app, which opens the invite link
   (`#/settings?server=…&invite=…`). The Join form is prefilled, as it is today with a tapped link.
3. **iPhone.** A scanned link opens in Safari, which has separate storage from the Home Screen app.
   When `inIosBrowser()` is true and the link carries an invite, the Join form shows a notice: "Using
   fronds from your Home Screen? Copy the invite, open the app, and paste it in Join." It has a "Copy
   invite" button (copies the full link, which `parseInvite` already accepts). Joining in Safari
   still works for people who use fronds in Safari.
4. "Done" hides the QR code along with the rest of the invite, as today.

## Out of scope
- Scanning inside the app (camera access; `BarcodeDetector` is missing on iPhone).
- QR codes for share links or the server code.

## Constraints
- Adds one small runtime dependency for QR encoding, `qrcode-generator` (MIT, no dependencies).
  Pin the exact version. Rendering is plain React SVG (`<rect>`s or one `<path>`), so the CSP needs
  no change. Never use `innerHTML`.
- The invite is single-use and expires in 7 days (server), so a photographed QR code is no worse
  than a forwarded link.

## Context for implementers
- `Invite` in `src/ui/components/SyncSection.tsx`. `createInvite`, `inviteLink`, `parseInvite` in
  `src/sync/households.ts`. `ConnectForm` reads `useSearchParams` in the same file.
- `inIosBrowser` in `src/lib/platform.ts`. The handoff pattern is `HandOffToApp` in
  `src/ui/pages/SharedViewPage.tsx`.
- CSP in `vite.config.ts` (unchanged).

## Tasks
1. **QR component**
   - Change: `npm i -E qrcode-generator`. `src/ui/components/QrCode.tsx` with `{ text: string; size?:
     number; label: string }`, which builds the matrix with error correction `'M'` and renders an
     `<svg role="img" aria-label={label}>`, dark modules `#000` on `#fff` with a 4-module margin.
   - Depends on: none
   - Done when: `npm run build` passes, and the built `dist/index.html` CSP is unchanged
     (`git diff --stat vite.config.ts` empty).
   - Executor: sonnet
2. **Show it on invites**
   - Change: render `QrCode` in `Invite` for `invite.link`.
   - Depends on: 1
   - Done when: `npm run lint` and `npm run build` pass, and `grep -n "QrCode" src/ui/components/SyncSection.tsx`
     finds the use (the scan itself is an acceptance check).
   - Executor: haiku
3. **iPhone handoff notice**
   - Change: in `ConnectForm`, when `inIosBrowser()` and `params.get('invite')`, show the notice and
     the "Copy invite" button (the full current URL).
   - Depends on: none
   - Done when: `npm run lint` passes. Manual check in iPhone Safari (or a user-agent override in
     desktop dev tools).
   - Executor: sonnet
4. **Version and changelog**
   - Change: minor bump and a `CHANGELOG.md` entry.
   - Depends on: 2, 3
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] An Android phone camera scanning the QR code opens fronds with server and invite prefilled.
- [ ] iPhone Safari shows the handoff notice, and the copied link pasted into the Home Screen app's
      Join box fills both fields.
- [ ] The QR code scans in dark mode (white background kept).
- [ ] No CSP change, and no `dangerouslySetInnerHTML` (`grep -rn dangerouslySetInnerHTML src` is empty).

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.

## Escalate when
- The QR library needs `eval`, canvas or `innerHTML`.

## Open questions
- None.

## Notes
- `pot-stickers` reuses `QrCode`.
