import { describe, expect, it } from 'vitest'
import { buildSurfaceMesh, type MeshSpec } from './surfaceMesh'

const spec: MeshSpec = { cx: 0, cy: 0, half: 20, step: 10, origin: { x: 0, y: 0, h: 100 }, sun: [0, 0, -1], sunR: .27, sub: 2, reach: 100 }
describe('background surface preparation', () => {
  it('preserves metres, winding, unit normals, sunlight and lunar curvature', () => {
    const g = buildSurfaceMesh((x, y) => 100 + x * .1 + y * .2, spec)
    expect(g.grid.n).toBe(5)
    expect(g.index.length).toBe(96)
    expect(g.position[12 * 3 + 1]).toBeCloseTo(0)
    for (let i = 0; i < g.normal.length; i += 3) {
      expect(Math.hypot(...g.normal.subarray(i, i + 3))).toBeCloseTo(1)
      expect(g.normal[i + 1]).toBeGreaterThan(.95)
    }
    for (const lit of g.sunlit) expect(lit).toBeCloseTo(1)
  })
  it('keeps coarse faces below the detailed patch', () => {
    const g = buildSurfaceMesh(() => 100, { ...spec, hole: { cx: 0, cy: 0, half: 15 } })
    expect(g.position[12 * 3 + 1]).toBe(-250)
    expect(g.position[1]).toBeGreaterThan(-1)
  })
})
