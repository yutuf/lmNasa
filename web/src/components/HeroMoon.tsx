// The Simple view's backdrop: an Earthrise. The real Moon (LRO albedo + normal map) fills the bottom as a curved
// horizon, back-lit by a low Sun so its edge glows; Earth rises above it; stars and a coloured sky (CSS) behind.
import { Suspense, useEffect, useRef, useState } from 'react'
import { useOverlayOpen } from '../overlayState'
import { Canvas, useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { dataUrl } from '../data'

function Horizon() {
  const [albedo, normal] = useTexture([dataUrl('moon_albedo.jpg'), dataUrl('moon_normal.jpg')])
  albedo.colorSpace = THREE.SRGBColorSpace
  const m = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (m.current) m.current.rotation.x += dt * 0.004 })
  return (
    <mesh ref={m} position={[0, -10.75, -5]} rotation={[0.4, 0.8, 0]}>
      <sphereGeometry args={[10, 256, 128]} />
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1.1, 1.1)} roughness={1} metalness={0} color="#d9d4cc" />
    </mesh>
  )
}

/** A soft additive halo (canvas radial gradient), for Earth's atmosphere and the Sun's glare. */
function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
const earthGlow = glowTexture('rgba(120,190,255,0.55)', 'rgba(60,120,255,0.18)')
const sunGlow = glowTexture('rgba(255,236,200,0.9)', 'rgba(255,150,90,0.22)')

function Earth() {
  const map = useTexture(dataUrl('earth.jpg'))
  map.colorSpace = THREE.SRGBColorSpace
  const e = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (e.current) e.current.rotation.y += dt * 0.05 })
  return (
    <group position={[6.2, 2.6, -15]}>
      <sprite scale={[3.6, 3.6, 1]}><spriteMaterial map={earthGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <mesh ref={e} rotation={[0.4, 2.2, 0.2]}>
        <sphereGeometry args={[0.8, 64, 48]} />
        <meshStandardMaterial map={map} roughness={0.7} />
      </mesh>
    </group>
  )
}

export default function HeroMoon() {
  // render only while on screen and not covered by an overlay
  const box = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(true)
  const covered = useOverlayOpen()
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className="hero-sky" aria-hidden="true" ref={box}>
      <Canvas camera={{ position: [0, 0, 0], fov: 40 }} dpr={[1, 1.25]} gl={{ alpha: true, antialias: true }} frameloop={seen && !covered ? 'always' : 'never'}
        onCreated={({ camera, gl }) => { gl.debug.checkShaderErrors = false; camera.lookAt(0, 0.35, -10) }}>
        <hemisphereLight args={['#2a2a2a', '#000000', 0.2]} />
        {/* the Sun low on the left: rakes across the horizon (long shadows) and lights Earth's left half */}
        <directionalLight position={[-10, 1.4, -3]} intensity={4.4} color="#ffe2c4" />
        <directionalLight position={[5, 2, 4]} intensity={0.35} color="#7aa6ff" />
        <sprite position={[-12, 0.3, -16]} scale={[8, 8, 1]}><spriteMaterial map={sunGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        <Suspense fallback={null}>
          <Horizon />
          <Earth />
        </Suspense>
      </Canvas>
    </div>
  )
}
