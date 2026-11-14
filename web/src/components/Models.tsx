// NASA 3D Resources models (public/models, see CREDITS.md), Draco-decoded locally so they work offline.
// Each model is normalised: scaled to a target size, its longest horizontal axis turned to +x (forward),
// centred on x/z and stood on y = 0.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const DRACO = `${import.meta.env.BASE_URL}draco/`
const modelUrl = (f: string) => `${import.meta.env.BASE_URL}models/${f}`

export interface ModelProps {
  file: 'lander.glb' | 'rover.glb' | 'lro.glb'
  size: number                     // metres (or scene units) along `fit`
  fit?: 'height' | 'length' | 'max'
  yaw?: number                     // extra turn about +y after normalising (rad)
  shadows?: boolean
}

export function NasaModel({ file, size, fit = 'max', yaw = 0, shadows = true }: ModelProps) {
  const { scene } = useGLTF(modelUrl(file), DRACO)
  const obj = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = shadows
        m.receiveShadow = shadows
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) (mat as THREE.MeshStandardMaterial).envMapIntensity = 0.4
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
  }, [scene, size, fit, yaw, shadows])
  return <primitive object={obj} />
}

export const preloadModels = () => (['lander.glb', 'rover.glb', 'lro.glb'] as const).forEach((f) => useGLTF.preload(modelUrl(f), DRACO))
