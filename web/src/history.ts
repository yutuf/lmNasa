// Real landings replayed through LunaNav's own engine. For five recent landings, the hourly Sun and Earth around the
// touchdown (history.json, scripts/build_history.py, same kernels as the main ephemeris) are run through the same
// horizon and sunlight code as the search, at the nearest whole-Moon grid point (about 30 km). The result, how long
// the Sun stays up and how much Earth is in view, is compared with what each mission actually did.
import { pointSky, type Atlas, type Ephem } from './engine'

export interface Landing {
  name: string; lat: number; lon: number; landingUnix: number; firstUnix: number; hours: number; workedDays: number
  outcome: { en: string; tr: string }
  sun: [number[], number[], number[]]; earth: [number[], number[], number[]]; sunR: number[]; dsn: number[]
}

export interface Replay {
  l: Landing
  index: number                 // nearest grid point
  distKm: number                // how far that point is from the real site
  sun: Float64Array             // sunlit fraction per hour, from 24 h before touchdown
  earth: boolean[]              // Earth above the terrain horizon (no DSN requirement) per hour
  sunAtLanding: number          // 0..1
  litDays: number               // days of sunlight after touchdown until the Sun sets (sunlit share < 50 % for 3 h)
  earthPct: number              // share of the worked days with Earth in view
}

const R = 1737.4
const gc = (la1: number, lo1: number, la2: number, lo2: number) => {
  const r = Math.PI / 180
  const c = Math.sin(la1 * r) * Math.sin(la2 * r) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.cos((lo1 - lo2) * r)
  return R * Math.acos(Math.min(1, Math.max(-1, c)))
}

export function replay(atlas: Atlas, l: Landing): Replay {
  let index = 0, best = Infinity
  for (let i = 0; i < atlas.n; i++) {
    const d = gc(l.lat, l.lon, atlas.lat[i], atlas.lon[i])
    if (d < best) { best = d; index = i }
  }
  const f = (a: number[]) => Float32Array.from(a)
  const eph: Ephem = { n: l.hours, sun: [f(l.sun[0]), f(l.sun[1]), f(l.sun[2])], earth: [f(l.earth[0]), f(l.earth[1]), f(l.earth[2])], sunR: f(l.sunR) } as Ephem
  const sky = pointSky(atlas, eph, l.dsn.map((x) => x === 1), index, 0, l.hours, false)
  const k0 = Math.round((l.landingUnix - l.firstUnix) / 3600)
  let litH = 0, dark = 0
  for (let k = k0; k < l.hours; k++) {
    if (sky.sunFraction[k] < 0.5) { if (++dark >= 3) break } else { dark = 0; litH = k - k0 + 1 }
  }
  const workH = Math.min(l.hours - k0, Math.max(24, l.workedDays * 24))
  let e = 0
  for (let k = k0; k < k0 + workH; k++) if (sky.earthVisible[k]) e++
  return { l, index, distKm: best, sun: sky.sunFraction, earth: sky.earthVisible, sunAtLanding: sky.sunFraction[k0], litDays: litH / 24, earthPct: Math.round((e / workH) * 100) }
}
