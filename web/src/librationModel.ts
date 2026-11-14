// Optical libration of the Moon, as a schematic a judge can watch.
// Longitude ±7.9° over an anomalistic month (27.555 d): the orbit is eccentric, so the Moon
// speeds up and slows down while it spins at a steady rate.
// Latitude ±6.7° over a draconic month (27.212 d): the lunar equator is tilted by that much.
// The two periods do not match, so the path is a Lissajous figure and does not close.
// At the south pole, Earth elevation is the latitude term with the opposite sign: a sub-Earth
// point in the southern hemisphere lifts Earth above that horizon.

export const LIBRATION = {
  lonAmpDeg: 7.9,
  latAmpDeg: 6.7,
  /** Anomalistic month, days. Longitude period. */
  lonPeriodDays: 27.555,
  /** Draconic month, days. Latitude period. About 27.2, not the 27.3-day sidereal month. */
  latPeriodDays: 27.212,
  /**
   * Latitude phase relative to longitude, radians.
   * Quadrature draws the ellipse of a typical month. The real offset drifts as nodes and perigee precess.
   * In phase, the two sines would collapse to a line and the loop would disappear.
   */
  latPhaseRad: Math.PI / 2,
  /** Lunar orbit eccentricity. The drawing uses a larger value so the ellipse reads. */
  eccentricity: 0.0549,
  /** Angular radius of Earth as seen from the Moon, degrees. Diameter is about 1.9°. */
  earthRadiusDeg: 0.95,
} as const

/** Screen layout for the orbit diagram. Eccentricity and tilt are enlarged on purpose. */
export const ORBIT_DRAW = {
  cx: 268,
  cy: 300,
  /** Semi-major axis, px. */
  a: 138,
  e: 0.34,
  tiltDeg: 26,
  periodDays: LIBRATION.lonPeriodDays,
} as const

/** Screen layout for the south-pole sky. Degrees are to scale. */
export const SKY_DRAW = {
  cx: 764,
  cy: 300,
  pxPerDeg: 16,
} as const

export function librationDeg(day: number): { lon: number; lat: number } {
  const lon = LIBRATION.lonAmpDeg * Math.sin((2 * Math.PI * day) / LIBRATION.lonPeriodDays)
  const lat = LIBRATION.latAmpDeg * Math.sin((2 * Math.PI * day) / LIBRATION.latPeriodDays + LIBRATION.latPhaseRad)
  return { lon, lat }
}

/** Azimuth along the horizon and elevation, degrees, as seen from the lunar south pole. */
export function southPoleElevation(day: number): { azDeg: number; elDeg: number } {
  const { lon, lat } = librationDeg(day)
  return { azDeg: lon, elDeg: -lat }
}

/** Kepler's equation M = E − e sin E. Angles in radians. */
export function keplerE(meanAnomaly: number, e: number): number {
  let E = meanAnomaly
  for (let i = 0; i < 12; i++) {
    const f = E - e * Math.sin(E) - meanAnomaly
    const fp = 1 - e * Math.cos(E)
    E -= f / fp
  }
  return E
}

/**
 * Moon in the orbital plane. Earth is at the origin, periapsis on +x.
 * x, y and r are in units of the semi-major axis. r = 1 − e at periapsis, 1 + e at apoapsis.
 */
export function moonOrbitXY(day: number, e: number, periodDays: number): { x: number; y: number; r: number } {
  const M = (2 * Math.PI * day) / periodDays
  const E = keplerE(M, e)
  const x = Math.cos(E) - e
  const y = Math.sqrt(1 - e * e) * Math.sin(E)
  return { x, y, r: Math.hypot(x, y) }
}

export type OrbitDraw = { cx: number; cy: number; a: number; e: number; tiltDeg: number; periodDays: number }

/** Foreshorten the orbit by `tiltDeg` around the line of apsides, then place it on the screen. */
export function projectMoon(day: number, d: OrbitDraw = ORBIT_DRAW): { x: number; y: number; r: number } {
  const p = moonOrbitXY(day, d.e, d.periodDays)
  const tilt = (d.tiltDeg * Math.PI) / 180
  return { x: d.cx + p.x * d.a, y: d.cy - p.y * Math.cos(tilt) * d.a, r: p.r }
}

export function orbitPath(d: OrbitDraw = ORBIT_DRAW, samples = 180): string {
  let out = ''
  for (let i = 0; i <= samples; i++) {
    const p = projectMoon((d.periodDays * i) / samples, d)
    out += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  return out
}

export function skyPoint(day: number, s: { cx: number; cy: number; pxPerDeg: number } = SKY_DRAW): { x: number; y: number; az: number; el: number } {
  const { azDeg, elDeg } = southPoleElevation(day)
  return { x: s.cx + azDeg * s.pxPerDeg, y: s.cy - elDeg * s.pxPerDeg, az: azDeg, el: elDeg }
}

export function skyTrace(days: number, samples: number, s: { cx: number; cy: number; pxPerDeg: number } = SKY_DRAW): string {
  let out = ''
  for (let i = 0; i <= samples; i++) {
    const p = skyPoint((days * i) / samples, s)
    out += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  return out
}
