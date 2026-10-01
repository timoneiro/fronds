import { describe, expect, it } from 'vitest'
import { ShareError, type SharedCollection } from '../domain/share'
import { readShareData, shareLink, shareRouteFrom } from './shareLink'

const APP = 'https://timoneiro.github.io/fronds/'

const share: SharedCollection = {
  sharedOn: '2026-10-01',
  sharedBy: 'Zoë',
  plants: Array.from({ length: 20 }, (_, i) => ({
    name: `Plant ${i + 1} 🌿`,
    wateringIntervalDays: 7,
    room: ['Living room', 'Kitchen', 'Bathroom'][i % 3],
    speciesId: 'epipremnum-aureum',
    lastWateredDaysAgo: i % 7,
  })),
}

const dataOf = (link: string) => link.slice(`${APP}#/view/`.length)

describe('share links', () => {
  it('round-trip through the URL, including non-ASCII text', async () => {
    const link = await shareLink(share, APP)
    expect(link.startsWith(`${APP}#/view/`)).toBe(true)
    expect(dataOf(link)).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await readShareData(dataOf(link))).toEqual(share)
  })

  it('stays short enough to send in a chat for 20 plants', async () => {
    expect((await shareLink(share, APP)).length).toBeLessThan(1500)
  })

  it('explains a link that was cut off', async () => {
    const data = dataOf(await shareLink(share, APP))
    await expect(readShareData(data.slice(0, data.length / 2))).rejects.toThrow(ShareError)
    await expect(readShareData('not*base64')).rejects.toThrow(/cut off/)
  })

  it('finds the link in a pasted message', () => {
    expect(shareRouteFrom(`Sam shared 20 plants with you on fronds 🪴 ${APP}#/view/abc-_9`)).toBe('/view/abc-_9')
    expect(shareRouteFrom(`${APP}#/view/abc/12\n`)).toBe('/view/abc/12')
    expect(shareRouteFrom('http://localhost:5173/#/view/xyz')).toBe('/view/xyz')
    expect(shareRouteFrom(`${APP}#/settings?invite=K7QM`)).toBeUndefined()
    expect(shareRouteFrom('hello')).toBeUndefined()
  })

  it('refuses data that inflates to something huge', async () => {
    const big = new TextEncoder().encode(`[1,"2026-10-01",null,[],[["${'a'.repeat(2_000_000)}",7]]]`)
    const stream = new Blob([big]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
    const data = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await expect(readShareData(data)).rejects.toThrow(ShareError)
  })
})
