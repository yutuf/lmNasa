// Pair a phone with the desktop. The phone is a remote: its turn rate moves a cursor, and the desktop
// stands at the current site. Signaling goes through PeerJS's public broker.
import type { DataConnection, Peer } from 'peerjs'
import type { Stand } from './phoneLook'
import { PUBLIC_ORIGIN, shareOrigin } from './publicOrigin'

export type PhoneToDesk =
  | { t: 'ori'; heading: number; alt: number; roll: number; aimX: number; aimY: number }
  | { t: 'cmd'; name: 'find' | 'best' }

export type DeskToPhone = { t: 'site'; name: string; lat: number; lon: number }

export type LinkStatus = 'connecting' | 'waiting' | 'live' | 'error'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function roomCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function peerIdFor(code: string): string {
  return `lunanav-${code.toUpperCase()}`
}

export function parsePhoneHash(hash: string): { code: string | null; lang: 'en' | 'tr' } {
  if (!hash.startsWith('#phone')) return { code: null, lang: 'en' }
  const q = new URLSearchParams(hash.slice('#phone'.length).replace(/^\?/, ''))
  const code = q.get('code')
  return { code: code ? code.toUpperCase() : null, lang: q.get('lang') === 'tr' ? 'tr' : 'en' }
}

export { PUBLIC_ORIGIN }

/** Where a phone in the room can open LunaNav. A desktop on localhost cannot be reached by scanning. */
export function phoneUrl(origin: string, path: string, code: string, lang: 'en' | 'tr'): string {
  const base = shareOrigin(origin)
  const route = `#phone?code=${code}&lang=${lang}`
  if (base === PUBLIC_ORIGIN) return `${base}/${route}`
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}${route}`
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function parsePhoneToDesk(raw: unknown): PhoneToDesk | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Partial<PhoneToDesk>
  if (m.t === 'ori' && finite(m.heading) && finite(m.alt) && finite(m.roll)) {
    return { t: 'ori', heading: m.heading, alt: m.alt, roll: m.roll, aimX: finite(m.aimX) ? m.aimX : 0, aimY: finite(m.aimY) ? m.aimY : 0 }
  }
  if (m.t === 'cmd' && (m.name === 'find' || m.name === 'best')) return { t: 'cmd', name: m.name }
  return null
}

export function parseDeskToPhone(raw: unknown): DeskToPhone | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Partial<DeskToPhone>
  if (m.t === 'site' && typeof m.name === 'string' && finite(m.lat) && finite(m.lon)) {
    return { t: 'site', name: m.name, lat: m.lat, lon: m.lon }
  }
  return null
}

export function standFrom(msg: DeskToPhone): Stand {
  return { name: msg.name, lat: msg.lat, lon: msg.lon }
}

type Link = { send: (msg: PhoneToDesk | DeskToPhone) => void; close: () => void }

function end(peer: Peer, conn: DataConnection | null) {
  conn?.close()
  peer.destroy()
}

export async function openHost(code: string, onMsg: (m: PhoneToDesk) => void, onStatus: (s: LinkStatus, detail?: string) => void): Promise<Link> {
  const { Peer } = await import('peerjs')
  const peer = new Peer(peerIdFor(code))
  let conn: DataConnection | null = null
  peer.on('open', () => onStatus('waiting'))
  peer.on('connection', (c) => {
    conn = c
    c.on('data', (raw) => { const m = parsePhoneToDesk(raw); if (m) onMsg(m) })
    c.on('open', () => onStatus('live'))
  })
  peer.on('error', (err) => onStatus('error', err.type))
  return { send: (msg) => conn?.send(msg), close: () => end(peer, conn) }
}

export async function openGuest(code: string, onMsg: (m: DeskToPhone) => void, onStatus: (s: LinkStatus, detail?: string) => void): Promise<Link> {
  const { Peer } = await import('peerjs')
  const peer = new Peer()
  let conn: DataConnection | null = null
  peer.on('open', () => {
    onStatus('connecting')
    conn = peer.connect(peerIdFor(code))
    conn.on('data', (raw) => { const m = parseDeskToPhone(raw); if (m) onMsg(m) })
    conn.on('open', () => onStatus('live'))
    conn.on('error', (err) => onStatus('error', err.type))
  })
  peer.on('error', (err) => onStatus('error', err.type))
  return { send: (msg) => conn?.send(msg), close: () => end(peer, conn) }
}
