// Spacecraft route: approach direction against the Sun, and the shape of the path.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { chooseApproach, flightPath } from './flight'
import { surfacePoint } from './geometry'

describe('chooseApproach', () => {
  it('flies with the Sun behind the lander', () => {
    expect(chooseApproach(10)).toMatchObject({ headingDeg: 180, sunBehind: true })    // Sun in the north → head south
    expect(chooseApproach(170)).toMatchObject({ headingDeg: 0, sunBehind: true })     // Sun in the south → head north
    expect(chooseApproach(90).sunOffDeg).toBe(90)                                       // Sun abeam either way
    expect(chooseApproach(-170).headingDeg).toBe(0)
  })
})

describe('flightPath', () => {
  const lat = -85.85, lon = 354.1
  const earth = surfacePoint(0, 0, 1).normalize()
  for (const sunAz of [10, 200]) {
    const ap = chooseApproach(sunAz)
    const f = flightPath(lat, lon, earth, ap)
    it(`ends on the site and starts near Earth (heading ${ap.headingDeg})`, () => {
      const site = surfacePoint(lat, lon, 1.004)
      expect(f.all[f.all.length - 1].distanceTo(site)).toBeLessThan(1e-6)
      expect(f.all[0].distanceTo(earth.clone().multiplyScalar(5.2))).toBeLessThan(0.5)
    })
    it('orbit is polar and passes over the site', () => {
      const south = surfacePoint(-90, 0, 1)
      expect(Math.min(...f.orbit.map((p) => p.clone().normalize().distanceTo(south)))).toBeLessThan(0.04)
      expect(Math.min(...f.orbit.map((p) => p.clone().normalize().distanceTo(surfacePoint(lat, lon, 1))))).toBeLessThan(0.04)
    })
    it('descends without going below the surface, ending in the approach direction', () => {
      for (const p of f.descent) expect(p.length()).toBeGreaterThanOrEqual(1.0039)
      const last = f.descent[f.descent.length - 1], prev = f.descent[f.descent.length - 5]
      const north = new THREE.Vector3().subVectors(surfacePoint(lat + 0.1, lon, 1), surfacePoint(lat, lon, 1)).normalize()
      const travel = last.clone().sub(prev).normalize()
      expect(Math.sign(travel.dot(north))).toBe(ap.headingDeg === 0 ? 1 : -1)
    })
    it('labels each point with a phase in order', () => {
      expect(f.phaseAt.length).toBe(f.all.length)
      expect([...f.phaseAt].sort((a, b) => a - b)).toEqual(f.phaseAt)
    })
  }
})
