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

const numFmts = new Map<string, Intl.NumberFormat>()
export function fmtNum(v: number, digits: number, lang: Lang) {
  // formatters are cached: building one per call, every frame, was a measurable cost in the film
  const key = `${lang}:${digits}`
  let f = numFmts.get(key)
  if (!f) { f = new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }); numFmts.set(key, f) }
  return f.format(v)
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

// --- film scenes: the landing window, the Monte Carlo dots, the landing ellipse ---
// Layouts are built once from the numbers the film was given. Dot positions in the
// ellipse and the odds are a schematic of those totals, not a map and not a replay
// of each random draw (the card only carries the shares).

export interface WindowDay {
  /** true = GO, false = NO-GO, null = this date was not in the series */
  go: boolean | null
  best: boolean
}

export interface WindowPlan {
  days: WindowDay[]
  go: number
  total: number
  /** false when per-day flags were absent: only the chosen date is marked, nothing else is invented */
  known: boolean
}

function whole(n: number) {
  return Number.isFinite(n) ? Math.floor(n) : 0
}

/** Day-by-day GO flags from `perStart`. Without that series, only the chosen date is marked. */
export function windowPlan(
  perStart: boolean[] | undefined | null,
  windowDays: number,
  bestStart: number,
  goDates: number,
  bestGo: boolean,
): WindowPlan {
  const best = whole(bestStart)
  if (perStart && perStart.length > 0) {
    const days: WindowDay[] = []
    let go = 0
    for (let i = 0; i < perStart.length; i++) {
      const g = !!perStart[i]
      if (g) go++
      days.push({ go: g, best: i === best })
    }
    return { days, go, total: days.length, known: true }
  }
  const total = Math.max(0, whole(windowDays))
  const days: WindowDay[] = []
  for (let i = 0; i < total; i++) {
    const isBest = i === best
    // bestGo is the computed verdict for the chosen date. Every other date stays unknown.
    days.push({ go: isBest ? !!bestGo : null, best: isBest })
  }
  const go = Math.max(0, Math.min(total, whole(goDates)))
  return { days, go, total, known: false }
}

/** How many GO days are on screen after `lit` cells have appeared. */
export function windowShownGo(plan: WindowPlan, lit: number) {
  const n = Math.max(0, Math.min(plan.total, whole(lit)))
  if (!plan.known) {
    if (plan.total <= 0 || n <= 0) return 0
    if (n >= plan.total) return plan.go
    return Math.round(plan.go * (n / plan.total))
  }
  let g = 0
  for (let i = 0; i < n; i++) if (plan.days[i].go) g++
  return g
}

export interface WindowCell extends WindowDay {
  num: string
  month: string
}

export interface WindowModel {
  plan: WindowPlan
  cells: WindowCell[]
  months: { name: string; n: number }[]
  chosen: string
}

/** Calendar labels for one landing window. The chosen cell is `landingMs`; other days step from it. */
export function windowModel(plan: WindowPlan, landingMs: number, lang: Lang): WindowModel {
  const anchor = plan.days.findIndex((d) => d.best)
  const dated = anchor >= 0 && Number.isFinite(landingMs)
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB'
  const dayFmt = dated ? new Intl.DateTimeFormat(loc, { day: 'numeric', timeZone: 'UTC' }) : null
  const monthFmt = dated ? new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }) : null
  const cells: WindowCell[] = []
  for (let i = 0; i < plan.days.length; i++) {
    const d = plan.days[i]
    if (!dated || !dayFmt || !monthFmt) {
      cells.push({ go: d.go, best: d.best, num: String(i + 1), month: '' })
      continue
    }
    const dt = new Date(landingMs + (i - anchor) * 86400000)
    cells.push({ go: d.go, best: d.best, num: dayFmt.format(dt), month: monthFmt.format(dt) })
  }
  const months: { name: string; n: number }[] = []
  if (dated && cells.length > 0 && cells.length <= 40) {
    for (const c of cells) {
      const last = months[months.length - 1]
      if (!last || last.name !== c.month) months.push({ name: c.month, n: 1 })
      else last.n++
    }
  }
  const chosen = Number.isFinite(landingMs)
    ? new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(landingMs))
    : ''
  return { plan, cells, months, chosen }
}

/** How many of `n` items are visible at playback t (0..1). Reduced motion shows every item. */
export function revealCount(t: number, n: number, at: number, span: number, reduce: boolean) {
  if (!Number.isFinite(n) || n <= 0) return 0
  const total = Math.floor(n)
  if (reduce) return total
  const u = rise(t, at, span, false)
  if (u >= 1) return total
  if (u <= 0) return 0
  return Math.min(total, Math.floor(u * total))
}

/** Largest-remainder split. Counts sum to `n` when any weight is positive, else they stay 0. */
export function shareCounts(weights: number[], n: number): number[] {
  const m = weights.length
  const out = Array.from({ length: m }, () => 0)
  if (n <= 0 || m === 0) return out
  let sum = 0
  const scaled: number[] = []
  for (let i = 0; i < m; i++) {
    const w = weights[i]
    const s = w > 0 && Number.isFinite(w) ? w : 0
    scaled.push(s)
    sum += s
  }
  if (sum <= 0) return out
  const frac: number[] = []
  let baseSum = 0
  for (let i = 0; i < m; i++) {
    const raw = (scaled[i] / sum) * n
    const base = Math.floor(raw + 1e-9)
    out[i] = base
    frac.push(raw - base)
    baseSum += base
  }
  let left = n - baseSum
  if (left < 0) {
    const order = out.map((_, i) => i).sort((a, b) => out[b] - out[a] || a - b)
    for (let k = 0; left < 0 && k < m * n; k++) {
      const i = order[k % m]
      if (out[i] > 0) { out[i]--; left++ }
    }
    return out
  }
  const order = frac.map((_, i) => i).sort((a, b) => frac[b] - frac[a] || a - b)
  for (let k = 0; k < left; k++) out[order[k % m]]++
  return out
}

export const ODDS_CAP = 300
/** Seconds of the 0..1 scene used for one dot to fall, after its own start. */
export const ODDS_FALL = 0.18
export const ODDS_BINS = ['ok', 'landing', 'tip', 'power', 'comms'] as const

export interface OddsCauses {
  landing: number
  tip: number
  power: number
  comms: number
}

export interface OddsLayout {
  n: number
  trials: number
  /** true when dots were capped below the real trial count; proportions are kept */
  capped: boolean
  /** dot counts per bin: success, landing failed, tipped, power, contact */
  counts: number[]
  bin: Uint8Array
  x: Float32Array
  y: Float32Array
  /** when the dot starts to fall, in scene time 0..1 */
  t0: Float32Array
}

function lcg(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** About 300 dots, one per trial up to the cap, stacked in five bins by the reported shares. */
export function oddsLayout(p: number, causes: OddsCauses, trials: number): OddsLayout {
  const tCount = Math.max(0, whole(trials))
  const want = Math.min(ODDS_CAP, tCount)
  const counts = shareCounts([
    Number.isFinite(p) ? Math.max(0, p) : 0,
    causes.landing, causes.tip, causes.power, causes.comms,
  ], want)
  let nDots = 0
  for (let b = 0; b < counts.length; b++) nDots += counts[b]
  const items: { b: number; x: number; y: number }[] = []
  for (let b = 0; b < 5; b++) {
    const c = counts[b] ?? 0
    if (c <= 0) continue
    const cols = Math.max(1, Math.ceil(Math.sqrt(c)))
    const rows = Math.ceil(c / cols)
    const mid = (b + 0.5) / 5
    const span = 0.16
    const rowGap = Math.min(0.045, 0.7 / rows)
    for (let i = 0; i < c; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = mid + ((col + 0.5) / cols - 0.5) * span
      const y = 0.9 - (row + 0.5) * rowGap
      items.push({ b, x, y })
    }
  }
  const rnd = lcg(Math.imul(tCount + 1, 1664525) ^ Math.round((Number.isFinite(p) ? p : 0) * 1e6))
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  const bin = new Uint8Array(nDots)
  const x = new Float32Array(nDots)
  const y = new Float32Array(nDots)
  const t0 = new Float32Array(nDots)
  for (let i = 0; i < nDots; i++) {
    bin[i] = items[i].b
    x[i] = items[i].x
    y[i] = items[i].y
    t0[i] = nDots <= 1 ? 0.08 : 0.05 + 0.58 * (i / (nDots - 1))
  }
  return { n: nDots, trials: tCount, capped: nDots < tCount, counts, bin, x, y, t0 }
}

/** Settled dots per bin at scene time t. Index order matches ODDS_BINS. */
export function oddsSettled(layout: OddsLayout, t: number, reduce: boolean): number[] {
  const out = [0, 0, 0, 0, 0]
  for (let i = 0; i < layout.n; i++) {
    const u = reduce ? 1 : (t - layout.t0[i]) / ODDS_FALL
    if (u >= 1) out[layout.bin[i]]++
  }
  return out
}

/** Vertical place of a falling dot. Null before it appears. y grows downward, 0 at the top. */
export function oddsDotY(settled: number, t0: number, t: number, reduce: boolean): number | null {
  if (reduce) return settled
  const u = (t - t0) / ODDS_FALL
  if (u <= 0) return null
  if (u >= 1) return settled
  const e = u * u * (3 - 2 * u)
  return -0.08 + (settled + 0.08) * e
}

export interface EllipseDot {
  /** -1..1 from the centre of the circle */
  x: number
  y: number
  pass: boolean
}

/**
 * Schematic points inside a circle. Exactly `go` of them pass (clamped to the point count).
 * Placement is a spiral so the picture reads as "inside the radius"; it is not the grid map.
 */
export function ellipseDots(points: number, go: number): EllipseDot[] {
  const n = Math.max(0, whole(points))
  if (n <= 0) return []
  const passN = Math.max(0, Math.min(n, whole(go)))
  const gold = Math.PI * (3 - Math.sqrt(5))
  const dots: EllipseDot[] = []
  for (let i = 0; i < n; i++) {
    const r = n === 1 ? 0 : Math.sqrt((i + 0.5) / n) * 0.86
    const a = i * gold
    const pass = Math.floor((i + 1) * passN / n) > Math.floor(i * passN / n)
    dots.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, pass })
  }
  return dots
}

/** Judge cut and the longer technical insert. Durations are wall-clock seconds. */
export const FILM_DUR = {
  title: 4, launch: 6, window: 6, coast: 5, descent: 6, landing: 10, site: 6, ellipse: 6, rover: 7, odds: 6, verdict: 5,
} as const

export type FilmSceneId = keyof typeof FILM_DUR

/** Default is the short judge cut. Technical adds the window, the site board, the ellipse and the odds. */
export function filmScenes(technical: boolean, opts: { landing: boolean; rover: boolean; ellipse: boolean; odds: boolean }): FilmSceneId[] {
  const landing = opts.landing ? ['landing' as const] : []
  const rover = opts.rover ? ['rover' as const] : []
  if (!technical) return ['title', 'launch', 'coast', 'descent', ...landing, ...rover, 'verdict']
  const ellipse = opts.ellipse ? ['ellipse' as const] : []
  const odds = opts.odds ? ['odds' as const] : []
  return ['title', 'launch', 'window', 'coast', 'descent', ...landing, 'site', ...ellipse, ...rover, ...odds, 'verdict']
}

export function filmRuntime(ids: readonly FilmSceneId[]) {
  return ids.reduce((n, id) => n + FILM_DUR[id], 0)
}
