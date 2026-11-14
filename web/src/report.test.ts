import { describe, expect, it } from 'vitest'
import { reportHtml, toCsv, type SiteRow } from './report'

const row: SiteRow = { rank: 1, index: 5, lat: -89.45678, lon: 222.5, region: 'Connecting Ridge, "A"', goDates: 7, windowDays: 30,
  bestLanding: '2027-09-12', go: true, sunPct: 88, earthPct: 61, longestDarkH: 12, batteryNeedWh: 1450, survives: true,
  slopeDeg: 3.25, heightM: 1520, zoneSlopeDeg: 6.5, iceKm: null, approachDeg: 180, sunOffDeg: 150, perStart: [true, false], sunDaily: [1, 0.5], earthDaily: [0, 1] }

describe('report', () => {
  it('writes a CSV with a header and quoted text', () => {
    const csv = toCsv([row]).trim().split('\n')
    expect(csv[0].split(',')).toContain('best_landing_utc')
    expect(csv[1]).toBe('1,-89.4568,222.5000,"Connecting Ridge, ""A""",7,30,2027-09-12,GO,88,61,12,1450,true,3.25,1520,6.5,,180,150')
  })
  it('builds a printable report that escapes names', () => {
    const html = reportHtml([row], { start: '2027-09-01', windowDays: 30, days: 14, dsn: true },
      { min_sun_frac: 0.7, min_comm_frac: 0.5, max_dark_hours: 48, battery_wh: 2000 } as never, ['NASA LOLA'], 'en')
    expect(html).toContain('Connecting Ridge, &quot;A&quot;')
    expect(html).toContain('2027-09-12')
    expect(html).toContain('+ NASA DSN')
    expect(html).toContain('heading S, Sun 150° behind')
  })
})
