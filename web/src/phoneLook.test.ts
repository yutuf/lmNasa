import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { enu, toThree } from './geometry'
import { headingFromOrientation, lookQuaternion, tiltFromAccel, tiltFromOrientation } from './phoneLook'

describe('phone look', () => {
  it('reads the horizon from an upright phone and the sky from a face-up phone', () => {
    expect(tiltFromAccel({ x: 0, y: 9.8, z: 0 }).alt).toBeCloseTo(0, 5)
    expect(tiltFromAccel({ x: 0, y: 0, z: 9.8 }).alt).toBeCloseTo(90, 5)
    expect(tiltFromAccel({ x: 0, y: 0, z: -9.8 }).alt).toBeCloseTo(-90, 5)
    expect(Math.abs(tiltFromAccel({ x: 9.8, y: 0, z: 0 }).roll)).toBeCloseTo(90, 5)
  })

  it('reads an upright phone from deviceorientation, which is what the browser fuses', () => {
    expect(tiltFromOrientation(90, 0)).toEqual({ alt: 0, roll: 0 })
    expect(tiltFromOrientation(0, 0)?.alt).toBe(90)
    expect(tiltFromOrientation(90, 30)?.roll).toBe(30)
    expect(tiltFromOrientation(null, 0)).toBeNull()
  })

  it('prefers the iOS compass and otherwise flips alpha into a heading', () => {
    expect(headingFromOrientation(20, 140)).toBe(140)
    expect(headingFromOrientation(90, null)).toBe(270)
    expect(headingFromOrientation(null, null)).toBeNull()
  })

  it('looks north along the horizon from the equator', () => {
    const q = lookQuaternion(0, 0, 0, 0, 0)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const north = toThree(enu(0, 0).n).normalize()
    const up = toThree(enu(0, 0).u).normalize()
    expect(forward.dot(north)).toBeGreaterThan(0.95)
    expect(Math.abs(forward.dot(up))).toBeLessThan(0.05)
  })

  it('looks up when the phone is tilted toward the sky', () => {
    const q = lookQuaternion(0, 0, 0, 80, 0)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const up = toThree(enu(0, 0).u).normalize()
    expect(forward.dot(up)).toBeGreaterThan(0.9)
  })
})
