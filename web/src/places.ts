// Human place names for a point near the south pole: "on the rim of Shackleton", "4.2 km NE of Malapert".
// Features are IAU-approved names (features.json from scripts/export_features.py).
import type { Lang } from './i18n'

export type Feature = [name: string, lat: number, lon: number, diameterKm: number, type: string]

const R_KM = 1737.4
const RAD = Math.PI / 180

/** South polar stereographic km (+x toward 90 E, +y toward 0 E). */
export function polarXY(lat: number, lon: number): [number, number] {
  const r = 2 * R_KM * Math.tan(((90 + lat) / 2) * RAD)
  return [r * Math.sin(lon * RAD), r * Math.cos(lon * RAD)]
}

const DIRS = { en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], tr: ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'] }

/** Local compass direction (from the feature's centre to the point), measured at the feature's longitude. */
function bearing(fLon: number, dx: number, dy: number): number {
  const lo = fLon * RAD
  const north = dx * Math.sin(lo) + dy * Math.cos(lo)
  const east = dx * Math.cos(lo) - dy * Math.sin(lo)
  return ((Math.atan2(east, north) / RAD) + 360) % 360
}

export interface Place { name: string; kind: 'inside' | 'rim' | 'near'; distKm: number; dir: string; text: string }

export function describePlace(lat: number, lon: number, feats: Feature[], lang: Lang): Place | null {
  const [x, y] = polarXY(lat, lon)
  let best: { f: Feature; d: number; score: number } | null = null
  for (const f of feats) {
    if (f[3] < 3) continue
    const [fx, fy] = polarXY(f[1], f[2])
    const d = Math.hypot(x - fx, y - fy)
    const r = f[3] / 2
    // distance to the rim, with a mild preference for larger, better-known features; standing on a mountain
    // (mons) wins outright; lettered satellite craters ("Scott M") rank below named ones
    const onMount = !/crater/i.test(f[4]) && d < r
    const score = onMount ? -20 - r * 0.01 : Math.abs(d - r) - Math.min(4, r * 0.08) + (/ [A-Z]$/.test(f[0]) ? 3 : 0)
    if (d < r * 3 + 30 && (!best || score < best.score)) best = { f, d, score }
  }
  if (!best) return null
  const { f, d } = best
  const r = f[3] / 2
  const [fx, fy] = polarXY(f[1], f[2])
  const dir = DIRS[lang][Math.round(bearing(f[2], x - fx, y - fy) / 45) % 8]
  const isCrater = /crater/i.test(f[4])
  const tr = lang === 'tr'
  if (isCrater && d < r * 0.8) return { name: f[0], kind: 'inside', distKm: d, dir, text: tr ? `${f[0]} krateri içinde` : `inside ${f[0]} crater` }
  if (isCrater && d <= r * 1.25) return { name: f[0], kind: 'rim', distKm: d, dir, text: tr ? `${f[0]} krater kenarı, ${dir}` : `${dir} rim of ${f[0]}` }
  if (!isCrater && d < r) return { name: f[0], kind: 'inside', distKm: d, dir, text: tr ? `${f[0]} üzerinde` : `on ${f[0]}` }
  const away = Math.max(0.1, d - r)
  return { name: f[0], kind: 'near', distKm: away, dir,
    text: tr ? `${f[0]} ${isCrater ? 'kenarının' : ''} ${away.toFixed(1).replace('.', ',')} km ${dir}`.replace(/\s+/g, ' ')
      : `${away.toFixed(1)} km ${dir} of ${f[0]}${isCrater ? ' rim' : ''}` }
}
