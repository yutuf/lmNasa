import { describe, expect, it } from 'vitest'
import { DEFAULT_TOUR as exportedTour } from './components/GuidedTour'
import { LIBRATION, ORBIT_DRAW, librationDeg, moonOrbitXY, projectMoon, skyPoint, southPoleElevation } from './librationModel'
import { DEFAULT_TOUR, placeCallout, spotlightBox, stepFrom, stepsPresent } from './tourModel'

const SELECTORS = [
  '.s-hero h1',
  '.s-step-goal',
  '.s-steps .s-step:nth-child(2)',
  '.s-run',
  '.card-grid .site-card',
  '.s-clps',
  '.s-next',
  '.map-card',
]

describe('judge tour', () => {
  it('walks the simple view in order, in both languages', () => {
    expect(DEFAULT_TOUR.map((s) => s.selector)).toEqual(SELECTORS)
    expect(exportedTour).toBe(DEFAULT_TOUR)
    for (const s of DEFAULT_TOUR) {
      expect(s.title.en.length).toBeGreaterThan(0)
      expect(s.title.tr.length).toBeGreaterThan(0)
      expect(s.body.en.length).toBeGreaterThan(8)
      expect(s.body.tr.length).toBeGreaterThan(8)
    }
  })

  it('skips steps whose selector is missing and keeps the rest in order', () => {
    const idx = stepsPresent(DEFAULT_TOUR, (sel) => sel !== '.s-run' && sel !== '.s-next')
    expect(idx.map((i) => DEFAULT_TOUR[i].selector)).toEqual(SELECTORS.filter((s) => s !== '.s-run' && s !== '.s-next'))
    expect(stepFrom(idx, idx[1], 1)).toBe(idx[2])
    expect(stepFrom(idx, idx[0], -1)).toBeNull()
    expect(stepFrom(idx, idx[idx.length - 1], 1)).toBeNull()
    expect(stepFrom([0, 2, 5], 1, 1)).toBe(2)
    expect(stepFrom([0, 2, 5], 1, -1)).toBe(0)
  })

  it('places the callout below when there is room, above when there is not, and inside the viewport', () => {
    const below = placeCallout({ top: 40, left: 300, width: 100, height: 40 }, { width: 800, height: 600 }, { width: 320, height: 150 })
    expect(below.placement).toBe('bottom')
    expect(below.top).toBe(40 + 40 + 16)
    expect(below.left).toBe(300 + 50 - 160)

    const above = placeCallout({ top: 500, left: 300, width: 100, height: 40 }, { width: 800, height: 600 }, { width: 320, height: 150 })
    expect(above.placement).toBe('top')
    expect(above.top + 150).toBeLessThanOrEqual(500)

    const edge = placeCallout({ top: 80, left: 0, width: 40, height: 30 }, { width: 800, height: 600 }, { width: 300, height: 140 })
    expect(edge.placement).toBe('bottom')
    expect(edge.left).toBeGreaterThanOrEqual(12)

    const full = placeCallout({ top: 0, left: 0, width: 800, height: 600 }, { width: 800, height: 600 }, { width: 300, height: 160 })
    expect(full.top).toBeGreaterThanOrEqual(12)
    expect(full.left).toBeGreaterThanOrEqual(12)
    expect(full.top + 160).toBeLessThanOrEqual(600 - 12)
    expect(full.left + 300).toBeLessThanOrEqual(800 - 12)

    const hole = spotlightBox({ top: -4, left: 10, width: 1000, height: 40 }, 8, { width: 400, height: 300 })
    expect(hole.left).toBe(2)
    expect(hole.top).toBe(0)
    expect(hole.left + hole.width).toBeLessThanOrEqual(400)
  })
})

describe('libration schematic', () => {
  it('uses the published amplitudes and the two month lengths', () => {
    expect(LIBRATION.lonAmpDeg).toBe(7.9)
    expect(LIBRATION.latAmpDeg).toBe(6.7)
    expect(LIBRATION.lonPeriodDays).toBeCloseTo(27.6, 0)
    expect(LIBRATION.latPeriodDays).toBeCloseTo(27.2, 1)
    expect(librationDeg(LIBRATION.lonPeriodDays / 4).lon).toBeCloseTo(7.9, 6)
    expect(librationDeg(0).lat).toBeCloseTo(6.7, 6)
    expect(LIBRATION.latPhaseRad).toBeCloseTo(Math.PI / 2, 8)
  })

  it('puts Earth on the south-pole horizon and flips latitude into elevation', () => {
    expect(southPoleElevation(0).elDeg).toBeCloseTo(-6.7, 6)
    expect(southPoleElevation(LIBRATION.latPeriodDays / 2).elDeg).toBeCloseTo(6.7, 6)
    const low = skyPoint(0)
    const high = skyPoint(LIBRATION.latPeriodDays / 2)
    expect(high.el).toBeGreaterThan(0)
    expect(high.y).toBeLessThan(low.y)
    const quarter = skyPoint(LIBRATION.lonPeriodDays / 4)
    expect(Math.hypot(low.x - quarter.x, low.y - quarter.y)).toBeGreaterThan(80)
  })

  it('does not close after eight months, because the periods differ', () => {
    const a = librationDeg(0)
    const b = librationDeg(8 * LIBRATION.lonPeriodDays)
    expect(Math.hypot(a.lon - b.lon, a.lat - b.lat)).toBeGreaterThan(1)
    const p = skyPoint(0)
    const q = skyPoint(8 * LIBRATION.lonPeriodDays)
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(10)
  })

  it('moves the Moon faster-looking geometry: closer at periapsis than at apoapsis', () => {
    const e = LIBRATION.eccentricity
    const peri = moonOrbitXY(0, e, LIBRATION.lonPeriodDays)
    const apo = moonOrbitXY(LIBRATION.lonPeriodDays / 2, e, LIBRATION.lonPeriodDays)
    expect(peri.r).toBeCloseTo(1 - e, 5)
    expect(apo.r).toBeCloseTo(1 + e, 5)
    expect(peri.x).toBeGreaterThan(0)
    expect(apo.x).toBeLessThan(0)
    const drawnPeri = projectMoon(0)
    const drawnApo = projectMoon(LIBRATION.lonPeriodDays / 2)
    expect(drawnPeri.r).toBeCloseTo(1 - ORBIT_DRAW.e, 5)
    expect(drawnPeri.x).toBeGreaterThan(ORBIT_DRAW.cx)
    expect(drawnApo.x).toBeLessThan(ORBIT_DRAW.cx)
    expect(ORBIT_DRAW.e).toBeGreaterThan(LIBRATION.eccentricity * 2)
    expect(ORBIT_DRAW.tiltDeg).toBeGreaterThan(LIBRATION.latAmpDeg)
  })
})
