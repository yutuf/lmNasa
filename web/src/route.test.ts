import { describe, expect, it } from 'vitest'
import { cumulative, planRoute, pursue, simplifyPath, smoothPath, wrapAngle } from './route'

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

  it('smooths a straight grid into a straight curve and keeps the length', () => {
    const r = planRoute(() => 0, [0, 0], [1000, 0], { cell: 20, margin: 200 })!
    expect(r.pts[0]).toEqual([0, 0])
    expect(r.pts[r.pts.length - 1]).toEqual([1000, 0])
    for (const p of r.pts) expect(Math.abs(p[1])).toBeLessThan(1)
    expect(r.cum[0]).toBe(0)
    expect(r.cum[r.cum.length - 1]).toBeGreaterThan(990)
    expect(r.cum[r.cum.length - 1]).toBeLessThan(1010)
    expect(r.cum.length).toBe(r.pts.length)
  })
})

describe('path smoothing', () => {
  it('drops collinear points and keeps a real corner', () => {
    const line: [number, number][] = []
    for (let i = 0; i <= 20; i++) line.push([i * 20, 0])
    expect(simplifyPath(line, 4)).toEqual([[0, 0], [400, 0]])
    expect(simplifyPath([[0, 0], [50, 0], [100, 0], [100, 80]], 4)).toEqual([[0, 0], [100, 0], [100, 80]])
  })

  it('samples a Catmull-Rom that stays near the polyline and turns gradually', () => {
    const stair: [number, number][] = [[0, 0]]
    for (let i = 0; i < 8; i++) {
      stair.push([(i + 1) * 20, i * 20])
      stair.push([(i + 1) * 20, (i + 1) * 20])
    }
    const curve = smoothPath(stair, 5, 4)
    expect(curve[0]).toEqual([0, 0])
    expect(curve[curve.length - 1]).toEqual(stair[stair.length - 1])
    let minRadius = Infinity
    for (let i = 2; i < curve.length; i++) {
      const a = Math.atan2(curve[i - 1][1] - curve[i - 2][1], curve[i - 1][0] - curve[i - 2][0])
      const b = Math.atan2(curve[i][1] - curve[i - 1][1], curve[i][0] - curve[i - 1][0])
      const ang = Math.abs(wrapAngle(b - a))
      const d1 = Math.hypot(curve[i - 1][0] - curve[i - 2][0], curve[i - 1][1] - curve[i - 2][1])
      const d2 = Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1])
      if (ang > 1e-3 && d1 > 2 && d2 > 2) minRadius = Math.min(minRadius, ((d1 + d2) * 0.5) / ang)
      expect(d2).toBeGreaterThan(0.04)
      expect(d2).toBeLessThan(14)
      expect(ang).toBeLessThan(0.85)
      expect(crossTrack(stair, curve[i][0], curve[i][1])).toBeLessThan(12)
    }
    expect(minRadius).toBeGreaterThan(6)
  })
})

describe('pure pursuit', () => {
  it('wraps the heading error the short way', () => {
    expect(wrapAngle(Math.PI + 0.4)).toBeCloseTo(-Math.PI + 0.4, 6)
    const pts = smoothPath([[0, 0], [400, 0]], 5, 4)
    const cum = cumulative(pts)
    const step = pursue({ pts, cum, x: 0, y: 0, heading: 2.6, s: 0, dt: 1 / 30, realSpeed: 0 })
    const turn = wrapAngle(step.heading - 2.6)
    expect(turn).toBeLessThan(0)
    expect(turn).toBeGreaterThan(-0.2)
    expect(step.done).toBe(false)
  })

  it('drives a planned diagonal to the goal without circling', () => {
    const r = planRoute(() => 0, [0, 0], [800, 500], { cell: 20, margin: 300 })!
    const film = follow(r.pts, r.cum, 30, 0.2, 0.6, undefined, 13)
    expect(film.s).toBeGreaterThan(25)
    expect(film.maxOff).toBeLessThan(20)
    expect(film.spin).toBeLessThan(Math.PI * 2)
    const end = follow(r.pts, r.cum, 30, 0.25, 2.4)
    expect(end.done).toBe(true)
    expect(end.goalDist).toBeLessThan(10)
    expect(end.maxOff).toBeLessThan(25)
    expect(end.spin).toBeLessThan(Math.PI * 4)
  })

  it('follows a staircase and a walled detour to the goal', () => {
    const stair: [number, number][] = [[0, 0]]
    for (let i = 0; i < 10; i++) {
      stair.push([(i + 1) * 20, i * 20])
      stair.push([(i + 1) * 20, (i + 1) * 20])
    }
    const curve = smoothPath(stair, 5, 4)
    const climbed = follow(curve, cumulative(curve), 60, 0.25, 0)
    expect(climbed.done).toBe(true)
    expect(climbed.goalDist).toBeLessThan(10)
    expect(climbed.maxOff).toBeLessThan(22)

    const r = planRoute(wall, [-500, 0], [500, 0], { cell: 20, margin: 1200, maxSlope: 20 })!
    const around = follow(r.pts, r.cum, 30, 0.25, 0.4, wall)
    expect(around.done).toBe(true)
    expect(around.goalDist).toBeLessThan(12)
    expect(around.maxOff).toBeLessThan(30)
    expect(around.stuck).toBe(false)
  })
})

function crossTrack(pts: readonly [number, number][], x: number, y: number) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1]
    const dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay
    const len2 = dx * dx + dy * dy
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)))
  }
  return best
}

/** Same integrator the rover uses: mission speed × warp, heading from pursue, stop on a steep step. */
function follow(
  pts: readonly [number, number][], cum: readonly number[], warp: number, maxSpeed: number, heading0: number,
  height?: (x: number, y: number) => number, seconds?: number,
) {
  let x = pts[0][0], y = pts[0][1], heading = heading0, s = 0, speed = 0
  let spin = 0, maxOff = 0, stuckN = 0, frames = 0
  const goal = pts[pts.length - 1]
  const dt = 1 / 30
  const length = Math.max(1, cum[cum.length - 1] ?? 1)
  const limit = seconds ? Math.round(seconds / dt) : Math.ceil((length / (maxSpeed * warp)) * 30 * 4) + 900
  let done = false
  let blocked = false
  while (frames < limit && !done) {
    frames++
    const step = pursue({ pts, cum, x, y, heading, s, dt, realSpeed: Math.abs(speed) * warp })
    spin += Math.abs(wrapAngle(step.heading - heading))
    heading = step.heading
    s = step.s
    if (step.done) { done = true; break }
    speed += (step.throttle * maxSpeed - speed) * Math.min(1, dt * 3)
    const stepM = speed * dt * warp
    const nx = x + Math.cos(heading) * stepM
    const ny = y + Math.sin(heading) * stepM
    if (height && Math.abs(stepM) > 1e-6) {
      const rise = height(nx, ny) - height(x, y)
      const slope = Math.atan2(Math.abs(rise), Math.abs(stepM)) * 180 / Math.PI
      if (slope > 18) {
        speed = 0
        stuckN++
        if (stuckN > 45) { blocked = true; break }
        continue
      }
    }
    stuckN = 0
    x = nx
    y = ny
    maxOff = Math.max(maxOff, crossTrack(pts, x, y))
  }
  return { x, y, s, frames, spin, maxOff, done, blocked, stuck: blocked, goalDist: Math.hypot(goal[0] - x, goal[1] - y) }
}
