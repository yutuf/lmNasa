import { describe, expect, it } from 'vitest'
import { planRoute } from './route'

// a 300 m wall along x = 0 with a gap at y in [800, 900]
const wall = (x: number, y: number) => (Math.abs(x) < 30 && !(y > 800 && y < 900) ? 300 : 0)

describe('route planner', () => {
  it('goes straight on flat ground', () => {
    const r = planRoute(() => 0, [0, 0], [1000, 0], { cell: 20, margin: 200 })!
    expect(r.lengthM).toBeCloseTo(1000, -1)
    expect(r.maxSlopeDeg).toBe(0)
  })

  it('goes around a wall through the gap and never climbs it', () => {
    const r = planRoute(wall, [-500, 0], [500, 0], { cell: 20, margin: 1200, maxSlope: 20 })!
    expect(r).not.toBeNull()
    expect(r.maxSlopeDeg).toBeLessThan(20)
    expect(r.pts.some(([x, y]) => Math.abs(x) < 30 && y > 790 && y < 910)).toBe(true)
    expect(r.lengthM).toBeGreaterThan(1500)
  })

  it('returns null when the goal is walled off', () => {
    const box = (x: number, y: number) => (Math.max(Math.abs(x - 500), Math.abs(y)) > 100 && Math.max(Math.abs(x - 500), Math.abs(y)) < 160 ? 500 : 0)
    expect(planRoute(box, [-300, 0], [500, 0], { cell: 20, margin: 400 })).toBeNull()
  })

  it('prefers a sunlit detour over a dark shortcut', () => {
    const lit = (_x: number, y: number) => (y > 150 ? 1 : 0)      // only the strip y > 150 is in sunlight
    const r = planRoute(() => 0, [0, 200], [2000, 200], { cell: 20, margin: 300, lit, darkCost: 3 })!
    expect(r.darkM).toBeLessThan(50)
    const straight = planRoute(() => 0, [0, 100], [2000, 100], { cell: 20, margin: 300, lit, darkCost: 0 })!
    expect(straight.darkM).toBeGreaterThan(1500)
  })
})
