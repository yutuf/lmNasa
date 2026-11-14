import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dataUrl } from '../data'
import { surfacePoint, toThree } from '../geometry'
import { NasaModel } from './Models'

export interface PoleCapInfo { albedo: string; normal: string; r_max_m: number; edge_lat: number }
export interface Overlay { texture: THREE.Texture; rMaxM: number; edgeLat: number }
export interface Pin { lat: number; lon: number; label: string; good: boolean }

interface Props {
  poleCap?: PoleCapInfo
  overlay?: Overlay | null
  pins: Pin[]
  selected: { lat: number; lon: number; label: string } | null
  sunDir: number[]      // Moon-fixed unit vector toward the Sun
  earthDir: number[]    // Moon-fixed unit vector toward Earth
  earthLabel: string
  onPick?: (k: number) => void
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

/** A spherical cap from the south pole to `edgeLat`, textured in the south-polar stereographic plane. */
function capGeometry(edgeLat: number, rMaxM: number, radius: number) {
  const nLat = 64
  const nLon = 256
  const R = 1737400
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= nLat; i++) {
    const lat = -90 + (i / nLat) * (edgeLat + 90)
    for (let j = 0; j <= nLon; j++) {
      const lon = -180 + (j / nLon) * 360
      const v = surfacePoint(lat, lon, radius)
      pos.push(v.x, v.y, v.z)
      const r = 2 * R * Math.tan(((90 + lat) * Math.PI) / 360)
      uv.push(0.5 + (r * Math.sin((lon * Math.PI) / 180)) / (2 * rMaxM), 0.5 + (r * Math.cos((lon * Math.PI) / 180)) / (2 * rMaxM))
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
  return g
}

function PoleCap({ cap }: { cap: PoleCapInfo }) {
  const [albedo, normal] = useTexture([dataUrl(cap.albedo), dataUrl(cap.normal)])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  const geometry = useMemo(() => capGeometry(cap.edge_lat, cap.r_max_m, 1.0006), [cap])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial map={albedo} normalMap={normal} roughness={1} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

function OverlayCap({ overlay }: { overlay: Overlay }) {
  const geometry = useMemo(() => capGeometry(overlay.edgeLat, overlay.rMaxM, 1.0014), [overlay])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={overlay.texture} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function CameraFlight({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree()
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    if (!target) return
    // fly to a point above the chosen spot, slightly to the side, and look at the spot itself
    const up = target.clone().normalize()
    const side = new THREE.Vector3(0, 0, 1).cross(up).normalize()
    goal.current = { pos: up.clone().multiplyScalar(1.3).add(side.multiplyScalar(0.22)), look: up.clone().multiplyScalar(0.99) }
  }, [target, controls])
  useFrame(() => {
    if (!goal.current) return
    camera.position.lerp(goal.current.pos, 0.06)
    if (controls) {
      controls.target.lerp(goal.current.look, 0.06)
      controls.update()
    }
    if (camera.position.distanceTo(goal.current.pos) < 0.003) goal.current = null
  })
  return null
}

/** NASA's Lunar Reconnaissance Orbiter in a polar orbit (size and altitude not to scale). */
function Orbiter() {
  const g = useRef<THREE.Group>(null)
  const ring = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, k) => {
      const a = (k / 128) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 1.16 * Math.cos(0.5), Math.sin(a) * 1.16, Math.cos(a) * 1.16 * Math.sin(0.5))
    })
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#a1a1aa', transparent: true, opacity: 0.25 }))
  }, [])
  useFrame(({ clock }) => {
    if (!g.current) return
    const a = clock.elapsedTime * 0.12
    const p = new THREE.Vector3(Math.cos(a) * 1.16 * Math.cos(0.5), Math.sin(a) * 1.16, Math.cos(a) * 1.16 * Math.sin(0.5))
    const v = new THREE.Vector3(-Math.sin(a) * Math.cos(0.5), Math.cos(a), -Math.sin(a) * Math.sin(0.5))
    g.current.position.copy(p)
    g.current.lookAt(p.clone().add(v))
  })
  return (
    <>
      <primitive object={ring} />
      <group ref={g}>
        <Suspense fallback={null}><NasaModel file="lro.glb" size={0.06} shadows={false} /></Suspense>
        <Html center className="tag" style={{ transform: 'translateY(-18px)' }}>LRO</Html>
      </group>
    </>
  )
}

function EarthBall() {
  const map = useTexture(`${import.meta.env.BASE_URL}data/earth.jpg`)
  map.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh rotation={[0.41, 0, 0]}>
      <sphereGeometry args={[0.28, 64, 32]} />
      <meshStandardMaterial map={map} roughness={0.75} emissive="#0b1e3d" emissiveIntensity={0.35} />
    </mesh>
  )
}

export default function Globe({ poleCap, overlay, pins, selected, sunDir, earthDir, earthLabel, onPick }: Props) {
  const sun = useMemo(() => toThree(sunDir).normalize(), [sunDir])
  const earth = useMemo(() => toThree(earthDir).normalize(), [earthDir])
  const target = useMemo(() => (selected ? surfacePoint(selected.lat, selected.lon, 1) : surfacePoint(-89.9, 0, 1)),
    [selected])
  return (
    <Canvas camera={{ position: [0.6, -3.6, 2.2], fov: 36, near: 0.01, far: 200 }} dpr={[1, 2]}>
      <color attach="background" args={['#000000']} />
      <Stars radius={60} depth={30} count={4000} factor={3} fade speed={0.3} />
      <ambientLight intensity={0.05} />
      <directionalLight position={sun.clone().multiplyScalar(20)} intensity={3.2} color="#fff6e8" />
      <Moon />
      {poleCap && <PoleCap cap={poleCap} />}
      {overlay && <OverlayCap overlay={overlay} />}
      <group position={earth.clone().multiplyScalar(5.2)}>
        <Suspense fallback={null}><EarthBall /></Suspense>
        <Html center className="tag tag-earth">{earthLabel}</Html>
      </group>
      {pins.map((p, k) => (
        <group key={k} position={surfacePoint(p.lat, p.lon, 1.003)}>
          <mesh onClick={(e) => { e.stopPropagation(); onPick?.(k) }}>
            <sphereGeometry args={[0.009, 12, 12]} />
            <meshBasicMaterial color={p.good ? '#4ade80' : '#ff6b6b'} />
          </mesh>
          <Html center className={`pin-num ${p.good ? 'good' : 'bad'}`}>
            <span onClick={() => onPick?.(k)}>{p.label}</span>
          </Html>
        </group>
      ))}
      {selected && (
        <group position={surfacePoint(selected.lat, selected.lon, 1.004)}>
          <mesh>
            <sphereGeometry args={[0.014, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html center className="tag tag-spot">{selected.label}</Html>
        </group>
      )}
      <Orbiter />
      <OrbitControls makeDefault enablePan={false} minDistance={1.06} maxDistance={8} rotateSpeed={0.5} zoomSpeed={0.6} />
      <CameraFlight target={target} />
    </Canvas>
  )
}
