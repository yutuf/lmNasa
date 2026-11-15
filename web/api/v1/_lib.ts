// Shared pieces for /api/v1. The maths stays in src/engine.ts and src/model.ts.
//
// The binaries are read from disk, once per warm process. The live deployment is behind
// Vercel Authentication, so fetching /data/*.bin from the deployment origin returns a login
// page. vercel.json includeFiles puts the same files inside the function instead.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAtlas, parseEphem, parseGlobalAtlas, parseHazard, type Atlas, type Ephem, type Hazard } from '../../src/engine.js'
import type { Constraints } from '../../src/model.js'

export const LIMITS = 'A planning tool, not a landing certification.'

export const SOURCE_NAMES = ['NASA LRO LOLA', 'JPL DE421', 'NASA DSN'] as const

export const SOURCES = [
  { id: 'lola', name: 'NASA LRO LOLA', detail: 'Terrain horizons and slopes. South-pole grid about 2 km apart, below 84.5°S; whole-Moon grid about 30 km apart everywhere else.' },
  { id: 'de421', name: 'JPL DE421', detail: 'Hourly Sun and Earth in the Moon-fixed frame, 1 Nov 2026 through 31 Dec 2045.' },
  { id: 'dsn', name: 'NASA DSN', detail: 'Deep Space Network: whether Goldstone, Madrid or Canberra has the Moon above a 10° mask.' },
] as const

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface ApiReq {
  method?: string
  url?: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiRes {
  status: (code: number) => ApiRes
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
  end?: (body?: string) => void
}

interface ManifestFile {
  start_unix: number
  n: number
  constraints: Constraints
  ephemeris?: { spk?: string; end_utc?: string }
}

export interface Catalog {
  manifest: ManifestFile
  startUnix: number
  pole: Atlas
  ephem: Ephem
  dsn: boolean[]
  hazard: Hazard
  moon: () => Atlas
}

const CATALOGUE_ERROR = 'The landing catalogue is not available on this server.'

function dataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(process.cwd(), 'public', 'data'),
    join(here, '..', '..', 'public', 'data'),
    join(process.cwd(), 'web', 'public', 'data'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'manifest.json')) && existsSync(join(dir, 'atlas.bin'))) return dir
  }
  throw new HttpError(500, CATALOGUE_ERROR)
}

function readBin(file: string): ArrayBuffer {
  try {
    const b = readFileSync(file)
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  } catch {
    throw new HttpError(500, CATALOGUE_ERROR)
  }
}

function readManifest(file: string): ManifestFile {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as ManifestFile
    const w = parsed?.constraints?.weights
    if (!parsed || typeof parsed.start_unix !== 'number' || typeof parsed.n !== 'number' || !Array.isArray(w) || w.length !== 3) {
      throw new HttpError(500, CATALOGUE_ERROR)
    }
    parsed.constraints = { ...parsed.constraints, weights: [w[0], w[1], w[2]] }
    return parsed
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(500, CATALOGUE_ERROR)
  }
}

let pending: Promise<Catalog> | null = null
let moonAtlas: Atlas | null = null

export function loadCatalog(): Promise<Catalog> {
  if (!pending) {
    pending = Promise.resolve().then(readCatalog).catch((e) => {
      pending = null
      throw e
    })
  }
  return pending
}

function readCatalog(): Catalog {
  const dir = dataDir()
  const manifest = readManifest(join(dir, 'manifest.json'))
  const ephemBuf = readBin(join(dir, 'ephem.bin'))
  const dsnBuf = readBin(join(dir, 'dsn.bin'))
  if (ephemBuf.byteLength < manifest.n * 28 || dsnBuf.byteLength < manifest.n) throw new HttpError(500, CATALOGUE_ERROR)
  const pole = parseAtlas(readBin(join(dir, 'atlas.bin')))
  const hazard = parseHazard(readBin(join(dir, 'hazard.bin')))
  if (!hazard.p95[0] || hazard.p95[0].length !== pole.n) throw new HttpError(500, CATALOGUE_ERROR)
  const dsn = Array.from(new Uint8Array(dsnBuf).subarray(0, manifest.n), (x) => x === 1)
  return {
    manifest,
    startUnix: manifest.start_unix,
    pole,
    ephem: parseEphem(ephemBuf, manifest.n),
    dsn,
    hazard,
    moon: () => {
      if (!moonAtlas) moonAtlas = parseGlobalAtlas(readBin(join(dir, 'global_atlas.bin')))
      return moonAtlas
    },
  }
}

function isHttp(e: unknown): e is HttpError {
  return e instanceof HttpError || (e instanceof Error && e.name === 'HttpError' && 'status' in e && typeof e.status === 'number')
}

export function handle(work: (req: ApiReq) => Promise<unknown> | unknown) {
  return async function handler(req: ApiReq, res: ApiRes): Promise<void> {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-methods', 'GET, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') {
      res.setHeader('cache-control', 'public, max-age=3600')
      res.status(204)
      if (res.end) res.end()
      else res.json({})
      return
    }
    if (req.method !== 'GET') {
      send(res, 405, { error: 'GET only' })
      return
    }
    try {
      send(res, 200, await work(req))
    } catch (e) {
      if (isHttp(e)) send(res, e.status, { error: e.message })
      else send(res, 500, { error: 'The request could not be completed.' })
    }
  }
}

function send(res: ApiRes, status: number, body: unknown) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', status >= 500 ? 'no-store' : 'public, max-age=3600')
  res.status(status).json(body)
}

function addQuery(u: URLSearchParams, key: string, value: unknown) {
  if (typeof value === 'string') u.append(key, value)
  else if (typeof value === 'number' || typeof value === 'boolean') u.append(key, String(value))
  else if (Array.isArray(value)) for (const item of value) addQuery(u, key, item)
}

export function queryFrom(req: ApiReq): URLSearchParams {
  const raw = req.url ?? ''
  const mark = raw.indexOf('?')
  const fromUrl = new URLSearchParams(mark >= 0 ? raw.slice(mark + 1) : '')
  if ([...fromUrl.keys()].length > 0) return fromUrl
  const out = new URLSearchParams()
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) addQuery(out, key, value)
  }
  return out
}

export function readQuery(req: ApiReq, allowed: readonly string[]): URLSearchParams {
  const params = queryFrom(req)
  const seen = new Set<string>()
  for (const key of params.keys()) {
    if (seen.has(key)) continue
    seen.add(key)
    if (!allowed.includes(key)) throw new HttpError(400, `Unknown parameter "${key}".`)
  }
  return params
}

export function optionalInt(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') return fallback
  if (!/^[+-]?\d+$/.test(raw.trim())) throw new HttpError(400, `"${name}" must be an integer.`)
  const n = Number(raw)
  if (n < min || n > max) throw new HttpError(400, `"${name}" must be between ${min} and ${max}.`)
  return n
}

export function requiredNumber(params: URLSearchParams, name: string, min: number, max: number): number {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') throw new HttpError(400, `"${name}" is required.`)
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) throw new HttpError(400, `"${name}" must be a number.`)
  const n = Number(raw)
  if (n < min || n > max) throw new HttpError(400, `"${name}" must be between ${min} and ${max}.`)
  return n
}

export function oneOf(params: URLSearchParams, name: string, values: readonly number[], fallback: number): number {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') return fallback
  if (!/^[+]?\d+$/.test(raw.trim())) throw new HttpError(400, `"${name}" must be one of ${values.join(', ')}.`)
  const n = Number(raw)
  if (!values.includes(n)) throw new HttpError(400, `"${name}" must be one of ${values.join(', ')}.`)
  return n
}

export function flag(params: URLSearchParams, name: string, fallback: boolean): boolean {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') return fallback
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  throw new HttpError(400, `"${name}" must be 0 or 1.`)
}

const ZONES = [0, 100, 250, 500, 1000] as const

export interface Mission {
  start: string
  startMs: number
  days: number
  windowDays: number
  sun: number
  earth: number
  shadow: number
  batt: number
  slope: number
  zone: number
  zslope: number
  dsn: boolean
}

export function parseDay(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `"${label}" must be a date like 2027-09-01.`)
  const ms = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `"${label}" is not a real calendar date.`)
  }
  return ms
}

const HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/

export function parseHour(value: string): number {
  if (!HOUR.test(value)) throw new HttpError(400, '"from" must be a UTC hour like 2027-09-01T00:00Z.')
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) throw new HttpError(400, '"from" must be a UTC hour like 2027-09-01T00:00Z.')
  if (ms % 3_600_000 !== 0) throw new HttpError(400, '"from" must be a whole UTC hour, such as 2027-09-01T00:00Z.')
  return ms
}

export function missionFrom(params: URLSearchParams): Mission {
  const start = params.get('start') ?? '2027-09-01'
  return {
    start,
    startMs: parseDay(start, 'start'),
    days: optionalInt(params, 'days', 14, 1, 30),
    windowDays: optionalInt(params, 'window', 30, 1, 90),
    sun: optionalInt(params, 'sun', 70, 0, 100),
    earth: optionalInt(params, 'earth', 50, 0, 100),
    shadow: optionalInt(params, 'shadow', 48, 0, 240),
    batt: optionalInt(params, 'batt', 2000, 500, 20000),
    slope: optionalInt(params, 'slope', 8, 2, 90),
    zone: oneOf(params, 'zone', ZONES, 1000),
    zslope: optionalInt(params, 'zslope', 12, 2, 30),
    dsn: flag(params, 'dsn', true),
  }
}

export function constraintsOf(cat: Catalog, mission: Mission): Constraints {
  return {
    ...cat.manifest.constraints,
    duration_days: mission.days,
    min_sun_frac: mission.sun / 100,
    min_comm_frac: mission.earth / 100,
    max_dark_hours: mission.shadow,
    battery_wh: mission.batt,
  }
}

export function constraintView(mission: Mission) {
  return {
    sun_pct: mission.sun,
    earth_pct: mission.earth,
    max_dark_h: mission.shadow,
    battery_wh: mission.batt,
    slope_deg: mission.slope,
    zone_m: mission.zone,
    zone_slope_deg: mission.zslope,
    dsn: mission.dsn,
  }
}

export function isoDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

export function isoHour(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().replace('.000Z', 'Z')
}

export function firstHourAt(startUnix: number, dayMs: number): number {
  return Math.round((dayMs / 1000 - startUnix) / 3600)
}

export function assertStayFits(cat: Catalog, firstHour: number, days: number): void {
  if (firstHour < 0) throw new HttpError(400, `start is before the catalogue begins (${isoDate(cat.startUnix)}).`)
  if (firstHour + days * 24 > cat.ephem.n) {
    const end = isoHour(cat.startUnix + (cat.ephem.n - 1) * 3600)
    throw new HttpError(400, `That stay runs past the end of the catalogue (${end}). Use an earlier start or fewer days.`)
  }
}

/** How many landing dates fit, same cut the web app uses when the window runs into the end of the catalogue. */
export function fitWindow(cat: Catalog, firstHour: number, days: number, requested: number): { starts: number; note: string | null } {
  assertStayFits(cat, firstHour, days)
  const room = Math.floor((cat.ephem.n - firstHour - days * 24) / 24) + 1
  const starts = Math.max(1, Math.min(requested, room))
  const note = starts < requested
    ? `Only ${starts} landing ${starts === 1 ? 'day fits' : 'days fit'} before the catalogue ends, so the window was cut from ${requested}.`
    : null
  return { starts, note }
}

export function percent(fraction: number): number {
  return Math.round(fraction * 1e6) / 1e4
}

export function roundTo(n: number, digits: number): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

export function east360(lon: number): number {
  const x = ((lon % 360) + 360) % 360
  return x === 360 ? 0 : roundTo(x, 6)
}

export function pointView(atlas: Atlas, index: number, distKm: number) {
  const lon = atlas.lon[index]
  return {
    index,
    lat: atlas.lat[index],
    lon,
    lon_360: east360(lon),
    distance_km: roundTo(distKm, 3),
    height_m: atlas.height[index],
    slope_deg: roundTo(atlas.slope[index], 2),
  }
}

export function reasonDetail(kind: string, value: number, c: Constraints): string {
  if (kind === 'sun') return `sunlight ${percent(value)}% is below ${c.min_sun_frac * 100}%`
  if (kind === 'earth') return `Earth contact ${percent(value)}% is below ${c.min_comm_frac * 100}%`
  if (kind === 'shadow') return `longest darkness ${value} h is over ${c.max_dark_hours} h`
  if (kind === 'battery') return `the battery drops under 20% after ${value} h`
  return kind
}

export function catalogueEnd(cat: Catalog): string {
  return isoHour(cat.startUnix + (cat.ephem.n - 1) * 3600)
}
