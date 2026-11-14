// The spacecraft's route to a landing site, for the globe: Earth → trans-lunar coast → polar lunar orbit over the
// site → powered descent. Shapes are schematic (Earth is drawn 5.2 Moon radii away, the orbit is lifted for
// visibility); what is computed per site is the orbit plane (a polar orbit whose ground track crosses the site) and
// the approach direction: the lander descends with the Sun behind it where it can, because at the south pole the Sun
// sits a few degrees above the horizon and an approach into it blinds the optical hazard-detection cameras.
import * as THREE from 'three'
import { surfacePoint } from './geometry'

export const PHASES = {
  coast: { days: 4.5 },          // a typical trans-lunar coast (Artemis-like), not computed
  orbitKm: 100,                  // low polar orbit
  descentMin: 12,                // powered descent duration, typical
  descentArcDeg: 16,             // ground range of the powered descent, about 480 km
} as const

export interface Approach {
  headingDeg: number             // direction of travel at touchdown (0 = north, 180 = south)
  sunOffDeg: number              // angle between the heading and the Sun's azimuth (180 = Sun straight behind)
  sunBehind: boolean
}

const wrap = (a: number) => Math.abs(((a % 360) + 540) % 360 - 180)

/** Choose the approach along the polar ground track (heading north or south) that keeps the Sun most behind. */
export function chooseApproach(sunAzDeg: number): Approach {
  const opts = [0, 180].map((h) => ({ headingDeg: h, sunOffDeg: wrap(sunAzDeg - h) }))
  const best = opts.sort((a, b) => b.sunOffDeg - a.sunOffDeg)[0]
  return { ...best, sunBehind: best.sunOffDeg >= 90 }
}

export interface FlightPath {
  transfer: THREE.Vector3[]
  orbit: THREE.Vector3[]       // the whole orbit ring
  parking: THREE.Vector3[]     // the part flown before the descent
  descent: THREE.Vector3[]
  all: THREE.Vector3[]         // transfer + parking + descent, for the moving craft
  phaseAt: number[]            // per point of `all`: 0 transfer, 1 orbit, 2 descent
}

/** Route geometry in the globe's frame (Moon radius 1). */
export function flightPath(lat: number, lon: number, earthDir: THREE.Vector3, approach: Approach, orbitR = 1.09): FlightPath {
  const u = surfacePoint(lat, lon, 1).normalize()
  const south = surfacePoint(-90, 0, 1).normalize()
  // orbit plane through the poles and the site; t points along the meridian away from the south pole (north)
  let n = new THREE.Vector3().crossVectors(south, u)
  if (n.lengthSq() < 1e-8) n = new THREE.Vector3(1, 0, 0)
  n.normalize()
  const t = new THREE.Vector3().crossVectors(n, u).normalize()
  const at = (phi: number, r: number) => u.clone().multiplyScalar(Math.cos(phi)).add(t.clone().multiplyScalar(Math.sin(phi))).multiplyScalar(r)
  // heading north means arriving from the pole side (phi < 0) and flying toward +phi
  const dir = approach.headingDeg === 0 ? 1 : -1
  const phi0 = -dir * (PHASES.descentArcDeg * Math.PI) / 180

  const orbit = Array.from({ length: 181 }, (_, k) => at((k / 180) * Math.PI * 2, orbitR))
  // one half orbit before the descent starts: insertion at phi0 - dir * PI, flying in +dir
  const parking = Array.from({ length: 91 }, (_, k) => at(phi0 - dir * Math.PI * (1 - k / 90), orbitR))
  // powered descent: altitude falls slowly at first, steeply near the end
  const descent = Array.from({ length: 61 }, (_, k) => {
    const s = k / 60
    return at(phi0 * (1 - s), 1.004 + (orbitR - 1.004) * Math.sqrt(1 - s))
  })
  // trans-lunar coast: a cubic curve from just outside Earth to the insertion point, arriving along the orbit
  const E = earthDir.clone().normalize().multiplyScalar(5.2)
  const start = E.clone().add(E.clone().normalize().multiplyScalar(-0.34))
  const ins = parking[0]
  const tangent = parking[1].clone().sub(parking[0]).normalize()
  const side = new THREE.Vector3().crossVectors(E, n).normalize()
  const c1 = start.clone().lerp(ins, 0.35).add(side.clone().multiplyScalar(1.4))
  const c2 = ins.clone().sub(tangent.clone().multiplyScalar(1.6))
  const curve = new THREE.CubicBezierCurve3(start, c1, c2, ins)
  const transfer = curve.getPoints(120)

  const all = [...transfer, ...parking.slice(1), ...descent.slice(1)]
  const phaseAt = [...transfer.map(() => 0), ...parking.slice(1).map(() => 1), ...descent.slice(1).map(() => 2)]
  return { transfer, orbit, parking, descent, all, phaseAt }
}
