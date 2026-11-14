// The search engine: for every candidate point near the south pole and every landing date in a window, work out
// the Sun and Earth over that point's real terrain horizon hour by hour, then run the mission models.
// lunanav/engine.py is the same algorithm in Python; src/engine.test.ts checks the two agree.
import { evaluateWindow, type Constraints } from './model'

export interface Atlas {
  n: number
  nAz: number
  spacingM: number
  rMaxM: number
  xKm: Float64Array
  yKm: Float64Array
  height: Int16Array
  slope: Float32Array
  horizon: Uint8Array     // n * nAz, (deg + 8) * 10
  lat: Float64Array       // per point (deg)
  lon: Float64Array
  kind: 'pole' | 'moon'   // the 2 km south-pole grid, or the ~30 km whole-Moon grid
}

export interface Ephem {
  n: number
  sun: [Float32Array, Float32Array, Float32Array]
  earth: [Float32Array, Float32Array, Float32Array]
  sunR: Float32Array
}

/** Touchdown hazard (scripts/build_hazard.py): 95th-percentile LOLA 40 m slope inside landing zones of each radius. */
export interface Hazard {
  radii: number[]           // zone radius (m)
  p95: Float32Array[]       // per radius, per atlas point (deg)
}

export interface Search {
  firstHour: number       // index of the first landing hour in the ephemeris
  nStarts: number         // landing options, every `strideH` hours
  strideH: number
  durationH: number
  maxSlope: number
  needDsn: boolean
  zone?: number           // landing-zone radius (m); 0 or absent = no touchdown hazard check
  zoneSlope?: number      // 95 % of the zone must be gentler than this (deg)
  iceKm?: number          // an ice cold trap must lie within this distance (km); 0 or absent = no science check
}

/** Science value (scripts/build_science.py): distance to the nearest ice cold trap, and cold-trap area within 5 km. */
export interface IceReach {
  distKm: Float32Array      // NaN = outside the data (north of 85 S)
  areaKm2: Float32Array
}

export function parseIceReach(buf: ArrayBuffer): IceReach {
  const n = new DataView(buf).getUint32(0, true)
  const d = new Uint8Array(buf, 4, n)
  const a = new Uint16Array(buf.slice(4 + n, 4 + n + 2 * n))
  return { distKm: Float32Array.from(d, (v) => (v === 255 ? NaN : v / 4)), areaKm2: Float32Array.from(a, (v) => v / 100) }
}

/** Does a point have an ice cold trap close enough? True without a requirement or without the data. */
export function passesIce(ice: IceReach | null, index: number, q: Search): boolean {
  if (!ice || !q.iceKm) return true
  const d = ice.distKm[index]
  return !Number.isNaN(d) && d <= q.iceKm
}

export function parseHazard(buf: ArrayBuffer): Hazard {
  const dv = new DataView(buf)
  const n = dv.getUint32(0, true)
  const k = dv.getUint8(4)
  const radii = Array.from({ length: k }, (_, i) => dv.getUint16(5 + 2 * i, true))
  const o = 5 + 2 * k
  const p95 = radii.map((_, i) => Float32Array.from(new Uint8Array(buf, o + i * n, n), (v) => v / 4))
  return { radii, p95 }
}

/** 95th-percentile slope inside the landing zone at a point, or null without a zone or hazard data. */
export function zoneSlopeAt(h: Hazard | null, zone: number | undefined, index: number): number | null {
  if (!h || !zone) return null
  const z = h.radii.indexOf(zone)
  return z < 0 ? null : h.p95[z][index]
}

/** Is a point flat enough to search: the 400 m site slope, and (if asked) the touchdown zone? */
export function passesTerrain(atlas: Atlas, h: Hazard | null, index: number, q: Search): boolean {
  if (atlas.slope[index] > q.maxSlope) return false
  const z = zoneSlopeAt(h, q.zone, index)
  return z === null || q.zoneSlope === undefined || z <= q.zoneSlope
}

export interface PointResult {
  index: number
  lat: number
  lon: number
  goCount: number         // landing options that are GO
  bestScore: number
  bestStart: number       // landing option index of the best score
  bestGo: boolean
  sunFrac: number         // for the best landing option
  commFrac: number
  longestDarkH: number
}

const R_KM = 1737.4
const RAD = Math.PI / 180

export function parseAtlas(buf: ArrayBuffer): Atlas {
  const dv = new DataView(buf)
  const n = dv.getUint32(0, true)
  const nAz = dv.getUint16(4, true)
  const spacingM = dv.getFloat32(6, true)
  const rMaxM = dv.getFloat32(10, true)
  let o = 14
  const i16 = (count: number) => { const a = new Int16Array(buf.slice(o, o + 2 * count)); o += 2 * count; return a }
  const x = i16(n)
  const y = i16(n)
  const height = i16(n)
  const slopeRaw = new Uint8Array(buf, o, n); o += n
  const horizon = new Uint8Array(buf, o, n * nAz)
  const xKm = Float64Array.from(x, (v) => v / 10), yKm = Float64Array.from(y, (v) => v / 10)
  const lat = new Float64Array(n), lon = new Float64Array(n)
  for (let i = 0; i < n; i++) [lat[i], lon[i]] = pointLatLon(xKm[i], yKm[i])
  return { n, nAz, spacingM, rMaxM, xKm, yKm, height, slope: Float32Array.from(slopeRaw, (v) => v / 4), horizon, lat, lon, kind: 'pole' }
}

/** The whole-Moon atlas (scripts/build_global_atlas.py): points by latitude/longitude, about 30 km apart. Their
 *  south-polar stereographic coordinates are filled in too, so the code that measures distances or tests the
 *  Artemis region outlines works the same on both grids. */
export function parseGlobalAtlas(buf: ArrayBuffer): Atlas {
  const dv = new DataView(buf)
  const n = dv.getUint32(0, true)
  const nAz = dv.getUint16(4, true)
  let o = 6
  const i16 = (count: number) => { const a = new Int16Array(buf.slice(o, o + 2 * count)); o += 2 * count; return a }
  const latR = i16(n), lonR = i16(n), height = i16(n)
  const slopeRaw = new Uint8Array(buf, o, n); o += n
  const horizon = new Uint8Array(buf, o, n * nAz)
  const lat = Float64Array.from(latR, (v) => v / 100), lon = Float64Array.from(lonR, (v) => v / 100)
  const xKm = new Float64Array(n), yKm = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const r = 2 * R_KM * Math.tan(((90 + lat[i]) * RAD) / 2)
    xKm[i] = r * Math.sin(lon[i] * RAD); yKm[i] = r * Math.cos(lon[i] * RAD)
  }
  return { n, nAz, spacingM: 30000, rMaxM: NaN, xKm, yKm, height, slope: Float32Array.from(slopeRaw, (v) => v / 4), horizon, lat, lon, kind: 'moon' }
}

/** Great-circle distance between two points (km). */
export function gcKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function parseEphem(buf: ArrayBuffer, n: number): Ephem {
  const f = (k: number) => new Float32Array(buf.slice(4 * n * k, 4 * n * (k + 1)))
  return { n, sun: [f(0), f(1), f(2)], earth: [f(3), f(4), f(5)], sunR: f(6) }
}

export function pointLatLon(xKm: number, yKm: number): [number, number] {
  const r = Math.hypot(xKm, yKm) * 1000
  return [-90 + 2 * Math.atan(r / (2 * 1737400)) / RAD, Math.atan2(xKm, yKm) / RAD]
}

/** Horizon elevation (deg) at an azimuth, periodic linear interpolation (numpy.interp(..., period=360)). */
export function horizonAt(h: Uint8Array, off: number, nAz: number, az: number): number {
  const step = 360 / nAz
  const p = (((az % 360) + 360) % 360) / step
  const i = Math.floor(p)
  const f = p - i
  const a = h[off + (i % nAz)] / 10 - 8
  const b = h[off + ((i + 1) % nAz)] / 10 - 8
  return a + (b - a) * f
}

export function diskFraction(alt: number, hz: number, r: number): number {
  const d = Math.min(Math.max((alt - hz) / r, -1), 1)
  return (Math.acos(-d) + d * Math.sqrt(1 - d * d)) / Math.PI
}

/** Hourly sun fraction and Earth visibility at one atlas point over `hours` hours from `firstHour`. */
export function pointSky(atlas: Atlas, ephem: Ephem, dsn: ArrayLike<boolean>, index: number, firstHour: number,
                         hours: number, needDsn: boolean) {
  const lat = atlas.lat[index], lon = atlas.lon[index]
  const la = lat * RAD
  const lo = lon * RAD
  const e = [-Math.sin(lo), Math.cos(lo), 0]
  const nn = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
  const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  const p = [R_KM * u[0], R_KM * u[1], R_KM * u[2]]
  const off = index * atlas.nAz
  const sunFraction = new Float64Array(hours)
  const earthVisible: boolean[] = new Array(hours)
  const [sx, sy, sz] = ephem.sun
  const [ex, ey, ez] = ephem.earth
  for (let k = 0; k < hours; k++) {
    const h = firstHour + k
    const s0 = sx[h], s1 = sy[h], s2 = sz[h]
    const su = s0 * u[0] + s1 * u[1] + s2 * u[2]
    const sAlt = Math.asin(Math.min(Math.max(su, -1), 1)) / RAD
    const sAz = Math.atan2(s0 * e[0] + s1 * e[1] + s2 * e[2], s0 * nn[0] + s1 * nn[1] + s2 * nn[2]) / RAD
    sunFraction[k] = diskFraction(sAlt, horizonAt(atlas.horizon, off, atlas.nAz, sAz), ephem.sunR[h])
    const d0 = ex[h] - p[0], d1 = ey[h] - p[1], d2 = ez[h] - p[2]
    const len = Math.hypot(d0, d1, d2)
    const eu = (d0 * u[0] + d1 * u[1] + d2 * u[2]) / len
    const eAlt = Math.asin(Math.min(Math.max(eu, -1), 1)) / RAD
    const eAz = Math.atan2(d0 * e[0] + d1 * e[1] + d2 * e[2], d0 * nn[0] + d1 * nn[1] + d2 * nn[2]) / RAD
    earthVisible[k] = eAlt > horizonAt(atlas.horizon, off, atlas.nAz, eAz) && (!needDsn || dsn[h])
  }
  return { lat, lon, sunFraction, earthVisible }
}

/** Evaluate every landing option at one point. */
export function searchPoint(atlas: Atlas, ephem: Ephem, dsn: ArrayLike<boolean>, index: number, q: Search,
                            c: Constraints): PointResult {
  const hours = (q.nStarts - 1) * q.strideH + q.durationH
  const sky = pointSky(atlas, ephem, dsn, index, q.firstHour, hours, q.needDsn)
  let goCount = 0
  let best = { score: -1, start: 0, go: false, sun: 0, comm: 0, dark: 0 }
  for (let s = 0; s < q.nStarts; s++) {
    const a = s * q.strideH
    const w = evaluateWindow(sky.sunFraction.subarray(a, a + q.durationH), sky.earthVisible.slice(a, a + q.durationH), 1, c)
    if (w.go) goCount++
    if (w.score > best.score) best = { score: w.score, start: s, go: w.go, sun: w.sunFrac, comm: w.commFrac, dark: w.longestDarkH }
  }
  return { index, lat: sky.lat, lon: sky.lon, goCount, bestScore: best.score, bestStart: best.start, bestGo: best.go,
    sunFrac: best.sun, commFrac: best.comm, longestDarkH: best.dark }
}

/** Hour-by-hour sky at one point, with Sun/Earth altitude and azimuth, for the detail views. */
export function pointTrack(atlas: Atlas, ephem: Ephem, dsn: ArrayLike<boolean>, index: number, firstHour: number,
                           hours: number) {
  const sky = pointSky(atlas, ephem, dsn, index, firstHour, hours, false)
  const la = sky.lat * RAD
  const lo = sky.lon * RAD
  const e = [-Math.sin(lo), Math.cos(lo), 0]
  const nn = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
  const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  const p = u.map((x) => R_KM * x)
  const sunAlt = new Float32Array(hours), sunAz = new Float32Array(hours)
  const earthAlt = new Float32Array(hours), earthAz = new Float32Array(hours)
  const link: boolean[] = new Array(hours)
  const altaz = (d: number[]) => {
    const len = Math.hypot(d[0], d[1], d[2])
    const alt = Math.asin((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / len) / RAD
    const az = Math.atan2(d[0] * e[0] + d[1] * e[1] + d[2] * e[2], d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2]) / RAD
    return [alt, (az + 360) % 360]
  }
  for (let k = 0; k < hours; k++) {
    const h = firstHour + k
    ;[sunAlt[k], sunAz[k]] = altaz([ephem.sun[0][h], ephem.sun[1][h], ephem.sun[2][h]])
    ;[earthAlt[k], earthAz[k]] = altaz([ephem.earth[0][h] - p[0], ephem.earth[1][h] - p[1], ephem.earth[2][h] - p[2]])
    link[k] = sky.earthVisible[k] && !!dsn[h]
  }
  const horizon = Array.from({ length: 360 }, (_, a) => horizonAt(atlas.horizon, index * atlas.nAz, atlas.nAz, a))
  return { ...sky, sunAlt, sunAz, earthAlt, earthAz, link, horizon,
    sunDir: (k: number) => [ephem.sun[0][firstHour + k], ephem.sun[1][firstHour + k], ephem.sun[2][firstHour + k]],
    earthDir: (k: number) => {
      const h = firstHour + k
      const d = [ephem.earth[0][h] - p[0], ephem.earth[1][h] - p[1], ephem.earth[2][h] - p[2]]
      const len = Math.hypot(d[0], d[1], d[2])
      return d.map((x) => x / len)
    } }
}

/** Is a stereographic point (km) inside a polygon ring? */
export function insideRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Visible share of the solar disk at every atlas point at one ephemeris hour (for the sunlight map). */
export function sunlitMap(atlas: Atlas, ephem: Ephem, hour: number): Float32Array {
  const out = new Float32Array(atlas.n)
  for (let i = 0; i < atlas.n; i++) out[i] = pointSky(atlas, ephem, [], i, hour, 1, false).sunFraction[0]
  return out
}
