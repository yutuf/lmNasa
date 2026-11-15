import { beforeAll, describe, expect, it } from 'vitest'
import { passesTerrain, pointSky, pointTrack, searchPoint, zoneSlopeAt, type Search } from '../../src/engine.js'
import { keepOut } from '../../src/landed.js'
import { evaluateWindow } from '../../src/model.js'
import { nearestPoint, pickAtlas } from '../../src/pinSite.js'
import { rankTop } from '../../src/scenarios.js'
import {
  constraintsOf, firstHourAt, fitWindow, isoDate, loadCatalog, missionFrom, percent, roundTo,
} from './_lib.js'
import indexHandler, { INDEX } from './index.js'
import siteHandler, { siteReport } from './site.js'
import searchHandler, { capReason, chooseWindow, searchReport } from './search.js'
import skyHandler, { clampHours, readHours, skyReport } from './sky.js'

beforeAll(async () => { await loadCatalog() }, 60_000)

function fake() {
  let status = 0
  const headers: Record<string, string> = {}
  let body: unknown
  let ended = false
  const res = {
    status: (c: number) => { status = c; return res },
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v },
    json: (b: unknown) => { body = b },
    end: () => { ended = true },
  }
  return { res, read: () => ({ status, headers, body, ended }) }
}

async function call(handler: (req: { method?: string; url?: string }, res: ReturnType<typeof fake>['res']) => Promise<void>, url: string, method = 'GET') {
  const box = fake()
  await handler({ method, url }, box.res)
  return box.read()
}

const OPEN = 'start=2027-09-01&days=14&window=3&slope=90&zone=0'
const POINTS = [
  { name: 'south-pole grid near 222.7°', lat: -89.45, lon: 222.7 },
  { name: 'south-pole grid at longitude 0', lat: -86, lon: 0 },
  { name: 'south-pole grid near de Gerlache', lat: -88.5, lon: -90 },
  { name: 'whole-Moon grid at Apollo 11', lat: 0.67408, lon: 23.47297 },
]

describe('/api/v1 index', () => {
  it('names every route, the three sources, and the planning limit', async () => {
    expect(INDEX.limits.toLowerCase()).toContain('a planning tool, not a landing certification')
    expect(INDEX.sources.map((s) => s.name).join(' ')).toContain('LOLA')
    expect(INDEX.sources.map((s) => s.name).join(' ')).toContain('DE421')
    expect(INDEX.sources.map((s) => s.name).join(' ')).toContain('DSN')
    expect(INDEX.endpoints.map((e) => e.path)).toEqual(['/api/v1', '/api/v1/site', '/api/v1/search', '/api/v1/sky'])
    expect(INDEX.endpoints.map((e) => e.example)).toEqual([
      '/api/v1',
      '/api/v1/site?lat=-89.45&lon=222.7&start=2027-09-01&days=14',
      '/api/v1/search?start=2027-09-01&window=30&days=14&top=10',
      '/api/v1/sky?lat=-89.45&lon=222.7&from=2027-09-01T00:00Z&hours=72',
    ])
    const got = await call(indexHandler, '/api/v1')
    expect(got.status).toBe(200)
    expect(got.body).toEqual(INDEX)
    expect(got.headers['access-control-allow-origin']).toBe('*')
    expect(got.headers['cache-control']).toBe('public, max-age=3600')
  })

  it('rejects a query it does not understand', async () => {
    const got = await call(indexHandler, '/api/v1?foo=1')
    expect(got.status).toBe(400)
    expect(got.body).toEqual({ error: 'Unknown parameter "foo".' })
  })
})

describe('parameter checks', () => {
  it('rejects a bad site query with a clear message', async () => {
    expect((await call(siteHandler, '/api/v1/site?lat=0&lon=0&foo=1')).status).toBe(400)
    expect((await call(siteHandler, '/api/v1/site?lon=0')).body).toEqual({ error: '"lat" is required.' })
    expect((await call(siteHandler, '/api/v1/site?lat=91&lon=0')).body).toEqual({ error: '"lat" must be between -90 and 90.' })
    expect((await call(siteHandler, '/api/v1/site?lat=-89&lon=1e2')).body).toEqual({ error: '"lon" must be a number.' })
    expect((await call(siteHandler, '/api/v1/site?lat=-89&lon=0&start=2027-02-31')).body).toEqual({ error: '"start" is not a real calendar date.' })
    expect((await call(siteHandler, '/api/v1/site?lat=-89&lon=0&series=2')).body).toEqual({ error: '"series" must be 0 or 1.' })
    expect((await call(siteHandler, '/api/v1/site?lat=-89&lon=0&zone=300')).body).toEqual({ error: '"zone" must be one of 0, 100, 250, 500, 1000.' })
    const post = await call(siteHandler, '/api/v1/site?lat=-89&lon=0', 'POST')
    expect(post.status).toBe(405)
    expect(post.body).toEqual({ error: 'GET only' })
    expect(post.headers['cache-control']).toBe('public, max-age=3600')
    const opt = await call(siteHandler, '/api/v1/site', 'OPTIONS')
    expect(opt.status).toBe(204)
    expect(opt.ended).toBe(true)
  })

  it('rejects a sky hour that is not a whole UTC hour', async () => {
    expect(readHours(null)).toBe(72)
    expect(() => readHours('0')).toThrow('"hours" must be at least 1.')
    expect(() => readHours('1.5')).toThrow('"hours" must be an integer.')
    expect(clampHours(800, 5000)).toEqual({ hours: 720, capped: true, cap_reason: 'hours is capped at 720.' })
    expect(clampHours(100, 40).hours).toBe(40)
    const half = await call(skyHandler, '/api/v1/sky?lat=-89&lon=0&from=2027-09-01T00:30Z')
    expect(half.status).toBe(400)
    expect(half.body).toEqual({ error: '"from" must be a whole UTC hour, such as 2027-09-01T00:00Z.' })
    const early = await call(skyHandler, '/api/v1/sky?lat=-89&lon=0&from=2020-01-01T00:00Z')
    expect(early.status).toBe(400)
    expect(String((early.body as { error: string }).error)).toContain('before the catalogue')
  })

  it('rejects a search window outside 1 to 90', async () => {
    const got = await call(searchHandler, '/api/v1/search?window=0')
    expect(got.status).toBe(400)
    expect(got.body).toEqual({ error: '"window" must be between 1 and 90.' })
  })
})

describe('site matches the engine', () => {
  it.each(POINTS)('$name', async ({ lat, lon }) => {
    const params = new URLSearchParams(`${OPEN}&lat=${lat}&lon=${lon}`)
    const body = await siteReport(params)
    const cat = await loadCatalog()
    const mission = missionFrom(params)
    const grid = pickAtlas(lat)
    const atlas = grid === 'pole' ? cat.pole : cat.moon()
    const nearest = nearestPoint(atlas, lat, lon)
    const fh = firstHourAt(cat.startUnix, mission.startMs)
    const fitted = fitWindow(cat, fh, mission.days, mission.windowDays)
    const c = constraintsOf(cat, mission)
    const q: Search = {
      firstHour: fh, nStarts: fitted.starts, strideH: 24, durationH: mission.days * 24,
      maxSlope: mission.slope, needDsn: mission.dsn, zone: grid === 'pole' ? mission.zone : 0, zoneSlope: mission.zslope,
    }
    const found = searchPoint(atlas, cat.ephem, cat.dsn, nearest.index, q, c)
    const sky = pointSky(atlas, cat.ephem, cat.dsn, nearest.index, fh, (fitted.starts - 1) * 24 + q.durationH, mission.dsn)
    expect(body.grid).toBe(grid)
    expect(body.point.index).toBe(nearest.index)
    expect(body.point.distance_km).toBe(roundTo(nearest.distKm, 3))
    expect(body.terrain.ok).toBe(true)
    expect(body.go_dates).toBe(found.goCount)
    expect(body.best.score).toBe(found.bestScore)
    expect(body.best.longest_dark_h).toBe(found.longestDarkH)
    expect(body.best.go).toBe(found.bestGo)
    expect(body.best.sun_pct).toBe(percent(found.sunFrac))
    expect(body.best.earth_pct).toBe(percent(found.commFrac))
    expect(body.best.date).toBe(isoDate(cat.startUnix + (fh + found.bestStart * 24) * 3600))
    expect(body.landings).toHaveLength(fitted.starts)
    body.landings.forEach((day, s) => {
      const a = s * 24
      const w = evaluateWindow(sky.sunFraction.subarray(a, a + q.durationH), sky.earthVisible.slice(a, a + q.durationH), 1, c)
      expect(day.sun_pct).toBe(percent(w.sunFrac))
      expect(day.earth_pct).toBe(percent(w.commFrac))
      expect(day.longest_dark_h).toBe(w.longestDarkH)
      expect(day.score).toBe(w.score)
      expect(day.go).toBe(w.go)
    })
  })

  it('uses the app defaults, and a steep cell is NO-GO even when the sky passes', async () => {
    const params = new URLSearchParams('lat=-89.45&lon=222.7&start=2027-09-01&days=14&window=2')
    const body = await siteReport(params)
    const cat = await loadCatalog()
    const mission = missionFrom(params)
    expect(mission.sun).toBe(70)
    expect(mission.earth).toBe(50)
    expect(mission.shadow).toBe(48)
    expect(mission.batt).toBe(2000)
    expect(mission.slope).toBe(8)
    expect(mission.zone).toBe(1000)
    const c = constraintsOf(cat, mission)
    const fh = firstHourAt(cat.startUnix, mission.startMs)
    const sky = pointSky(cat.pole, cat.ephem, cat.dsn, body.point.index, fh, 24 + mission.days * 24, true)
    const w = evaluateWindow(sky.sunFraction.subarray(0, mission.days * 24), sky.earthVisible.slice(0, mission.days * 24), 1, c)
    const z = zoneSlopeAt(cat.hazard, mission.zone, body.point.index)
    const terrainOk = cat.pole.slope[body.point.index] <= mission.slope && (z === null || z <= mission.zslope)
    expect(body.landings[0].sun_pct).toBe(percent(w.sunFrac))
    expect(body.landings[0].score).toBe(w.score)
    expect(body.landings[0].longest_dark_h).toBe(w.longestDarkH)
    expect(body.landings[0].go).toBe(w.go && terrainOk)
    expect(body.constraints).toEqual({ sun_pct: 70, earth_pct: 50, max_dark_h: 48, battery_wh: 2000, slope_deg: 8, zone_m: 1000, zone_slope_deg: 12, dsn: true })
  })

  it('adds the best stay, hour by hour, when series=1', async () => {
    const body = await siteReport(new URLSearchParams('lat=-89.45&lon=222.7&start=2027-09-01&days=2&window=1&slope=90&zone=0&series=1'))
    expect(body.series).not.toBeNull()
    expect(body.series!.hours).toBe(48)
    expect(body.series!.sun_disc).toHaveLength(48)
    expect(body.series!.sun_alt).toHaveLength(48)
    expect(body.series!.earth_alt).toHaveLength(48)
    expect(body.series!.dsn).toHaveLength(48)
    const cat = await loadCatalog()
    const fh = firstHourAt(cat.startUnix, Date.parse('2027-09-01T00:00:00Z'))
    const track = pointTrack(cat.pole, cat.ephem, cat.dsn, body.point.index, fh, 48)
    expect(body.series!.sun_disc[0]).toBe(roundTo(track.sunFraction[0], 4))
    expect(body.series!.sun_alt[0]).toBe(roundTo(track.sunAlt[0], 3))
    expect(body.series!.earth_alt[0]).toBe(roundTo(track.earthAlt[0], 3))
    expect(body.series!.dsn[0]).toBe(cat.dsn[fh] === true)
  })
})

describe('search', () => {
  it('cuts a window that would pass about 8 s, and keeps one day when nothing shorter exists', () => {
    const wide = chooseWindow(30, 1000, 336, 0.01, 7000)
    expect(wide).toEqual({ used: 16, capped: true, estimateMs: 10320 })
    expect(capReason(30, wide.used, wide.estimateMs)).toBe('A window of 30 landing days would take about 10 s on this server, past the about 8 s limit, so it was cut to 16.')
    const fits = chooseWindow(30, 10, 336, 0.001, 7000)
    expect(fits.capped).toBe(false)
    expect(fits.used).toBe(30)
    const one = chooseWindow(1, 100000, 336, 1, 7000)
    expect(one).toMatchObject({ used: 1, capped: true })
    expect(capReason(1, 1, one.estimateMs)).toContain('still run')
    expect(capReason(1, 1, one.estimateMs)).toContain('about 8 s')
  })

  it('ranks a one-day south-pole search the same way the app does', async () => {
    const params = new URLSearchParams('start=2027-09-01&window=1&days=1&top=3&slope=8&zone=1000')
    const body = await searchReport(params)
    expect(body.capped).toBe(false)
    expect(body.window_days).toBe(1)
    expect(body.points_on_grid).toBeGreaterThan(20000)
    expect(body.sites.length).toBeGreaterThan(0)
    expect(body.sites.length).toBeLessThanOrEqual(3)
    expect(body.elapsed_ms).toBeGreaterThan(0)
    const cat = await loadCatalog()
    const mission = missionFrom(params)
    const fh = firstHourAt(cat.startUnix, mission.startMs)
    const c = constraintsOf(cat, mission)
    const q: Search = {
      firstHour: fh, nStarts: body.window_days, strideH: 24, durationH: mission.days * 24,
      maxSlope: mission.slope, needDsn: mission.dsn, zone: mission.zone, zoneSlope: mission.zslope,
    }
    const ids: number[] = []
    for (let i = 0; i < cat.pole.n; i++) {
      if (!passesTerrain(cat.pole, cat.hazard, i, q) || keepOut(cat.pole.lat[i], cat.pole.lon[i])) continue
      ids.push(i)
    }
    const results = ids.map((id) => searchPoint(cat.pole, cat.ephem, cat.dsn, id, q, c))
    const picks = rankTop(results, cat.pole, 3, 6)
    expect(body.sites.map((s) => s.index)).toEqual(picks.map((p) => p.index))
    const hit = picks[0]
    expect(body.sites[0].go_dates).toBe(hit.goCount)
    expect(body.sites[0].score).toBe(hit.bestScore)
    expect(body.sites[0].sun_pct).toBe(percent(hit.sunFrac))
    expect(body.sites[0].earth_pct).toBe(percent(hit.commFrac))
    expect(body.sites[0].longest_dark_h).toBe(hit.longestDarkH)
    expect(body.sites[0].best_date).toBe(isoDate(cat.startUnix + (fh + hit.bestStart * 24) * 3600))
    expect(body.sites[0].lat).toBe(hit.lat)
    expect(body.sites[0].lon).toBe(hit.lon)
  }, 60_000)
})

describe('sky matches the engine', () => {
  it('returns the same altitudes, disc fraction and DSN flag', async () => {
    const params = new URLSearchParams('lat=-89.45&lon=222.7&from=2027-09-01T00:00Z&hours=3')
    const body = await skyReport(params)
    const cat = await loadCatalog()
    const nearest = nearestPoint(cat.pole, -89.45, 222.7)
    const fh = firstHourAt(cat.startUnix, Date.parse('2027-09-01T00:00:00Z'))
    const track = pointTrack(cat.pole, cat.ephem, cat.dsn, nearest.index, fh, 3)
    expect(body.hours).toBe(3)
    expect(body.capped).toBe(false)
    expect(body.horizon_deg).toHaveLength(360)
    expect(body.horizon_deg[0]).toBe(roundTo(track.horizon[0], 2))
    expect(body.hourly).toHaveLength(3)
    body.hourly.forEach((row, k) => {
      expect(row.sun_alt).toBe(roundTo(track.sunAlt[k], 3))
      expect(row.sun_az).toBe(roundTo(track.sunAz[k], 3))
      expect(row.sun_disc).toBe(roundTo(track.sunFraction[k], 4))
      expect(row.earth_alt).toBe(roundTo(track.earthAlt[k], 3))
      expect(row.earth_az).toBe(roundTo(track.earthAz[k], 3))
      expect(row.earth_up).toBe(track.earthVisible[k])
      expect(row.dsn).toBe(cat.dsn[fh + k] === true)
    })
  })

  it('caps hours at 720', async () => {
    const body = await skyReport(new URLSearchParams('lat=-86&lon=10&from=2027-09-01T00:00:00Z&hours=721'))
    expect(body.hours).toBe(720)
    expect(body.hours_requested).toBe(721)
    expect(body.capped).toBe(true)
    expect(body.cap_reason).toContain('720')
    expect(body.hourly).toHaveLength(720)
  })
})
