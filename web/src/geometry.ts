// Directions on and around the Moon. Moon-fixed frame: x toward 0°E on the equator, y toward 90°E, z north.
// three.js frame used by the scenes: (x, y, z)three = (x, z, -y)moon, so +y is north and the texture's
// centre (0°E) faces +x.
import * as THREE from 'three'

const rad = Math.PI / 180

export function enu(lat: number, lon: number) {
  const la = lat * rad
  const lo = lon * rad
  return {
    e: [-Math.sin(lo), Math.cos(lo), 0],
    n: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    u: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
  }
}

/** Unit vector (Moon-fixed) toward a body seen at alt/az from a point on the surface. */
export function directionMoonFixed(altDeg: number, azDeg: number, lat: number, lon: number): number[] {
  const { e, n, u } = enu(lat, lon)
  const a = altDeg * rad
  const z = azDeg * rad
  const ce = Math.cos(a) * Math.sin(z)
  const cn = Math.cos(a) * Math.cos(z)
  const cu = Math.sin(a)
  return [0, 1, 2].map((k) => ce * e[k] + cn * n[k] + cu * u[k])
}

export const toThree = (m: number[]) => new THREE.Vector3(m[0], m[2], -m[1])

export function surfacePoint(lat: number, lon: number, r = 1): THREE.Vector3 {
  const la = lat * rad
  const lo = lon * rad
  return toThree([r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)])
}

/** Direction toward a body in a terrain patch's frame (x east-ish, y north / toward 0°E, z up). Polar patches
 *  lie in the south-polar stereographic plane, others on a local east-north grid (lunanav/terrain3d.py). */
export function patchDirection(frame: 'polar' | 'enu', lon: number, azDeg: number, altDeg: number): number[] {
  const a = azDeg * rad
  const e = altDeg * rad
  if (frame === 'enu') return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)]
  const lo = lon * rad
  const north = [Math.sin(lo), Math.cos(lo)]
  const east = [Math.cos(lo), -Math.sin(lo)]
  const d = [Math.cos(a) * north[0] + Math.sin(a) * east[0], Math.cos(a) * north[1] + Math.sin(a) * east[1]]
  return [Math.cos(e) * d[0], Math.cos(e) * d[1], Math.sin(e)]
}
