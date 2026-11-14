// 3D terrain renders for site cards: the real LOLA terrain around a site (pole_dem.bin, 200 m grid) as a lit relief
// with the Sun where it stands on the best landing date, rendered once off-screen to a transparent PNG and cached.
// One shared WebGL renderer for all cards (browsers limit the number of live WebGL contexts).
import * as THREE from 'three'
import { dataUrl } from './data'
import { heightAt, parseDem, planeDir, type Dem } from './terrain'

const W = 520, H = 400
const HALF_M = 9000                 // the relief covers 18 km x 18 km
const N = 120                       // grid cells per side
const EXAG = 2.2                    // vertical exaggeration, so 200 m slopes read at card size

let demP: Promise<Dem> | null = null
let renderer: THREE.WebGLRenderer | null = null
const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

const loadDem = () => (demP ??= fetch(dataUrl('pole_dem.bin')).then((r) => r.arrayBuffer()).then(parseDem))

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(W, H, false)
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  return renderer
}

function build(dem: Dem, xM: number, yM: number) {
  const z0 = heightAt(dem, xM, yM)
  const base = Number.isNaN(z0) ? 0 : z0
  // a round relief (a polar grid of rings), like a core sample cut out of the terrain
  const ring = new THREE.RingGeometry(1, HALF_M, 160, N)
  ring.rotateX(-Math.PI / 2)                           // plane in x (east-ish) / z, y up
  const pos = ring.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = pos.getZ(i)
    let z = heightAt(dem, xM + px, yM - pz)
    if (Number.isNaN(z)) z = base
    const r = Math.hypot(px, pz) / HALF_M
    // a round cut-out that sinks away at the edge, like a core sample
    const rim = r > 0.95
    pos.setY(i, rim ? -2600 : (z - base) * EXAG)
    // neutral grey regolith, a little lighter on high ground; the cut-out's side is dark rock
    const shade = rim ? 0.16 : 0.5 + 0.22 * Math.min(1, Math.max(0, (z - base + 1500) / 3000))
    col[3 * i] = shade; col[3 * i + 1] = shade * 0.985; col[3 * i + 2] = shade * 0.96
  }
  ring.setAttribute('color', new THREE.BufferAttribute(col, 3))
  ring.computeVertexNormals()
  const mesh = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** A transparent PNG data URL of the terrain around (xKm, yKm), lit by the Sun at (sunAzDeg, sunAltDeg). */
export function renderSite(key: string, xKm: number, yKm: number, lonDeg: number, sunAzDeg: number, sunAltDeg: number): Promise<string> {
  if (cache.has(key)) return cache.get(key)!
  const job = queue.then(async () => {
    const dem = await loadDem()
    const r = getRenderer()
    const scene = new THREE.Scene()
    const mesh = build(dem, xKm * 1000, yKm * 1000)
    scene.add(mesh)
    // the landing point: a thin red mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 1400, 12), new THREE.MeshBasicMaterial({ color: 0xe10600 }))
    mast.position.set(0, 700 + 40, 0)
    scene.add(mast)
    // the Sun at its real azimuth; at the pole it is a few degrees up, so lift it a little for a readable render
    const [dx, dy] = planeDir(lonDeg, sunAzDeg)
    const alt = Math.max(7, Math.min(35, sunAltDeg + 6)) * Math.PI / 180
    const sun = new THREE.DirectionalLight(0xfff3e0, 3.4)
    sun.position.set(dx * Math.cos(alt), Math.sin(alt), -dy * Math.cos(alt)).multiplyScalar(30000)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -HALF_M, right: HALF_M, top: HALF_M, bottom: -HALF_M, near: 1000, far: 80000 })
    scene.add(sun)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.1))
    // view from the Sun's side, turned 35 deg: lit slopes face us, the long polar shadows fall away behind the ridges
    const cam = new THREE.PerspectiveCamera(30, W / H, 100, 200000)
    const toSun = new THREE.Vector3(dx, 0, -dy).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6)
    cam.position.copy(toSun.multiplyScalar(24000)).add(new THREE.Vector3(0, 14000, 0))
    cam.lookAt(0, -900, 0)
    r.render(scene, cam)
    const url = r.domElement.toDataURL('image/png')
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mast.geometry.dispose()
    return url
  })
  queue = job.catch(() => undefined)
  cache.set(key, job)
  return job
}
