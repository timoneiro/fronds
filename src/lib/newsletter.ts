/**
 * Buttondown username for release emails. Kept out of the repo: CI passes the BUTTONDOWN_USERNAME
 * secret in as VITE_BUTTONDOWN_USERNAME at build time (locally, put it in `.env.local`). It still
 * ends up in the built app and the subscribe request — it's just not published in the source.
 * Empty → the subscribe form stays hidden.
 */
export const BUTTONDOWN_USERNAME = import.meta.env.VITE_BUTTONDOWN_USERNAME ?? ''
