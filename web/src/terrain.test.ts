import { describe, expect, it } from 'vitest'
import { diskAbove, heightAt, horizonElev, makeGround, planeAz, planeDir, profileAt, type Dem, type Patch } from './terrain'

const flat = (rows = 101, cols = 101, v = 0): Dem => ({ rows, cols, mPerPx: 200, line0: 50, sample0: 50, scale: 0.5, h: new Int16Array(rows * cols).fill(v) })

describe('terrain', () => {
  it('reads heights with bilinear interpolation in polar stereographic metres', () => {
    const d = flat()
    d.h[50 * 101 + 51] = 200            // 100 m at (x=+200, y=0)
    expect(heightAt(d, 0, 0)).toBe(0)
    expect(heightAt(d, 200, 0)).toBeCloseTo(100)
    expect(heightAt(d, 100, 0)).toBeCloseTo(50)
    expect(Number.isNaN(heightAt(d, 1e6, 0))).toBe(true)
  })

  it('maps azimuths to plane directions and back at any longitude', () => {
    for (const lon of [0, 37, 90, 181, 300]) {
      for (const az of [0, 45, 133, 270]) {
        const [dx, dy] = planeDir(lon, az)
        expect(Math.hypot(dx, dy)).toBeCloseTo(1)
        expect(planeAz(lon, dx, dy)).toBeCloseTo(az)
      }
    }
    // at longitude 0, local north (toward the equator) is +y in the south polar plane
    const [nx, ny] = planeDir(0, 0)
    expect(nx).toBeCloseTo(0)
    expect(ny).toBeCloseTo(1)
  })

  it('sees only the curvature drop on a flat sphere, and a wall when there is one', () => {
    const d = flat(1001, 1001)
    d.line0 = 500; d.sample0 = 500
    const g = makeGround(d, [])
    const e = horizonElev(g.height, 0, 0, 0, 90, 2, 90000)
    expect(e).toBeLessThan(0)
    expect(e).toBeGreaterThan(-1.5)
    for (let r = 0; r < 1001; r++) d.h[r * 1001 + 510] = 2000   // 1 km high wall 2 km east (at lon 0, east = +x)
    expect(horizonElev(g.height, 0, 0, 0, 90, 2, 90000)).toBeCloseTo((Math.atan2(998 - 2000 * 2000 / 2 / 1737400, 2000) * 180) / Math.PI, 0)
  })

  it('prefers a 10 m site map inside its bounds and blends at the edge', () => {
    const d = flat(1001, 1001)
    d.line0 = 500; d.sample0 = 500
    const p: Patch = { id: 's', name: 's', rows: 401, cols: 401, mPerPx: 10, x0: -2000, y0: 2000, scale: 0.25, h: new Int16Array(401 * 401).fill(400) }
    const g = makeGround(d, [p])
    expect(g.height(0, 0)).toBeCloseTo(100)       // deep inside: the site map
    expect(g.height(5000, 0)).toBeCloseTo(0)      // outside: the 200 m grid
    expect(g.height(1800, 0)).toBeCloseTo(50)     // 200 m from the edge: half way
    expect(g.source(0, 0)?.id).toBe('s')
  })

  it('computes the visible solar disk fraction and interpolates the horizon profile', () => {
    expect(diskAbove(5, 0, 0.27)).toBe(1)
    expect(diskAbove(-5, 0, 0.27)).toBe(0)
    expect(diskAbove(0, 0, 0.27)).toBeCloseTo(0.5)
    const prof = new Float32Array(360)
    prof[359] = 2
    prof[0] = 4
    expect(profileAt(prof, 359.5)).toBeCloseTo(3)
    expect(profileAt(prof, -0.5)).toBeCloseTo(3)
  })
})
