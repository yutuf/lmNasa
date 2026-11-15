// Real landings replayed through Touchdown's own engine. For five recent landings, the hourly Sun and Earth around the
// touchdown (history.json, scripts/build_history.py, same kernels as the main ephemeris) are run through the same
// horizon and sunlight code as the search, at the nearest whole-Moon grid point (about 30 km). The result, how long
// the Sun stays up and how much Earth is in view, is compared with what each mission actually did.
import { pointSky, type Atlas, type Ephem } from './engine'
import { simulateBattery, type Constraints } from './model'

// Power for the operations prediction: the app's default solar lander (400 W array, 150 W load, 95 % charge and
// discharge, battery floor 20 %), with each mission's battery from the app's lander list where it has one.
// These are class defaults, not the missions' published figures.
const OPS_BASE: Constraints = { duration_days: 14, min_sun_frac: 0.7, min_comm_frac: 0.5, max_dark_hours: 48, array_peak_w: 400,
  load_w: 150, battery_wh: 2000, initial_soc: 1, charge_eff: 0.95, discharge_eff: 0.95, min_soc: 0.2, weights: [0.4, 0.3, 0.3] }
const OPS_BATTERY_WH: Record<string, number> = { 'Chandrayaan-3': 1500, 'IM-1 Odysseus': 2000, 'Blue Ghost 1': 2500 }

/** Predicted end of operations, in days after touchdown: the panels charge from the visible Sun, the load runs all the
 *  time, and operations end when the battery reaches its floor (the same battery model as the search). null: still
 *  powered when the series ends. */
export function operatingDays(sunFraction: ArrayLike<number>, from: number, c: Constraints): number | null {
  const run = simulateBattery(Float64Array.from({ length: Math.max(0, sunFraction.length - from) }, (_, k) => sunFraction[from + k]), 1, c)
  return run.firstFailure === null ? null : run.firstFailure / 24
}

export interface Landing {
  name: string; lat: number; lon: number; landingUnix: number; firstUnix: number; hours: number; workedDays: number
  outcome: { en: string; tr: string }
  endUnix?: number; endSource?: string   // when operations really ended, where a public time exists
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
  opsDays: number | null        // predicted end of operations: battery floor reached after the Sun sets
  realDays: number              // when operations really ended (exact where public, else the whole days it worked)
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
  const opsDays = operatingDays(sky.sunFraction, k0, { ...OPS_BASE, battery_wh: OPS_BATTERY_WH[l.name] ?? OPS_BASE.battery_wh })
  return { l, index, distKm: best, sun: sky.sunFraction, earth: sky.earthVisible, sunAtLanding: sky.sunFraction[k0], litDays: litH / 24, earthPct: Math.round((e / workH) * 100), opsDays,
    realDays: l.endUnix ? (l.endUnix - l.landingUnix) / 86400 : l.workedDays }
}
