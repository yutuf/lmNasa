// GET /api/v1/search — the web app's south-pole search, on one thread, inside a function's time budget.
import { passesTerrain, searchPoint, type PointResult, type Search } from '../../src/engine.js'
import { keepOut } from '../../src/landed.js'
import type { Constraints } from '../../src/model.js'
import { rankTop } from '../../src/scenarios.js'
import {
  constraintView, constraintsOf, east360, firstHourAt, fitWindow, handle, isoDate, LIMITS, loadCatalog,
  missionFrom, optionalInt, percent, readQuery, roundTo, SOURCE_NAMES, type Catalog,
} from './_lib.js'

const KEYS = ['start', 'days', 'window', 'top', 'sun', 'earth', 'shadow', 'batt', 'slope', 'zone', 'zslope', 'dsn']

/** Leave headroom under a 10 s function limit for reading the catalogue and writing the JSON. */
export const SEARCH_BUDGET_MS = 7000

const SEPARATED_KM = 6

export function hoursFor(starts: number, stayH: number): number {
  return (starts - 1) * 24 + stayH
}

/** Shorten a landing window until `points` of them fit in the time budget. One day still runs if it does not fit. */
export function chooseWindow(requested: number, points: number, stayH: number, msPerPointHour: number, budgetMs: number): { used: number; capped: boolean; estimateMs: number } {
  const estimate = (starts: number) => points * hoursFor(starts, stayH) * msPerPointHour
  const full = estimate(requested)
  if (points <= 0 || !(msPerPointHour > 0) || full <= budgetMs) {
    return { used: requested, capped: false, estimateMs: Math.round(full) }
  }
  let used = 1
  for (let s = requested - 1; s >= 1; s--) {
    if (estimate(s) <= budgetMs) { used = s; break }
  }
  return { used, capped: true, estimateMs: Math.round(full) }
}

export function capReason(fromDays: number, toDays: number, estimateMs: number): string {
  const sec = Math.max(8, Math.round(estimateMs / 1000))
  const noun = (n: number) => `${n} landing ${n === 1 ? 'day' : 'days'}`
  if (fromDays === toDays) {
    return `A window of ${noun(fromDays)} would take about ${sec} s on this server, past the about 8 s limit. It was still run, because a shorter window is not possible.`
  }
  return `A window of ${noun(fromDays)} would take about ${sec} s on this server, past the about 8 s limit, so it was cut to ${toDays}.`
}

let cachedRate: number | null = null

function pointHourRate(ids: number[], cat: Catalog, q: Search, c: Constraints, stayH: number): { rate: number; probeMs: number } {
  if (cachedRate !== null) return { rate: cachedRate, probeMs: 0 }
  if (ids.length === 0 || stayH <= 0) return { rate: 0, probeMs: 0 }
  const q1: Search = { ...q, nStarts: 1 }
  const t0 = performance.now()
  let probed = 0
  for (const id of ids) {
    searchPoint(cat.pole, cat.ephem, cat.dsn, id, q1, c)
    probed++
    const elapsed = performance.now() - t0
    if (probed >= 32 && elapsed >= 40) break
    if (probed >= 250) break
  }
  const probeMs = performance.now() - t0
  const rate = (probeMs / (probed * stayH)) * 1.15
  if (probeMs >= 15) cachedRate = rate
  return { rate, probeMs }
}

export async function searchReport(params: URLSearchParams) {
  const mission = missionFrom(params)
  const top = optionalInt(params, 'top', 10, 1, 50)
  const cat = await loadCatalog()
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
    zone: mission.zone,
    zoneSlope: mission.zslope,
  }
  const ids: number[] = []
  let excludedLanded = 0
  for (let i = 0; i < cat.pole.n; i++) {
    if (!passesTerrain(cat.pole, cat.hazard, i, q)) continue
    if (keepOut(cat.pole.lat[i], cat.pole.lon[i])) { excludedLanded++; continue }
    ids.push(i)
  }
  const t0 = performance.now()
  const probe = pointHourRate(ids, cat, q, c, durationH)
  const budget = Math.max(250, SEARCH_BUDGET_MS - probe.probeMs)
  const chosen = chooseWindow(fitted.starts, ids.length, durationH, probe.rate, budget)
  const scored: Search = { ...q, nStarts: chosen.used }
  const results: PointResult[] = []
  for (const id of ids) results.push(searchPoint(cat.pole, cat.ephem, cat.dsn, id, scored, c))
  const elapsed = Math.round(performance.now() - t0)
  const picks = rankTop(results, cat.pole, top, SEPARATED_KM)
  return {
    limits: LIMITS,
    sources: SOURCE_NAMES,
    grid: 'pole' as const,
    start: mission.start,
    stay_days: mission.days,
    window_requested: mission.windowDays,
    window_days: chosen.used,
    window_note: fitted.note,
    capped: chosen.capped,
    cap_reason: chosen.capped ? capReason(fitted.starts, chosen.used, chosen.estimateMs) : null,
    points_on_grid: cat.pole.n,
    points_scored: ids.length,
    excluded_landed: excludedLanded,
    separated_km: SEPARATED_KM,
    top,
    point_hours: ids.length * hoursFor(chosen.used, durationH),
    elapsed_ms: elapsed,
    constraints: constraintView(mission),
    sites: picks.map((r, k) => ({
      rank: k + 1,
      index: r.index,
      lat: r.lat,
      lon: r.lon,
      lon_360: east360(r.lon),
      go_dates: r.goCount,
      best_date: isoDate(cat.startUnix + (fh + r.bestStart * 24) * 3600),
      sun_pct: percent(r.sunFrac),
      earth_pct: percent(r.commFrac),
      longest_dark_h: r.longestDarkH,
      go: r.bestGo,
      score: r.bestScore,
      slope_deg: roundTo(cat.pole.slope[r.index], 2),
    })),
  }
}

export default handle((req) => searchReport(readQuery(req, KEYS)))
