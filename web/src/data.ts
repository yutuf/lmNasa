// Loading the exported data (scripts/export_web_data.py) from public/data/.
import type { Constraints } from './model'

export interface Spot {
  id: string
  name: { en: string; tr: string }
  desc: { en: string; tr: string }
  group: 'pole' | 'artemis' | 'mission'
  lat: number
  lon: number
  series: string
  horizon: number[]
  patch: { file: string; n: number; spacing_m: number; frame: 'polar' | 'enu' } | null
}

export interface Manifest {
  pole_cap?: { albedo: string; normal: string; r_max_m: number; edge_lat: number }
  start_unix: number
  step_h: number
  n: number
  dsn: string
  constraints: Constraints
  spots: Spot[]
  sources: string[]
}

export interface Series {
  sunFraction: Float32Array
  sunAlt: Float32Array
  sunAz: Float32Array
  earthAlt: Float32Array
  earthAz: Float32Array
  earthVisible: boolean[]
}

const BASE = `${import.meta.env.BASE_URL}data/`

export async function loadManifest(): Promise<Manifest> {
  const r = await fetch(BASE + 'manifest.json')
  return r.json()
}

export function parseSeries(buf: ArrayBuffer, n: number): Series {
  const sunFraction = new Float32Array(buf, 0, n).slice()
  const ints = new Int16Array(buf.slice(4 * n, 12 * n))
  const scale = (k: number, f: number) => Float32Array.from(ints.subarray(k * n, (k + 1) * n), (x) => x / f)
  const ev = new Uint8Array(buf, 12 * n, n)
  return {
    sunFraction, sunAlt: scale(0, 100), sunAz: scale(1, 50), earthAlt: scale(2, 100), earthAz: scale(3, 50),
    earthVisible: Array.from(ev, (x) => x === 1),
  }
}

const cache = new Map<string, Promise<Series>>()
export function loadSeries(spot: Spot, n: number): Promise<Series> {
  if (!cache.has(spot.id)) {
    cache.set(spot.id, fetch(BASE + spot.series).then((r) => r.arrayBuffer()).then((b) => parseSeries(b, n)))
  }
  return cache.get(spot.id)!
}

export async function loadDsn(file: string): Promise<boolean[]> {
  const b = await (await fetch(BASE + file)).arrayBuffer()
  return Array.from(new Uint8Array(b), (x) => x === 1)
}

export async function loadPatch(spot: Spot): Promise<Int16Array | null> {
  if (!spot.patch) return null
  return new Int16Array(await (await fetch(BASE + spot.patch.file)).arrayBuffer())
}

export const dataUrl = (f: string) => BASE + f
