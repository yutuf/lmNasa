import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { polarXY } from './places'
import { planeDir, type Dem } from './terrain'
import { standGeometry, standLook, standQuaternion } from './phoneGround'

function flatDem(lat: number, lon: number): Dem {
  const [xKm, yKm] = polarXY(lat, lon)
  const mPerPx = 40
  const cols = 40
  const rows = 40
  const col = 20
  const row = 20
  const h = new Int16Array(rows * cols)
  h.fill(1000)
  return {
    rows, cols, mPerPx, scale: 1, h,
    sample0: col - (xKm * 1000) / mPerPx,
    line0: row + (yKm * 1000) / mPerPx,
  }
}

function cameraLook(heading: number, alt: number, lon: number): THREE.Vector3 {
  const cam = new THREE.PerspectiveCamera()
  cam.position.set(0, 1.8, 0)
  standQuaternion(cam.quaternion, heading, alt, lon)
  cam.updateMatrixWorld(true)
  return cam.getWorldDirection(new THREE.Vector3())
}

describe('phone ground', () => {
  it('looks north along the horizon and east when the heading is 90', () => {
    const [east, north] = planeDir(0, 0)
    const look = standLook(0, 0, 0)
    expect(look.x).toBeCloseTo(east, 5)
    expect(look.y).toBeCloseTo(0, 5)
    expect(look.z).toBeCloseTo(-north, 5)
    const northView = cameraLook(0, 0, 0)
    expect(northView.x).toBeCloseTo(0, 4)
    expect(northView.y).toBeCloseTo(0, 4)
    expect(northView.z).toBeCloseTo(-1, 4)
    const eastView = cameraLook(90, 0, 0)
    expect(eastView.x).toBeCloseTo(1, 4)
    expect(eastView.z).toBeCloseTo(0, 4)
  })

  it('keeps the camera upright while looking up', () => {
    const cam = new THREE.PerspectiveCamera()
    standQuaternion(cam.quaternion, 0, 60, 0)
    cam.updateMatrixWorld(true)
    const look = cam.getWorldDirection(new THREE.Vector3())
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
    expect(look.y).toBeCloseTo(Math.sin(60 * Math.PI / 180), 4)
    expect(look.z).toBeCloseTo(-Math.cos(60 * Math.PI / 180), 4)
    expect(up.y).toBeGreaterThan(0.4)
    expect(right.y).toBeCloseTo(0, 4)
    expect(right.x).toBeGreaterThan(0.4)
  })

  it('builds a ground patch whose centre is the site and whose faces point up', () => {
    const dem = flatDem(-85, 0)
    const geo = standGeometry(dem, -85, 0, 90, 30)
    expect(geo).not.toBeNull()
    const g = geo!
    const n = Math.round((2 * 90) / 30) + 1
    const pos = g.getAttribute('position')
    const mid = ((n - 1) / 2) * n + (n - 1) / 2
    expect(pos.getY(mid)).toBeCloseTo(0, 3)
    expect(pos.getX(mid)).toBeCloseTo(0, 3)
    expect(pos.getZ(mid)).toBeCloseTo(0, 3)
    const idx = g.getIndex()!
    const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(0))
    const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(1))
    const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(2))
    const face = new THREE.Vector3().crossVectors(b.sub(a), c.sub(a.clone()))
    expect(face.y).toBeGreaterThan(0)
    g.dispose()
  })

  it('returns nothing when the site is outside the polar grid', () => {
    const dem: Dem = { rows: 4, cols: 4, mPerPx: 200, line0: 0, sample0: 0, scale: 1, h: new Int16Array(16) }
    expect(standGeometry(dem, -85, 0, 30, 30)).toBeNull()
  })
})
