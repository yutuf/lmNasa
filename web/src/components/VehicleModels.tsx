// Simple 3D models of the landers and rovers we have no NASA model for, built from primitives at real size (metres).
// Apollo LM and the rover stand-in still use the NASA 3D Resources models. Forward is +x, up is +y.
import { Suspense } from 'react'
import { NasaModel } from './Models'

const FOIL = '#c9a43a', SILVER = '#c9ccd2', DARK = '#2a2c31', PANEL = '#1f3a6b', WHITE = '#e9e9ec'

function Legs({ n = 4, r = 2, h = 1.6, foot = 0.35, color = SILVER }: { n?: number; r?: number; h?: number; foot?: number; color?: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + Math.PI / n
        const x = Math.cos(a) * r, z = Math.sin(a) * r
        const tilt = Math.atan2(r * 0.55, h)
        return (
          <group key={k}>
            <mesh position={[x * 0.72, h / 2, z * 0.72]} rotation={[Math.sin(a) * tilt, 0, -Math.cos(a) * tilt]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, h * 1.15, 8]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[x, 0.05, z]} castShadow><cylinderGeometry args={[foot, foot, 0.1, 16]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.5} /></mesh>
          </group>
        )
      })}
    </>
  )
}


function BlueMoon() {
  return (
    <group>
      <mesh position={[0, 4.4, 0]} castShadow><cylinderGeometry args={[1.6, 1.9, 5.6, 32]} /><meshStandardMaterial color={WHITE} metalness={0.2} roughness={0.5} /></mesh>
      <mesh position={[0, 7.8, 0]} castShadow><coneGeometry args={[1.6, 1.4, 32]} /><meshStandardMaterial color={WHITE} metalness={0.2} roughness={0.5} /></mesh>
      <mesh position={[0, 5.4, 1.7]} rotation={[0, 0, 0]}><boxGeometry args={[2.4, 2.2, 0.08]} /><meshStandardMaterial color={PANEL} /></mesh>
      <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.6, 0.9, 1.2, 24]} /><meshStandardMaterial color={DARK} metalness={0.6} /></mesh>
      <Legs n={4} r={3} h={2} foot={0.5} />
    </group>
  )
}

function NovaC() {
  return (
    <group>
      <mesh position={[0, 2.3, 0]} castShadow><cylinderGeometry args={[0.95, 0.95, 2.6, 6]} /><meshStandardMaterial color={FOIL} metalness={0.7} roughness={0.35} /></mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[Math.cos((k * 2 * Math.PI) / 3) * 0.9, 2.6, Math.sin((k * 2 * Math.PI) / 3) * 0.9]} rotation={[0, -(k * 2 * Math.PI) / 3, 0]}>
          <boxGeometry args={[0.05, 1.6, 1.0]} /><meshStandardMaterial color={PANEL} />
        </mesh>
      ))}
      <mesh position={[0, 3.75, 0]}><cylinderGeometry args={[0.35, 0.35, 0.3, 16]} /><meshStandardMaterial color={SILVER} /></mesh>
      <Legs n={6} r={1.7} h={1.1} foot={0.25} />
    </group>
  )
}

function BlueGhost() {
  return (
    <group>
      <mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[1.5, 1.5, 1.2, 8]} /><meshStandardMaterial color={FOIL} metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={[0, 1.95, 0]}><cylinderGeometry args={[1.45, 1.45, 0.3, 8]} /><meshStandardMaterial color={PANEL} /></mesh>
      <mesh position={[0.4, 2.35, 0.3]}><boxGeometry args={[0.6, 0.5, 0.6]} /><meshStandardMaterial color={SILVER} /></mesh>
      <mesh position={[-0.6, 2.5, -0.3]}><cylinderGeometry args={[0.02, 0.02, 0.9, 6]} /><meshStandardMaterial color={SILVER} /></mesh>
      <Legs n={4} r={2.1} h={0.8} foot={0.3} />
    </group>
  )
}


function Wheels({ n, len, width, r, color = DARK }: { n: number; len: number; width: number; r: number; color?: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, k) => [-1, 1].map((side) => (
        <mesh key={`${k}${side}`} position={[n === 1 ? 0 : -len / 2 + (k * len) / (n - 1), r, (side * width) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[r, r, r * 0.6, 20]} /><meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      )))}
    </>
  )
}

function LRV() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[3.1, 0.08, 1.4]} /><meshStandardMaterial color={SILVER} metalness={0.6} roughness={0.4} /></mesh>
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[-0.2, 0.85, z]}><boxGeometry args={[0.55, 0.6, 0.5]} /><meshStandardMaterial color="#5c6670" /></mesh>
      ))}
      <mesh position={[1.1, 1.1, 0]}><cylinderGeometry args={[0.02, 0.02, 1.1, 6]} /><meshStandardMaterial color={SILVER} /></mesh>
      <mesh position={[1.1, 1.7, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.45, 0.25, 24, 1, true]} /><meshStandardMaterial color="#d8d8d8" side={2} /></mesh>
      <Wheels n={2} len={2.3} width={1.85} r={0.41} color="#8a8f96" />
    </group>
  )
}



export function LanderBody({ id }: { id: string }) {
  // real models (Sketchfab, CC-BY 4.0; see public/models/CREDITS.md)
  if (id === 'hls') return <Suspense fallback={null}><NasaModel file="starship.glb" size={50} fit="height" /></Suspense>
  if (id === 'vikram') return <Suspense fallback={null}><NasaModel file="vikram.glb" size={2} fit="height" /></Suspense>
  // no public model exists for these yet: simplified shapes
  if (id === 'bluemoon') return <BlueMoon />
  if (id === 'nova') return <NovaC />
  if (id === 'ghost') return <BlueGhost />
  // NASA 3D Resources: Apollo Lunar Module (about 7 m tall)
  return <Suspense fallback={null}><NasaModel file="lander.glb" size={7} fit="height" /></Suspense>
}

export function RoverBody({ id }: { id: string }) {
  if (id === 'lrv') return <LRV />
  if (id === 'yutu') return <Suspense fallback={null}><NasaModel file="yutu.glb" size={1.5} fit="length" /></Suspense>
  if (id === 'pragyan') return <Suspense fallback={null}><NasaModel file="pragyan.glb" size={0.92} fit="length" /></Suspense>
  // NASA 3D Resources: Mars 2020 Perseverance (3 m long), standing in for VIPER
  return <Suspense fallback={null}><NasaModel file="rover.glb" size={3} fit="length" /></Suspense>
}

/** Height of the lander's hatch / top deck (m), for the lander-view camera. */
export const landerEye = (id: string) => ({ hls: 38, bluemoon: 6, nova: 3.6, ghost: 2.4, vikram: 2.2 } as Record<string, number>)[id] ?? 5.6
