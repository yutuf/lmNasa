import { describe, expect, it } from 'vitest'
import type { PointResult } from './engine'
import { ORBIT_SCENARIOS, V_LLO, planeChangeDv, scenarioRows } from './orbitScenarios'

const pt = (index: number, lat: number, goCount: number): PointResult =>
  ({ index, lat, lon: 0, goCount, bestScore: goCount, bestStart: 0, bestGo: goCount > 0, sunFrac: 0, commFrac: 0, longestDarkH: 0 })

describe('orbit scenarios', () => {
  it('circular speed at 100 km is about 1.63 km/s', () => { expect(V_LLO).toBeGreaterThan(1.6); expect(V_LLO).toBeLessThan(1.66) })
  it('no plane change when the site is within the inclination; a big one for the pole from a low orbit', () => {
    expect(planeChangeDv(-40, 45)).toBe(0)
    expect(planeChangeDv(-89, 20)).toBeGreaterThan(1.7)   // 69 deg of tilt
    expect(planeChangeDv(-89, 90)).toBe(0)
  })
  it('only the polar orbit reaches a south-pole site; reachable counts shrink with inclination', () => {
    const rs = [pt(0, -88, 5), pt(1, -60, 3), pt(2, -10, 1), pt(3, 30, 0)]
    const rows = scenarioRows(rs)
    expect(rows[0].best?.index).toBe(0)                         // polar: the pole site wins
    expect(rows.map((r) => r.reachable)).toEqual([4, 3, 2, 1])  // 90, 75, 45, 20 degrees
    expect(rows[ORBIT_SCENARIOS.length - 1].dvToBest).toBeGreaterThan(1)
  })
})
