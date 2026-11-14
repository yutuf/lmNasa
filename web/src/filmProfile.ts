// Schematic coast and descent readouts for the mission film. The shape is a nominal profile
// (the same 185 km, 10.9 km/s, 6,000 km/h and ~4.5 days the film already states, plus the
// mean Earth–Moon distance). Nothing here is a measurement of this flight.
import type { Lang } from './i18n'

export const PROFILE = {
  tliKms: 10.9,             // launch card: speed after trans-lunar injection
  leoAltKm: 185,            // launch card: parking orbit
  burnKms: 6000 / 3600,     // film line: braking burn starts at 6,000 km/h
  lloAltKm: 100,            // polar-orbit altitude the descent leaves
  burnRangeKm: 480,         // schematic distance to the site when the burn starts
  moonKm: 384_400,
  earthRKm: 6371,
  moonRKm: 1737.4,
  coastS: 4.5 * 86400,
  descentS: 12 * 60,
} as const

export interface Readout {
  altKm: number
  velKms: number
  rangeKm: number
  ttlS: number
  /** profile = nominal flight curve; site = the computed terrain height, with the planned touchdown state */
  kind: 'profile' | 'site'
}

function clamp01(t: number) {
  if (!Number.isFinite(t) || t < 0) return 0
  return t > 1 ? 1 : t
}

function smooth(t: number) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u
}

const RANGE0 = PROFILE.moonKm - PROFILE.earthRKm - PROFILE.leoAltKm - PROFILE.moonRKm

/** Coast, t = 0 just after TLI, t = 1 at the start of the braking burn. */
export function coastReadout(t: number): Readout {
  const u = smooth(t)
  const lin = clamp01(t)
  return {
    altKm: lerp(PROFILE.leoAltKm, PROFILE.moonKm - PROFILE.earthRKm, u),
    velKms: lerp(PROFILE.tliKms, PROFILE.burnKms, u),
    rangeKm: lerp(RANGE0, PROFILE.lloAltKm, u),
    ttlS: PROFILE.coastS * (1 - lin) + PROFILE.descentS,
    kind: 'profile',
  }
}

/** Powered descent, t = 0 at burn start, t = 1 at the planned touchdown. */
export function descentReadout(t: number): Readout {
  const burn = 1 - clamp01(t)
  return {
    altKm: PROFILE.lloAltKm * burn ** 2.4,
    velKms: PROFILE.burnKms * burn ** 2.8,
    rangeKm: PROFILE.burnRangeKm * burn ** 1.15,
    ttlS: PROFILE.descentS * burn,
    kind: 'profile',
  }
}

/** On the surface: terrain height is computed; speed, range and the clock are the planned touchdown. */
export function siteReadout(heightM: number): Readout {
  return { altKm: heightM / 1000, velKms: 0, rangeKm: 0, ttlS: 0, kind: 'site' }
}

/** 0 at t <= at, 1 at t >= at + span. Reduced motion snaps to the finished state. */
export function rise(t: number, at: number, span: number, reduce: boolean) {
  if (reduce || span <= 0) return 1
  const u = (t - at) / span
  return u < 0 ? 0 : u > 1 ? 1 : u
}

/** Which mission day (0-based) a 0..1 playback has reached. */
export function dayIndex(t: number, n: number) {
  if (n <= 0) return 0
  const u = clamp01(t)
  if (u >= 1) return n - 1
  return Math.min(n - 1, Math.floor(u * n))
}

export function fmtNum(v: number, digits: number, lang: Lang) {
  return v.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtKm(km: number, lang: Lang) {
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB'
  if (km >= 100) return `${km.toLocaleString(loc, { maximumFractionDigits: 0 })} km`
  if (km >= 1) return `${km.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  return `${Math.round(km * 1000).toLocaleString(loc)} m`
}

export function fmtVel(kms: number, lang: Lang) {
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB'
  const unit = lang === 'tr' ? 'km/sn' : 'km/s'
  const msUnit = lang === 'tr' ? 'm/sn' : 'm/s'
  if (kms >= 0.05) return `${kms.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`
  const ms = kms * 1000
  if (ms < 0.05) return `0 ${msUnit}`
  return `${ms.toLocaleString(loc, { maximumFractionDigits: 1 })} ${msUnit}`
}

export function fmtClock(seconds: number, lang: Lang) {
  const s = Math.max(0, Math.round(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(h)}:${pad(m)}:${pad(sec)}`
  if (d <= 0) return clock
  return lang === 'tr' ? `${d}g ${clock}` : `${d}d ${clock}`
}

export function fmtLat(lat: number, lang: Lang) {
  const hemi = lat >= 0 ? (lang === 'tr' ? 'K' : 'N') : (lang === 'tr' ? 'G' : 'S')
  return `${Math.abs(lat).toFixed(2)}°${hemi}`
}

export function fmtLon(lon: number, lang: Lang) {
  const x = ((lon % 360) + 360) % 360
  const east = x <= 180
  const v = east ? x : 360 - x
  const hemi = east ? (lang === 'tr' ? 'D' : 'E') : (lang === 'tr' ? 'B' : 'W')
  return `${v.toFixed(1)}°${hemi}`
}
