import { describe, expect, it } from 'vitest'
import { parseDeskToPhone, parsePhoneHash, parsePhoneToDesk, peerIdFor, phoneUrl } from './phoneLink'

describe('phone link', () => {
  it('reads the room code and language from the phone hash', () => {
    expect(parsePhoneHash('#phone?code=ab12cd&lang=tr')).toEqual({ code: 'AB12CD', lang: 'tr' })
    expect(parsePhoneHash('#phone')).toEqual({ code: null, lang: 'en' })
    expect(parsePhoneHash('#judges')).toEqual({ code: null, lang: 'en' })
  })

  it('builds a url a phone can open', () => {
    expect(phoneUrl('https://lunanav-theta.vercel.app', '/', 'K7MQ2P', 'en')).toBe('https://lunanav-theta.vercel.app/#phone?code=K7MQ2P&lang=en')
    expect(phoneUrl('http://localhost:5173', '/', 'K7MQ2P', 'en')).toBe('https://lunanav-theta.vercel.app/#phone?code=K7MQ2P&lang=en')
    expect(phoneUrl('http://127.0.0.1:5173', '/web/', 'K7MQ2P', 'tr')).toBe('https://lunanav-theta.vercel.app/#phone?code=K7MQ2P&lang=tr')
    expect(peerIdFor('k7mq2p')).toBe('lunanav-K7MQ2P')
  })

  it('accepts look and mission messages and drops junk', () => {
    expect(parsePhoneToDesk({ t: 'ori', heading: 10, alt: 2, roll: -4 })).toEqual({ t: 'ori', heading: 10, alt: 2, roll: -4 })
    expect(parsePhoneToDesk({ t: 'cmd', name: 'find' })).toEqual({ t: 'cmd', name: 'find' })
    expect(parsePhoneToDesk({ t: 'cmd', name: 'nope' })).toBeNull()
    expect(parseDeskToPhone({ t: 'site', name: 'Shoemaker', lat: -88, lon: 20 })).toEqual({ t: 'site', name: 'Shoemaker', lat: -88, lon: 20 })
    expect(parseDeskToPhone(null)).toBeNull()
  })
})
