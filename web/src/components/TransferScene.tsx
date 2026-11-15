import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dataUrl } from '../data'
import { earthSunAt, ease, MOON_ADVANCE, transferMoon, transferPosition, UP } from '../motion3d'
import { sceneProgress, useMissionPlayback } from '../missionPlayback'

function Transfer() {
  const playback = useMissionPlayback()
  const { camera, size } = useThree()
  const moon = useRef<THREE.Mesh>(null), craft = useRef<THREE.Group>(null)
  const plume = useRef<THREE.Mesh>(null)
  const [earthMap, moonMap] = useTexture([dataUrl('earth.jpg'), dataUrl('moon_albedo.jpg')])
  earthMap.colorSpace = moonMap.colorSpace = THREE.SRGBColorSpace
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), next: new THREE.Vector3(), forward: new THREE.Vector3(),
    prograde: new THREE.Quaternion(), retrograde: new THREE.Quaternion(), look: new THREE.Vector3(2.4, 0, -.9) }), [])
  const lines = useMemo(() => {
    const line = (pts: THREE.Vector3[], color: string, opacity: number) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
    const orbit = line(Array.from({ length: 129 }, (_, i) => {
      const a = -.6 + MOON_ADVANCE * i / 128
      return new THREE.Vector3(5.2 * Math.cos(a), 0, -5.2 * Math.sin(a))
    }), '#9aa4b2', .35)
    const points = Array.from({ length: 257 }, (_, i) => transferPosition(i / 256, new THREE.Vector3()))
    return [orbit, line(points, '#708294', .22), line(points, '#b6d5e9', .85)]
  }, [])
  useEffect(() => () => lines.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose() }), [lines])
  useFrame(() => {
    if (!moon.current || !craft.current || !playback) return
    const u = sceneProgress(playback.current)
    transferMoon(u, moon.current.position)
    // Synchronous rotation: the same lunar hemisphere remains directed toward Earth.
    moon.current.rotation.y = -.6 + MOON_ADVANCE * u
    transferPosition(u, tmp.p)
    transferPosition(Math.min(.9999, u + .0001), tmp.next)
    craft.current.position.copy(tmp.p)
    tmp.forward.subVectors(tmp.next, tmp.p).normalize()
    tmp.prograde.setFromUnitVectors(UP, tmp.forward)
    tmp.retrograde.setFromUnitVectors(UP, tmp.forward.negate())
    craft.current.quaternion.copy(tmp.prograde).slerp(tmp.retrograde, ease((u - .76) / .1))
    if (plume.current) plume.current.visible = u >= .87 && u < .995
    lines[2].geometry.setDrawRange(0, Math.max(1, Math.round(u * 256) + 1))
    const phone = size.width / size.height < 1
    camera.position.set(2.4, phone ? 10.8 : 6.2, phone ? 12.5 : 7.5)
    camera.lookAt(tmp.look)
  })
  return <>
    {lines.map((l, i) => <primitive object={l} key={i} />)}
    <mesh><sphereGeometry args={[.65, 64, 40]} /><meshStandardMaterial map={earthMap} roughness={1} /></mesh>
    <mesh ref={moon}><sphereGeometry args={[.18, 64, 40]} /><meshStandardMaterial map={moonMap} roughness={1} /></mesh>
    <group ref={craft}>
      <mesh><cylinderGeometry args={[.018, .022, .06, 12]} /><meshStandardMaterial color="#d5d6d6" roughness={.8} /></mesh>
      <mesh position={[.05, 0, 0]}><boxGeometry args={[.06, .003, .04]} /><meshStandardMaterial color="#35434e" roughness={.95} /></mesh>
      <mesh position={[-.05, 0, 0]}><boxGeometry args={[.06, .003, .04]} /><meshStandardMaterial color="#35434e" roughness={.95} /></mesh>
      <mesh ref={plume} position={[0, -.09, 0]} visible={false}><coneGeometry args={[.015, .12, 16, 1, true]} /><meshBasicMaterial color="#b9cde5" opacity={.16} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} /></mesh>
    </group>
  </>
}

export default function TransferScene({ launch }: { launch: Date }) {
  const playback = useMissionPlayback()
  const sun = useMemo(() => earthSunAt(launch.getTime(), new THREE.Vector3()).multiplyScalar(30), [launch])
  return <Canvas camera={{ position: [2.4, 6.2, 7.5], fov: 42, near: .01, far: 100 }} dpr={[1, 1.5]} frameloop={playback?.current.paused ? 'demand' : 'always'} onCreated={({ gl }) => { gl.debug.checkShaderErrors = false }}>
    <color attach="background" args={['#000']} />
    <ambientLight intensity={.035} />
    <directionalLight position={sun} intensity={3.2} />
    <Suspense fallback={null}><Transfer /></Suspense>
  </Canvas>
}
