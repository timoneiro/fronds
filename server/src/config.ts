import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import webpush from 'web-push'

export interface Config {
  port: number
  dataDir: string
  /** Household key the app sends as a bearer token. */
  key: string
  vapid: { publicKey: string; privateKey: string; subject: string }
  allowedOrigins: string[] | '*'
  timezone: string
}

interface Secrets {
  key: string
  vapidPublicKey: string
  vapidPrivateKey: string
}

/** Secrets are generated on first start and kept in the data volume. */
async function loadSecrets(dataDir: string): Promise<Secrets> {
  await mkdir(dataDir, { recursive: true })
  const path = join(dataDir, 'secrets.json')
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Secrets
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  const vapid = webpush.generateVAPIDKeys()
  const secrets: Secrets = {
    key: randomBytes(24).toString('base64url'),
    vapidPublicKey: vapid.publicKey,
    vapidPrivateKey: vapid.privateKey,
  }
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
    key: env.FRONDS_KEY || secrets.key,
    vapid: {
      publicKey: secrets.vapidPublicKey,
      privateKey: secrets.vapidPrivateKey,
      subject: env.VAPID_SUBJECT ?? 'https://github.com/timoneiro/fronds',
    },
    allowedOrigins: origins.includes('*') || !origins.length ? '*' : origins,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}
