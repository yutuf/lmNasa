// The ground around the lander in 3D, lit by the Sun at the chosen hour with real-time shadows.
import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Spot } from '../data'
import { patchDirection } from '../geometry'

interface Props {
  spot: Spot
  heights: Int16Array
  sunAz: number
  sunAlt: number
  earthAz: number
  earthAlt: number
}

const EXAG = 3
const R_KM = 1737.4

export default function Terrain({ spot, heights, sunAz, sunAlt, earthAz, earthAlt }: Props) {
  const patch = spot.patch!
  const n = patch.n
  const s = patch.spacing_m / 1000
  const half = ((n - 1) * s) / 2
  const geometry = useMemo(() => {
    const pos = new Float32Array(n * n * 3)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = j * s - half
        const z = i * s - half                       // rows run from north (top) to south: +z is south
        const curve = (x * x + z * z) / (2 * R_KM)    // the Moon's curvature, km
        const k = (i * n + j) * 3
        pos[k] = x
        pos[k + 1] = ((heights[i * n + j] / 1000) - curve) * EXAG
        pos[k + 2] = z
      }
    }
    const idx: number[] = []
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [heights, n, s, half])
  const centre = ((heights[Math.floor(n / 2) * n + Math.floor(n / 2)] / 1000)) * EXAG
  const toScene = (d: number[]) => new THREE.Vector3(d[0], d[2] * EXAG, -d[1]).normalize()
  const sun = toScene(patchDirection(patch.frame, spot.lon, sunAz, sunAlt))
  const earth = toScene(patchDirection(patch.frame, spot.lon, earthAz, earthAlt))
  const lightPos = sun.clone().multiplyScalar(half * 3)
  const ray = (d: THREE.Vector3) => [new THREE.Vector3(0, centre, 0), d.clone().multiplyScalar(half * 0.45).add(new THREE.Vector3(0, centre, 0))]
  const camDist = half * 1.6
  return (
    <Canvas shadows camera={{ position: [-camDist * 0.7, camDist * 0.75, camDist], fov: 40, near: 0.1, far: 2000 }} dpr={[1, 2]}>
      <color attach="background" args={['#04060c']} />
      <ambientLight intensity={0.05} />
      <directionalLight position={lightPos} intensity={3.4} color="#fff6e8" castShadow
                        shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.0004}
                        shadow-camera-left={-half * 1.5} shadow-camera-right={half * 1.5}
                        shadow-camera-top={half * 1.5} shadow-camera-bottom={-half * 1.5}
                        shadow-camera-near={0.1} shadow-camera-far={half * 8} />
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#b9b6ad" roughness={1} metalness={0} flatShading={false} />
      </mesh>
      <mesh position={[0, centre + 0.25, 0]}>
        <sphereGeometry args={[half * 0.02, 16, 16]} />
        <meshBasicMaterial color="#ff4b4b" />
      </mesh>
      <Line points={ray(sun)} color="#f2b705" lineWidth={3} />
      <Line points={ray(earth)} color="#4ea8de" lineWidth={3} />
      <OrbitControls makeDefault target={[0, centre, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={half * 0.3} maxDistance={half * 4} />
    </Canvas>
  )
}
