import { planRoute, type Route } from './route'
import type { Sampler } from './terrain'

/** A short illustrative departure on real terrain. It is not the long science/ice traverse. */
export function filmSurfaceRoute(height: Sampler, start: [number, number], lander: [number, number], clearance: number, maxSlope: number): Route | null {
  const heading = Math.atan2(start[1] - lander[1], start[0] - lander[0])
  const safeHeight: Sampler = (x, y) => Math.hypot(x - lander[0], y - lander[1]) < clearance ? NaN : height(x, y)
  for (const offset of [0, .3, -.3, .6, -.6, .9, -.9, 1.2, -1.2]) {
    const a = heading + offset
    const goal: [number, number] = [start[0] + Math.cos(a) * 60, start[1] + Math.sin(a) * 60]
    const route = planRoute(safeHeight, start, goal, { cell: 2, maxSlope, margin: 16, darkCost: 0 })
    if (route && route.lengthM > 30) return route
  }
  return null
}

export const filmWarp = (maxSpeed: number) => Math.max(1, Math.round(1.5 / Math.max(.001, maxSpeed)))
