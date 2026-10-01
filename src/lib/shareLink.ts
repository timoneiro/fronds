import { decodeShare, encodeShare, ShareError, type SharedCollection } from '../domain/share'

/*
 * Share link = app URL + "#/view/" + base64url(deflate-raw(JSON)). The data
 * stays in the fragment, which browsers never send to the server.
 */

const VIEW_ROUTE = '#/view/'
const MAX_DATA_CHARS = 100_000
const MAX_JSON_BYTES = 1_000_000

const currentAppUrl = () => (typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`)

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Stops past `limit` bytes, so a crafted link can't inflate into something huge. */
async function decompress(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('Share data too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function shareLink(share: SharedCollection, appUrl = currentAppUrl()): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(encodeShare(share)))
  return appUrl + VIEW_ROUTE + toBase64Url(await compress(json))
}

/** Decodes the `<data>` part of a share link. Throws ShareError with a message for people. */
export async function readShareData(data: string): Promise<SharedCollection> {
  let raw: unknown
  try {
    if (data.length > MAX_DATA_CHARS) throw new Error('Share data too large')
    raw = JSON.parse(new TextDecoder().decode(await decompress(fromBase64Url(data), MAX_JSON_BYTES)))
  } catch {
    throw new ShareError('This link is incomplete. It may have been cut off when it was copied, so ask for it again.')
  }
  return decodeShare(raw)
}
