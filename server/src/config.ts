import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import webpush from 'web-push'
import { newCode } from './secrets.ts'

export interface Config {
  port: number
  dataDir: string
  /** Code the server owner shares with people allowed to create a household. */
  serverCode: string
  /** Shared key from server 0.1, only used to migrate an existing single-household store. */
  legacyKey?: string
  vapid: { publicKey: string; privateKey: string; subject: string }
  allowedOrigins: string[] | '*'
  timezone: string
}

interface Secrets {
  serverCode?: string
  /** Server 0.1's shared household key. */
  key?: string
  vapidPublicKey: string
  vapidPrivateKey: string
}

/**
 * Secrets are generated on first start and kept in the data volume. Existing
 * values are never regenerated — the VAPID keys in particular must stay the
 * same or every phone's push subscription stops working.
 */
async function loadSecrets(dataDir: string): Promise<Secrets> {
  await mkdir(dataDir, { recursive: true })
  const path = join(dataDir, 'secrets.json')
  let secrets: Secrets | undefined
  try {
    secrets = JSON.parse(await readFile(path, 'utf8')) as Secrets
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  if (secrets?.serverCode) return secrets

  if (!secrets) {
    const vapid = webpush.generateVAPIDKeys()
    secrets = { vapidPublicKey: vapid.publicKey, vapidPrivateKey: vapid.privateKey }
  }
  secrets.serverCode = newCode()
  await writeFile(path, JSON.stringify(secrets, null, 2), { mode: 0o600 })
  return secrets
}

export async function loadConfig(env = process.env): Promise<Config> {
  const dataDir = env.DATA_DIR ?? './data'
  const secrets = await loadSecrets(dataDir)
  const origins = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    port: Number(env.PORT ?? 8787),
    dataDir,
    serverCode: env.FRONDS_SERVER_CODE || secrets.serverCode!,
    legacyKey: env.FRONDS_KEY || secrets.key,
    vapid: {
      publicKey: secrets.vapidPublicKey,
      privateKey: secrets.vapidPrivateKey,
      subject: env.VAPID_SUBJECT ?? 'https://github.com/timoneiro/fronds',
    },
    allowedOrigins: origins.includes('*') || !origins.length ? '*' : origins,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}
