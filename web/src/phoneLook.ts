// Where a phone is looking, from the accelerometer, then placed on the lunar surface.
// Device axes: +x to the right of the screen, +y toward the top, +z out of the screen.
// At rest the accelerometer reports gravity. Upright (gravity along +y) looks at the horizon.
// Face up (gravity along +z) looks at the sky.
import * as THREE from 'three'
import { directionMoonFixed, enu, surfacePoint } from './geometry'

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

/**
 * Fused deviceorientation. beta 90 is an upright phone (horizon); beta 0 is flat, face up (sky).
 * gamma is the roll, positive when the right side drops.
 */
export function tiltFromOrientation(beta: number | null, gamma: number | null): { alt: number; roll: number } | null {
  if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null
  return {
    alt: Math.max(-90, Math.min(90, 90 - beta)),
    roll: Math.max(-90, Math.min(90, gamma)),
  }
}

/** A few kilometres above the surface: high enough that the near plane can sit in front of the ground. */
export const EYE_RADIUS = 1.005

const scratch = {
  dir: new THREE.Vector3(),
  up: new THREE.Vector3(),
  eye: new THREE.Vector3(),
  at: new THREE.Vector3(),
  m: new THREE.Matrix4(),
  roll: new THREE.Quaternion(),
  z: new THREE.Vector3(0, 0, 1),
}

/** Writes the stand-on-the-surface quaternion into `out`. heading 0 looks north, alt 0 is the horizon. */
export function writeLook(out: THREE.Quaternion, lat: number, lon: number, headingDeg: number, altDeg: number, rollDeg: number): THREE.Quaternion {
  const dir = directionMoonFixed(altDeg, headingDeg, lat, lon)
  scratch.dir.set(dir[0], dir[2], -dir[1]).normalize()
  const u = enu(lat, lon).u
  scratch.up.set(u[0], u[2], -u[1]).normalize()
  scratch.eye.copy(surfacePoint(lat, lon, EYE_RADIUS))
  scratch.at.copy(scratch.eye).add(scratch.dir)
  scratch.m.lookAt(scratch.eye, scratch.at, scratch.up)
  out.setFromRotationMatrix(scratch.m)
  scratch.roll.setFromAxisAngle(scratch.z, rollDeg * Math.PI / 180)
  out.multiply(scratch.roll)
  return out
}

/** Camera quaternion standing at lat/lon. heading 0 looks north, alt 0 is the horizon, alt 90 is the zenith. */
export function lookQuaternion(lat: number, lon: number, headingDeg: number, altDeg: number, rollDeg: number): THREE.Quaternion {
  return writeLook(new THREE.Quaternion(), lat, lon, headingDeg, altDeg, rollDeg)
}

export function eyePosition(lat: number, lon: number): THREE.Vector3 {
  return surfacePoint(lat, lon, EYE_RADIUS)
}

export interface Stand { name: string; lat: number; lon: number }

export const SOUTH_POLE: Stand = { name: 'South pole', lat: -85, lon: 0 }
