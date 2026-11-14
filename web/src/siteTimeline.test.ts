import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Atlas, Ephem } from './engine'
import type { Constraints } from './model'
import type { CardSite } from './components/SiteCard'
import type { SiteCtx } from './components/SiteExtras'
import SiteTimeline from './components/SiteTimeline'
import {
  LOOKAHEAD_DAYS,
  buildTimeline,
  clockSummary,
  coverageNote,
  ephemHourAt,
  ephemSide,
  formatSpan,
  nearbyGoDates,
  reasonText,
  rightNowText,
  skySpan,
  slipLine,
  sunClock,
  earthClock,
  type SlipVerdict,
} from './siteTimeline'

const START = Date.parse('2026-11-01T00:00:00Z') / 1000

function mission(over: Partial<Constraints> = {}): Constraints {
  return {
    duration_days: 14,
    min_sun_frac: 0.5,
    min_comm_frac: 0.5,
    max_dark_hours: 48,
    array_peak_w: 400,
    load_w: 80,
    battery_wh: 3000,
    initial_soc: 1,
    charge_eff: 1,
    discharge_eff: 1,
    min_soc: 0.2,
    weights: [1, 1, 1],
    ...over,
  }
}

function flatSite(): Atlas {
  return {
    n: 1, nAz: 4, spacingM: 30000, rMaxM: NaN,
    xKm: new Float64Array([0]), yKm: new Float64Array([0]),
    height: new Int16Array([0]), slope: new Float32Array([0]),
    horizon: new Uint8Array(4),
    lat: new Float64Array([0]), lon: new Float64Array([0]),
    kind: 'moon',
  }
}

/** Sun overhead except [downFrom, downTo). Earth stays overhead. n hours. */
function sky(n: number, downFrom: number, downTo: number): Ephem {
  const sx = new Float32Array(n)
  const sy = new Float32Array(n)
  const sz = new Float32Array(n)
  const ex = new Float32Array(n)
  const ey = new Float32Array(n)
  const ez = new Float32Array(n)
  const sunR = new Float32Array(n)
  for (let h = 0; h < n; h++) {
    sx[h] = h >= downFrom && h < downTo ? -1 : 1
    sunR[h] = 0.25
    ex[h] = 1737.4 + 384000
  }
  return { n, sun: [sx, sy, sz], earth: [ex, ey, ez], sunR }
}

describe('formatSpan', () => {
  it('matches the broadcast form', () => {
    expect(formatSpan(148, 'en')).toBe('6 d 4 h')
    expect(formatSpan(148, 'tr')).toBe('6 g 4 sa')
    expect(formatSpan(24, 'en')).toBe('1 d')
    expect(formatSpan(5, 'en')).toBe('5 h')
    expect(formatSpan(5, 'tr')).toBe('5 sa')
    expect(formatSpan(0, 'en')).toBe('now')
    expect(formatSpan(0, 'tr')).toBe('şimdi')
  })
})

describe('sun and earth clocks', () => {
  it('ignores a dip shorter than 3 hours and catches a real sunset', () => {
    const sun = [1, 0, 0, 1, 0, 0, 0, 0, 1]
    const c = sunClock(sun, 0)
    expect(c.up).toBe(true)
    expect(c.setInH).toBe(4)
    expect(c.riseInH).toBe(8)
  })

  it('treats exactly half a disk as still up', () => {
    expect(sunClock([0.5, 0.5, 0.5], 0)).toMatchObject({ up: true, setInH: null })
    expect(sunClock([1, 0.49, 0.49, 0.49, 1], 0).setInH).toBe(1)
  })

  it('when the Sun is already down, counts the rise and then the next set', () => {
    const sun = [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1]
    const c = sunClock(sun, 1)
    expect(c.up).toBe(false)
    expect(c.riseInH).toBe(3)
    expect(c.setInH).toBe(6)
  })

  it('treats one hour below the horizon as Earth-set', () => {
    const c = earthClock([true, true, false, true], 0)
    expect(c).toMatchObject({ up: true, setInH: 2, riseInH: 3 })
    const down = earthClock([false, false, true, false], 0)
    expect(down).toMatchObject({ up: false, riseInH: 2, setInH: 3 })
  })
})

describe('phrases', () => {
  const sun = { up: true, setInH: 148, riseInH: 20 * 24 + 2 }
  const earth = { up: true, setInH: 2 * 24 + 11, riseInH: 14 * 24 }

  it('says when the Sun sets and when it rises again', () => {
    expect(clockSummary('sun', sun, 'en')).toBe('Sun up, sets in 6 d 4 h, rises in 20 d 2 h')
    expect(clockSummary('earth', earth, 'en')).toBe('Earth up, sets in 2 d 11 h, rises in 14 d')
    expect(rightNowText(sun, earth, 'en')).toBe(
      'Right now at this site: Sun up, sets in 6 d 4 h, rises in 20 d 2 h; Earth up, sets in 2 d 11 h, rises in 14 d.',
    )
    expect(clockSummary('sun', sun, 'tr')).toBe('Güneş var, 6 g 4 sa içinde batar, 20 g 2 sa içinde doğar')
    expect(rightNowText(sun, earth, 'tr')).toContain('Şu an bu noktada: Güneş var')
  })

  it('leads with the rise when the body is already down', () => {
    expect(clockSummary('sun', { up: false, setInH: 16 * 24 + 8, riseInH: 2 * 24 + 1 }, 'en'))
      .toBe('Sun down, rises in 2 d 1 h, sets in 16 d 8 h')
  })
})

describe('slip reasons', () => {
  const c = mission({ min_sun_frac: 0.7, min_comm_frac: 0.5, max_dark_hours: 48 })
  const reasons = [
    { kind: 'sun' as const, value: 0.4 },
    { kind: 'earth' as const, value: 0.3 },
    { kind: 'shadow' as const, value: 61 },
    { kind: 'battery' as const, value: 12 },
  ]
  const noGo = (over: Partial<SlipVerdict> = {}): SlipVerdict => ({ slip: 3, go: false, covered: true, reasons: [{ kind: 'shadow', value: 61 }], ...over })

  it('names the failed check on one line', () => {
    expect(slipLine(noGo(), c, 'en')).toBe('Slip 3 days → NO-GO: longest dark 61 h > 48 h')
    expect(slipLine(noGo(), c, 'tr')).toBe('3 gün gecikme → NO-GO: en uzun karanlık 61 sa > 48 sa')
    expect(slipLine({ slip: 0, go: true, covered: true, reasons: [] }, c, 'en')).toBe('Slip 0 days → GO')
    expect(slipLine({ slip: 1, go: true, covered: true, reasons: [] }, c, 'en')).toBe('Slip 1 day → GO')
    expect(slipLine(noGo({ covered: false, reasons: [] }), c, 'en')).toBe('Slip 3 days → NO-GO: outside the data')
  })

  it('keeps evaluateWindow order when several checks fail', () => {
    expect(reasonText(reasons, c, 'en')).toBe(
      'sunlight 40% < 70%; Earth contact 30% < 50%; longest dark 61 h > 48 h; battery fails at 12 h',
    )
    expect(reasonText(reasons, c, 'tr')).toBe(
      'güneş ışığı %40 < %70; Dünya bağlantısı %30 < %50; en uzun karanlık 61 sa > 48 sa; batarya 12 sa sonra bitiyor',
    )
  })
})

describe('ephemeris clock', () => {
  it('is inside only between the first hour and the last', () => {
    const t0 = Date.parse('2026-11-01T00:00:00Z')
    expect(ephemHourAt(START, 100, t0)).toBe(0)
    expect(ephemHourAt(START, 100, t0 - 1)).toBeNull()
    expect(ephemHourAt(START, 100, Date.parse('2026-11-01T01:30:00Z'))).toBe(1)
    expect(ephemHourAt(START, 100, t0 + 99 * 3600 * 1000)).toBe(99)
    expect(ephemHourAt(START, 100, t0 + 100 * 3600 * 1000)).toBeNull()
    expect(ephemSide(START, 100, Date.parse('2026-10-31T00:00:00Z'))).toBe('before')
    expect(ephemSide(START, 100, t0 + 100 * 3600 * 1000)).toBe('after')
    expect(ephemSide(START, 100, Date.parse('2026-11-01T05:00:00Z'))).toBeNull()
  })

  it('says the data starts in Nov 2026 when today is earlier', () => {
    expect(coverageNote(START, 1000, Date.parse('2026-10-01T00:00:00Z'), 'en'))
      .toBe('Hour-by-hour data starts 1 Nov 2026.')
    expect(coverageNote(START, 1000, Date.parse('2026-10-01T00:00:00Z'), 'tr'))
      .toBe('Saat saat veri 1 Kas 2026 tarihinde başlıyor.')
    expect(coverageNote(START, 1000, Date.parse('2026-11-02T00:00:00Z'), 'en')).toBeNull()
    expect(coverageNote(START, 1000, Date.parse('2027-06-01T00:00:00Z'), 'en'))
      .toMatch(/^Hour-by-hour data starts 1 Nov 2026 and ends /)
  })
})

describe('sky span', () => {
  it('reaches back to now and forward through the slip and the two-year search', () => {
    const span = skySpan(100000, 50000, 48, 10)
    expect(span.origin).toBe(10)
    expect(span.origin + span.hours).toBe(50000 + LOOKAHEAD_DAYS * 24 + 48)
  })

  it('clamps to the ephemeris', () => {
    expect(skySpan(1000, 100, 24, null).origin).toBe(0)
    const end = skySpan(80, 10, 24, null)
    expect(end.origin + end.hours).toBeLessThanOrEqual(80)
  })
})

describe('nearby GO dates', () => {
  it('returns the previous GO day and the next three, skipping the chosen day', () => {
    const c = mission({ max_dark_hours: 1, min_sun_frac: 0, min_comm_frac: 0, load_w: 0, duration_days: 1 })
    const n = 200
    const sun = new Float64Array(n).fill(1)
    const earth = new Array<boolean>(n).fill(true)
    // Day steps of 24 h, windows of 2 h. Landing at hour 48.
    // Delta -1 (hour 24) is dark; delta -2 (hour 0) is lit. Delta +2 is dark.
    sun.fill(0, 24, 26)
    sun.fill(0, 96, 98)
    const { prev, next } = nearbyGoDates(sun, earth, 48, 2, c, START, 0)
    expect(prev).toMatchObject({ deltaDays: -2, iso: '2026-11-01' })
    expect(next.map((d) => d.deltaDays)).toEqual([1, 3, 4])
    expect(next.map((d) => d.iso)).toEqual(['2026-11-04', '2026-11-06', '2026-11-07'])
  })
})

describe('buildTimeline on a flat site', () => {
  const n = 200
  const c = mission({
    duration_days: 2, min_sun_frac: 0.5, min_comm_frac: 0, max_dark_hours: 5, load_w: 0,
  })
  const input = {
    atlas: flatSite(),
    eph: sky(n, 100, 110),
    dsn: Array.from({ length: n }, (_, h) => h < 50),
    index: 0,
    firstHour: 0,
    bestStart: 0,
    days: 2,
    needDsn: true,
    relay: false,
    c,
    startUnix: START,
    nowMs: Date.parse('2026-10-01T00:00:00Z'),
  }

  it('counts sunset after a 3-hour night and Earth-set when DSN drops', () => {
    const t = buildTimeline(input)
    expect(t.outside).toBe('before')
    expect(t.nowSun).toBeNull()
    expect(t.landingIso).toBe('2026-11-01')
    expect(t.landingSun).toMatchObject({ up: true, setInH: 100, riseInH: 110 })
    expect(t.landingEarth).toMatchObject({ up: true, setInH: 50, riseInH: null })
    expect(t.landingSun && clockSummary('sun', t.landingSun, 'en')).toBe(
      'Sun up, sets in 4 d 4 h, rises in 4 d 14 h',
    )
  })

  it('marks each slip from the same sky, and the next GO days', () => {
    const t = buildTimeline(input)
    expect(t.slips.map((v) => v.covered && v.go)).toEqual([
      true, true, true, false, false, true, true, false, false, false, false,
    ])
    expect(slipLine(t.slips[0], c, 'en')).toBe('Slip 0 days → GO')
    expect(slipLine(t.slips[3], c, 'en')).toBe('Slip 3 days → NO-GO: longest dark 10 h > 5 h')
    expect(t.slips[7].covered).toBe(false)
    expect(t.prev).toBeNull()
    expect(t.next.map((d) => d.iso)).toEqual(['2026-11-02', '2026-11-03', '2026-11-06'])
  })

  it('counts from the current hour when that hour is in the catalogue', () => {
    const t = buildTimeline({ ...input, nowMs: Date.parse('2026-11-01T10:00:00Z') })
    expect(t.nowHour).toBe(10)
    expect(t.nowSun).toMatchObject({ up: true, setInH: 90, riseInH: 100 })
    expect(t.nowEarth).toMatchObject({ up: true, setInH: 40, riseInH: null })
    expect(rightNowText(t.nowSun!, t.nowEarth!, 'en')).toBe(
      'Right now at this site: Sun up, sets in 3 d 18 h, rises in 4 d 4 h; Earth up, sets in 1 d 16 h, no rise after that.',
    )
  })

  it('stays quiet for a point index the atlas does not have', () => {
    const t = buildTimeline({ ...input, index: 4 })
    expect(t.slips).toHaveLength(11)
    expect(t.slips.every((v) => !v.covered)).toBe(true)
    expect(t.next).toEqual([])
  })
})

describe('SiteTimeline markup', () => {
  const n = 200
  const c = mission({
    duration_days: 2, min_sun_frac: 0.5, min_comm_frac: 0, max_dark_hours: 5, load_w: 0,
  })
  const ctx: SiteCtx = {
    atlas: flatSite(),
    eph: sky(n, 100, 110),
    dsn: Array.from({ length: n }, (_, h) => h < 50),
    c, firstHour: 0, days: 2, needDsn: true, relay: false, startUnix: START,
  }
  const s = { r: { index: 0, bestStart: 0 } } as CardSite

  it('renders the touchdown line, eleven slip cells and the next GO days', () => {
    const html = renderToStaticMarkup(createElement(SiteTimeline, { ctx, s, lang: 'en' }))
    expect(html).toContain('After touchdown · 1 Nov 2026')
    expect(html).toContain('Sun up, sets in 4 d 4 h, rises in 4 d 14 h')
    expect(html).toContain('Slip 0 days → GO')
    expect(html.split('tl-cell').length - 1).toBe(11)
    expect(html).toContain('2 Nov 2026')
    expect(html).toContain('6 Nov 2026')
    expect(html.includes('Right now at this site') || html.includes('Hour-by-hour data starts')).toBe(true)
  })

  it('renders the Turkish line', () => {
    const html = renderToStaticMarkup(createElement(SiteTimeline, { ctx, s, lang: 'tr' }))
    expect(html).toContain('İnişten sonra · 1 Kas 2026')
    expect(html).toContain('Güneş var, 4 g 4 sa içinde batar, 4 g 14 sa içinde doğar')
    expect(html).toContain('0 gün gecikme → GO')
    expect(html).toContain('en az 3 saat')
  })
})
