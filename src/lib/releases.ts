import changelog from '../../CHANGELOG.md?raw'
import { getSetting, setSetting } from '../db/db'
import { parseChangelog } from '../domain/changelog'

/** Every release in CHANGELOG.md, newest first (bundled, so it works offline). */
export const RELEASES = parseChangelog(changelog)

/** Local to this device: each phone shows "What's new" once. */
const LAST_SEEN = 'lastSeenVersion'

export const getLastSeenVersion = () => getSetting<string>(LAST_SEEN)
export const markReleasesSeen = () => setSetting(LAST_SEEN, __APP_VERSION__)
