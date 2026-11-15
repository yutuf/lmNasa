// The landers and rovers in 3D: only real models (NASA 3D Resources, and CC-BY models from Sketchfab; see
// public/models/CREDITS.md), at real size in metres. Forward is +x, up is +y.
import { Suspense, type RefObject } from 'react'
import { NasaModel, type ModelFile } from './Models'
import { landerById } from '../vehicles'
import type { RoverMotion } from '../modelRig'

/** The model file behind each vehicle (for preloading). */
// eslint-disable-next-line react-refresh/only-export-components -- Shared model lookup used by the film preloader.
export const landerFile = (id: string): ModelFile => (({ hls: 'starship.glb', vikram: 'vikram.glb' } as Record<string, ModelFile>)[id] ?? 'lander.glb')
// eslint-disable-next-line react-refresh/only-export-components -- Shared model lookup used by the film preloader.
export const roverFile = (id: string): ModelFile => (({ lrv: 'lrv.glb', yutu: 'yutu.glb', pragyan: 'pragyan.glb' } as Record<string, ModelFile>)[id] ?? 'rover.glb')

export function LanderBody({ id, onReady }: { id: string; onReady?: () => void }) {
  // real models (Sketchfab, CC-BY 4.0; see public/models/CREDITS.md)
  if (id === 'hls') return <Suspense fallback={null}><NasaModel file="starship.glb" size={50} fit="height" onReady={onReady} /></Suspense>
  if (id === 'vikram') return <Suspense fallback={null}><NasaModel file="vikram.glb" size={2} fit="height" onReady={onReady} /></Suspense>
  // NASA 3D Resources: Apollo Lunar Module (about 7 m tall)
  return <Suspense fallback={null}><NasaModel file="lander.glb" size={landerById(id).heightM} fit="height" onReady={onReady} /></Suspense>
}

export function RoverBody({ id, motion, onReady }: { id: string; motion?: RefObject<RoverMotion>; onReady?: () => void }) {
  if (id === 'lrv') return <Suspense fallback={null}><NasaModel file="lrv.glb" size={3.1} fit="length" motion={motion} onReady={onReady} /></Suspense>
  if (id === 'yutu') return <Suspense fallback={null}><NasaModel file="yutu.glb" size={1.5} fit="length" motion={motion} onReady={onReady} /></Suspense>
  if (id === 'pragyan') return <Suspense fallback={null}><NasaModel file="pragyan.glb" size={0.92} fit="length" motion={motion} onReady={onReady} /></Suspense>
  // Perseverance is explicitly a VIPER proxy, fitted to VIPER's approximate 1.5 m height.
  return <Suspense fallback={null}><NasaModel file="rover.glb" size={1.5} fit="height" motion={motion} onReady={onReady} /></Suspense>
}

/** Height of the lander's hatch / top deck (m), for the lander-view camera. */
// eslint-disable-next-line react-refresh/only-export-components -- Camera dimensions belong beside the vehicle models.
export const landerEye = (id: string) => ({ hls: 38, bluemoon: 6, nova: 3.6, ghost: 2.4, vikram: 2.2 } as Record<string, number>)[id] ?? 5.6
