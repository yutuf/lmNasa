// Two "what if" views for one site, computed on demand on the site page:
//  - antenna / solar-panel mast height: raising the eye lowers the terrain horizon a little (the near ridges drop
//    away), which can turn grazing sunlight and a low Earth into usable hours. The horizon is ray-marched from the
//    200 m polar terrain with and without the mast; the difference is applied to the site's atlas horizon.
//  - the mission calendar: every landing day from 2026 to 2045 at this site, GO or not.
import { pointSky, type Atlas, type Ephem } from './engine'
import { evaluateWindow, type Constraints } from './model'
import { dataUrl } from './data'
import { heightAt, horizonElev, parseDem, type Dem } from './terrain'

let demP: Promise<Dem> | null = null
const loadDem = () => (demP ??= fetch(dataUrl('pole_dem.bin')).then((r) => r.arrayBuffer()).then(parseDem))

export interface MastResult { mastM: number; sunPct: number; earthPct: number; darkH: number; go: boolean; lowerDeg: number }

/** The mission on its best landing date with the eye raised `mastM` metres (south-pole sites only). */
export async function mastEffect(atlas: Atlas, eph: Ephem, dsn: ArrayLike<boolean>, index: number, firstHour: number, startDay: number,
  days: number, needDsn: boolean, relay: boolean, c: Constraints, mastM: number): Promise<MastResult | null> {
  if (atlas.kind !== 'pole') return null
  const dem = await loadDem()
  const h = (x: number, y: number) => heightAt(dem, x, y)
  const x = atlas.xKm[index] * 1000, y = atlas.yKm[index] * 1000, lon = atlas.lon[index]
  const nAz = atlas.nAz, off = index * nAz
  // a copy of the atlas whose horizon at this one point is lowered by the mast
  const horizon = atlas.horizon.slice()
  let lower = 0
  for (let a = 0; a < nAz; a++) {
    const az = (a * 360) / nAz
    const d = horizonElev(h, x, y, lon, az, mastM + 1, 40000) - horizonElev(h, x, y, lon, az, 1, 40000)   // <= 0
    lower = Math.min(lower, d)
    horizon[off + a] = Math.max(0, Math.min(255, Math.round(horizon[off + a] + d * 10)))   // stored as (deg + 8) * 10
  }
  const sky = pointSky({ ...atlas, horizon }, eph, dsn, index, firstHour + startDay * 24, days * 24, needDsn, relay)
  const w = evaluateWindow(sky.sunFraction, sky.earthVisible, 1, c)
  return { mastM, sunPct: Math.round(w.sunFrac * 100), earthPct: Math.round(w.commFrac * 100), darkH: w.longestDarkH, go: w.go, lowerDeg: -lower }
}

/** GO (1) or not (0) for every landing day from the start of the ephemeris to its end, at one site. */
export function missionCalendar(atlas: Atlas, eph: Ephem, dsn: ArrayLike<boolean>, index: number, days: number,
  needDsn: boolean, relay: boolean, c: Constraints): Uint8Array {
  const len = days * 24
  const hours = eph.n - 1
  const sky = pointSky(atlas, eph, dsn, index, 0, hours, needDsn, relay)
  const nDays = Math.floor((hours - len) / 24)
  const out = new Uint8Array(Math.max(0, nDays))
  for (let d = 0; d < nDays; d++) {
    const a = d * 24
    out[d] = evaluateWindow(sky.sunFraction.subarray(a, a + len), sky.earthVisible.slice(a, a + len), 1, c).go ? 1 : 0
  }
  return out
}
