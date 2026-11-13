// South-pole terrain for the rover and lander views: the 200 m LOLA polar grid (pole_dem.bin) plus 10 m site maps
// (LOLA 5 m/px, Barker et al. 2021) where we have them, the sky at any position and hour, and a horizon ray-march
// (same method as lunanav/horizon.py: mast height, lunar curvature, out to 150 km).
import type { Ephem } from './engine'
import { pointLatLon } from './engine'

export interface Dem { rows: number; cols: number; mPerPx: number; line0: number; sample0: number; scale: number; h: Int16Array }
export interface Patch { id: string; name: string; rows: number; cols: number; mPerPx: number; x0: number; y0: number; scale: number; h: Int16Array }
export interface SiteInfo { id: string; name: string; file: string; m_per_px: number; bounds_m: number[]; center: number[] }
export type Sampler = (x: number, y: number) => number

export const R_M = 1737400
const RAD = Math.PI / 180

export function parseDem(buf: ArrayBuffer): Dem {
  const v = new DataView(buf)
  return { rows: v.getUint32(0, true), cols: v.getUint32(4, true), mPerPx: v.getFloat32(8, true), line0: v.getFloat32(12, true),
    sample0: v.getFloat32(16, true), scale: v.getFloat32(20, true), h: new Int16Array(buf.slice(24)) }
}

export function parsePatch(buf: ArrayBuffer, id: string, name: string): Patch {
  const v = new DataView(buf)
  return { id, name, rows: v.getUint32(0, true), cols: v.getUint32(4, true), mPerPx: v.getFloat32(8, true), x0: v.getFloat32(12, true),
    y0: v.getFloat32(16, true), scale: v.getFloat32(20, true), h: new Int16Array(buf.slice(24)) }
}

function bilinear(h: Int16Array, cols: number, rows: number, col: number, row: number, scale: number): number {
  const c0 = Math.floor(col)
  const r0 = Math.floor(row)
  if (c0 < 0 || r0 < 0 || c0 + 1 >= cols || r0 + 1 >= rows) return NaN
  const fc = col - c0
  const fr = row - r0
  const k = r0 * cols + c0
  return scale * (h[k] * (1 - fc) * (1 - fr) + h[k + 1] * fc * (1 - fr) + h[k + cols] * (1 - fc) * fr + h[k + cols + 1] * fc * fr)
}

/** Height (m) at a stereographic point (m): +x toward 90°E, +y toward 0°E. NaN outside the grid. */
export function heightAt(d: Dem, x: number, y: number): number {
  return bilinear(d.h, d.cols, d.rows, d.sample0 + x / d.mPerPx, d.line0 - y / d.mPerPx, d.scale)
}

export function patchHeight(p: Patch, x: number, y: number): number {
  return bilinear(p.h, p.cols, p.rows, (x - p.x0) / p.mPerPx, (p.y0 - y) / p.mPerPx, p.scale)
}

/** Distance (m) from (x, y) to the nearest edge of a patch, negative outside. */
function patchInset(p: Patch, x: number, y: number): number {
  const x1 = p.x0 + (p.cols - 1) * p.mPerPx
  const y1 = p.y0 - (p.rows - 1) * p.mPerPx
  return Math.min(x - p.x0, x1 - x, p.y0 - y, y - y1)
}

const BLEND_M = 400

/** Best available height: the 10 m site map where we have one (blended into the 200 m grid over 400 m), else 200 m. */
export function makeGround(dem: Dem, patches: Patch[]): { height: Sampler; source: (x: number, y: number) => Patch | null } {
  const source = (x: number, y: number) => patches.find((p) => patchInset(p, x, y) > 0) ?? null
  const height: Sampler = (x, y) => {
    const base = heightAt(dem, x, y)
    for (const p of patches) {
      const d = patchInset(p, x, y)
      if (d <= 0) continue
      const hp = patchHeight(p, x, y)
      if (Number.isNaN(hp)) continue
      if (d >= BLEND_M || Number.isNaN(base)) return hp
      const w = d / BLEND_M
      return hp * w + base * (1 - w)
    }
    return base
  }
  return { height, source }
}

/** Unit direction in the stereographic plane for a local azimuth (clockwise from north) at longitude lon. */
export function planeDir(lonDeg: number, azDeg: number): [number, number] {
  const lo = lonDeg * RAD
  const a = azDeg * RAD
  return [Math.cos(a) * Math.sin(lo) + Math.sin(a) * Math.cos(lo), Math.cos(a) * Math.cos(lo) - Math.sin(a) * Math.sin(lo)]
}

/** Local azimuth (deg, clockwise from north) of a stereographic-plane direction at longitude lon. */
export function planeAz(lonDeg: number, dx: number, dy: number): number {
  const lo = lonDeg * RAD
  const north = dx * Math.sin(lo) + dy * Math.cos(lo)
  const east = dx * Math.cos(lo) - dy * Math.sin(lo)
  return ((Math.atan2(east, north) / RAD) + 360) % 360
}

/** Terrain horizon elevation (deg) seen from (x, y) toward a local azimuth. */
export function horizonElev(h: Sampler, x: number, y: number, lonDeg: number, azDeg: number, mast = 2, maxM = 150000,
  h0In?: number): number {
  const h0 = (h0In ?? h(x, y)) + mast
  const [dx, dy] = planeDir(lonDeg, azDeg)
  let best = -90
  let s = 20
  while (s <= maxM) {
    const z = h(x + dx * s, y + dy * s)
    if (Number.isNaN(z)) break
    const e = Math.atan2(z - h0 - (s * s) / (2 * R_M), s) / RAD
    if (e > best) best = e
    s += s < 2000 ? 20 : s < 20000 ? 100 : 250
  }
  return best
}

/** Horizon elevation for every whole degree of azimuth (index 0 = north). */
export function horizonProfile(h: Sampler, x: number, y: number, mast = 2): Float32Array {
  const [, lon] = pointLatLon(x / 1000, y / 1000)
  const h0 = h(x, y)
  const out = new Float32Array(360)
  for (let a = 0; a < 360; a++) out[a] = horizonElev(h, x, y, lon, a, mast, 150000, h0)
  return out
}

export function profileAt(p: Float32Array, az: number): number {
  const a = ((az % 360) + 360) % 360
  const i = Math.floor(a)
  const f = a - i
  return p[i] * (1 - f) + p[(i + 1) % 360] * f
}

/** Moon-fixed Sun unit vector and Earth position (km) at a fractional ephemeris hour (linear between hours). */
export function bodies(eph: Ephem, hr: number) {
  const h = Math.max(0, Math.min(eph.n - 2, Math.floor(hr)))
  const f = Math.max(0, Math.min(1, hr - h))
  const lerp = (a: Float32Array) => a[h] * (1 - f) + a[h + 1] * f
  const sun = [lerp(eph.sun[0]), lerp(eph.sun[1]), lerp(eph.sun[2])]
  const n = Math.hypot(sun[0], sun[1], sun[2])
  return { sun: sun.map((v) => v / n), earth: [lerp(eph.earth[0]), lerp(eph.earth[1]), lerp(eph.earth[2])], sunR: lerp(eph.sunR) }
}

/** Altitude/azimuth of a Moon-fixed vector seen from latitude/longitude (vector from the surface point). */
export function altAz(v: number[], latDeg: number, lonDeg: number) {
  const la = latDeg * RAD
  const lo = lonDeg * RAD
  const e = [-Math.sin(lo), Math.cos(lo), 0]
  const n = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
  const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  const len = Math.hypot(v[0], v[1], v[2])
  const alt = Math.asin(Math.max(-1, Math.min(1, (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / len))) / RAD
  const az = Math.atan2(v[0] * e[0] + v[1] * e[1] + v[2] * e[2], v[0] * n[0] + v[1] * n[1] + v[2] * n[2]) / RAD
  return { alt, az: (az + 360) % 360 }
}

/** Sun and Earth seen from a stereographic point (m) at a fractional ephemeris hour. */
export function localSky(eph: Ephem, xM: number, yM: number, hr: number) {
  const [lat, lon] = pointLatLon(xM / 1000, yM / 1000)
  const b = bodies(eph, hr)
  const la = lat * RAD
  const lo = lon * RAD
  const p = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)].map((x) => 1737.4 * x)
  return { lat, lon, sun: altAz(b.sun, lat, lon), earth: altAz([b.earth[0] - p[0], b.earth[1] - p[1], b.earth[2] - p[2]], lat, lon), sunR: b.sunR }
}

/** Fraction (0..1) of the solar disk above a straight horizon line (lunanav/geometry.py). */
export function diskAbove(alt: number, hz: number, r: number) {
  const d = Math.min(Math.max((alt - hz) / r, -1), 1)
  return (Math.acos(-d) + d * Math.sqrt(1 - d * d)) / Math.PI
}

/** Sunlight fraction and Earth-in-view at a point with a known horizon profile. */
export function conditions(eph: Ephem, profile: Float32Array, xM: number, yM: number, hr: number) {
  const s = localSky(eph, xM, yM, hr)
  return { ...s, sunFrac: diskAbove(s.sun.alt, profileAt(profile, s.sun.az), s.sunR), earthUp: s.earth.alt > profileAt(profile, s.earth.az) }
}

/** Hours until the Sun (>= half disk) or Earth visibility next changes at this point, scanning up to `maxH` hours. */
export function nextChanges(eph: Ephem, profile: Float32Array, xM: number, yM: number, hr: number, maxH = 720) {
  const c0 = conditions(eph, profile, xM, yM, hr)
  const sun0 = c0.sunFrac >= 0.5
  let sunH: number | null = null
  let earthH: number | null = null
  for (let k = 1; k <= maxH && (sunH === null || earthH === null) && hr + k < eph.n - 1; k++) {
    const c = conditions(eph, profile, xM, yM, hr + k)
    if (sunH === null && (c.sunFrac >= 0.5) !== sun0) sunH = k
    if (earthH === null && c.earthUp !== c0.earthUp) earthH = k
  }
  return { sunUp: sun0, earthUp: c0.earthUp, sunH, earthH }
}
