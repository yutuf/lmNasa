// Real 3D models: NASA 3D Resources, plus CC-BY models from Sketchfab (public/models, see CREDITS.md), Draco-decoded locally so they work offline.
// Each model is normalised: scaled to a target size, its longest horizontal axis turned to +x (forward),
// centred on x/z and stood on y = 0.
import { useEffect, useMemo, type RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cleanPragyan, rigWheels, rollWheels, type RoverMotion, type Wheel } from '../modelRig'

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
  motion?: RefObject<RoverMotion>
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

export function NasaModel({ file, size, fit = 'max', yaw = 0, shadows = true, motion }: ModelProps) {
  const { scene } = useGLTF(modelUrl(file), DRACO)
  const wheels = useMemo<Wheel[]>(() => [], [])
  const obj = useMemo(() => {
    const root = scene.clone(true)
    const drop: THREE.Object3D[] = []
    root.traverse((o) => { if (HIDE.test(o.name)) drop.push(o) })
    drop.forEach((o) => o.removeFromParent())
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        if (file === 'pragyan.glb' || file === 'yutu.glb') m.geometry = cleanPragyan(m.geometry)
        m.castShadow = shadows
        m.receiveShadow = shadows
        // Per-instance materials prevent an offscreen vehicle photograph from changing a live scene's light.
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => lighten(mat as THREE.Material).clone())
        m.material = Array.isArray(m.material) ? mats : mats[0]
        for (const mat of mats) {
          const sm = mat as THREE.MeshStandardMaterial
          if (sm.isMeshStandardMaterial) { sm.envMap = null; sm.envMapIntensity = 0; sm.roughness = Math.max(.65, sm.roughness); sm.metalness = Math.min(.65, sm.metalness) }
        }
      }
    })
    const rawBox = new THREE.Box3().setFromObject(root, true)
    const rawSize = rawBox.getSize(new THREE.Vector3())
    // Yutu's chassis was authored at 60 degrees; its wide solar wings cannot define forward.
    const turn = file === 'yutu.glb' ? Math.PI / 3 : rawSize.z > rawSize.x ? Math.PI / 2 : 0
    const oriented = new THREE.Group()
    oriented.add(root)
    oriented.rotation.y = turn + yaw
    // Precise bounds matter for a fused, rotated mesh: a transformed local AABB can extend below the wheels.
    const box = new THREE.Box3().setFromObject(oriented, true)
    const e = box.getSize(new THREE.Vector3())
    const ref = fit === 'height' ? e.y : fit === 'length' ? e.x : Math.max(e.x, e.y, e.z)
    const s = size / (ref || 1)
    const c = box.getCenter(new THREE.Vector3())
    const inner = new THREE.Group()
    oriented.position.set(-c.x, -box.min.y, -c.z)
    inner.add(oriented)
    inner.scale.setScalar(s)
    wheels.length = 0
    const model = motion ? rigWheels(inner, file, wheels) : inner
    model.name = `vehicle-${file}`
    model.userData.model = file
    return model
  }, [scene, file, size, fit, yaw, shadows, motion, wheels])
  useFrame(() => { if (motion) rollWheels(wheels, motion.current) })
  useEffect(() => () => {
    const materials = new Set<THREE.Material>()
    obj.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        if (motion) mesh.geometry.dispose()
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        list.forEach(m => materials.add(m))
      }
    })
    materials.forEach(m => m.dispose())
  }, [obj, motion])
  return <primitive object={obj} />
}

/** Start loading and decoding a model before a scene needs it (so the scene does not stall on its first frames). */
export const preloadModel = (f: ModelFile) => useGLTF.preload(modelUrl(f), DRACO)
export const preloadModels = () => (['lander.glb', 'rover.glb', 'lro.glb'] as const).forEach((f) => useGLTF.preload(modelUrl(f), DRACO))
