import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { clearsLander, earthSunAt, finalApproach, launchPosition, MOON_ADVANCE, transferMoon, transferPosition } from './motion3d'

describe('3D mission motion contracts', () => {
  it('ascends from the surface and joins orbit and injection without teleporting', () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3()
    expect(launchPosition(0, a).length()).toBeCloseTo(1)
    for (const t of [.18, .72]) {
      launchPosition(t - 1e-7, a); launchPosition(t + 1e-7, b)
      expect(a.distanceTo(b)).toBeLessThan(.0001)
    }
    for (let i = 0; i <= 1000; i++) expect(launchPosition(i / 1000, a).length()).toBeGreaterThanOrEqual(1 - 1e-8)
  })
  it('brakes monotonically and settles vertically at zero speed and altitude', () => {
    const p = { altitude: 0, range: 0, vertical: 0, horizontal: 0, tilt: 0 }
    let alt = Infinity, range = Infinity, speed = Infinity
    for (let i = 0; i <= 1000; i++) {
      finalApproach(i / 1000, p)
      expect(p.altitude).toBeLessThanOrEqual(alt)
      expect(p.range).toBeLessThanOrEqual(range)
      expect(Math.hypot(p.vertical, p.horizontal)).toBeLessThanOrEqual(speed)
      expect(p.tilt).toBeGreaterThanOrEqual(0)
      alt = p.altitude; range = p.range; speed = Math.hypot(p.vertical, p.horizontal)
    }
    expect(p).toEqual({ altitude: 0, range: 0, vertical: -0, horizontal: -0, tilt: 0 })
  })
  it('catches lander collisions between frames, including at high time warp', () => {
    expect(clearsLander(-20, 0, 20, 0, 0, 0, 5)).toBe(false)
    expect(clearsLander(-20, 6, 20, 6, 0, 0, 5)).toBe(true)
    expect(clearsLander(8, 0, 8, 0, 0, 0, 5)).toBe(true)
  })
  it('shows a prograde Moon and arrives at its future limb', () => {
    const a = transferMoon(0, new THREE.Vector3()), b = transferMoon(1, new THREE.Vector3())
    expect(a.angleTo(b)).toBeCloseTo(MOON_ADVANCE)
    expect(a.clone().cross(b).y).toBeGreaterThan(0)
    expect(transferPosition(1, new THREE.Vector3()).distanceTo(b)).toBeCloseTo(.28)
  })
  it('places the subsolar point near Greenwich noon and the right seasonal hemisphere', () => {
    const v = new THREE.Vector3()
    earthSunAt(Date.parse('2027-03-20T12:00:00Z'), v)
    expect(v.length()).toBeCloseTo(1)
    expect(v.x).toBeGreaterThan(.99)
    expect(Math.abs(v.y)).toBeLessThan(.01)
    expect(earthSunAt(Date.parse('2027-06-21T12:00:00Z'), v).y).toBeGreaterThan(.39)
    expect(earthSunAt(Date.parse('2027-12-21T12:00:00Z'), v).y).toBeLessThan(-.39)
  })
})
