// GET /api/v1/sky — hourly Sun and Earth at the nearest grid point.
import { pointTrack } from '../../src/engine.js'
import { nearestPoint, pickAtlas } from '../../src/pinSite.js'
import {
  catalogueEnd, firstHourAt, handle, HttpError, isoDate, isoHour, LIMITS, loadCatalog, parseHour, pointView,
  readQuery, requiredNumber, roundTo, SOURCE_NAMES,
} from './_lib.js'

const KEYS = ['lat', 'lon', 'from', 'hours']
const HOUR_CAP = 720
const DEFAULT_FROM = '2027-09-01T00:00Z'

export function readHours(raw: string | null): number {
  if (raw === null || raw.trim() === '') return 72
  if (!/^[+-]?\d+$/.test(raw.trim())) throw new HttpError(400, '"hours" must be an integer.')
  const n = Number(raw)
  if (n < 1) throw new HttpError(400, '"hours" must be at least 1.')
  return n
}

/** Cut an hour count to 720 and to the hours the catalogue still has. */
export function clampHours(asked: number, room: number): { hours: number; capped: boolean; cap_reason: string | null } {
  let hours = asked
  const notes: string[] = []
  if (hours > HOUR_CAP) {
    hours = HOUR_CAP
    notes.push('hours is capped at 720.')
  }
  if (hours > room) {
    hours = room
    notes.push(`Only ${room} ${room === 1 ? 'hour remains' : 'hours remain'} in the catalogue, so the request was cut.`)
  }
  return { hours, capped: notes.length > 0, cap_reason: notes.length ? notes.join(' ') : null }
}

export async function skyReport(params: URLSearchParams) {
  const lat = requiredNumber(params, 'lat', -90, 90)
  const lon = requiredNumber(params, 'lon', -360, 360)
  const fromText = params.get('from')
  const fromMs = fromText === null || fromText.trim() === '' ? Date.parse(DEFAULT_FROM) : parseHour(fromText)
  const asked = readHours(params.get('hours'))
  const cat = await loadCatalog()
  const fh = firstHourAt(cat.startUnix, fromMs)
  if (fh < 0) throw new HttpError(400, `from is before the catalogue begins (${isoDate(cat.startUnix)}).`)
  if (fh >= cat.ephem.n) throw new HttpError(400, `from is after the catalogue ends (${catalogueEnd(cat)}).`)
  const clamped = clampHours(asked, cat.ephem.n - fh)
  const grid = pickAtlas(lat)
  const atlas = grid === 'pole' ? cat.pole : cat.moon()
  const nearest = nearestPoint(atlas, lat, lon)
  if (nearest.index < 0) throw new HttpError(400, 'No grid point covers that location.')
  const track = pointTrack(atlas, cat.ephem, cat.dsn, nearest.index, fh, clamped.hours)
  const hourly = Array.from({ length: clamped.hours }, (_, k) => ({
    t: isoHour(cat.startUnix + (fh + k) * 3600),
    sun_alt: roundTo(track.sunAlt[k], 3),
    sun_az: roundTo(track.sunAz[k], 3),
    sun_disc: roundTo(track.sunFraction[k], 4),
    earth_alt: roundTo(track.earthAlt[k], 3),
    earth_az: roundTo(track.earthAz[k], 3),
    earth_up: track.earthVisible[k] === true,
    dsn: cat.dsn[fh + k] === true,
  }))
  return {
    limits: LIMITS,
    sources: SOURCE_NAMES,
    asked: { lat, lon },
    grid,
    spacing_km: roundTo(atlas.spacingM / 1000, 3),
    point: pointView(atlas, nearest.index, nearest.distKm),
    from: isoHour(cat.startUnix + fh * 3600),
    hours_requested: asked,
    hours: clamped.hours,
    capped: clamped.capped,
    cap_reason: clamped.cap_reason,
    horizon_deg: track.horizon.map((v) => roundTo(v, 2)),
    hourly,
  }
}

export default handle((req) => skyReport(readQuery(req, KEYS)))
