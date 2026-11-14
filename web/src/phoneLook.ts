// Where a phone is looking, from the accelerometer, then placed on the lunar surface.
// Device axes: +x to the right of the screen, +y toward the top, +z out of the screen.
// At rest the accelerometer reports gravity. Upright (gravity along +y) looks at the horizon.
// Face up (gravity along +z) looks at the sky.
import * as THREE from 'three'
import { directionMoonFixed, enu, surfacePoint, toThree } from './geometry'

export interface Gravity { x: number; y: number; z: number }

export function tiltFromAccel(g: Gravity): { alt: number; roll: number } {
  const alt = Math.atan2(g.z, g.y) * 180 / Math.PI
  const roll = Math.atan2(g.x, Math.hypot(g.y, g.z)) * 180 / Math.PI
  return { alt, roll }
}

/** Compass heading in degrees. iOS exposes webkitCompassHeading; other browsers give alpha clockwise from north. */
export function headingFromOrientation(alpha: number | null, webkitCompassHeading?: number | null): number | null {
  if (webkitCompassHeading != null && Number.isFinite(webkitCompassHeading)) return ((webkitCompassHeading % 360) + 360) % 360
  if (alpha != null && Number.isFinite(alpha)) return ((360 - alpha) % 360 + 360) % 360
  return null
}

/** Camera quaternion standing at lat/lon. heading 0 looks north, alt 0 is the horizon, alt 90 is the zenith. */
export function lookQuaternion(lat: number, lon: number, headingDeg: number, altDeg: number, rollDeg: number): THREE.Quaternion {
  const dir = toThree(directionMoonFixed(altDeg, headingDeg, lat, lon)).normalize()
  const up = toThree(enu(lat, lon).u).normalize()
  const eye = surfacePoint(lat, lon, 1.02)
  const m = new THREE.Matrix4().lookAt(eye, eye.clone().add(dir), up)
  const q = new THREE.Quaternion().setFromRotationMatrix(m)
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollDeg * Math.PI / 180))
  return q
}

export function eyePosition(lat: number, lon: number): THREE.Vector3 {
  return surfacePoint(lat, lon, 1.02)
}

export interface Stand { name: string; lat: number; lon: number }

export const SOUTH_POLE: Stand = { name: 'South pole', lat: -85, lon: 0 }
