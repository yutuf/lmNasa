// The landers and rovers in 3D: only real models (NASA 3D Resources, and CC-BY models from Sketchfab; see
// public/models/CREDITS.md), at real size in metres. Forward is +x, up is +y.
import { Suspense } from 'react'
import { NasaModel, type ModelFile } from './Models'

/** The model file behind each vehicle (for preloading). */
export const landerFile = (id: string): ModelFile => (({ hls: 'starship.glb', vikram: 'vikram.glb' } as Record<string, ModelFile>)[id] ?? 'lander.glb')
export const roverFile = (id: string): ModelFile => (({ lrv: 'lrv.glb', yutu: 'yutu.glb', pragyan: 'pragyan.glb' } as Record<string, ModelFile>)[id] ?? 'rover.glb')

export function LanderBody({ id }: { id: string }) {
  // real models (Sketchfab, CC-BY 4.0; see public/models/CREDITS.md)
  if (id === 'hls') return <Suspense fallback={null}><NasaModel file="starship.glb" size={50} fit="height" /></Suspense>
  if (id === 'vikram') return <Suspense fallback={null}><NasaModel file="vikram.glb" size={2} fit="height" /></Suspense>
  // NASA 3D Resources: Apollo Lunar Module (about 7 m tall)
  return <Suspense fallback={null}><NasaModel file="lander.glb" size={7} fit="height" /></Suspense>
}

export function RoverBody({ id }: { id: string }) {
  if (id === 'lrv') return <Suspense fallback={null}><NasaModel file="lrv.glb" size={3.1} fit="length" /></Suspense>
  if (id === 'yutu') return <Suspense fallback={null}><NasaModel file="yutu.glb" size={1.5} fit="length" /></Suspense>
  if (id === 'pragyan') return <Suspense fallback={null}><NasaModel file="pragyan.glb" size={0.92} fit="length" /></Suspense>
  // NASA 3D Resources: Mars 2020 Perseverance (3 m long), standing in for VIPER
  return <Suspense fallback={null}><NasaModel file="rover.glb" size={3} fit="length" /></Suspense>
}

/** Height of the lander's hatch / top deck (m), for the lander-view camera. */
export const landerEye = (id: string) => ({ hls: 38, bluemoon: 6, nova: 3.6, ghost: 2.4, vikram: 2.2 } as Record<string, number>)[id] ?? 5.6
