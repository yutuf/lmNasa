// Launch from Earth for the mission film: lift-off from Kennedy Space Center (28.6 N), the climb into a 185 km parking
// orbit inclined like the launch site, one and a half turns, then the trans-lunar injection burn and departure toward
// the Moon. The sequence and timings follow an Apollo/Artemis-style profile; the drawing is not to scale (the orbit is
// lifted so it can be seen). `t` (0..1) is the scene's progress, driven by the film.
import { useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dataUrl } from '../data'

const KSC = { lat: 28.6, lon: -80.6 }
const R_ORBIT = 1.09
const INC = (28.6 * Math.PI) / 180

/** A point on the inclined parking-orbit circle at angle a (rad) from the launch site's longitude. */
function orbitPoint(a: number, r: number) {
  const x = Math.cos(a) * r, y = Math.sin(a) * r
  return new THREE.Vector3(x, y * Math.sin(INC), y * Math.cos(INC))
}

function surface(lat: number, lon: number, r = 1) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r)
}

function Earth() {
  const map = useTexture(dataUrl('earth.jpg'))
  map.colorSpace = THREE.SRGBColorSpace
  // turn the globe so Kennedy sits where the parking orbit starts (angle 0 of the orbit)
  const k = surface(KSC.lat, KSC.lon)
  const q = new THREE.Quaternion().setFromUnitVectors(k.clone().normalize(), orbitPoint(0.02, 1).normalize())
  return (
    <group quaternion={q}>
      <mesh><sphereGeometry args={[1, 96, 64]} /><meshStandardMaterial map={map} roughness={0.8} /></mesh>
      <mesh position={k.clone().multiplyScalar(1.002)}><sphereGeometry args={[0.012, 12, 12]} /><meshBasicMaterial color="#e10600" /></mesh>
    </group>
  )
}

/** The full path: ascent (0..0.12), 1.5 parking orbits (0.12..0.7), TLI burn and departure (0.7..1). */
function pathAt(u: number) {
  if (u < 0.12) {
    const s = u / 0.12
    return orbitPoint(0.35 * s, 1.0 + (R_ORBIT - 1.0) * Math.sin((s * Math.PI) / 2))
  }
  if (u < 0.7) return orbitPoint(0.35 + ((u - 0.12) / 0.58) * Math.PI * 3, R_ORBIT)
  const s = (u - 0.7) / 0.3
  const a = 0.35 + Math.PI * 3 + s * 1.6
  return orbitPoint(a, R_ORBIT + s * s * 6)
}

function Craft({ t }: { t: number }) {
  const g = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Mesh>(null)
  const trail = useMemo(() => {
    const pts = Array.from({ length: 400 }, (_, k) => pathAt(k / 399))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }))
    return line
  }, [])
  const { camera } = useThree()
  useFrame(() => {
    const p = pathAt(t)
    const ahead = pathAt(Math.min(1, t + 0.004))
    if (g.current) { g.current.position.copy(p); g.current.lookAt(ahead) }
    // draw only the flown part of the trajectory
    trail.geometry.setDrawRange(0, Math.max(2, Math.floor(t * 399)))
    const burning = t < 0.12 || (t > 0.7 && t < 0.78)
    if (flame.current) { flame.current.visible = burning; flame.current.scale.setScalar(0.8 + Math.random() * 0.4) }
    // camera: close on the pad, wider during the orbits, pulled back for the departure
    const dist = t < 0.12 ? 1.9 : t < 0.7 ? 3.2 : 3.2 + (t - 0.7) * 14
    const around = orbitPoint(0.35 + t * 2.2, 1).normalize()
    camera.position.lerp(around.multiplyScalar(dist).add(new THREE.Vector3(0, 0.9, 0)), 0.05)
    camera.lookAt(t < 0.7 ? new THREE.Vector3(0, 0, 0) : p.clone().multiplyScalar(0.4))
  })
  return (
    <>
      <primitive object={trail} />
      <group ref={g}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.012, 0.05, 12]} /><meshStandardMaterial color="#f2f2f2" metalness={0.4} roughness={0.4} /></mesh>
        <mesh ref={flame} position={[0, 0, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.012, 0.06, 12]} /><meshBasicMaterial color="#ffb347" transparent opacity={0.9} />
        </mesh>
      </group>
    </>
  )
}

export default function LaunchScene({ t }: { t: number }) {
  return (
    <Canvas camera={{ position: [1.2, 1.2, 1.6], fov: 40, near: 0.01, far: 200 }} dpr={[1, 2]}>
      <color attach="background" args={['#000']} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#9cc4ff', '#000000', 0.35]} />
      <directionalLight position={[5, 2, 3]} intensity={2.6} color="#fff6e8" />
      <Suspense fallback={null}><Earth /></Suspense>
      <Craft t={t} />
    </Canvas>
  )
}
