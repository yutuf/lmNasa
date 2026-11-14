// Nominal Kennedy ascent, parking orbit and tangent TLI. Scale and time are compressed.
import { useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dataUrl } from '../data'
import { earthSunAt, ease, launchPosition, UP } from '../motion3d'
import { sceneProgress, useMissionPlayback } from '../missionPlayback'

const RAD = Math.PI / 180
const pad = new THREE.Vector3(Math.cos(28.6 * RAD) * Math.cos(-80.6 * RAD), Math.sin(28.6 * RAD), -Math.cos(28.6 * RAD) * Math.sin(-80.6 * RAD))
const east = new THREE.Vector3(-Math.sin(-80.6 * RAD), 0, -Math.cos(-80.6 * RAD))
const normal = new THREE.Vector3().crossVectors(pad, east).normalize()
const frame = new THREE.Matrix4().makeBasis(pad, east, normal)

function Earth() {
  const map = useTexture(dataUrl('earth.jpg'))
  map.colorSpace = THREE.SRGBColorSpace
  return <>
    <mesh><sphereGeometry args={[1, 96, 64]} /><meshStandardMaterial map={map} roughness={1} /></mesh>
    <mesh position={pad.clone().multiplyScalar(1.002)}><sphereGeometry args={[.005, 12, 12]} /><meshBasicMaterial color="#e10600" /></mesh>
  </>
}

function Flight({ t }: { t: number }) {
  const playback = useMissionPlayback()
  const craft = useRef<THREE.Group>(null), flame = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), ahead: new THREE.Vector3(), axis: new THREE.Vector3(), eye: new THREE.Vector3(),
    look: new THREE.Vector3(), radial: new THREE.Vector3(), started: false }), [])
  const trail = useMemo(() => {
    const pts = Array.from({ length: 501 }, (_, k) => launchPosition(k / 500, new THREE.Vector3()).applyMatrix4(frame))
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#b7c8d6', transparent: true, opacity: .55 }))
  }, [])
  useEffect(() => () => { trail.geometry.dispose(); (trail.material as THREE.Material).dispose() }, [trail])
  useFrame((state, dt) => {
    if (!craft.current) return
    const u = playback ? sceneProgress(playback.current) : t
    const { p, ahead, axis, eye, look, radial } = tmp
    launchPosition(u, p).applyMatrix4(frame)
    launchPosition(Math.min(1, u + .0001), ahead).applyMatrix4(frame)
    axis.subVectors(ahead, p).normalize()
    if (u >= 1) axis.copy(east)
    craft.current.position.copy(p)
    craft.current.quaternion.setFromUnitVectors(UP, axis)
    trail.geometry.setDrawRange(0, Math.max(1, Math.floor(u * 500) + 1))
    if (flame.current) {
      flame.current.visible = u < .18 || (u >= .72 && u < .83)
      flame.current.scale.y = .96 + .04 * Math.sin(state.clock.elapsedTime * 38)
    }
    const wide = ease((u - .04) / .22)
    radial.copy(pad).multiplyScalar(.35).addScaledVector(normal, .23)
    eye.copy(p).add(radial).lerp(radial.copy(normal).multiplyScalar(u < .72 ? 3.7 : 4.5).addScaledVector(pad, 1.5), wide)
    look.copy(p).lerp(radial.copy(p).multiplyScalar(u < .72 ? 0 : .45), wide)
    if (!tmp.started) { camera.position.copy(eye); tmp.started = true }
    camera.position.lerp(eye, 1 - Math.exp(-dt * 6))
    camera.up.copy(pad).lerp(UP, wide).normalize()
    camera.lookAt(look)
  })
  return <>
    <primitive object={trail} />
    <group ref={craft}>
      <mesh position={[0, .015, 0]}><cylinderGeometry args={[.007, .009, .05, 16]} /><meshStandardMaterial color="#d8d9da" roughness={.85} metalness={.15} /></mesh>
      <mesh position={[0, .047, 0]}><coneGeometry args={[.007, .015, 16]} /><meshStandardMaterial color="#eeeeeb" roughness={.9} /></mesh>
      <mesh position={[0, -.013, 0]}><cylinderGeometry args={[.006, .009, .008, 16, 1, true]} /><meshStandardMaterial color="#242528" roughness={.8} side={THREE.DoubleSide} /></mesh>
      <mesh ref={flame} position={[0, -.049, 0]}>
        <coneGeometry args={[.013, .065, 20, 1, true]} />
        <meshBasicMaterial color="#b8d5f2" transparent opacity={.25} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </group>
  </>
}

export default function LaunchScene({ t, launch }: { t: number; launch: Date }) {
  const sun = useMemo(() => earthSunAt(launch.getTime(), new THREE.Vector3()).multiplyScalar(20), [launch])
  return <Canvas camera={{ position: pad.clone().multiplyScalar(1.4).addScaledVector(normal, .25), fov: 40, near: .002, far: 100 }} dpr={[1, 1.5]}
    onCreated={({ gl }) => { gl.debug.checkShaderErrors = false }}>
    <color attach="background" args={['#000']} />
    <ambientLight intensity={.035} />
    <directionalLight position={sun} intensity={3.2} color="#fff9ef" />
    <Suspense fallback={null}><Earth /></Suspense>
    <Flight t={t} />
  </Canvas>
}
