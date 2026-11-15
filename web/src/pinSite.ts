// Drop a pin by typing coordinates. Pure helpers: the component only parses, the app evaluates
// the point with searchPoint on the atlas pickAtlas chooses and opens that site.
import { gcKm, type Atlas } from './engine.js'
import type { Lang } from './i18n'

export interface PinCoords { lat: number; lon: number }

export interface NearestGridPoint { index: number; distKm: number }

/** A typed point snapped to the grid the search can actually evaluate. */
export interface ResolvedPin {
  lat: number
  lon: number
  grid: 'pole' | 'moon'
  index: number
  distKm: number
  /** Set when the snap is at least 2 km. Null when the point sits on its grid cell. */
  note: string | null
}

export interface PinExample {
  id: string
  lat: number
  lon: number
  label: { en: string; tr: string }
}

// South of 84.5°S, same cut as scienceSites.inPoleGrid. On the line itself the point is
// outside the 2 km atlas, so it uses the whole-Moon grid.
const POLE_EDGE = -84.5
// Inside a 2 km cell the farthest corner is about 1.4 km. Past one grid step, say so.
const FAR_KM = 2

// K kuzey, G güney, D doğu, B batı. N/S/E/W are the English letters.
const HEMI: Record<string, { axis: 'lat' | 'lon'; sign: 1 | -1 }> = {
  N: { axis: 'lat', sign: 1 },
  K: { axis: 'lat', sign: 1 },
  S: { axis: 'lat', sign: -1 },
  G: { axis: 'lat', sign: -1 },
  E: { axis: 'lon', sign: 1 },
  D: { axis: 'lon', sign: 1 },
  W: { axis: 'lon', sign: -1 },
  B: { axis: 'lon', sign: -1 },
}

const LABEL = String.raw`latitude|lat|enlem|longitude|long|lon|boylam`
// Optional leading or trailing hemisphere. Degrees, or degrees and minutes, or degrees minutes seconds.
// The letter is a hemisphere only when it is not the start of a word ("boylam" must not become "west").
const COORD = /(?:([NSKGEDWB])(?![A-Za-z]))?\s*([+-]?(?:\d+(?:\.\d+)?))(?:\s*°(?:\s*(\d+(?:\.\d+)?))?(?:\s*'(?:\s*(\d+(?:\.\d+)?)\s*(?:"|'')?)?)?)?\s*(?:([NSKGEDWB])(?![A-Za-z]))?/
const GAP = /[\s,;/]+/g

interface One { value: number; axis: 'lat' | 'lon' | null }

/** Longitude into the closed range -180..180. 360 becomes 0; 180 and -180 stay put. */
export function normLon(lon: number): number {
  if (!Number.isFinite(lon)) return lon
  let x = lon % 360
  if (x > 180) x -= 360
  else if (x < -180) x += 360
  return Object.is(x, -0) ? 0 : x
}

function normalize(text: string): string {
  return text
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[º˚]/g, '°')
    .replace(/[′’]/g, "'")
    .replace(/[″“”]/g, '"')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
}

function readOne(lead: string | undefined, degStr: string | undefined, minStr: string | undefined, secStr: string | undefined, trail: string | undefined): One | null {
  if (!degStr) return null
  if (lead && trail && lead.toUpperCase() !== trail.toUpperCase()) return null
  const deg = Number(degStr)
  if (!Number.isFinite(deg)) return null
  const min = minStr === undefined ? null : Number(minStr)
  const sec = secStr === undefined ? null : Number(secStr)
  if (min !== null && (!Number.isFinite(min) || min < 0 || min >= 60)) return null
  if (sec !== null && (min === null || !Number.isFinite(sec) || sec < 0 || sec >= 60)) return null
  if (min !== null && degStr.includes('.')) return null
  let mag = Math.abs(deg)
  if (min !== null) mag += min / 60
  if (sec !== null) mag += sec / 3600
  const letter = (trail ?? lead)?.toUpperCase()
  if (!letter) return { value: (deg < 0 ? -1 : 1) * mag, axis: null }
  const h = HEMI[letter]
  if (!h) return null
  // "-10N" contradicts itself. "-10S" and "10S" are both south.
  if (deg < 0 && h.sign > 0) return null
  return { value: h.sign * mag, axis: h.axis }
}

function finish(lat: number, lon: number): PinCoords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 + 1e-8) return null
  if (Math.abs(lon) > 360 + 1e-8) return null
  return { lat, lon: normLon(lon) }
}

function assign(a: One, b: One): PinCoords | null {
  const lats = [a, b].filter((p) => p.axis === 'lat')
  const lons = [a, b].filter((p) => p.axis === 'lon')
  const free = [a, b].filter((p) => p.axis === null)
  if (lats.length > 1 || lons.length > 1) return null
  if (lats.length === 1 && lons.length === 1) return finish(lats[0].value, lons[0].value)
  if (lats.length === 1 && free.length === 1) return finish(lats[0].value, free[0].value)
  if (lons.length === 1 && free.length === 1) return finish(free[0].value, lons[0].value)
  if (lats.length === 0 && lons.length === 0) return finish(a.value, b.value)
  return null
}

function gapsAreSeparators(s: string, spans: ReadonlyArray<readonly [number, number]>): boolean {
  let at = 0
  for (const [a, b] of spans) {
    if (s.slice(at, a).replace(GAP, '') !== '') return false
    at = b
  }
  return s.slice(at).replace(GAP, '') === ''
}

function hasLabel(s: string): boolean {
  return new RegExp(String.raw`\b(?:${LABEL})\b`, 'i').test(s)
}

function parseLabeled(s: string): PinCoords | null {
  const re = new RegExp(String.raw`\b(${LABEL})\b\s*[:=]?\s*${COORD.source}`, 'gi')
  const matches = [...s.matchAll(re)]
  if (matches.length !== 2) return null
  if (!gapsAreSeparators(s, matches.map((m) => [m.index, m.index + m[0].length] as const))) return null
  const hits: { axis: 'lat' | 'lon'; value: number }[] = []
  for (const m of matches) {
    const word = m[1].toLowerCase()
    const axis: 'lat' | 'lon' = word === 'lat' || word === 'latitude' || word === 'enlem' ? 'lat' : 'lon'
    const one = readOne(m[2], m[3], m[4], m[5], m[6])
    if (!one || (one.axis && one.axis !== axis)) return null
    hits.push({ axis, value: one.value })
  }
  if (hits.filter((h) => h.axis === 'lat').length !== 1 || hits.filter((h) => h.axis === 'lon').length !== 1) return null
  const lat = hits.find((h) => h.axis === 'lat')
  const lon = hits.find((h) => h.axis === 'lon')
  return lat && lon ? finish(lat.value, lon.value) : null
}

function parsePair(s: string): PinCoords | null {
  const matches = [...s.matchAll(new RegExp(COORD.source, 'gi'))]
  if (matches.length !== 2) return null
  if (!gapsAreSeparators(s, matches.map((m) => [m.index, m.index + m[0].length] as const))) return null
  const a = readOne(matches[0][1], matches[0][2], matches[0][3], matches[0][4], matches[0][5])
  const b = readOne(matches[1][1], matches[1][2], matches[1][3], matches[1][4], matches[1][5])
  return a && b ? assign(a, b) : null
}

/** "-89.5, 120", "89.5S 120E", "89°30'S 120°E", "lat -85.4 lon 31.6", and G/K/D/B. */
export function parseCoords(text: string): PinCoords | null {
  const raw = text.trim()
  if (!raw || raw.length > 160) return null
  const s = normalize(raw)
  return hasLabel(s) ? parseLabeled(s) : parsePair(s)
}

/** Decimal degrees, longitude already in -180..180. Trailing zeros trimmed. */
export function formatCoords(lat: number, lon: number): string {
  const t = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return `${t(lat)}, ${t(normLon(lon))}`
}

/**
 * Nearest atlas point. Works on either grid: great-circle kilometres, so a point just
 * west of the date line finds the neighbour just east of it. One scan is enough for a click
 * (about 22k polar points, about 41k whole-Moon points).
 */
export function nearestPoint(atlas: Atlas, lat: number, lon: number): NearestGridPoint {
  let index = -1
  let distKm = Infinity
  for (let i = 0; i < atlas.n; i++) {
    const d = gcKm(lat, lon, atlas.lat[i], atlas.lon[i])
    if (d < distKm) { distKm = d; index = i }
  }
  return { index, distKm }
}

/** South-pole 2 km grid when lat < -84.5; the whole-Moon grid (~30 km) everywhere else, including the north pole. */
export function pickAtlas(lat: number): 'pole' | 'moon' {
  return lat < POLE_EDGE ? 'pole' : 'moon'
}

/** Honest snap distance. Quiet inside one polar cell; "nearest grid point is 12 km away" when it is not. */
export function gridNote(distKm: number, lang: Lang): string | null {
  if (!Number.isFinite(distKm) || distKm < FAR_KM) return null
  const km = Math.round(distKm)
  return lang === 'tr' ? `en yakın ızgara noktası ${km} km uzakta` : `nearest grid point is ${km} km away`
}

/** Pick the grid, snap, and the note. `pole` is the south-pole atlas; `moon` is the whole-Moon atlas. */
export function resolvePin(pole: Atlas, moon: Atlas, lat: number, lon: number, lang: Lang): ResolvedPin {
  const grid = pickAtlas(lat)
  const nearest = nearestPoint(grid === 'pole' ? pole : moon, lat, normLon(lon))
  return { lat, lon: normLon(lon), grid, index: nearest.index, distKm: nearest.distKm, note: gridNote(nearest.distKm, lang) }
}

/**
 * Inverse of geometry.surfacePoint. Pass a raycast hit on the Moon (three.js, y up, moon at the
 * origin; any radius). Globe.tsx does not emit a surface click — onPick is a ranked-pin index —
 * so the app calls this when it adds one.
 * Longitude at the poles is arbitrary.
 */
export function latLonFromThree(x: number, y: number, z: number): PinCoords | null {
  const r = Math.hypot(x, y, z)
  if (!(r > 0) || !Number.isFinite(r)) return null
  const lat = Math.asin(Math.min(1, Math.max(-1, y / r))) * (180 / Math.PI)
  const lon = normLon(Math.atan2(-z, x) * (180 / Math.PI))
  return { lat, lon }
}

/** Chips. Landings are the published points in data/landed_missions.yaml. Shackleton is the rim, not the floor. */
export const PIN_EXAMPLES: readonly PinExample[] = [
  {
    id: 'shackleton-rim',
    // places.test.ts: describePlace(-89.69, 198.05) is "rim of Shackleton". 198.05°E = -161.95°.
    lat: -89.69,
    lon: -161.95,
    label: { en: 'Shackleton rim', tr: 'Shackleton kenarı' },
  },
  {
    id: 'apollo11',
    // Apollo 11 (1969), Tranquility Base.
    lat: 0.67408,
    lon: 23.47297,
    label: { en: 'Apollo 11', tr: 'Apollo 11' },
  },
  {
    id: 'change4',
    // Chang'e 4, far side (2019), Von Kármán.
    lat: -45.4446,
    lon: 177.5991,
    label: { en: "Chang'e 4", tr: "Chang'e 4" },
  },
  {
    id: 'chandrayaan3',
    // Chandrayaan-3 (2023), Shiv Shakti. South, but outside the 2 km grid.
    lat: -69.373,
    lon: 32.319,
    label: { en: 'Chandrayaan-3', tr: 'Chandrayaan-3' },
  },
]
