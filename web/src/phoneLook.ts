// Where a phone is looking, from the accelerometer, then placed on the lunar surface.
// Device axes: +x to the right of the screen, +y toward the top, +z out of the screen.
// At rest the accelerometer reports gravity. Upright (gravity along +y) looks at the horizon.
// Face up (gravity along +z) looks at the sky.
import * as THREE from 'three'
import { directionMoonFixed, enu, surfacePoint } from './geometry'

export interface Gravity { x: number; y: number; z: number }

/**
 * Pitch and roll from gravity, in the screen frame. +z out of the screen is the look direction.
 * Euler beta/gamma are not used: they flip 180° when the phone rolls past upright.
 * `rollOk` is false when the phone points nearly straight up or down, where roll is undefined.
 */
export function poseFromGravity(g: Gravity): { alt: number; roll: number; rollOk: boolean } {
  const m = Math.hypot(g.x, g.y, g.z)
  if (m < 1e-3) return { alt: 0, roll: 0, rollOk: false }
  const sx = g.x / m, sy = g.y / m, sz = g.z / m
  const alt = Math.asin(Math.max(-1, Math.min(1, sz))) * 180 / Math.PI
  if (Math.hypot(sx, sy) < 0.25) return { alt, roll: 0, rollOk: false }
  return { alt, roll: Math.atan2(sx, sy) * 180 / Math.PI, rollOk: true }
}

export function tiltFromAccel(g: Gravity): { alt: number; roll: number } {
  const p = poseFromGravity(g)
  return { alt: p.alt, roll: p.roll }
}

/** Device-frame gravity into the screen frame. `angleDeg` is screen.orientation.angle (clockwise). */
export function gravityInScreen(g: Gravity, angleDeg: number): Gravity {
  const r = ((angleDeg % 360) + 360) % 360 * Math.PI / 180
  const c = Math.cos(r), s = Math.sin(r)
  return { x: g.x * c - g.y * s, y: g.x * s + g.y * c, z: g.z }
}

/** Shortest step from `prev` toward `next`, capped so one bad compass sample cannot spin the view. */
export function followAngle(prev: number, next: number, maxStep: number): number {
  let d = ((next - prev + 540) % 360) - 180
  if (d > maxStep) d = maxStep
  else if (d < -maxStep) d = -maxStep
  return (prev + d + 360) % 360
}

export function blendGravity(prev: Gravity, next: Gravity, k: number): Gravity {
  return {
    x: prev.x + (next.x - prev.x) * k,
    y: prev.y + (next.y - prev.y) * k,
    z: prev.z + (next.z - prev.z) * k,
  }
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
  const frame = enu(lat, lon)
  scratch.up.set(frame.u[0], frame.u[2], -frame.u[1])
  const north = scratch.at.set(frame.n[0], frame.n[2], -frame.n[1])
  // right = look × up. Near the zenith that cross vanishes and lookAt would flip, so fall back to north.
  const right = scratch.eye.crossVectors(scratch.dir, scratch.up)
  if (right.lengthSq() < 1e-4) right.crossVectors(scratch.dir, north)
  right.normalize()
  const camUp = scratch.up.crossVectors(right, scratch.dir).normalize()
  const back = north.copy(scratch.dir).multiplyScalar(-1)
  scratch.m.makeBasis(right, camUp, back)
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

/** Drag-to-look. Finger moving right turns right; finger moving up looks up. Altitude stays clear of the zenith flip. */
export function dragLook(tilt: { heading: number; alt: number }, dx: number, dy: number, degPerPx = 0.22): { heading: number; alt: number } {
  return {
    heading: (tilt.heading + dx * degPerPx + 360) % 360,
    alt: Math.max(-75, Math.min(75, tilt.alt - dy * degPerPx)),
  }
}

export function nudgeLook(tilt: { heading: number; alt: number }, dir: 'left' | 'right' | 'up' | 'down', step = 8): { heading: number; alt: number } {
  if (dir === 'left') return dragLook(tilt, -step / 0.22, 0)
  if (dir === 'right') return dragLook(tilt, step / 0.22, 0)
  if (dir === 'up') return dragLook(tilt, 0, -step / 0.22)
  return dragLook(tilt, 0, step / 0.22)
}

export interface RemoteRates { alpha: number; beta: number; gamma: number }
export interface CursorAim { x: number; y: number }

/** How far the cursor may travel, in degrees, and still stay on a vertical phone. */
export function remoteLimits(vFovDeg = 68, aspect = 9 / 19.5): { x: number; y: number } {
  const halfV = Math.tan(vFovDeg * Math.PI / 360)
  const edge = 0.86
  return {
    x: Math.atan(halfV * aspect * edge) * 180 / Math.PI,
    y: Math.atan(halfV * edge) * 180 / Math.PI,
  }
}

/**
 * TV-remote cursor. Rates are degrees per second in the device frame.
 * The phone is held upright, screen facing the user.
 * +gamma yaws the screen toward the user's right, so the cursor moves right.
 * +beta tips the top of the phone toward the user, so the cursor moves down.
 * Alpha rolls the phone in the plane of the screen and is ignored, so a wrist
 * roll cannot flip the picture. The picture itself does not follow the phone's tilt.
 */
export function stepRemote(cursor: CursorAim, rates: RemoteRates, dt: number, opts?: { dead?: number; gain?: number; limitX?: number; limitY?: number }): CursorAim {
  if (!(dt > 0) || dt > 0.05) return { x: cursor.x, y: cursor.y }
  const dead = opts?.dead ?? 6
  const gain = opts?.gain ?? 1.2
  const limits = remoteLimits()
  const limitX = opts?.limitX ?? limits.x
  const limitY = opts?.limitY ?? limits.y
  const zone = (v: number) => {
    if (!Number.isFinite(v) || Math.abs(v) > 720) return 0
    if (Math.abs(v) < dead) return 0
    return v - Math.sign(v) * dead
  }
  return {
    x: Math.max(-limitX, Math.min(limitX, cursor.x + zone(rates.gamma) * dt * gain)),
    y: Math.max(-limitY, Math.min(limitY, cursor.y - zone(rates.beta) * dt * gain)),
  }
}

/**
 * Turn the view from the phone, used as a steering wheel. The picture stays upright.
 * +alpha rolls the top of the phone to the user's left, like turning a wheel left, so the view turns left.
 * +gamma yaws the screen to the user's right and also turns right. The stronger of the two wins,
 * so a wheel twist and a yaw do not add. +beta looks down.
 * Holding still leaves the view where it is. Altitude stays clear of the zenith.
 */
export function stepSlew(tilt: { heading: number; alt: number }, rates: RemoteRates, dt: number, opts?: { dead?: number; gain?: number }): { heading: number; alt: number } {
  if (!(dt > 0) || dt > 0.05) return { heading: tilt.heading, alt: tilt.alt }
  const dead = opts?.dead ?? 5
  const gain = opts?.gain ?? 1.35
  const zone = (v: number) => {
    if (!Number.isFinite(v) || Math.abs(v) > 720) return 0
    if (Math.abs(v) < dead) return 0
    return v - Math.sign(v) * dead
  }
  const wheel = -zone(rates.alpha)
  const yaw = zone(rates.gamma)
  const turn = Math.abs(wheel) >= Math.abs(yaw) ? wheel : yaw
  return {
    heading: (tilt.heading + turn * dt * gain + 360) % 360,
    alt: Math.max(-75, Math.min(75, tilt.alt - zone(rates.beta) * dt * gain)),
  }
}

/** Finger right moves the cursor right. Finger up moves it up. Same limits as the remote. */
export function dragCursor(cursor: CursorAim, dx: number, dy: number, degPerPx = 0.16): CursorAim {
  const limits = remoteLimits()
  return {
    x: Math.max(-limits.x, Math.min(limits.x, cursor.x + dx * degPerPx)),
    y: Math.max(-limits.y, Math.min(limits.y, cursor.y - dy * degPerPx)),
  }
}

/** Point the camera at the cursor, then the caller puts the cursor back on the center. */
export function commitAim(tilt: { heading: number; alt: number }, aim: CursorAim): { heading: number; alt: number } {
  return {
    heading: (tilt.heading + aim.x + 360) % 360,
    alt: Math.max(-75, Math.min(75, tilt.alt + aim.y)),
  }
}

/** Cursor position on screen. +x is right, +y is up, each axis is -1..1 across the view. */
export function cursorNdc(xDeg: number, yDeg: number, vFovDeg = 68, aspect = 16 / 9): { x: number; y: number } {
  const halfV = Math.tan(vFovDeg * Math.PI / 360)
  const halfH = halfV * Math.max(aspect, 0.2)
  return {
    x: Math.max(-0.92, Math.min(0.92, Math.tan(xDeg * Math.PI / 180) / halfH)),
    y: Math.max(-0.92, Math.min(0.92, Math.tan(yDeg * Math.PI / 180) / halfV)),
  }
}

export interface Stand { name: string; lat: number; lon: number }

export const SOUTH_POLE: Stand = { name: 'South pole', lat: -85, lon: 0 }
