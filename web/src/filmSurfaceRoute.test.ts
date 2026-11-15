import { describe, expect, it } from 'vitest'
import { filmSurfaceRoute, filmWarp } from './filmSurfaceRoute'

describe('film surface departure', () => {
  it('builds a repeatable route away from the lander, longer than the shot can exhaust', () => {
    const a = filmSurfaceRoute(() => 0, [14, 8], [0, 0], 5, 18)!
    const b = filmSurfaceRoute(() => 0, [14, 8], [0, 0], 5, 18)!
    expect(a.pts).toEqual(b.pts)
    expect(a.lengthM).toBeGreaterThan(50)
    for (const p of a.pts) expect(Math.hypot(...p)).toBeGreaterThan(5)
    expect(filmWarp(.01) * .01 * 7).toBeLessThan(a.lengthM)
  })
  it('reports an impassable surface instead of inventing a drivable route', () => {
    expect(filmSurfaceRoute(() => NaN, [14, 8], [0, 0], 5, 18)).toBeNull()
  })
})
