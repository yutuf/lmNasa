// Real 3D models: NASA 3D Resources, plus CC-BY models from Sketchfab (public/models, see CREDITS.md), Draco-decoded locally so they work offline.
// Each model is normalised: scaled to a target size, its longest horizontal axis turned to +x (forward),
// centred on x/z and stood on y = 0.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// A renderer owns its WebGL textures. VehiclePhoto creates separate off-screen
// renderers, so sharing one PMREM texture between them makes the NASA GLBs vanish.
const envTextures = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()
function modelEnv(gl: THREE.WebGLRenderer) {
  let texture = envTextures.get(gl)
  if (!texture) {
    const pm = new THREE.PMREMGenerator(gl)
    texture = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
    envTextures.set(gl, texture)
  }
  return texture
}

const DRACO = `${import.meta.env.BASE_URL}draco/`
const modelUrl = (f: string) => `${import.meta.env.BASE_URL}models/${f}`

export type ModelFile = 'lander.glb' | 'rover.glb' | 'lro.glb' | 'vikram.glb' | 'pragyan.glb' | 'yutu.glb' | 'starship.glb' | 'lrv.glb'
// display props baked into some downloaded models (a showroom floor) that must not stand on the Moon
const HIDE = /^(floor|ground|plane|backdrop)/i

export interface ModelProps {
  file: ModelFile
  size: number                     // metres (or scene units) along `fit`
  fit?: 'height' | 'length' | 'max'
  yaw?: number                     // extra turn about +y after normalising (rad)
  shadows?: boolean
}

/** Physical materials (glass-like transmission, clearcoat, sheen) cost a second render of the whole scene every frame
 *  and extra shader variants; at the size vehicles appear on screen a standard material looks the same. */
const lightCache = new WeakMap<THREE.Material, THREE.Material>()
function lighten(mat: THREE.Material): THREE.Material {
  const pm = mat as THREE.MeshPhysicalMaterial
  if (!pm.isMeshPhysicalMaterial) return mat
  let out = lightCache.get(mat)
  if (!out) {
    const sm = new THREE.MeshStandardMaterial({
      name: pm.name, color: pm.color, map: pm.map, normalMap: pm.normalMap, normalScale: pm.normalScale,
      roughness: pm.roughness, roughnessMap: pm.roughnessMap, metalness: pm.metalness, metalnessMap: pm.metalnessMap,
      emissive: pm.emissive, emissiveMap: pm.emissiveMap, emissiveIntensity: pm.emissiveIntensity, aoMap: pm.aoMap,
      alphaMap: pm.alphaMap, side: pm.side, vertexColors: pm.vertexColors,
      // see-through parts (visors, lenses) stay faintly transparent instead of using a transmission pass
      transparent: pm.transparent || pm.transmission > 0, opacity: pm.transmission > 0 ? Math.min(pm.opacity, 0.45) : pm.opacity,
      alphaTest: pm.alphaTest, depthWrite: pm.transmission > 0 ? false : pm.depthWrite,
    })
    lightCache.set(mat, sm)
    out = sm
  }
  return out
}

export function NasaModel({ file, size, fit = 'max', yaw = 0, shadows = true }: ModelProps) {
  const { scene } = useGLTF(modelUrl(file), DRACO)
  const gl = useThree((s) => s.gl)
  const obj = useMemo(() => {
    const root = scene.clone(true)
    const drop: THREE.Object3D[] = []
    root.traverse((o) => { if (HIDE.test(o.name)) drop.push(o) })
    drop.forEach((o) => o.removeFromParent())
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = shadows
        m.receiveShadow = shadows
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => lighten(mat as THREE.Material))
        m.material = Array.isArray(m.material) ? mats : mats[0]
        for (const mat of mats) {
          const sm = mat as THREE.MeshStandardMaterial
          if (sm.isMeshStandardMaterial) { sm.envMap = modelEnv(gl); sm.envMapIntensity = 0.35 }
        }
      }
    })
    const box = new THREE.Box3().setFromObject(root)
    const e = box.getSize(new THREE.Vector3())
    const turn = e.z > e.x ? Math.PI / 2 : 0       // longest horizontal axis -> +x
    const len = Math.max(e.x, e.z)
    const ref = fit === 'height' ? e.y : fit === 'length' ? len : Math.max(len, e.y)
    const s = size / (ref || 1)
    const c = box.getCenter(new THREE.Vector3())
    const inner = new THREE.Group()
    root.position.set(-c.x, -box.min.y, -c.z)
    inner.add(root)
    inner.rotation.y = turn + yaw
    inner.scale.setScalar(s)
    return inner
  }, [scene, size, fit, yaw, shadows, gl])
  return <primitive object={obj} />
}

/** Start loading and decoding a model before a scene needs it (so the scene does not stall on its first frames). */
export const preloadModel = (f: ModelFile) => useGLTF.preload(modelUrl(f), DRACO)
export const preloadModels = () => (['lander.glb', 'rover.glb', 'lro.glb'] as const).forEach((f) => useGLTF.preload(modelUrl(f), DRACO))
