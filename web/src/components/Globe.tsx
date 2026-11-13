import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Spot } from '../data'
import { dataUrl } from '../data'
import { surfacePoint, toThree } from '../geometry'
import type { Lang } from '../i18n'

export interface PoleCapInfo { albedo: string; normal: string; r_max_m: number; edge_lat: number }

interface Props {
  poleCap?: PoleCapInfo
  spots: Spot[]
  selected: Spot
  sunDir: number[]      // Moon-fixed unit vector toward the Sun
  earthDir: number[]    // Moon-fixed unit vector toward Earth (from the selected spot)
  lang: Lang
  onSelect: (id: string) => void
}

function Moon() {
  const [albedo, normal] = useTexture([dataUrl('moon_albedo.jpg'), dataUrl('moon_normal.jpg')])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  return (
    <mesh>
      <sphereGeometry args={[1, 192, 96]} />
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1.2, 1.2)}
                            roughness={1} metalness={0} />
    </mesh>
  )
}

/** High-resolution south-polar cap (stereographic texture from the 200 m LOLA grid), laid over the globe. */
function PoleCap({ cap }: { cap: PoleCapInfo }) {
  const [albedo, normal] = useTexture([dataUrl(cap.albedo), dataUrl(cap.normal)])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  const geometry = useMemo(() => {
    const nLat = 64
    const nLon = 256
    const R = 1737400
    const pos: number[] = []
    const uv: number[] = []
    for (let i = 0; i <= nLat; i++) {
      const lat = -90 + (i / nLat) * (cap.edge_lat + 90)
      for (let j = 0; j <= nLon; j++) {
        const lon = -180 + (j / nLon) * 360
        const v = surfacePoint(lat, lon, 1.0006)
        pos.push(v.x, v.y, v.z)
        const r = 2 * R * Math.tan(((90 + lat) * Math.PI) / 360)
        const x = r * Math.sin((lon * Math.PI) / 180)
        const y = r * Math.cos((lon * Math.PI) / 180)
        uv.push(0.5 + x / (2 * cap.r_max_m), 0.5 + y / (2 * cap.r_max_m))
      }
    }
    const idx: number[] = []
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        const a = i * (nLon + 1) + j
        idx.push(a, a + 1, a + nLon + 1, a + 1, a + nLon + 2, a + nLon + 1)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    g.computeTangents?.()
    return g
  }, [cap])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1, 1)} roughness={1}
                            metalness={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

function CameraFlight({ target }: { target: THREE.Vector3 }) {
  const { camera } = useThree()
  const goal = useRef<THREE.Vector3 | null>(null)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    const dist = Math.max(camera.position.length(), 2.4)
    goal.current = target.clone().normalize().multiplyScalar(Math.min(Math.max(dist, 4.0), 4.6))
      .add(new THREE.Vector3(0, 0.35, 0))
  }, [target, camera])
  useFrame(() => {
    if (!goal.current) return
    camera.position.lerp(goal.current, 0.06)
    if (controls) controls.update()
    if (camera.position.distanceTo(goal.current) < 0.01) goal.current = null
  })
  return null
}

export default function Globe({ poleCap, spots, selected, sunDir, earthDir, lang, onSelect }: Props) {
  const sun = useMemo(() => toThree(sunDir).normalize(), [sunDir])
  const earth = useMemo(() => toThree(earthDir).normalize(), [earthDir])
  const pin = useMemo(() => surfacePoint(selected.lat, selected.lon, 1.0), [selected])
  const pinTop = useMemo(() => surfacePoint(selected.lat, selected.lon, 1.16), [selected])
  const pinMid = useMemo(() => pin.clone().add(pinTop).multiplyScalar(0.5), [pin, pinTop])
  const pinQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    pin.clone().normalize()), [pin])
  return (
    <Canvas camera={{ position: [3.0, 0.8, 3.0], fov: 36, near: 0.01, far: 200 }} dpr={[1, 2]}>
      <color attach="background" args={['#04060c']} />
      <Stars radius={60} depth={30} count={4000} factor={3} fade speed={0.3} />
      <ambientLight intensity={0.035} />
      <directionalLight position={sun.clone().multiplyScalar(20)} intensity={3.2} color="#fff6e8" />
      <Moon />
      {poleCap && <PoleCap cap={poleCap} />}
      {/* Earth in its true direction (distance not to scale) */}
      <group position={earth.clone().multiplyScalar(5.2)}>
        <mesh>
          <sphereGeometry args={[0.28, 48, 24]} />
          <meshStandardMaterial color="#3d7bd9" emissive="#123a7a" emissiveIntensity={0.6} roughness={0.6} />
        </mesh>
        <Html center className="tag tag-earth">{lang === 'tr' ? 'Dünya' : 'Earth'}</Html>
      </group>
      {spots.map((s) => {
        const p = surfacePoint(s.lat, s.lon, 1.004)
        const isSel = s.id === selected.id
        const colour = s.group === 'mission' ? '#f2b705' : s.group === 'artemis' ? '#7ee0a8' : '#ffb35c'
        return (
          <mesh key={s.id} position={p} onClick={(e) => { e.stopPropagation(); onSelect(s.id) }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}>
            <sphereGeometry args={[isSel ? 0.0 : 0.012, 12, 12]} />
            <meshBasicMaterial color={colour} />
          </mesh>
        )
      })}
      <mesh position={pinMid} quaternion={pinQuat}>
        <cylinderGeometry args={[0.004, 0.004, 0.16, 8]} />
        <meshBasicMaterial color="#ff4b4b" />
      </mesh>
      <mesh position={pinTop}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color="#ff4b4b" />
      </mesh>
      <Html position={pinTop} center className="tag tag-spot">{selected.name[lang]}</Html>
      <OrbitControls makeDefault enablePan={false} minDistance={1.35} maxDistance={8} rotateSpeed={0.5}
                     zoomSpeed={0.6} />
      <CameraFlight target={pin} />
    </Canvas>
  )
}
