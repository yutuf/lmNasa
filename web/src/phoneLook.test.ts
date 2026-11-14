import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { enu, toThree } from './geometry'
import { commitAim, cursorNdc, dragCursor, dragLook, followAngle, gravityInScreen, headingFromOrientation, lookQuaternion, nudgeLook, poseFromGravity, stepRemote, stepSlew, tiltFromAccel, tiltFromOrientation } from './phoneLook'

describe('phone look', () => {
  it('reads the horizon from an upright phone and the sky from a face-up phone', () => {
    expect(tiltFromAccel({ x: 0, y: 9.8, z: 0 }).alt).toBeCloseTo(0, 5)
    expect(tiltFromAccel({ x: 0, y: 0, z: 9.8 }).alt).toBeCloseTo(90, 5)
    expect(tiltFromAccel({ x: 0, y: 0, z: -9.8 }).alt).toBeCloseTo(-90, 5)
    expect(Math.abs(tiltFromAccel({ x: 9.8, y: 0, z: 0 }).roll)).toBeCloseTo(90, 5)
  })

  it('keeps the horizon while the phone rolls past upright, instead of flipping altitude', () => {
    const samples = [
      { x: 0, y: 1, z: 0 },
      { x: 0.7, y: 0.7, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0.7, y: -0.7, z: 0 },
      { x: 0, y: -1, z: 0 },
    ]
    const rolls = samples.map((g) => poseFromGravity(g).roll)
    for (const g of samples) expect(Math.abs(poseFromGravity(g).alt)).toBeLessThan(1)
    expect(rolls[0]).toBeCloseTo(0, 5)
    expect(rolls[2]).toBeCloseTo(90, 5)
    expect(rolls[4]).toBeCloseTo(180, 5)
    for (let i = 1; i < rolls.length; i++) expect(rolls[i]).toBeGreaterThan(rolls[i - 1])
  })

  it('turns device gravity into the screen frame when the phone is landscape', () => {
    const turned = gravityInScreen({ x: 1, y: 0, z: 2 }, 90)
    expect(turned.x).toBeCloseTo(0, 5)
    expect(turned.y).toBeCloseTo(1, 5)
    expect(turned.z).toBe(2)
    expect(gravityInScreen({ x: 0, y: -1, z: 0 }, 180).y).toBeCloseTo(1, 5)
  })

  it('takes the short compass step and refuses a single-sample spin', () => {
    expect(followAngle(350, 10, 30)).toBe(10)
    expect(followAngle(0, 90, 30)).toBe(30)
    const half = followAngle(0, 180, 30)
    expect(Math.min(half, 360 - half)).toBe(30)
  })

  it('turns a finger drag into a look, and will not pitch through the zenith', () => {
    expect(dragLook({ heading: 10, alt: 0 }, 100, 0).heading).toBeCloseTo(32, 5)
    expect(dragLook({ heading: 10, alt: 0 }, 0, -100).alt).toBeCloseTo(22, 5)
    expect(dragLook({ heading: 350, alt: 70 }, 100, -100).alt).toBe(75)
    expect(nudgeLook({ heading: 0, alt: 0 }, 'left').heading).toBe(352)
    expect(nudgeLook({ heading: 0, alt: 0 }, 'down').alt).toBe(-8)
    const east = toThree(enu(0, 0).e).normalize()
    const sky = toThree(enu(0, 0).u).normalize()
    const fwd = (heading: number, alt: number) => new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternion(0, 0, heading, alt, 0))
    const level = fwd(0, 0)
    const turned = fwd(dragLook({ heading: 0, alt: 0 }, 100, 0).heading, 0)
    const raised = fwd(0, dragLook({ heading: 0, alt: 0 }, 0, -100).alt)
    expect(turned.dot(east)).toBeGreaterThan(level.dot(east) + 0.2)
    expect(raised.dot(sky)).toBeGreaterThan(level.dot(sky) + 0.2)
  })

  it('moves a remote cursor by yaw and pitch, and ignores the roll that flipped the view', () => {
    const opts = { dead: 0, gain: 1, limitX: 40, limitY: 40 }
    expect(stepRemote({ x: 0, y: 0 }, { alpha: 400, beta: 0, gamma: 0 }, 0.04, opts)).toEqual({ x: 0, y: 0 })
    const right = stepRemote({ x: 0, y: 0 }, { alpha: 0, beta: 0, gamma: 500 }, 0.04, opts)
    expect(right.x).toBeCloseTo(20, 5)
    expect(right.y).toBe(0)
    expect(stepRemote({ x: 0, y: 0 }, { alpha: 0, beta: 500, gamma: 0 }, 0.04, opts).y).toBeCloseTo(-20, 5)
    expect(stepRemote({ x: 3, y: 4 }, { alpha: 0, beta: 2, gamma: -2 }, 0.04)).toEqual({ x: 3, y: 4 })
    expect(stepRemote({ x: 1, y: 1 }, { alpha: 0, beta: 0, gamma: 80 }, 0.2, opts)).toEqual({ x: 1, y: 1 })
    expect(stepRemote({ x: 14, y: 0 }, { alpha: 0, beta: 0, gamma: 200 }, 0.02, { dead: 0, gain: 1, limitX: 15, limitY: 15 }).x).toBe(15)
    const aim = stepRemote({ x: 0, y: 0 }, { alpha: 0, beta: -400, gamma: 400 }, 0.04, opts)
    const look = commitAim({ heading: 0, alt: -22 }, aim)
    const east = toThree(enu(0, 0).e).normalize()
    const sky = toThree(enu(0, 0).u).normalize()
    const fwd = (heading: number, alt: number) => new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternion(0, 0, heading, alt, 0))
    expect(fwd(look.heading, 0).dot(east)).toBeGreaterThan(fwd(0, 0).dot(east) + 0.15)
    expect(fwd(0, look.alt).dot(sky)).toBeGreaterThan(fwd(0, -22).dot(sky) + 0.1)
    expect(dragCursor({ x: 0, y: 0 }, 40, 0).x).toBeGreaterThan(5)
    expect(dragCursor({ x: 0, y: 0 }, 0, -40).y).toBeGreaterThan(5)
    expect(cursorNdc(0, 0)).toEqual({ x: 0, y: 0 })
    expect(cursorNdc(0, 10).y).toBeGreaterThan(0.2)
  })

  it('turns the view from the phone yaw and pitch, and holds still when the hand does', () => {
    const opts = { dead: 0, gain: 1 }
    expect(stepSlew({ heading: 10, alt: -22 }, { alpha: 400, beta: 0, gamma: 0 }, 0.04, opts)).toEqual({ heading: 10, alt: -22 })
    expect(stepSlew({ heading: 10, alt: 0 }, { alpha: 0, beta: 0, gamma: 500 }, 0.04, opts).heading).toBeCloseTo(30, 5)
    expect(stepSlew({ heading: 0, alt: 0 }, { alpha: 0, beta: 500, gamma: 0 }, 0.04, opts).alt).toBeCloseTo(-20, 5)
    expect(stepSlew({ heading: 4, alt: -8 }, { alpha: 1, beta: 1, gamma: 1 }, 0.04)).toEqual({ heading: 4, alt: -8 })
    expect(stepSlew({ heading: 4, alt: -8 }, { alpha: 0, beta: 0, gamma: 80 }, 0.2, opts)).toEqual({ heading: 4, alt: -8 })
    expect(stepSlew({ heading: 0, alt: 70 }, { alpha: 0, beta: -500, gamma: 0 }, 0.04, opts).alt).toBe(75)
    const turned = stepSlew({ heading: 0, alt: 0 }, { alpha: 0, beta: 0, gamma: 400 }, 0.04, opts)
    const east = toThree(enu(0, 0).e).normalize()
    const fwd = (heading: number, alt: number) => new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternion(0, 0, heading, alt, 0))
    expect(fwd(turned.heading, 0).dot(east)).toBeGreaterThan(fwd(0, 0).dot(east) + 0.15)
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

  it('stays the right way up as the aim rises toward the zenith', () => {
    const up = toThree(enu(0, 0).u).normalize()
    for (const alt of [0, 30, 60, 80, 88]) {
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(lookQuaternion(0, 0, 0, alt, 0))
      expect(camUp.dot(up)).toBeGreaterThan(-0.15)
    }
  })

  it('looks up when the phone is tilted toward the sky', () => {
    const q = lookQuaternion(0, 0, 0, 80, 0)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const up = toThree(enu(0, 0).u).normalize()
    expect(forward.dot(up)).toBeGreaterThan(0.9)
  })
})
