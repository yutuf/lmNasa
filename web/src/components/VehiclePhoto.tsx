// Studio "photos" of the landers and rovers: each 3D model rendered once, off-screen, with three-point lighting and a
// soft contact shadow on a transparent background, then cached as a PNG for cards, pickers and Luna's story.
// One off-screen react-three-fiber root renders the models one after another (WebGL contexts are a scarce resource).
import { createRoot, extend, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { LanderBody, RoverBody } from './VehicleModels'

const SIZE = 512
// <Canvas> registers three.js objects for JSX; a bare off-screen root has to do it itself
extend(THREE as unknown as Parameters<typeof extend>[0])
const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

function Capture({ target, done }: { target: React.RefObject<THREE.Group | null>; done: (url: string) => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let frames = 0
    let id = 0
    const tick = () => {
      // wait a couple of frames so textures and environment maps are on the GPU
      // and until the model is really there: real models load (and suspend) inside their own boundary
      const g = target.current
      let meshes = 0
      g?.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++ })
      if (++frames < 3 || (!meshes && frames < 900)) { id = requestAnimationFrame(tick); return }
      if (!g) return
      const box = new THREE.Box3().setFromObject(g)
      const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3())
      const r = Math.max(size.x, size.y * 1.1, size.z) * 0.62
      const cam = camera as THREE.PerspectiveCamera
      cam.position.copy(centre).add(new THREE.Vector3(1.0, 0.45, 1.25).normalize().multiplyScalar(r / Math.tan((cam.fov * Math.PI) / 360)))
      cam.near = r / 50; cam.far = r * 50
      cam.lookAt(centre)
      cam.updateProjectionMatrix()
      const shadow = scene.getObjectByName('contact')
      if (shadow) { shadow.position.set(centre.x, box.min.y + 0.01, centre.z); shadow.scale.setScalar(Math.max(size.x, size.z) * 1.5) }
      gl.render(scene, camera)
      done(gl.domElement.toDataURL('image/png'))
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [gl, scene, camera, target, done])
  return null
}

function contactTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function Studio({ body, done }: { body: ReactNode; done: (url: string) => void }) {
  const g = useRef<THREE.Group>(null)
  const tex = useState(contactTexture)[0]
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 9, 5]} intensity={3.2} color="#fff4e6" />
      <directionalLight position={[-7, 3, -4]} intensity={1.6} color="#7fa8ff" />
      <directionalLight position={[0, 4, -9]} intensity={1.2} color="#ffffff" />
      <mesh name="contact" rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={tex} transparent depthWrite={false} /></mesh>
      <Suspense fallback={null}>
        <group ref={g}>{body}</group>
        <Capture target={g} done={done} />
      </Suspense>
    </>
  )
}

function shoot(key: string, body: ReactNode): Promise<string> {
  if (cache.has(key)) return cache.get(key)!
  const job = queue.then(() => new Promise<string>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE; canvas.height = SIZE
    const root = createRoot(canvas)
    const timer = setTimeout(() => { root.unmount(); reject(new Error('render timeout')) }, 20000)
    // configure() is asynchronous in react-three-fiber v9: render only once the root exists
    root.configure({
      gl: { alpha: true, antialias: true, preserveDrawingBuffer: true }, dpr: 1, frameloop: 'always',
      size: { width: SIZE, height: SIZE, top: 0, left: 0 }, camera: { fov: 28, position: [8, 4, 8] },
      onCreated: ({ gl }) => { gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace },
    }).then(() => {
      root.render(<Studio body={body} done={(url) => { clearTimeout(timer); setTimeout(() => root.unmount(), 0); resolve(url) }} />)
    }, reject)
  }))
  queue = job.catch(() => undefined)
  cache.set(key, job)
  return job
}

export function useVehiclePhoto(kind: 'lander' | 'rover', id: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    shoot(`${kind}:${id}`, kind === 'lander' ? <LanderBody id={id} /> : <RoverBody id={id} />)
      .then((u) => { if (live) setUrl(u) }).catch(() => {})
    return () => { live = false }
  }, [kind, id])
  return url
}

export default function VehiclePhoto({ kind, id, alt, className }: { kind: 'lander' | 'rover'; id: string; alt: string; className?: string }) {
  const url = useVehiclePhoto(kind, id)
  // nothing until the render is ready (no empty placeholder boxes)
  return url ? <img className={className} src={url} alt={alt} /> : null
}
