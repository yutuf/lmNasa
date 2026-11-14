// Eclipses seen from the Moon: Earth passing in front of the Sun (a lunar eclipse, seen from Earth).
// Uses the same hourly Moon-fixed Sun direction and Earth position as the engine (JPL DE440).
import type { Ephem } from './engine'

const RAD = Math.PI / 180
const R_EARTH_KM = 6371

/** Fraction (0..1) of the solar disk covered by a disk of radius re at separation d (all in degrees). */
export function diskCover(d: number, rs: number, re: number): number {
  if (d >= rs + re) return 0
  if (d <= Math.abs(re - rs)) return re >= rs ? 1 : (re * re) / (rs * rs)
  const a = Math.acos((d * d + rs * rs - re * re) / (2 * d * rs))
  const b = Math.acos((d * d + re * re - rs * rs) / (2 * d * re))
  const area = rs * rs * (a - Math.sin(2 * a) / 2) + re * re * (b - Math.sin(2 * b) / 2)
  return Math.min(1, area / (Math.PI * rs * rs))
}

/** Share of the Sun hidden by Earth at ephemeris hour hr (fractional), seen from Moon-fixed point p (km). */
export function eclipseAt(eph: Ephem, hr: number, p: number[] = [0, 0, 0]): number {
  const h = Math.max(0, Math.min(eph.n - 2, Math.floor(hr)))
  const f = Math.max(0, Math.min(1, hr - h))
  const L = (a: Float32Array) => a[h] * (1 - f) + a[h + 1] * f
  const s = [L(eph.sun[0]), L(eph.sun[1]), L(eph.sun[2])]
  const e = [L(eph.earth[0]) - p[0], L(eph.earth[1]) - p[1], L(eph.earth[2]) - p[2]]
  const ns = Math.hypot(s[0], s[1], s[2])
  const ne = Math.hypot(e[0], e[1], e[2])
  const cos = (s[0] * e[0] + s[1] * e[1] + s[2] * e[2]) / (ns * ne)
  const d = Math.acos(Math.max(-1, Math.min(1, cos))) / RAD
  if (d > 3) return 0
  return diskCover(d, L(eph.sunR), Math.asin(R_EARTH_KM / ne) / RAD)
}

export interface Eclipse { startH: number; endH: number; peakH: number; peak: number; totalH: number; totalStart?: number }

/** Every eclipse in the ephemeris (scanned every 10 minutes). Peak = greatest cover; for a total eclipse, mid-totality. */
export function listEclipses(eph: Ephem, p: number[] = [0, 0, 0]): Eclipse[] {
  const out: Eclipse[] = []
  let cur: Eclipse | null = null
  const step = 1 / 6
  for (let hr = 0; hr < eph.n - 1; hr += step) {
    const c = eclipseAt(eph, hr, p)
    if (c > 0) {
      cur ??= { startH: hr, endH: hr, peakH: hr, peak: 0, totalH: 0 }
      cur.endH = hr
      if (c > cur.peak) { cur.peak = c; cur.peakH = hr }
      if (c >= 0.999) { cur.totalStart ??= hr; cur.totalH += step; cur.peakH = cur.totalStart + cur.totalH / 2 - step / 2 }
    } else if (cur) { out.push(cur); cur = null }
  }
  if (cur) out.push(cur)
  return out
}
