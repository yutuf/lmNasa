// Map overlays for the globe: one coloured cell per search point. The south-pole grid paints a texture in the
// polar stereographic plane (a cap around the pole); the whole-Moon grid paints an equirectangular texture that
// wraps the whole sphere.
import * as THREE from 'three'
import type { Atlas } from './engine'
import type { Overlay } from './components/Globe'

type RGBA = [number, number, number, number] | null

export function paintOverlay(atlas: Atlas, colour: (i: number) => RGBA): Overlay {
  if (atlas.kind === 'moon') {
    const W = 1440, H = 720
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const x = c.getContext('2d')!
    for (let i = 0; i < atlas.n; i++) {
      const col = colour(i)
      if (!col) continue
      const lat = atlas.lat[i], lon = atlas.lon[i]
      const dlon = 1 / Math.max(Math.cos((lat * Math.PI) / 180), 1 / 30)
      x.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${col[3] / 255})`
      x.fillRect(((lon - dlon / 2 + 180) / 360) * W, ((90 - lat - 0.5) / 180) * H, (dlon / 360) * W + 0.6, H / 180 + 0.6)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { texture: tex, rMaxM: NaN, edgeLat: 90, sphere: true }
  }
  const n = Math.round((2 * atlas.rMaxM) / atlas.spacingM) + 1
  const px = new Uint8Array(n * n * 4)
  for (let i = 0; i < atlas.n; i++) {
    const col = colour(i)
    if (!col) continue
    const cc = Math.round((atlas.xKm[i] * 1000 + atlas.rMaxM) / atlas.spacingM)
    const rr = Math.round((atlas.yKm[i] * 1000 + atlas.rMaxM) / atlas.spacingM)
    const k = (rr * n + cc) * 4
    px[k] = col[0]; px[k + 1] = col[1]; px[k + 2] = col[2]; px[k + 3] = col[3]
  }
  const tex = new THREE.DataTexture(px, n, n, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return { texture: tex, rMaxM: atlas.rMaxM, edgeLat: -84.5 }
}
