// Countdown, launch-slip and nearest GO dates for one site.
// One pointSky call covers the chosen landing, up to ten days of slip, about two years
// either side (for other GO days and the next set/rise) and, when it falls inside the
// ephemeris, the current hour. Sunset is not a one-hour graze: the Sun has to stay
// below half a disk for three hours. Earth-set is the next hour pointSky says Earth
// is gone (below the terrain, or no DSN dish when that check is on; a relay still counts).
import { pointSky, type Atlas, type Ephem } from './engine'
import { evaluateWindow, type Constraints, type Window } from './model'
import type { Lang } from './i18n'

export const SUN_DARK_HOURS = 3
export const SLIP_MAX = 10
export const LOOKAHEAD_DAYS = 730

export type Reason = Window['reasons'][number]

export interface BodyClock {
  up: boolean
  /** Hours from the reference until the next set. When the body is already down, this is the set after it next rises. */
  setInH: number | null
  /** Hours until the next rise. When the body is up, this is the rise after the set above. */
  riseInH: number | null
}

export interface SlipVerdict {
  slip: number
  go: boolean
  /** False when the slipped mission runs past the end of the sky we have. */
  covered: boolean
  reasons: Reason[]
}

export interface GoDate {
  /** Days after the chosen landing. Negative means earlier. */
  deltaDays: number
  /** UTC calendar day, YYYY-MM-DD. */
  iso: string
}

export interface Timeline {
  landingHour: number
  landingIso: string
  landingSun: BodyClock
  landingEarth: BodyClock
  nowHour: number | null
  outside: 'before' | 'after' | null
  nowSun: BodyClock | null
  nowEarth: BodyClock | null
  slips: SlipVerdict[]
  prev: GoDate | null
  next: GoDate[]
}

export interface TimelineInput {
  atlas: Atlas
  eph: Ephem
  dsn: ArrayLike<boolean>
  index: number
  firstHour: number
  bestStart: number
  days: number
  needDsn: boolean
  relay: boolean
  c: Constraints
  startUnix: number
  nowMs: number
}

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
}

const DOWN: BodyClock = { up: false, setInH: null, riseInH: null }

export function ephemLength(eph: Ephem): number {
  return Math.min(
    eph.n,
    eph.sun[0].length, eph.sun[1].length, eph.sun[2].length,
    eph.earth[0].length, eph.earth[1].length, eph.earth[2].length,
    eph.sunR.length,
  )
}

/** Absolute ephemeris hour containing `nowMs`, or null when that instant is outside the catalogue. */
export function ephemHourAt(startUnix: number, ephemHours: number, nowMs: number): number | null {
  if (!Number.isFinite(startUnix) || !Number.isFinite(nowMs) || ephemHours <= 0) return null
  const h = Math.floor((nowMs / 1000 - startUnix) / 3600)
  if (h < 0 || h >= ephemHours) return null
  return h
}

export function ephemSide(startUnix: number, ephemHours: number, nowMs: number): 'before' | 'after' | null {
  if (!Number.isFinite(startUnix) || !Number.isFinite(nowMs) || ephemHours <= 0) return 'before'
  const h = Math.floor((nowMs / 1000 - startUnix) / 3600)
  if (h < 0) return 'before'
  if (h >= ephemHours) return 'after'
  return null
}

/** UTC date of an ephemeris hour. `startUnix` is seconds. */
export function hourIso(startUnix: number, hour: number): string {
  return new Date((startUnix + hour * 3600) * 1000).toISOString().slice(0, 10)
}

export function formatDay(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number)
  const name = MONTHS[lang][(m ?? 1) - 1] ?? ''
  return `${d} ${name} ${y}`
}

/** Compact countdown: 148 h → "6 d 4 h" / "6 g 4 sa". Zero is "now" / "şimdi". */
export function formatSpan(hours: number, lang: Lang): string {
  const h = Math.max(0, Math.round(hours))
  if (h === 0) return lang === 'tr' ? 'şimdi' : 'now'
  const d = Math.floor(h / 24)
  const hr = h % 24
  if (lang === 'tr') {
    if (d === 0) return `${hr} sa`
    if (hr === 0) return `${d} g`
    return `${d} g ${hr} sa`
  }
  if (d === 0) return `${hr} h`
  if (hr === 0) return `${d} d`
  return `${d} d ${hr} h`
}

function nextHold(down: (i: number) => boolean, n: number, start: number, persist: number): number | null {
  const from = Math.max(0, start)
  for (let h = from; h + persist <= n; h++) {
    let hold = true
    for (let k = 0; k < persist; k++) if (!down(h + k)) { hold = false; break }
    if (!hold) continue
    // A real drop: the hour before was still up (hour 0 counts only when we start there).
    if (h === 0 || !down(h - 1)) return h
  }
  return null
}

function nextUp(up: (i: number) => boolean, n: number, start: number): number | null {
  for (let h = Math.max(0, start); h < n; h++) if (up(h)) return h
  return null
}

/** `persist` hours below the "up" test, starting on a falling edge. Sun uses 3; Earth uses 1. */
export function bodyClock(up: (i: number) => boolean, n: number, from: number, persist: number): BodyClock {
  if (n <= 0 || !Number.isFinite(from)) return DOWN
  const i = Math.floor(from)
  if (i < 0 || i >= n) return DOWN
  const isUp = up(i)
  const down = (k: number) => !up(k)
  if (isUp) {
    const setAt = nextHold(down, n, i, persist)
    const riseAt = setAt === null ? null : nextUp(up, n, setAt + 1)
    return {
      up: true,
      setInH: setAt === null ? null : setAt - i,
      riseInH: riseAt === null ? null : riseAt - i,
    }
  }
  const riseAt = nextUp(up, n, i + 1)
  const setAt = riseAt === null ? null : nextHold(down, n, riseAt, persist)
  return {
    up: false,
    setInH: setAt === null ? null : setAt - i,
    riseInH: riseAt === null ? null : riseAt - i,
  }
}

export function sunClock(sun: ArrayLike<number>, from: number, persist = SUN_DARK_HOURS): BodyClock {
  return bodyClock((i) => sun[i] >= 0.5, sun.length, from, persist)
}

export function earthClock(visible: ArrayLike<boolean>, from: number): BodyClock {
  return bodyClock((i) => !!visible[i], visible.length, from, 1)
}

function bodyName(kind: 'sun' | 'earth', up: boolean, lang: Lang): string {
  if (kind === 'sun') {
    if (lang === 'tr') return up ? 'Güneş var' : 'Güneş yok'
    return up ? 'Sun up' : 'Sun down'
  }
  if (lang === 'tr') return up ? 'Dünya görünüyor' : 'Dünya yok'
  return up ? 'Earth up' : 'Earth down'
}

/** One line: state, the next set, and the rise that belongs with it. */
export function clockSummary(kind: 'sun' | 'earth', clock: BodyClock, lang: Lang): string {
  const name = bodyName(kind, clock.up, lang)
  const tr = lang === 'tr'
  const sets = (h: number) => (tr ? `${formatSpan(h, lang)} içinde batar` : `sets in ${formatSpan(h, lang)}`)
  const rises = (h: number) => (tr ? `${formatSpan(h, lang)} içinde doğar` : `rises in ${formatSpan(h, lang)}`)
  if (clock.up) {
    if (clock.setInH === null) return `${name}, ${tr ? 'bu aralıkta batmıyor' : 'no set in this window'}`
    const rise = clock.riseInH === null ? (tr ? 'sonrasında doğuş yok' : 'no rise after that') : rises(clock.riseInH)
    return `${name}, ${sets(clock.setInH)}, ${rise}`
  }
  if (clock.riseInH === null) return `${name}, ${tr ? 'bu aralıkta doğmuyor' : 'no rise in this window'}`
  const set = clock.setInH === null ? (tr ? 'sonrasında batış yok' : 'no set after that') : sets(clock.setInH)
  return `${name}, ${rises(clock.riseInH)}, ${set}`
}

export function touchdownText(sun: BodyClock, earth: BodyClock, lang: Lang): string {
  return `${clockSummary('sun', sun, lang)}. ${clockSummary('earth', earth, lang)}.`
}

export function rightNowText(sun: BodyClock, earth: BodyClock, lang: Lang): string {
  const lead = lang === 'tr' ? 'Şu an bu noktada' : 'Right now at this site'
  return `${lead}: ${clockSummary('sun', sun, lang)}; ${clockSummary('earth', earth, lang)}.`
}

/** Shown when the clock is outside the ephemeris. The catalogue itself starts in Nov 2026. */
export function coverageNote(startUnix: number, ephemHours: number, nowMs: number, lang: Lang): string | null {
  const side = ephemSide(startUnix, ephemHours, nowMs)
  if (!side) return null
  const startLabel = formatDay(hourIso(startUnix, 0), lang)
  if (side === 'before') {
    return lang === 'tr'
      ? `Saat saat veri ${startLabel} tarihinde başlıyor.`
      : `Hour-by-hour data starts ${startLabel}.`
  }
  const endLabel = formatDay(hourIso(startUnix, Math.max(0, ephemHours - 1)), lang)
  return lang === 'tr'
    ? `Saat saat veri ${startLabel} tarihinde başlıyor ve ${endLabel} tarihinde bitiyor.`
    : `Hour-by-hour data starts ${startLabel} and ends ${endLabel}.`
}

export function limitNote(needDsn: boolean, relay: boolean, lang: Lang): string {
  if (lang === 'tr') {
    const earth = needDsn
      ? 'Dünya batışı, Dünya’nın arazi ufkunun altına indiği ya da hiçbir Derin Uzay Ağı anteninin Ay’ı görmediği ilk saattir.'
      : 'Dünya batışı, Dünya’nın arazi ufkunun altına indiği ilk saattir.'
    return `Gün batımı, Güneş’in görünen payının en az 3 saat boyunca %50’nin altında kaldığı ilk saattir. ${earth}${relay ? ' Röle uydusu da bağlantı sayılır.' : ''}`
  }
  const earth = needDsn
    ? 'Earth-set is the next hour Earth drops below the terrain horizon, or no Deep Space Network station can see the Moon.'
    : 'Earth-set is the next hour Earth drops below the terrain horizon.'
  return `Sunset is the first hour the Sun stays below half a disk for at least 3 hours. ${earth}${relay ? ' A relay satellite still counts as contact.' : ''}`
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** One reason, in the order evaluateWindow pushed them. Several reasons join with "; ". */
export function reasonText(reasons: Reason[], c: Constraints, lang: Lang): string {
  const tr = lang === 'tr'
  return reasons.map((r) => {
    if (r.kind === 'shadow') {
      const hv = fmtNum(r.value)
      const lim = fmtNum(c.max_dark_hours)
      return tr ? `en uzun karanlık ${hv} sa > ${lim} sa` : `longest dark ${hv} h > ${lim} h`
    }
    if (r.kind === 'sun') {
      const got = Math.round(r.value * 100)
      const need = Math.round(c.min_sun_frac * 100)
      return tr ? `güneş ışığı %${got} < %${need}` : `sunlight ${got}% < ${need}%`
    }
    if (r.kind === 'earth') {
      const got = Math.round(r.value * 100)
      const need = Math.round(c.min_comm_frac * 100)
      return tr ? `Dünya bağlantısı %${got} < %${need}` : `Earth contact ${got}% < ${need}%`
    }
    const hv = fmtNum(r.value)
    return tr ? `batarya ${hv} sa sonra bitiyor` : `battery fails at ${hv} h`
  }).join('; ')
}

export function slipLine(v: SlipVerdict, c: Constraints, lang: Lang): string {
  const verdict = v.go ? 'GO' : 'NO-GO'
  const head = lang === 'tr'
    ? `${v.slip} gün gecikme → ${verdict}`
    : `Slip ${v.slip} ${v.slip === 1 ? 'day' : 'days'} → ${verdict}`
  if (!v.covered) return lang === 'tr' ? `${head}: verinin dışında` : `${head}: outside the data`
  if (v.go) return head
  const why = reasonText(v.reasons, c, lang)
  return why ? `${head}: ${why}` : head
}

export function deltaLabel(delta: number, lang: Lang): string {
  const n = Math.abs(delta)
  if (lang === 'tr') return delta < 0 ? `${n} g önce` : `${n} g sonra`
  return delta < 0 ? `${n} d earlier` : `${n} d later`
}

export function datesNote(hasPrev: boolean, nextCount: number, lang: Lang): string | null {
  if (!hasPrev && nextCount === 0) {
    return lang === 'tr'
      ? 'Seçilen güne 2 yıl içinde başka GO iniş tarihi yok.'
      : 'No other GO landing date within 2 years of the chosen day.'
  }
  if (nextCount === 0) {
    return lang === 'tr' ? 'Sonraki 2 yılda başka GO tarihi yok.' : 'No GO date in the next 2 years.'
  }
  return null
}

function take(sun: ArrayLike<number>, earth: ArrayLike<boolean>, index: number, len: number): { sf: Float64Array; ev: boolean[] } | null {
  if (len <= 0 || index < 0 || index + len > sun.length || index + len > earth.length) return null
  const sf = new Float64Array(len)
  const ev = new Array<boolean>(len)
  for (let i = 0; i < len; i++) {
    sf[i] = sun[index + i]
    ev[i] = !!earth[index + i]
  }
  return { sf, ev }
}

export function slipVerdicts(sun: ArrayLike<number>, earth: ArrayLike<boolean>, landingIndex: number, durationH: number, c: Constraints, maxSlip = SLIP_MAX): SlipVerdict[] {
  const out: SlipVerdict[] = []
  for (let slip = 0; slip <= maxSlip; slip++) {
    const slice = take(sun, earth, landingIndex + slip * 24, durationH)
    if (!slice) {
      out.push({ slip, go: false, covered: false, reasons: [] })
      continue
    }
    const w = evaluateWindow(slice.sf, slice.ev, 1, c)
    out.push({ slip, go: w.go, covered: true, reasons: w.reasons })
  }
  return out
}

/** The previous GO landing day and the next few, stepping one day at a time from the chosen hour. */
export function nearbyGoDates(
  sun: ArrayLike<number>, earth: ArrayLike<boolean>, landingIndex: number, durationH: number,
  c: Constraints, startUnix: number, originHour: number, ahead = 3, maxDays = LOOKAHEAD_DAYS,
): { prev: GoDate | null; next: GoDate[] } {
  const at = (delta: number, index: number): GoDate => ({
    deltaDays: delta,
    iso: hourIso(startUnix, originHour + index),
  })
  const go = (index: number) => {
    const slice = take(sun, earth, index, durationH)
    return slice !== null && evaluateWindow(slice.sf, slice.ev, 1, c).go
  }
  const next: GoDate[] = []
  for (let d = 1; d <= maxDays && next.length < ahead; d++) {
    const index = landingIndex + d * 24
    if (index + durationH > sun.length || index + durationH > earth.length) break
    if (go(index)) next.push(at(d, index))
  }
  let prev: GoDate | null = null
  for (let d = 1; d <= maxDays; d++) {
    const index = landingIndex - d * 24
    if (index < 0) break
    if (go(index)) { prev = at(-d, index); break }
  }
  return { prev, next }
}

/** Hours of sky to ask pointSky for: one contiguous span, clamped to the ephemeris. */
export function skySpan(ephemHours: number, landingHour: number, durationH: number, nowH: number | null): { origin: number; hours: number } {
  const back = LOOKAHEAD_DAYS * 24
  const forward = LOOKAHEAD_DAYS * 24 + durationH
  let origin = landingHour - back
  if (nowH !== null) origin = Math.min(origin, nowH)
  if (ephemHours <= 0) return { origin: 0, hours: 0 }
  origin = Math.max(0, Math.min(origin, ephemHours - 1))
  let end = Math.max(landingHour + forward, landingHour + SLIP_MAX * 24 + durationH)
  if (nowH !== null) end = Math.max(end, nowH + LOOKAHEAD_DAYS * 24)
  end = Math.min(ephemHours, Math.max(end, origin))
  return { origin, hours: end - origin }
}

function blankSlips(): SlipVerdict[] {
  return Array.from({ length: SLIP_MAX + 1 }, (_, slip) => ({ slip, go: false, covered: false, reasons: [] }))
}

export function buildTimeline(input: TimelineInput): Timeline {
  const ephemHours = ephemLength(input.eph)
  const durationH = Math.max(1, Math.round(input.days)) * 24
  const landingHour = Math.round(input.firstHour) + Math.round(input.bestStart) * 24
  const nowH = ephemHourAt(input.startUnix, ephemHours, input.nowMs)
  const outside = ephemSide(input.startUnix, ephemHours, input.nowMs)
  const base = {
    landingHour: Number.isFinite(landingHour) ? landingHour : 0,
    landingIso: Number.isFinite(landingHour) ? hourIso(input.startUnix, landingHour) : '',
    landingSun: DOWN,
    landingEarth: DOWN,
    nowHour: nowH,
    outside,
    nowSun: null,
    nowEarth: null,
    slips: blankSlips(),
    prev: null,
    next: [],
  }
  if (!Number.isFinite(landingHour) || input.index < 0 || input.index >= input.atlas.n || ephemHours <= 0) return base

  const span = skySpan(ephemHours, landingHour, durationH, nowH)
  // The only sky sample. Slips, countdowns and the GO-day search all read this.
  const sky = pointSky(input.atlas, input.eph, input.dsn, input.index, span.origin, span.hours, input.needDsn, input.relay)
  const landingIndex = landingHour - span.origin
  let nowSun: BodyClock | null = null
  let nowEarth: BodyClock | null = null
  if (nowH !== null) {
    const idx = nowH - span.origin
    if (idx >= 0 && idx < sky.sunFraction.length) {
      nowSun = sunClock(sky.sunFraction, idx)
      nowEarth = earthClock(sky.earthVisible, idx)
    }
  }
  const near = nearbyGoDates(sky.sunFraction, sky.earthVisible, landingIndex, durationH, input.c, input.startUnix, span.origin)
  return {
    ...base,
    landingSun: sunClock(sky.sunFraction, landingIndex),
    landingEarth: earthClock(sky.earthVisible, landingIndex),
    nowSun,
    nowEarth,
    slips: slipVerdicts(sky.sunFraction, sky.earthVisible, landingIndex, durationH, input.c),
    prev: near.prev,
    next: near.next,
  }
}
