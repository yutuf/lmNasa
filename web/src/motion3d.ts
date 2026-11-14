// Shared nominal animation profiles. Scene units are explicitly schematic; surface units are metres.
import * as THREE from 'three'

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const ease = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u) }
export const UP = new THREE.Vector3(0, 1, 0)

export interface SurfacePose { altitude: number; range: number; vertical: number; horizontal: number; tilt: number }
/** Final 180 s, played in 26 s. Acceleration opposes both the horizontal and vertical velocity. */
export function finalApproach(t: number, out: SurfacePose) {
  const b = 1 - clamp01(t)
  out.altitude = 1600 * b ** 2.4
  out.range = 2400 * b ** 3.2
  out.vertical = -1600 * 2.4 * b ** 1.4 / 180
  out.horizontal = -2400 * 3.2 * b ** 2.2 / 180
  out.tilt = Math.atan2(2400 * 3.2 * 2.2 * b ** 1.2 / 180 ** 2, 1.62 + 1600 * 2.4 * 1.4 * b ** .4 / 180 ** 2)
  return out
}

/** Reject a swept segment, including at high time warp, rather than letting it tunnel through a lander. */
export function clearsLander(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number) {
  const dx = bx - ax, dy = by - ay
  const f = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ax + dx * f - cx, ay + dy * f - cy) >= radius
}

/** US Naval Observatory low-precision solar coordinates, converted to Earth-fixed longitude with GMST.
 * https://aa.usno.navy.mil/faq/sun_approx — launch lighting only; lunar surface lighting uses the supplied JPL ephemeris. */
export function earthSunAt(unixMs: number, out: THREE.Vector3) {
  const d = unixMs / 86400000 + 2440587.5 - 2451545
  const rad = Math.PI / 180
  const g = (357.529 + .98560028 * d) * rad
  const l = (280.459 + .98564736 * d + 1.915 * Math.sin(g) + .020 * Math.sin(2 * g)) * rad
  const ob = (23.439 - .00000036 * d) * rad
  const ra = Math.atan2(Math.cos(ob) * Math.sin(l), Math.cos(l))
  const dec = Math.asin(Math.sin(ob) * Math.sin(l))
  const lon = ra - (280.46061837 + 360.98564736629 * d) * rad
  return out.set(Math.cos(dec) * Math.cos(lon), Math.sin(dec), -Math.cos(dec) * Math.sin(lon))
}

/** Continuous ascent -> one parking orbit -> a tangent injection/departure. Y is the rocket's thrust axis. */
export function launchPosition(t: number, out: THREE.Vector3) {
  const u = clamp01(t), r = 1.09
  let a: number, radius: number
  if (u < .18) {
    const s = u / .18
    a = Math.PI / 3 * s * s
    radius = 1 + .09 * Math.sin(s * Math.PI / 2)
  } else if (u < .72) {
    a = Math.PI / 3 + (u - .18) / .54 * Math.PI * 2
    radius = r
  } else {
    const s = (u - .72) / .28, a0 = Math.PI / 3 + Math.PI * 2
    // Depart tangentially; no artificial turn back into Earth after injection.
    const along = (.28 * r * Math.PI * 2 / .54) * s + 1.8 * s * s
    return out.set(Math.cos(a0) * r - Math.sin(a0) * along, Math.sin(a0) * r + Math.cos(a0) * along, 0)
  }
  return out.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
}

export const TRANSFER_DAYS = 4.5
export const MOON_ADVANCE = Math.PI * 2 * TRANSFER_DAYS / 27.321661
/** Earth-centred prograde transfer ending at the Moon's future position; sizes/distances compressed. */
export function transferMoon(t: number, out: THREE.Vector3) {
  const a = -.6 + MOON_ADVANCE * clamp01(t)
  return out.set(5.2 * Math.cos(a), 0, -5.2 * Math.sin(a))
}
const transferEnd = transferMoon(1, new THREE.Vector3())
export function transferPosition(t: number, out: THREE.Vector3) {
  const u = ease(t), a = -.6 + MOON_ADVANCE * .2
  // Cubic Hermite-like Bezier: depart Earth prograde, meet the leading limb on the lunar tangent.
  const b = 1 - u
  const endX = transferEnd.x - .28 * Math.sin(-.6 + MOON_ADVANCE)
  const endZ = transferEnd.z - .28 * Math.cos(-.6 + MOON_ADVANCE)
  return out.set(b ** 3 * .72 + 3 * b * b * u * 1.3 + 3 * b * u * u * (endX + .8 * Math.cos(a)) + u ** 3 * endX,
    0, 3 * b * b * u * -1.2 + 3 * b * u * u * (endZ + .8 * Math.sin(a)) + u ** 3 * endZ)
}
