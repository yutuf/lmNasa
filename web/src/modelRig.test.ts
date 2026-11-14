import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { cleanPragyan, rollWheels, type Wheel } from './modelRig'

describe('real-model wheel rig', () => {
  it('rolls one circumference per turn, reverses, and differentially rolls while pivoting', () => {
    const wheel: Wheel = { pivot: new THREE.Group(), spin: new THREE.Group(), radius: .2, x: 1, z: .5 }
    rollWheels([wheel], { travel: .4 * Math.PI, heading: 0, wheelSteer: .3 })
    expect(wheel.spin.rotation.z).toBeCloseTo(-2 * Math.PI)
    expect(wheel.pivot.rotation.y).toBeCloseTo(.3)
    rollWheels([wheel], { travel: -.2, heading: 0, wheelSteer: 0 })
    expect(wheel.spin.rotation.z).toBeCloseTo(1)
    rollWheels([wheel], { travel: 0, heading: 1, wheelSteer: .2 })
    expect(wheel.spin.rotation.z).toBeCloseTo(-2.5)
  })
  it('removes disconnected decorative specks without changing the cached original mesh', () => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 10,10,10, 10.001,10,10, 10,10.001,10], 3))
    geo.setIndex([0,1,2,3,4,5])
    const clean = cleanPragyan(geo)
    expect(clean.getAttribute('position').count).toBe(3)
    expect(clean.boundingBox!.max.x).toBe(1)
    expect(geo.getAttribute('position').count).toBe(6)
    expect(cleanPragyan(geo)).toBe(clean)
  })
})
