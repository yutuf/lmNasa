import { pointLatLon } from './engine'
import { altAz, diskAbove, horizonElev, R_M, type Sampler } from './terrain'

export interface MeshSpec {
  cx: number; cy: number; half: number; step: number
  origin: { x: number; y: number; h: number }
  hole?: { cx: number; cy: number; half: number }
  sun: number[]; sunR: number; sub: number; reach: number
}
export interface SurfaceMesh {
  position: Float32Array; normal: Float32Array; uv: Float32Array; color: Float32Array; sunlit: Float32Array; index: Uint32Array
  grid: { cx: number; cy: number; half: number; step: number; n: number }
}

/** Same terrain and horizon sampling as Drive; prepared in a worker so a scene cut cannot freeze the film. */
export function buildSurfaceMesh(height: Sampler, spec: MeshSpec): SurfaceMesh {
  const { cx, cy, half, step, origin: o, hole, sun, sunR, sub, reach } = spec
  const n = Math.round(2 * half / step) + 1
  const position = new Float32Array(n * n * 3), normal = new Float32Array(n * n * 3)
  const uv = new Float32Array(n * n * 2), color = new Float32Array(n * n * 3).fill(1), sunlit = new Float32Array(n * n)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const sx = cx - half + j * step, sy = cy + half - i * step, dx = sx - o.x, dy = sy - o.y, k = i * n + j
    let z = height(sx, sy)
    if (!Number.isFinite(z)) z = -3000
    let y = z - o.h - (dx * dx + dy * dy) / (2 * R_M)
    if (hole && Math.abs(sx - hole.cx) < hole.half && Math.abs(sy - hole.cy) < hole.half) y -= 250
    position[k * 3] = dx; position[k * 3 + 1] = y; position[k * 3 + 2] = -dy
    uv[k * 2] = sx / 26; uv[k * 2 + 1] = sy / 26
  }
  const index = new Uint32Array((n - 1) * (n - 1) * 6)
  let q = 0
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j
    index[q++] = a; index[q++] = a + n; index[q++] = a + 1
    index[q++] = a + 1; index[q++] = a + n; index[q++] = a + n + 1
  }
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3
    const abx = position[b] - position[a], aby = position[b + 1] - position[a + 1], abz = position[b + 2] - position[a + 2]
    const acx = position[c] - position[a], acy = position[c + 1] - position[a + 1], acz = position[c + 2] - position[a + 2]
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx
    for (const k of [a, b, c]) { normal[k] += nx; normal[k + 1] += ny; normal[k + 2] += nz }
  }
  for (let k = 0; k < normal.length; k += 3) {
    const l = Math.hypot(normal[k], normal[k + 1], normal[k + 2]) || 1
    normal[k] /= l; normal[k + 1] /= l; normal[k + 2] /= l
  }
  const m = Math.floor((n - 1) / sub) + 1, lit = new Float32Array(m * m)
  for (let a = 0; a < m; a++) for (let c = 0; c < m; c++) {
    const sx = cx - half + c * sub * step, sy = cy + half - a * sub * step
    const [lat, lon] = pointLatLon(sx / 1000, sy / 1000), s = altAz(sun, lat, lon)
    lit[a * m + c] = s.alt < -2 ? 0 : diskAbove(s.alt, horizonElev(height, sx, sy, lon, s.az, 1, reach), sunR)
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const fi = Math.min(i / sub, m - 1.0001), fj = Math.min(j / sub, m - 1.0001)
    const a = Math.floor(fi), c = Math.floor(fj), u = fi - a, v = fj - c
    sunlit[i * n + j] = lit[a * m + c] * (1 - u) * (1 - v) + lit[a * m + c + 1] * (1 - u) * v + lit[(a + 1) * m + c] * u * (1 - v) + lit[(a + 1) * m + c + 1] * u * v
  }
  return { position, normal, uv, color, sunlit, index, grid: { cx, cy, half, step, n } }
}
