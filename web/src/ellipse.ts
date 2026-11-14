// Worst case inside the landing ellipse. A lander does not touch down on the exact point; with standard navigation it
// lands anywhere within about a kilometre or two. Near the south pole the terrain changes over that distance, so the
// same landing date is evaluated at every grid point within the ellipse (the 2 km grid: the site and its neighbours)
// and the worst sunlight, Earth contact, darkness and slope are reported, with how many points still pass.
import { pointSky, type Atlas, type Ephem } from './engine'
import { evaluateWindow, type Constraints } from './model'

export interface EllipseCheck {
  radiusKm: number
  points: number          // grid points inside the ellipse, the site included
  go: number              // of those, how many pass the mission on the same landing date
  worstSun: number        // % of the mission with sunlight, worst point
  worstEarth: number      // % with contact with Earth, worst point
  worstDarkH: number      // longest dark spell (h), worst point
  worstSlope: number      // steepest point slope (deg)
}

/** Evaluate the landing date (`startDay` days after `firstHour`) at every polar grid point within `radiusKm`. */
export function ellipseCheck(atlas: Atlas, eph: Ephem, dsn: ArrayLike<boolean>, index: number, firstHour: number,
                             startDay: number, days: number, needDsn: boolean, c: Constraints, radiusKm = 2.1, relay = false): EllipseCheck | null {
  if (atlas.kind !== 'pole') return null              // the whole-Moon grid is 30 km apart: no points inside an ellipse
  const x0 = atlas.xKm[index], y0 = atlas.yKm[index]
  const near: number[] = []
  for (let i = 0; i < atlas.n; i++) {
    if (Math.abs(atlas.xKm[i] - x0) > radiusKm || Math.abs(atlas.yKm[i] - y0) > radiusKm) continue
    if (Math.hypot(atlas.xKm[i] - x0, atlas.yKm[i] - y0) <= radiusKm) near.push(i)
  }
  const h0 = firstHour + startDay * 24, len = days * 24
  if (h0 + len >= eph.n) return null
  const out: EllipseCheck = { radiusKm, points: near.length, go: 0, worstSun: 100, worstEarth: 100, worstDarkH: 0, worstSlope: 0 }
  for (const i of near) {
    const sky = pointSky(atlas, eph, dsn, i, h0, len, needDsn, relay)
    const w = evaluateWindow(sky.sunFraction, sky.earthVisible, 1, c)
    if (w.go) out.go++
    out.worstSun = Math.min(out.worstSun, Math.round(w.sunFrac * 100))
    out.worstEarth = Math.min(out.worstEarth, Math.round(w.commFrac * 100))
    out.worstDarkH = Math.max(out.worstDarkH, w.longestDarkH)
    out.worstSlope = Math.max(out.worstSlope, atlas.slope[i])
  }
  return out
}
