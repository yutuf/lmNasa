// Local visual/numerical test surface, deliberately absent from the application's normal production entry.
/* eslint-disable react-refresh/only-export-components -- Standalone QA entry renders its own root. */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LanderBody, RoverBody } from './components/VehicleModels'
import type { RoverMotion } from './modelRig'

function Probe({ motion }: { motion: React.RefObject<RoverMotion> }) {
  const { scene, camera, gl } = useThree()
  useEffect(() => { Object.assign(window, { __modelQA: { scene, camera, gl, motion: motion.current } }) }, [scene, camera, gl, motion])
  return null
}

function Subject({ id, lander, moving }: { id: string; lander: boolean; moving: boolean }) {
  const motion = useRef<RoverMotion>({ travel: 0, heading: 0, wheelSteer: 0 })
  const ground = useMemo(() => new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2), [])
  useFrame((_, dt) => { if (moving) motion.current.travel += Math.min(dt, .1) * .2 })
  return <>
    <ambientLight intensity={.1} />
    <directionalLight position={[4, 7, 6]} intensity={3.2} />
    <mesh geometry={ground}><meshStandardMaterial color="#454545" roughness={1} /></mesh>
    <Suspense fallback={null}>{lander ? <LanderBody id={id} /> : <RoverBody id={id} motion={motion} />}</Suspense>
    <Probe motion={motion} />
  </>
}

const params = new URLSearchParams(location.search)
const id = params.get('id') ?? 'viper', lander = params.get('kind') === 'lander'
const h = lander ? id === 'hls' ? 50 : id === 'apollo' ? 7 : 2 : 1.5
createRoot(document.getElementById('root')!).render(<div style={{ width: '100vw', height: '100dvh' }}>
  <Canvas camera={{ position: [h * 1.6, h * 1.2, h * 2.3], fov: 42, near: .01, far: 1000 }} dpr={1} onCreated={({ camera, gl }) => { camera.lookAt(0, h * .35, 0); gl.debug.checkShaderErrors = false }}>
    <color attach="background" args={['#000']} /><Subject id={id} lander={lander} moving={params.has('moving')} />
  </Canvas>
</div>)
