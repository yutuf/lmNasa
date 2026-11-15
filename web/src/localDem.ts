// Terrain for the rover, lander and moonwalk views away from the south pole. The drive view runs on a stereographic
// plane centred on the south pole; there the 200 m polar grid (pole_dem.bin) is the ground. Anywhere else this builds a
// 160 km x 160 km grid at 200 m around the site, in the same Dem format the drive view, its mesh worker and its
// horizon code already read:
//   * heights: the whole-Moon LOLA grid (global_dem.bin, ~3.8 km between points), bicubic, so large craters and
//     ridges are real;
//   * finer than ~4 km: deterministic synthetic roughness and small craters, labelled as such in the HUD.
// The south-polar stereographic plane stretches distances by k = sec^2(c/2) away from the pole (x2 at the equator), so
// the local grid measures true metres around the site and latLonAt() scales offsets back onto the plane.
import { pointLatLon } from './engine'
import type { Dem } from './terrain'
import { dataUrl } from './data'

export interface GlobalDem { ppd: number; rows: number; cols: number; unit: number; h: Int16Array }
let globP: Promise<GlobalDem> | null = null
/** The whole-Moon LOLA grid, loaded once. */
export const loadGlobalDem = () => (globP ??= fetch(dataUrl('global_dem.bin')).then((r) => r.arrayBuffer()).then((b) => {
  const v = new DataView(b)
  return { ppd: v.getUint16(0, true), rows: v.getUint16(2, true), cols: v.getUint16(4, true), unit: v.getFloat32(6, true), h: new Int16Array(b.slice(10)) }
}))

const at = (g: GlobalDem, r: number, c: number) => {
  const rr = Math.min(g.rows - 1, Math.max(0, r))
  return g.h[rr * g.cols + (((c % g.cols) + g.cols) % g.cols)] * g.unit
}

/** Height (m) from the whole-Moon grid, bilinear; longitude wraps. */
export function globalHeight(g: GlobalDem, lat: number, lon: number) {
  const col = g.ppd * (((lon % 360) + 360) % 360) - 0.5, row = Math.min(g.rows - 1.001, Math.max(0, g.ppd * (90 - lat) - 0.5))
  const c0 = Math.floor(col), r0 = Math.floor(row), fc = col - c0, fr = row - r0
  return at(g, r0, c0) * (1 - fc) * (1 - fr) + at(g, r0, c0 + 1) * fc * (1 - fr) + at(g, r0 + 1, c0) * (1 - fc) * fr + at(g, r0 + 1, c0 + 1) * fc * fr
}

/** Height (m) from the whole-Moon grid, Catmull-Rom: no creases between the 3.8 km cells under a low Sun. */
export function globalHeightSmooth(g: GlobalDem, lat: number, lon: number) {
  const col = g.ppd * (((lon % 360) + 360) % 360) - 0.5, row = Math.min(g.rows - 1.001, Math.max(0, g.ppd * (90 - lat) - 0.5))
  const c0 = Math.floor(col), r0 = Math.floor(row), fc = col - c0, fr = row - r0
  const w = (t: number) => [((-t + 2) * t - 1) * t / 2, ((3 * t - 5) * t * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, ((t - 1) * t * t) / 2]
  const wc = w(fc), wr = w(fr)
  let v = 0
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) v += wr[j] * wc[i] * at(g, r0 - 1 + j, c0 - 1 + i)
  return v
}

/** Stereographic scale factor at a latitude: plane metres per true metre. */
export const planeScale = (lat: number) => 1 / Math.cos(((90 + lat) * Math.PI) / 360) ** 2

// ---- the drive view's frame: null at the pole (plane metres are true metres), else the site and its scale ----
export type DriveFrame = { xs: number; ys: number; k: number } | null
let frame: DriveFrame = null
export function setDriveFrame(f: DriveFrame) { frame = f }

/** Latitude/longitude of a drive-view point (m). */
export function latLonAt(xM: number, yM: number): [number, number] {
  if (frame) { xM = frame.xs + (xM - frame.xs) * frame.k; yM = frame.ys + (yM - frame.ys) * frame.k }
  return pointLatLon(xM / 1000, yM / 1000)
}

// ---- synthetic detail below the 3.8 km grid: deterministic per site ----
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
  const s = (t: number) => t * t * (3 - 2 * t)
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy)) * 2 - 1
}

const HALF_M = 80000
const STEP_M = 200

/** A Dem around (xs, ys) on the south-polar plane, in true metres (see the file note). */
export async function localDem(xs: number, ys: number): Promise<{ dem: Dem; k: number }> {
  const g = await loadGlobalDem()
  const [lat0] = pointLatLon(xs / 1000, ys / 1000)
  const k = planeScale(lat0)
  const n = Math.round((2 * HALF_M) / STEP_M) + 1
  const seed = (Math.round(xs) ^ Math.round(ys * 7)) & 0xffff
  // small craters: a few hundred bowls with raised rims, 150 m to 2.5 km across
  const craters: { x: number; y: number; r: number; d: number }[] = []
  for (let i = 0; i < 420; i++) {
    const u = hash(i, 1, seed), v = hash(i, 2, seed), w = hash(i, 3, seed)
    const r = 75 + 1200 * w ** 3
    craters.push({ x: (u * 2 - 1) * HALF_M, y: (v * 2 - 1) * HALF_M, r, d: r * (0.18 + 0.06 * hash(i, 4, seed)) })
  }
  const h = new Int16Array(n * n)
  const SCALE = 0.5
  for (let row = 0; row < n; row++) {
    const ly = HALF_M - row * STEP_M
    for (let col = 0; col < n; col++) {
      const lx = -HALF_M + col * STEP_M
      const [la, lo] = pointLatLon((xs + lx * k) / 1000, (ys + ly * k) / 1000)
      let z = globalHeightSmooth(g, la, lo)
      z += 55 * valueNoise(lx / 2400, ly / 2400, seed) + 24 * valueNoise(lx / 1100, ly / 1100, seed + 1) + 9 * valueNoise(lx / 500, ly / 500, seed + 2)
      for (const c of craters) {
        const dx = lx - c.x, dy = ly - c.y
        if (Math.abs(dx) > c.r * 1.6 || Math.abs(dy) > c.r * 1.6) continue
        const q = Math.hypot(dx, dy) / c.r
        if (q < 1) z -= c.d * (1 - q * q)
        else if (q < 1.6) z += c.d * 0.25 * (1 - (q - 1) / 0.6) ** 2
      }
      h[row * n + col] = Math.max(-32767, Math.min(32767, Math.round(z / SCALE)))
    }
  }
  const dem: Dem = { rows: n, cols: n, mPerPx: STEP_M, sample0: (HALF_M - xs) / STEP_M, line0: (ys + HALF_M) / STEP_M, scale: SCALE, h }
  return { dem, k }
}
