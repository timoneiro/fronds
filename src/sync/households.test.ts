import { describe, expect, it } from 'vitest'
import { inviteLink, parseInvite } from './households'

describe('invite links', () => {
  const server = 'https://caixa.example.ts.net:10443'
  const link = inviteLink(server, 'K7QM-2XRP-9HTW', 'https://timoneiro.github.io/fronds/')

  it('carry the server and code in the app URL fragment', () => {
    expect(link).toBe(
      'https://timoneiro.github.io/fronds/#/settings?server=https%3A%2F%2Fcaixa.example.ts.net%3A10443&invite=K7QM-2XRP-9HTW',
    )
  })

  it('parse back from a pasted link or a bare code', () => {
    expect(parseInvite(link)).toEqual({ code: 'K7QM-2XRP-9HTW', server })
    expect(parseInvite('  k7qm 2xrp 9htw ')).toEqual({ code: 'k7qm 2xrp 9htw' })
    expect(parseInvite('')).toEqual({})
  })
})
