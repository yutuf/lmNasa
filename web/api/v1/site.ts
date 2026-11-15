// GET /api/v1/site — one point, every landing day, the best day.
import { evaluateWindow, type Constraints } from '../../src/model.js'
import { pointSky, pointTrack, searchPoint, zoneSlopeAt, type Atlas, type Search } from '../../src/engine.js'
import { nearestPoint, pickAtlas } from '../../src/pinSite.js'
import {
  constraintView, constraintsOf, firstHourAt, fitWindow, flag, handle, HttpError, isoDate, isoHour, LIMITS,
  loadCatalog, missionFrom, percent, pointView, readQuery, reasonDetail, requiredNumber, roundTo, SOURCE_NAMES,
  type Catalog, type Mission,
} from './_lib.js'

const KEYS = ['lat', 'lon', 'start', 'days', 'window', 'sun', 'earth', 'shadow', 'batt', 'slope', 'zone', 'zslope', 'dsn', 'series']

export interface Reason { kind: string; detail: string }

export interface LandingDay {
  date: string
  sun_pct: number
  earth_pct: number
  longest_dark_h: number
  go: boolean
  score: number
  reasons: Reason[]
}

interface Terrain {
  slope_deg: number
  slope_limit_deg: number
  slope_ok: boolean
  zone_m: number
  zone_slope_deg: number | null
  zone_limit_deg: number
  zone_ok: boolean
  ok: boolean
  note: string | null
  reasons: Reason[]
}

function terrainAt(atlas: Atlas, cat: Catalog, index: number, mission: Mission, grid: 'pole' | 'moon'): Terrain {
  const slope = atlas.slope[index]
  const slopeOk = slope <= mission.slope
  const reasons: Reason[] = []
  if (!slopeOk) reasons.push({ kind: 'slope', detail: `slope ${roundTo(slope, 2)}° is over the ${mission.slope}° limit` })
  let zoneSlope: number | null = null
  let zoneOk = true
  let note: string | null = null
  if (grid === 'moon') {
    note = 'The touchdown-zone check exists on the south-pole grid only. This point is on the whole-Moon grid, about 30 km between points.'
  } else if (mission.zone > 0) {
    const z = zoneSlopeAt(cat.hazard, mission.zone, index)
    zoneSlope = z === null ? null : roundTo(z, 2)
    if (z !== null && z > mission.zslope) {
      zoneOk = false
      reasons.push({ kind: 'zone', detail: `landing-zone slope ${roundTo(z, 2)}° inside ${mission.zone} m is over the ${mission.zslope}° limit` })
    }
  }
  return {
    slope_deg: roundTo(slope, 2),
    slope_limit_deg: mission.slope,
    slope_ok: slopeOk,
    zone_m: grid === 'pole' ? mission.zone : 0,
    zone_slope_deg: zoneSlope,
    zone_limit_deg: mission.zslope,
    zone_ok: zoneOk,
    ok: slopeOk && zoneOk,
    note,
    reasons,
  }
}

function landingDay(date: string, sun: ArrayLike<number>, earth: boolean[], c: Constraints, terrain: Terrain): LandingDay {
  const w = evaluateWindow(sun, earth, 1, c)
  const reasons = [
    ...w.reasons.map((r) => ({ kind: r.kind, detail: reasonDetail(r.kind, r.value, c) })),
    ...terrain.reasons,
  ]
  return {
    date,
    sun_pct: percent(w.sunFrac),
    earth_pct: percent(w.commFrac),
    longest_dark_h: w.longestDarkH,
    go: w.go && terrain.ok,
    score: w.score,
    reasons,
  }
}

export async function siteReport(params: URLSearchParams) {
  const mission = missionFrom(params)
  const wantSeries = flag(params, 'series', false)
  const lat = requiredNumber(params, 'lat', -90, 90)
  const lon = requiredNumber(params, 'lon', -360, 360)
  const cat = await loadCatalog()
  const grid = pickAtlas(lat)
  const atlas = grid === 'pole' ? cat.pole : cat.moon()
  const nearest = nearestPoint(atlas, lat, lon)
  if (nearest.index < 0) throw new HttpError(400, 'No grid point covers that location.')
  const fh = firstHourAt(cat.startUnix, mission.startMs)
  const fitted = fitWindow(cat, fh, mission.days, mission.windowDays)
  const c = constraintsOf(cat, mission)
  const durationH = mission.days * 24
  const q: Search = {
    firstHour: fh,
    nStarts: fitted.starts,
    strideH: 24,
    durationH,
    maxSlope: mission.slope,
    needDsn: mission.dsn,
    zone: grid === 'pole' ? mission.zone : 0,
    zoneSlope: mission.zslope,
  }
  const found = searchPoint(atlas, cat.ephem, cat.dsn, nearest.index, q, c)
  const sky = pointSky(atlas, cat.ephem, cat.dsn, nearest.index, fh, (fitted.starts - 1) * 24 + durationH, mission.dsn)
  const terrain = terrainAt(atlas, cat, nearest.index, mission, grid)
  const landings: LandingDay[] = []
  for (let s = 0; s < fitted.starts; s++) {
    const a = s * 24
    landings.push(landingDay(
      isoDate(cat.startUnix + (fh + s * 24) * 3600),
      sky.sunFraction.subarray(a, a + durationH),
      sky.earthVisible.slice(a, a + durationH),
      c,
      terrain,
    ))
  }
  const best = landings[found.bestStart]
  if (!best) throw new HttpError(500, 'The request could not be completed.')
  const series = wantSeries ? seriesFor(cat, atlas, nearest.index, fh + found.bestStart * 24, durationH) : null
  return {
    limits: LIMITS,
    sources: SOURCE_NAMES,
    asked: { lat, lon },
    grid,
    spacing_km: roundTo(atlas.spacingM / 1000, 3),
    point: pointView(atlas, nearest.index, nearest.distKm),
    terrain: {
      slope_deg: terrain.slope_deg,
      slope_limit_deg: terrain.slope_limit_deg,
      slope_ok: terrain.slope_ok,
      zone_m: terrain.zone_m,
      zone_slope_deg: terrain.zone_slope_deg,
      zone_limit_deg: terrain.zone_limit_deg,
      zone_ok: terrain.zone_ok,
      ok: terrain.ok,
      note: terrain.note,
    },
    start: mission.start,
    stay_days: mission.days,
    window_requested: mission.windowDays,
    window_days: fitted.starts,
    window_note: fitted.note,
    constraints: constraintView(mission),
    go_dates: landings.filter((d) => d.go).length,
    landings,
    best,
    series,
  }
}

function seriesFor(cat: Catalog, atlas: Atlas, index: number, firstHour: number, hours: number) {
  const track = pointTrack(atlas, cat.ephem, cat.dsn, index, firstHour, hours)
  return {
    start: isoHour(cat.startUnix + firstHour * 3600),
    hours,
    sun_disc: Array.from(track.sunFraction, (v) => roundTo(v, 4)),
    sun_alt: Array.from(track.sunAlt, (v) => roundTo(v, 3)),
    earth_alt: Array.from(track.earthAlt, (v) => roundTo(v, 3)),
    dsn: Array.from({ length: hours }, (_, k) => cat.dsn[firstHour + k] === true),
  }
}

export default handle((req) => siteReport(readQuery(req, KEYS)))
