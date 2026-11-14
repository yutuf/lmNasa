// Artemis III head-to-head: for each of NASA's nine candidate regions, the region's centre (the reference point
// derived from the official USGS outline) against the best point LunaNav finds inside the region, for the current
// mission. The centre is evaluated even when it fails the terrain checks, so the table can say why.
import { insideRing, type Atlas, type PointResult } from './engine'
import { rankTop } from './scenarios'

export interface Region { name: string; rings: number[][][] }

export interface ArtemisRow {
  name: string
  centre: { index: number; result: PointResult; fails: string | null } | null   // fails: which check it fails; null: passes. centre null: outside the grid
  best: PointResult | null      // best point inside the region that passed every check
  bestKm: number | null         // distance from the centre to the best point
  searched: number              // points inside the region that passed the terrain/science checks
  inside: number                // atlas points inside the region
}

/** Area-weighted centroid of the largest ring (km, stereographic). */
export function ringCentroid(ring: number[][]): [number, number] {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i]
    const k = x0 * y1 - x1 * y0
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

export function nearestIndex(atlas: Atlas, x: number, y: number): number {
  let best = 0, bd = Infinity
  for (let i = 0; i < atlas.n; i++) {
    const d = (atlas.xKm[i] - x) ** 2 + (atlas.yKm[i] - y) ** 2
    if (d < bd) { bd = d; best = i }
  }
  return best
}

export function artemisRows(regions: Region[], atlas: Atlas, results: PointResult[],
                            evalPoint: (index: number) => PointResult, fails: (index: number) => string | null): ArtemisRow[] {
  return regions.map((g) => {
    const ring = [...g.rings].sort((a, b) => b.length - a.length)[0]
    const [cx, cy] = ringCentroid(ring)
    const ci = nearestIndex(atlas, cx, cy)
    const isIn = (i: number) => g.rings.some((r) => insideRing(atlas.xKm[i], atlas.yKm[i], r))
    const mine = results.filter((r) => isIn(r.index))
    let inside = 0
    for (let i = 0; i < atlas.n; i++) if (isIn(i)) inside++
    const name = g.name.replace(/_/g, ' ')
    if (!inside || !isIn(ci)) return { name, centre: null, best: null, bestKm: null, searched: 0, inside }
    const best = rankTop(mine, atlas, 1)[0] ?? null
    const bestKm = best ? Math.hypot(atlas.xKm[best.index] - atlas.xKm[ci], atlas.yKm[best.index] - atlas.yKm[ci]) : null
    return { name, centre: { index: ci, result: evalPoint(ci), fails: fails(ci) }, best, bestKm, searched: mine.length, inside }
  }).sort((a, b) => Number(!!b.centre) - Number(!!a.centre) || (b.best?.goCount ?? -1) - (a.best?.goCount ?? -1) || (b.best?.bestScore ?? 0) - (a.best?.bestScore ?? 0))
}

/** The longest run of consecutive GO landing dates containing `at`, as [first, last] indexes, or null. */
export function goRun(perStart: boolean[], at: number): [number, number] | null {
  if (!perStart[at]) return null
  let a = at, b = at
  while (a > 0 && perStart[a - 1]) a--
  while (b < perStart.length - 1 && perStart[b + 1]) b++
  return [a, b]
}
