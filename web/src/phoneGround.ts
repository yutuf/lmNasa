// A patch of the real south-polar LOLA grid, in the same frame as the rover view.
// Three.js: x is stereographic x (toward 90 E), y is up, z is minus stereographic y.
// Heading 0 looks along local north. Altitude 0 is the horizon. The camera never rolls.
import * as THREE from 'three'
import { polarXY } from './places'
import { heightSmooth, planeDir, R_M, type Dem } from './terrain'

/** Look direction in the terrain frame. Same mapping as the rover view: (sin(lon+heading), sin(alt), -cos(lon+heading)). Heading 90 looks toward local east. */
export function standLook(headingDeg: number, altDeg: number, lonDeg: number): THREE.Vector3 {
  const [east, north] = planeDir(lonDeg, headingDeg)
  const a = altDeg * Math.PI / 180
  const ca = Math.cos(a)
  return new THREE.Vector3(east * ca, Math.sin(a), -north * ca)
}

/** Camera basis. right × look = up, and the camera looks down its local -Z. */
export function standQuaternion(out: THREE.Quaternion, headingDeg: number, altDeg: number, lonDeg: number): THREE.Quaternion {
  const look = standLook(headingDeg, altDeg, lonDeg).normalize()
  const north = standLook(0, 0, lonDeg)
  const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0))
  if (right.lengthSq() < 1e-6) right.crossVectors(look, north)
  right.normalize()
  const up = new THREE.Vector3().crossVectors(right, look).normalize()
  const m = new THREE.Matrix4().makeBasis(right, up, look.clone().multiplyScalar(-1))
  return out.setFromRotationMatrix(m)
}

/** Stereographic bounds that stay two pixels inside the grid, where bicubic height is defined. */
function sampleBox(dem: Dem) {
  const inset = dem.mPerPx * 2
  return {
    minX: (0 - dem.sample0) * dem.mPerPx + inset,
    maxX: ((dem.cols - 1) - dem.sample0) * dem.mPerPx - inset,
    minY: (dem.line0 - (dem.rows - 1)) * dem.mPerPx + inset,
    maxY: (dem.line0 - 0) * dem.mPerPx - inset,
  }
}

function clampSample(dem: Dem, x: number, y: number): [number, number] {
  const b = sampleBox(dem)
  return [Math.min(b.maxX, Math.max(b.minX, x)), Math.min(b.maxY, Math.max(b.minY, y))]
}

/**
 * Ground around a site, metres, origin on the surface at that site.
 * A site a short way past the grid edge still gets the overlapping patch.
 * Returns null when the patch does not reach the grid.
 */
export function standGeometry(dem: Dem, lat: number, lon: number, half = 900, step = 30): THREE.BufferGeometry | null {
  const [xKm, yKm] = polarXY(lat, lon)
  const ox = xKm * 1000
  const oy = yKm * 1000
  const [cx, cy] = clampSample(dem, ox, oy)
  if (Math.hypot(cx - ox, cy - oy) > half) return null
  const h0 = heightSmooth(dem, cx, cy)
  if (!Number.isFinite(h0)) return null
  const n = Math.round((2 * half) / step) + 1
  const pos = new Float32Array(n * n * 3)
  const uv = new Float32Array(n * n * 2)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const sx = ox - half + j * step
      const sy = oy + half - i * step
      const dx = sx - ox
      const dy = sy - oy
      let z = heightSmooth(dem, sx, sy)
      if (!Number.isFinite(z)) {
        const [qx, qy] = clampSample(dem, sx, sy)
        z = heightSmooth(dem, qx, qy)
      }
      if (!Number.isFinite(z)) z = h0
      const y = z - h0 - (dx * dx + dy * dy) / (2 * R_M)
      const k = i * n + j
      pos[k * 3] = dx
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = -dy
      uv[k * 2] = sx / 26
      uv[k * 2 + 1] = sy / 26
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6)
  let q = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j
      idx[q++] = a
      idx[q++] = a + n
      idx[q++] = a + 1
      idx[q++] = a + 1
      idx[q++] = a + n
      idx[q++] = a + n + 1
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  return g
}
