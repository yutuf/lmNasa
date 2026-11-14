// Rover route planner: A* over a grid on the real terrain. Steeper ground costs more and anything above the rover's
// slope limit is impassable; ground in shadow at the current hour costs extra (the rover burns battery there), so the
// planner prefers to stay in sunlight. Coordinates are south polar stereographic metres.
import type { Sampler } from './terrain'

export interface RouteOptions {
  cell?: number                       // grid spacing (m)
  maxSlope?: number                   // degrees; steeper steps are impassable
  margin?: number                     // extra room around the start/goal box (m)
  lit?: (x: number, y: number) => number   // 0..1 sunlight at a point (1 = full Sun)
  darkCost?: number                   // extra cost per metre in full shadow (as a multiple of distance)
  maxCells?: number                   // safety cap on the grid size
}

export interface Route { pts: [number, number][]; lengthM: number; darkM: number; maxSlopeDeg: number; climbM: number }

class Heap {
  private k: number[] = []
  private v: number[] = []
  get size() { return this.k.length }
  push(key: number, val: number) {
    const k = this.k, v = this.v
    let i = k.length
    k.push(key); v.push(val)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= key) break
      k[i] = k[p]; v[i] = v[p]; i = p
    }
    k[i] = key; v[i] = val
  }
  pop(): number {
    const k = this.k, v = this.v
    const top = v[0]
    const lk = k.pop()!, lv = v.pop()!
    if (k.length) {
      let i = 0
      const n = k.length
      for (;;) {
        let c = 2 * i + 1
        if (c >= n) break
        if (c + 1 < n && k[c + 1] < k[c]) c++
        if (k[c] >= lk) break
        k[i] = k[c]; v[i] = v[c]; i = c
      }
      k[i] = lk; v[i] = lv
    }
    return top
  }
}

export function planRoute(h: Sampler, from: [number, number], to: [number, number], o: RouteOptions = {}): Route | null {
  const cell = o.cell ?? 20
  const maxSlope = o.maxSlope ?? 20
  const margin = o.margin ?? 1500
  const darkCost = o.darkCost ?? 3
  const x0 = Math.min(from[0], to[0]) - margin
  const y1 = Math.max(from[1], to[1]) + margin
  const nx = Math.ceil((Math.max(from[0], to[0]) + margin - x0) / cell) + 1
  const ny = Math.ceil((y1 - (Math.min(from[1], to[1]) - margin)) / cell) + 1
  if (nx * ny > (o.maxCells ?? 400000)) return null
  const X = (i: number) => x0 + (i % nx) * cell
  const Y = (i: number) => y1 - Math.floor(i / nx) * cell
  const idx = (x: number, y: number) => Math.round((y1 - y) / cell) * nx + Math.round((x - x0) / cell)
  const n = nx * ny
  const z = new Float32Array(n)
  for (let i = 0; i < n; i++) z[i] = h(X(i), Y(i))
  const dark = new Float32Array(n).fill(-1)        // lazily evaluated 0..1 darkness
  const darkAt = (i: number) => {
    if (!o.lit) return 0
    if (dark[i] < 0) dark[i] = 1 - o.lit(X(i), Y(i))
    return dark[i]
  }
  const s = idx(from[0], from[1])
  const g = idx(to[0], to[1])
  if (s < 0 || s >= n || g < 0 || g >= n || Number.isNaN(z[s]) || Number.isNaN(z[g])) return null
  const cost = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const tan = Math.tan((maxSlope * Math.PI) / 180)
  const hx = X(g), hy = Y(g)
  const heur = (i: number) => Math.hypot(X(i) - hx, Y(i) - hy)
  const heap = new Heap()
  cost[s] = 0
  heap.push(heur(s), s)
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  while (heap.size) {
    const i = heap.pop()
    if (done[i]) continue
    done[i] = 1
    if (i === g) break
    const ci = i % nx
    const ri = Math.floor(i / nx)
    for (const [dc, dr] of nb) {
      const c = ci + dc, r = ri + dr
      if (c < 0 || r < 0 || c >= nx || r >= ny) continue
      const j = r * nx + c
      if (done[j] || Number.isNaN(z[j])) continue
      const d = cell * (dc && dr ? Math.SQRT2 : 1)
      const grade = Math.abs(z[j] - z[i]) / d
      if (grade > tan) continue
      const step = d * (1 + 2 * (grade / tan) ** 2 + darkCost * darkAt(j))
      const nc = cost[i] + step
      if (nc < cost[j]) { cost[j] = nc; prev[j] = i; heap.push(nc + heur(j), j) }
    }
  }
  if (!done[g]) return null
  const path: number[] = []
  for (let i = g; i !== -1; i = prev[i]) path.push(i)
  path.reverse()
  let lengthM = 0, darkM = 0, maxSlopeDeg = 0, climbM = 0
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k]
    const d = Math.hypot(X(b) - X(a), Y(b) - Y(a))
    lengthM += d
    darkM += d * (o.lit ? (dark[b] < 0 ? darkAt(b) : dark[b]) : 0)
    maxSlopeDeg = Math.max(maxSlopeDeg, (Math.atan(Math.abs(z[b] - z[a]) / d) * 180) / Math.PI)
    climbM += Math.max(0, z[b] - z[a])
  }
  const pts = path.map((i) => [X(i), Y(i)] as [number, number])
  pts[0] = [from[0], from[1]]
  pts[pts.length - 1] = [to[0], to[1]]
  return { pts, lengthM, darkM, maxSlopeDeg, climbM }
}
