// Whether a full-screen overlay (the film, a site page, the drive view, the workshop...) covers the page. Canvases
// behind it (the Earthrise backdrop, the page's globe) stop rendering meanwhile: several WebGL scenes drawing at once
// is what made the film and the 3D views stutter.
import { useSyncExternalStore } from 'react'

let open = false
const subs = new Set<() => void>()
export function setOverlayOpen(v: boolean) { if (v !== open) { open = v; subs.forEach((f) => f()) } }
export function useOverlayOpen() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => open, () => false)
}
