// The workshop's engineering model: budgets follow the parts, requirements follow the budgets, orbits follow Kepler.
import { describe, expect, it } from 'vitest'
import { DEFAULT_DESIGN, K, ORBIT_PRESETS, budget, orbitStats } from './workshop'

describe('budget', () => {
  it('uses the rocket equation for the descent propellant', () => {
    const b = budget(DEFAULT_DESIGN)
    expect(b.propKg / b.dryKg).toBeCloseTo(Math.exp(K.dvSoft / (K.isp * K.g0)) - 1, 6)   // about 0.83 of the dry mass
  })
  it('a bigger battery survives a longer night; a bigger array needs less Sun', () => {
    const small = budget({ ...DEFAULT_DESIGN, batteryWh: 2000, solarW: 400 })
    const big = budget({ ...DEFAULT_DESIGN, batteryWh: 8000, solarW: 1600 })
    expect(big.maxDarkH).toBeGreaterThan(small.maxDarkH)
    expect(big.minSunPct).toBeLessThan(small.minSunPct)
  })
  it('a rough landing is less precise and less tolerant of slopes, precision navigation narrows the zone', () => {
    const soft = budget(DEFAULT_DESIGN), rough = budget({ ...DEFAULT_DESIGN, landing: 'rough' }), prec = budget({ ...DEFAULT_DESIGN, nav: 'precision' })
    expect(rough.zone).toBeGreaterThanOrEqual(soft.zone)
    expect(rough.zslope).toBeLessThan(soft.zslope)
    expect(prec.zone).toBeLessThan(soft.zone)
  })
  it('a relay link still needs contact half the time; the relay supplies it in the search', () => {
    expect(budget({ ...DEFAULT_DESIGN, comms: 'relay' }).earthPct).toBe(50)
  })
})

describe('orbitStats', () => {
  it('a low polar orbit takes about 2 hours, like LRO', () => {
    expect(orbitStats(ORBIT_PRESETS[0], -89.5, 0, 2).periodH).toBeCloseTo(2.0, 1)
  })
  it('a halo-like orbit takes days and watches the south pole most of the time', () => {
    const s = orbitStats(ORBIT_PRESETS[2], -89.5, 0, 30)
    expect(s.periodH / 24).toBeGreaterThan(5)
    expect(s.visiblePct).toBeGreaterThan(60)
  })
  it('a polar orbiter passes over the pole on most orbits, but is in view only a small share of the time', () => {
    const s = orbitStats(ORBIT_PRESETS[0], -89.5, 0, 3)
    expect(s.passesPerDay).toBeGreaterThan(5)
    expect(s.visiblePct).toBeLessThan(25)
  })
})
