import { describe, expect, it } from 'vitest'
import { coastReadout, dayIndex, descentReadout, ellipseDots, fmtClock, fmtKm, fmtLat, fmtLon, fmtVel, ODDS_FALL, oddsDotY, oddsLayout, oddsSettled, PROFILE, revealCount, rise, shareCounts, siteReadout, windowModel, windowPlan, windowShownGo } from './filmProfile'

describe('film profile', () => {
  it('starts the coast where the launch card leaves it and hands the clock to the burn', () => {
    const a = coastReadout(0)
    const b = coastReadout(1)
    const burn = descentReadout(0)
    expect(a.altKm).toBe(PROFILE.leoAltKm)
    expect(a.velKms).toBe(PROFILE.tliKms)
    expect(a.rangeKm).toBeCloseTo(PROFILE.moonKm - PROFILE.earthRKm - PROFILE.leoAltKm - PROFILE.moonRKm, 6)
    expect(a.ttlS).toBe(PROFILE.coastS + PROFILE.descentS)
    expect(b.velKms).toBeCloseTo(PROFILE.burnKms, 6)
    expect(b.rangeKm).toBe(PROFILE.lloAltKm)
    expect(b.ttlS).toBe(burn.ttlS)
    expect(burn.altKm).toBe(PROFILE.lloAltKm)
    expect(burn.velKms).toBeCloseTo(PROFILE.burnKms, 6)
    expect(burn.rangeKm).toBe(PROFILE.burnRangeKm)
  })

  it('brings the descent to a stop on the clock', () => {
    const end = descentReadout(1)
    expect(end.altKm).toBe(0)
    expect(end.velKms).toBe(0)
    expect(end.rangeKm).toBe(0)
    expect(end.ttlS).toBe(0)
    const steps = [0, 0.25, 0.5, 0.75, 1]
    for (let i = 0; i < steps.length - 1; i++) {
      const p = descentReadout(steps[i])
      const q = descentReadout(steps[i + 1])
      expect(p.altKm).toBeGreaterThan(q.altKm)
      expect(p.velKms).toBeGreaterThan(q.velKms)
      expect(p.rangeKm).toBeGreaterThan(q.rangeKm)
      expect(p.ttlS).toBeGreaterThan(q.ttlS)
    }
  })

  it('keeps range to the site ahead of altitude through the burn', () => {
    const mid = descentReadout(0.5)
    expect(mid.rangeKm).toBeGreaterThan(mid.altKm)
    expect(mid.kind).toBe('profile')
  })

  it('uses the computed height on the surface and a planned stop', () => {
    const s = siteReadout(1520)
    expect(s.altKm).toBeCloseTo(1.52, 6)
    expect(s.velKms).toBe(0)
    expect(s.rangeKm).toBe(0)
    expect(s.ttlS).toBe(0)
    expect(s.kind).toBe('site')
  })

  it('formats the countdown and the coordinates', () => {
    expect(fmtClock(0, 'en')).toBe('00:00:00')
    expect(fmtClock(PROFILE.descentS, 'en')).toBe('00:12:00')
    expect(fmtClock(PROFILE.coastS + PROFILE.descentS, 'en')).toBe('4d 12:12:00')
    expect(fmtClock(PROFILE.coastS + PROFILE.descentS, 'tr')).toBe('4g 12:12:00')
    expect(fmtLat(-89.5, 'en')).toBe('89.50°S')
    expect(fmtLat(-89.5, 'tr')).toBe('89.50°G')
    expect(fmtLon(222.5, 'en')).toBe('137.5°W')
    expect(fmtLon(20, 'tr')).toBe('20.0°D')
    expect(fmtKm(185, 'en')).toBe('185 km')
    expect(fmtKm(0.25, 'en')).toBe('250 m')
    expect(fmtVel(10.9, 'en')).toBe('10.90 km/s')
    expect(fmtVel(0, 'tr')).toBe('0 m/sn')
  })

  it('scrubs the stagger and the sunlight day', () => {
    expect(rise(0.2, 0.5, 0.1, false)).toBe(0)
    expect(rise(0.55, 0.5, 0.1, false)).toBeCloseTo(0.5, 6)
    expect(rise(0.2, 0.5, 0.1, true)).toBe(1)
    expect(dayIndex(0, 8)).toBe(0)
    expect(dayIndex(0.5, 8)).toBe(4)
    expect(dayIndex(1, 8)).toBe(7)
    expect(dayIndex(0.2, 0)).toBe(0)
  })
})

describe('landing window', () => {
  it('lights the real per-day flags and rings the chosen date', () => {
    const plan = windowPlan([true, false, true, false], 30, 2, 9, true)
    expect(plan.known).toBe(true)
    expect(plan.total).toBe(4)
    expect(plan.go).toBe(2)
    expect(plan.days[2]).toEqual({ go: true, best: true })
    expect(plan.days[1]).toEqual({ go: false, best: false })
    expect(windowShownGo(plan, 0)).toBe(0)
    expect(windowShownGo(plan, 2)).toBe(1)
    expect(windowShownGo(plan, 4)).toBe(2)
  })

  it('does not invent the other days when perStart is missing', () => {
    const plan = windowPlan(undefined, 30, 4, 5, true)
    expect(plan.known).toBe(false)
    expect(plan.total).toBe(30)
    expect(plan.go).toBe(5)
    expect(plan.days[4]).toEqual({ go: true, best: true })
    expect(plan.days.filter((d) => d.go === null)).toHaveLength(29)
    expect(plan.days.some((d) => d.go === false)).toBe(false)
    expect(windowShownGo(plan, 0)).toBe(0)
    expect(windowShownGo(plan, 30)).toBe(5)
    const empty = windowPlan([], 10, 1, 3, false)
    expect(empty.known).toBe(false)
    expect(empty.days[1]).toEqual({ go: false, best: true })
    expect(empty.days[0].go).toBeNull()
  })

  it('dates the strip from the chosen landing and refuses a bad anchor', () => {
    const ms = Date.UTC(2026, 10, 14)
    const plan = windowPlan([false, true, true, false, true, false], 6, 2, 3, true)
    const model = windowModel(plan, ms, 'en')
    expect(model.chosen).toBe('14 November 2026')
    expect(model.cells[2].num).toBe('14')
    expect(model.cells[2].month).toBe('Nov')
    expect(model.cells[0].num).toBe('12')
    expect(model.cells[3].num).toBe('15')
    const cross = windowModel(windowPlan([true, true, true, true, true, true], 6, 2, 6, true), Date.UTC(2026, 11, 1), 'en')
    expect(cross.months).toEqual([{ name: 'Nov', n: 2 }, { name: 'Dec', n: 4 }])
    const loose = windowModel(windowPlan([true, false], 2, 9, 1, true), ms, 'en')
    expect(loose.cells[0]).toMatchObject({ num: '1', month: '', best: false })
    expect(loose.chosen).toBe('14 November 2026')
    expect(windowModel(plan, Number.NaN, 'en').chosen).toBe('')
    expect(windowModel(plan, ms, 'tr').chosen).toContain('2026')
  })

  it('reveals items across the scene and snaps when motion is reduced', () => {
    expect(revealCount(0, 30, 0.1, 0.68, false)).toBe(0)
    expect(revealCount(0.5, 10, 0, 1, false)).toBe(5)
    expect(revealCount(1, 30, 0.1, 0.68, false)).toBe(30)
    expect(revealCount(0, 30, 0.1, 0.68, true)).toBe(30)
    expect(revealCount(0.5, 0, 0, 1, false)).toBe(0)
  })
})

describe('odds and ellipse schematics', () => {
  const causes = { landing: 0.1, tip: 0.08, power: 0.12, comms: 0.08 }

  it('splits dots by the reported shares and never past the cap', () => {
    expect(shareCounts([0.5, 0.2, 0.1, 0.1, 0.1], 300)).toEqual([150, 60, 30, 30, 30])
    expect(shareCounts([1, 1, 1], 10)).toEqual([4, 3, 3])
    const tenths = shareCounts([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 10)
    expect(tenths.reduce((a, b) => a + b, 0)).toBe(10)
    expect(shareCounts([0, 0, 0], 40).every((n) => n === 0)).toBe(true)
    const lay = oddsLayout(0.62, causes, 400)
    expect(lay.n).toBe(300)
    expect(lay.trials).toBe(400)
    expect(lay.capped).toBe(true)
    expect(lay.counts.reduce((a, b) => a + b, 0)).toBe(300)
    const tally = [0, 0, 0, 0, 0]
    for (let i = 0; i < lay.n; i++) {
      const b = lay.bin[i]
      tally[b]++
      expect(lay.x[i]).toBeGreaterThan(b / 5)
      expect(lay.x[i]).toBeLessThan((b + 1) / 5)
      expect(lay.y[i]).toBeGreaterThan(0)
      expect(lay.y[i]).toBeLessThan(1)
      if (i > 0) expect(lay.t0[i]).toBeGreaterThanOrEqual(lay.t0[i - 1])
    }
    expect(tally).toEqual(lay.counts)
    expect(lay.t0[lay.n - 1] + ODDS_FALL).toBeLessThan(1)
    expect(oddsSettled(lay, 0, false)).toEqual([0, 0, 0, 0, 0])
    expect(oddsSettled(lay, 1, false)).toEqual(lay.counts)
    expect(oddsSettled(lay, 0, true)).toEqual(lay.counts)
    const again = oddsLayout(0.62, causes, 400)
    expect(Array.from(again.bin)).toEqual(Array.from(lay.bin))
    expect(Array.from(again.x)).toEqual(Array.from(lay.x))
  })

  it('uses one dot per trial when the run is under the cap', () => {
    const lay = oddsLayout(1, { landing: 0, tip: 0, power: 0, comms: 0 }, 20)
    expect(lay.n).toBe(20)
    expect(lay.capped).toBe(false)
    expect(lay.counts).toEqual([20, 0, 0, 0, 0])
    const none = oddsLayout(0, { landing: 0, tip: 0, power: 0, comms: 0 }, 50)
    expect(none.n).toBe(0)
    expect(none.trials).toBe(50)
    expect(oddsDotY(0.5, 0.2, 0.1, false)).toBeNull()
    expect(oddsDotY(0.5, 0.2, 0.2 + ODDS_FALL, false)).toBe(0.5)
    expect(oddsDotY(0.5, 0.2, 0, true)).toBe(0.5)
  })

  it('keeps ellipse points inside the circle and the real pass count', () => {
    const dots = ellipseDots(5, 3)
    expect(dots).toHaveLength(5)
    expect(dots.filter((d) => d.pass)).toHaveLength(3)
    for (const d of dots) expect(d.x * d.x + d.y * d.y).toBeLessThanOrEqual(0.86 * 0.86 + 1e-9)
    expect(ellipseDots(4, 9).every((d) => d.pass)).toBe(true)
    expect(ellipseDots(4, -2).every((d) => !d.pass)).toBe(true)
    expect(ellipseDots(0, 3)).toEqual([])
    expect(ellipseDots(4.8, 2)).toHaveLength(4)
  })
})
