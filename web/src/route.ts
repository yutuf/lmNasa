// Rover route planner: A* over a grid on the real terrain. Steeper ground costs more and anything above the rover's
// slope limit is impassable; ground in shadow at the current hour costs extra (the rover burns battery there), so the
// planner prefers to stay in sunlight. The grid path is then simplified and resampled as a Catmull-Rom; the rover
// pure-pursues that curve. Coordinates are south polar stereographic metres (heading 0 = +x, π/2 = +y).
import type { Sampler } from './terrain'

export interface RouteOptions {
  cell?: number                       // grid spacing (m)
  maxSlope?: number                   // degrees; steeper steps are impassable
  margin?: number                     // extra room around the start/goal box (m)
  lit?: (x: number, y: number) => number   // 0..1 sunlight at a point (1 = full Sun)
  darkCost?: number                   // extra cost per metre in full shadow (as a multiple of distance)
  maxCells?: number                   // safety cap on the grid size
}

export interface Route {
  pts: [number, number][]          // smoothed curve the rover drives and the ribbon draws
  cum: number[]                    // cumulative metres along pts; cum[0] = 0
  lengthM: number; darkM: number; maxSlopeDeg: number; climbM: number
}

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
  const grid: [number, number][] = path.map((i) => [X(i), Y(i)])
  if (grid.length < 2) grid.push([to[0], to[1]])
  grid[0] = [from[0], from[1]]
  grid[grid.length - 1] = [to[0], to[1]]
  // cell*0.25 m drops collinear grid points and leaves real corners (a stair sits ~0.7 cells off its chord)
  const pts = smoothPath(grid, 3, Math.min(8, Math.max(4, cell * 0.25)))
  return { pts, cum: cumulative(pts), lengthM, darkM, maxSlopeDeg, climbM }
}

type Pt = [number, number]

/** Angle wrapped to [-π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Cumulative distance along a polyline. `out[0] = 0`. */
export function cumulative(pts: readonly Pt[]): number[] {
  const c = new Array<number>(pts.length)
  if (!pts.length) return c
  c[0] = 0
  for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return c
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-8) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

/** Ramer–Douglas–Peucker. Keeps endpoints; drops points within `epsilon` metres of the chord. */
export function simplifyPath(pts: readonly Pt[], epsilon: number): Pt[] {
  const n = pts.length
  if (n < 3) return pts.map((p) => [p[0], p[1]])
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack = [0, n - 1]
  while (stack.length) {
    const b = stack.pop()!
    const a = stack.pop()!
    let maxD = 0, idx = -1
    const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1]
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], ax, ay, bx, by)
      if (d > maxD) { maxD = d; idx = i }
    }
    if (idx >= 0 && maxD > epsilon) {
      keep[idx] = 1
      stack.push(a, idx, idx, b)
    }
  }
  const out: Pt[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push([pts[i][0], pts[i][1]])
  return out
}

function dedup(pts: readonly Pt[], min: number): Pt[] {
  if (!pts.length) return []
  const out: Pt[] = [[pts[0][0], pts[0][1]]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = out[out.length - 1]
    if (Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]) >= min) out.push([pts[i][0], pts[i][1]])
  }
  if (pts.length > 1) {
    const g = pts[pts.length - 1]
    const p = out[out.length - 1]
    if (Math.hypot(g[0] - p[0], g[1] - p[1]) < min) out[out.length - 1] = [g[0], g[1]]
    else out.push([g[0], g[1]])
    if (out.length === 1 && (pts[0][0] !== g[0] || pts[0][1] !== g[1])) out.unshift([pts[0][0], pts[0][1]])
  }
  return out
}

function densify(pts: readonly Pt[], maxSeg: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(len / maxSeg))
    for (let k = 0; k < n; k++) {
      const u = k / n
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
    }
  }
  const last = pts[pts.length - 1]
  out.push([last[0], last[1]])
  return out
}

function resampleLine(a: Pt, b: Pt, spacing: number): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.ceil(len / spacing))
  const out: Pt[] = []
  for (let k = 0; k <= n; k++) {
    const u = k / n
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
  }
  out[0] = [a[0], a[1]]
  out[out.length - 1] = [b[0], b[1]]
  return out
}

/** Centripetal Catmull-Rom, t in [0, 1] between p1 and p2. */
function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const alpha = 0.5
  const knot = (ti: number, a: Pt, b: Pt) => ti + Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha)
  const t0 = 0
  const t1 = knot(t0, p0, p1)
  const t2 = knot(t1, p1, p2)
  const t3 = knot(t2, p2, p3)
  const tt = t1 + (t2 - t1) * t
  const lerp = (a: Pt, b: Pt, ta: number, tb: number): Pt => {
    const d = tb - ta
    const u = d < 1e-6 ? 0 : (tt - ta) / d
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
  }
  const a1 = lerp(p0, p1, t0, t1)
  const a2 = lerp(p1, p2, t1, t2)
  const a3 = lerp(p2, p3, t2, t3)
  const b1 = lerp(a1, a2, t0, t2)
  const b2 = lerp(a2, a3, t1, t3)
  return lerp(b1, b2, t1, t2)
}

function closestOn(poly: readonly Pt[], x: number, y: number): Pt {
  let bx = poly[0][0], by = poly[0][1], best = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const ax = poly[i][0], ay = poly[i][1]
    const dx = poly[i + 1][0] - ax, dy = poly[i + 1][1] - ay
    const len2 = dx * dx + dy * dy
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    const px = ax + dx * t, py = ay + dy * t
    const d = (px - x) ** 2 + (py - y) ** 2
    if (d < best) { best = d; bx = px; by = py }
  }
  return [bx, by]
}

/** Replace a sharp corner with two points set back along the edges so the curve can round it. */
function fillet(pts: readonly Pt[], radius: number): Pt[] {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]])
  const out: Pt[] = [[pts[0][0], pts[0][1]]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1]
    const abx = a[0] - b[0], aby = a[1] - b[1]
    const cbx = c[0] - b[0], cby = c[1] - b[1]
    const lab = Math.hypot(abx, aby), lcb = Math.hypot(cbx, cby)
    if (lab < 1 || lcb < 1) { out.push([b[0], b[1]]); continue }
    const turn = Math.acos(Math.max(-1, Math.min(1, (-abx * cbx - aby * cby) / (lab * lcb))))
    const cut = Math.min(radius, lab * 0.45, lcb * 0.45)
    if (turn < 0.35 || cut < 1.5) { out.push([b[0], b[1]]); continue }
    out.push([b[0] + (abx / lab) * cut, b[1] + (aby / lab) * cut])
    out.push([b[0] + (cbx / lcb) * cut, b[1] + (cby / lcb) * cut])
  }
  const last = pts[pts.length - 1]
  out.push([last[0], last[1]])
  return out
}

/**
 * Simplify a grid path, round its corners, and resample a centripetal Catmull-Rom every `spacing` metres.
 * Samples stay within 12 m of the simplified polyline so the curve cannot cut a cliff the grid avoided.
 */
export function smoothPath(pts: readonly Pt[], spacing = 5, epsilon = 5): Pt[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]])
  const step = Math.max(1, spacing)
  const guide = simplifyPath(dedup(pts, 0.75), epsilon)
  if (guide.length < 2) return [[pts[0][0], pts[0][1]], [pts[pts.length - 1][0], pts[pts.length - 1][1]]]
  const start = pts[0], goal = pts[pts.length - 1]
  const simple = fillet(guide, 10)
  if (simple.length === 2) {
    const line = resampleLine(simple[0], simple[1], step)
    line[0] = [start[0], start[1]]
    line[line.length - 1] = [goal[0], goal[1]]
    return line
  }
  const ctrl = densify(simple, 24)
  const out: Pt[] = [[ctrl[0][0], ctrl[0][1]]]
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]
    const p1 = ctrl[i]
    const p2 = ctrl[i + 1]
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    if (segLen < 1e-3) continue
    const n = Math.max(1, Math.ceil(segLen / step))
    for (let k = 1; k <= n; k++) {
      const q = k === n ? [p2[0], p2[1]] as Pt : catmull(p0, p1, p2, p3, k / n)
      const prev = out[out.length - 1]
      if (Math.hypot(q[0] - prev[0], q[1] - prev[1]) >= 0.05) out.push(q)
    }
  }
  const maxDev = 12
  for (let i = 1; i < out.length - 1; i++) {
    const q = closestOn(guide, out[i][0], out[i][1])
    const dx = out[i][0] - q[0], dy = out[i][1] - q[1]
    const d = Math.hypot(dx, dy)
    if (d > maxDev) out[i] = [q[0] + (dx * maxDev) / d, q[1] + (dy * maxDev) / d]
  }
  const cleaned = dedup(out, 0.4)
  cleaned[0] = [start[0], start[1]]
  cleaned[cleaned.length - 1] = [goal[0], goal[1]]
  return cleaned
}

function segmentIndex(cum: readonly number[], s: number): number {
  let lo = 0
  let hi = cum.length - 2
  if (hi < 0) return 0
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (cum[m] <= s) lo = m
    else hi = m - 1
  }
  return lo
}

// Pursue/locate scratch. Single-threaded and not re-entered; keeps the drive frame free of allocations.
const _foot = { t: 0, d2: 0, len: 0 }
const _xy = { x: 0, y: 0 }

function foot(pts: readonly Pt[], seg: number, x: number, y: number) {
  const ax = pts[seg][0], ay = pts[seg][1]
  const dx = pts[seg + 1][0] - ax, dy = pts[seg + 1][1] - ay
  const len2 = dx * dx + dy * dy
  const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
  const px = ax + dx * t, py = ay + dy * t
  _foot.t = t
  _foot.d2 = (px - x) ** 2 + (py - y) ** 2
  _foot.len = Math.sqrt(len2)
}

/** Arc-length progress (m) of the closest point on the polyline, starting the search at `hint`. */
export function routeProgress(pts: readonly Pt[], cum: readonly number[], x: number, y: number, hint: number): number {
  const n = pts.length
  if (n < 2) return 0
  const total = cum[n - 1] ?? 0
  if (!(total > 0)) return 0
  let i = segmentIndex(cum, Math.max(0, Math.min(total, hint)))
  foot(pts, i, x, y)
  let bi = i, bt = _foot.t, bd = _foot.d2, bl = _foot.len
  for (let k = 0; k < 6 && i > 0; k++) {
    foot(pts, i - 1, x, y)
    if (_foot.d2 < bd) { i--; bi = i; bt = _foot.t; bd = _foot.d2; bl = _foot.len }
    else break
  }
  for (let k = 0; k < 48 && i < n - 2; k++) {
    foot(pts, i + 1, x, y)
    if (_foot.d2 <= bd + 1e-4) { i++; bi = i; bt = _foot.t; bd = _foot.d2; bl = _foot.len }
    else break
  }
  if (bd > 50 * 50) {
    for (let j = 0; j < n - 1; j++) {
      foot(pts, j, x, y)
      if (_foot.d2 < bd) { bi = j; bt = _foot.t; bd = _foot.d2; bl = _foot.len }
    }
  }
  return Math.max(0, Math.min(total, cum[bi] + bl * bt))
}

function sampleXY(pts: readonly Pt[], cum: readonly number[], s: number, out: { x: number; y: number }) {
  const n = pts.length
  const total = cum[n - 1] ?? 0
  if (s <= 0 || n < 2) { out.x = pts[0][0]; out.y = pts[0][1]; return }
  if (s >= total) { out.x = pts[n - 1][0]; out.y = pts[n - 1][1]; return }
  const i = segmentIndex(cum, s)
  const span = cum[i + 1] - cum[i]
  const u = span > 1e-6 ? (s - cum[i]) / span : 0
  out.x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u
  out.y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u
}

export interface Pursuit {
  pts: readonly Pt[]
  cum?: readonly number[]
  x: number; y: number
  heading: number       // stereographic plane: 0 = +x, π/2 = +y (not a three.js yaw)
  s: number             // arc length already passed, metres
  dt: number            // real seconds
  realSpeed: number     // ground speed, metres per real second (mission speed × time warp)
}

export interface PursuitStep {
  s: number
  seg: number
  heading: number
  throttle: number      // 0..1 of the rover's max speed
  steer: number         // -1..1, positive increases heading; Drive integrates heading itself
  done: boolean
}

const _step: PursuitStep = { s: 0, seg: 0, heading: 0, throttle: 0, steer: 0, done: false }

/**
 * One pure-pursuit step. Aims at a point a speed-scaled distance ahead on the path so grid corners
 * are rounded instead of orbited. Writes `out` (defaults to an internal buffer) and returns it.
 */
export function pursue(p: Pursuit, out: PursuitStep = _step): PursuitStep {
  const pts = p.pts
  const cum = p.cum && p.cum.length === pts.length ? p.cum : cumulative(pts)
  const n = pts.length
  const total = n ? (cum[n - 1] ?? 0) : 0
  const dt = Math.max(0, Math.min(0.1, p.dt))
  if (n < 2 || total < 1) {
    out.s = total; out.seg = 0; out.heading = p.heading; out.throttle = 0; out.steer = 0; out.done = true
    return out
  }
  const s = routeProgress(pts, cum, p.x, p.y, p.s)
  const goal = pts[n - 1]
  const distGoal = Math.hypot(goal[0] - p.x, goal[1] - p.y)
  const remain = total - s
  const v = Math.max(0, p.realSpeed)
  const arrive = Math.max(6, v * dt * 2)
  if (remain <= arrive || (distGoal <= arrive && remain < 40)) {
    out.s = s; out.seg = segmentIndex(cum, s); out.heading = p.heading; out.throttle = 0; out.steer = 0; out.done = true
    return out
  }
  const lookDist = Math.max(16, Math.min(56, 14 + v * 1.5))
  let lookS = Math.min(total, s + lookDist)
  sampleXY(pts, cum, lookS, _xy)
  for (let k = 0; k < 6 && lookS < total - 1; k++) {
    const dx = _xy.x - p.x, dy = _xy.y - p.y
    if (dx * dx + dy * dy >= 12 * 12) break
    lookS = Math.min(total, lookS + 10)
    sampleXY(pts, cum, lookS, _xy)
  }
  let bearing: number
  const ldx = _xy.x - p.x, ldy = _xy.y - p.y
  if (ldx * ldx + ldy * ldy < 0.16) {
    sampleXY(pts, cum, Math.min(total, s + 4), _xy)
    bearing = Math.atan2(_xy.y - p.y, _xy.x - p.x)
  } else bearing = Math.atan2(ldy, ldx)
  const alpha = wrapAngle(bearing - p.heading)
  // Yaw rate scales with ground speed so the turning radius stays near 11 m at any time warp.
  const yawMax = Math.max(1.6, v / 11)
  const yaw = Math.max(-yawMax, Math.min(yawMax, alpha * 3))
  const ad = Math.abs(alpha)
  const brake = Math.max(24, Math.min(100, v * 1.2))
  let throttle = Math.min(1, remain / brake)
  if (ad > 1.15) throttle *= 0.6
  if (ad > 2.1) throttle *= 0.35
  out.s = s
  out.seg = segmentIndex(cum, s)
  out.heading = wrapAngle(p.heading + yaw * dt)
  out.throttle = throttle
  out.steer = Math.max(-1, Math.min(1, alpha / 0.8))
  out.done = false
  return out
}
