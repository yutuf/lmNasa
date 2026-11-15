// Live session for the pitch: each judge scans a QR, plans a mission on their phone (goal, length, a spot they tap
// on the south-pole map), and the big screen puts their spot against AdaptLab's pick for the same mission, says which
// is better and why, and suggests a better spot near theirs. Pure helpers here; the screens are LiveSession.tsx and
// LiveJoin.tsx.
import { gcKm } from './engine.js'
import { SCIENCE_SITES } from './scienceSites'

export type GoalId = 'safe' | 'ice' | 'artemis' | 'sun'

export interface Goal { id: GoalId; en: string; tr: string; hintEn: string; hintTr: string; colour: string }

export const GOALS: Goal[] = [
  { id: 'safe', en: 'Safe landing', tr: 'Güvenli iniş', hintEn: 'Most good landing days', hintTr: 'En çok uygun iniş günü', colour: '#5A4A9E' },
  { id: 'ice', en: 'Water ice', tr: 'Su buzu', hintEn: 'Land within 15 km of ice', hintTr: 'Buza 15 km yakın in', colour: '#1F6B52' },
  { id: 'artemis', en: 'Artemis III', tr: 'Artemis III', hintEn: 'Near an astronaut site', hintTr: 'Astronot bölgesine yakın', colour: '#76671F' },
  { id: 'sun', en: 'Most sunlight', tr: 'En çok güneş', hintEn: 'Power for the whole stay', hintTr: 'Görev boyunca enerji', colour: '#9E3A2E' },
]

export const LENGTHS = [7, 14, 28] as const
export type Length = (typeof LENGTHS)[number]

/** The landing window every phone plans in: the API's longest search window. */
export const WINDOW = { start: '2027-09-01', days: 12 }

/** Judges in one room. More phones get a "room is full" message. */
export const MAX_JUDGES = 8

export const goalById = (id: string): Goal | null => GOALS.find((g) => g.id === id) ?? null

/** One room per session: a short code, the host's PeerJS id derives from it. */
export function liveCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}
export const livePeerId = (code: string) => `adaptlab-live-${code.toUpperCase()}`

export function parseJoinHash(hash: string): { code: string | null; lang: 'en' | 'tr' } {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const raw = q.get('join')
  const code = raw && /^[A-Z0-9]{4}$/i.test(raw) ? raw.toUpperCase() : null
  return { code, lang: q.get('lang') === 'en' ? 'en' : 'tr' }   // the judges' page opens in Turkish
}

// ---- the phone map: south polar stereographic, 0 E up, 90 E right (scripts/export_live_map.py) ----

const R_MOON_KM = 1737.4
/** Half the map's width. Taps must fall inside MAP_EDGE_KM, where the 2 km search grid is. */
export const MAP_R_KM = 155
export const MAP_EDGE_KM = 148
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export function polarXYKm(lat: number, lon: number): { x: number; y: number } {
  const r = 2 * R_MOON_KM * Math.tan(rad(90 + lat) / 2)
  return { x: r * Math.sin(rad(lon)), y: r * Math.cos(rad(lon)) }
}

/** A tap on the map (0..1 across, 0..1 down) to lat/lon, or null outside the searchable disc. */
export function mapToLatLon(fx: number, fy: number): { lat: number; lon: number } | null {
  const x = (fx * 2 - 1) * MAP_R_KM
  const y = (1 - fy * 2) * MAP_R_KM
  const r = Math.hypot(x, y)
  if (r > MAP_EDGE_KM) return null
  const lat = -90 + 2 * deg(Math.atan(r / (2 * R_MOON_KM)))
  const lon = ((deg(Math.atan2(x, y)) % 360) + 360) % 360
  return { lat, lon }
}

export function latLonToMap(lat: number, lon: number): { fx: number; fy: number } {
  const { x, y } = polarXYKm(lat, lon)
  return { fx: (x / MAP_R_KM + 1) / 2, fy: (1 - y / MAP_R_KM) / 2 }
}

/** Crater names drawn on the phone map, from the IAU names in features.json. */
export const MAP_LABELS: { name: string; lat: number; lon: number }[] = [
  { name: 'Shackleton', lat: -89.67, lon: 129.78 },
  { name: 'Shoemaker', lat: -88.14, lon: 45.91 },
  { name: 'Faustini', lat: -87.18, lon: 84.31 },
  { name: 'Haworth', lat: -87.45, lon: 354.83 },
  { name: 'de Gerlache', lat: -88.48, lon: 271.66 },
  { name: 'Sverdrup', lat: -88.32, lon: 206.61 },
  { name: 'Henson', lat: -88.57, lon: 229.37 },
  { name: 'Slater', lat: -88.08, lon: 111.29 },
  { name: 'Nobile', lat: -85.28, lon: 53.27 },
  { name: 'Cabeus', lat: -85.33, lon: 317.87 },
  { name: 'Malapert', lat: -85.98, lon: 358.33 },
]

const insideMap = (lat: number, lon: number) => { const p = polarXYKm(lat, lon); return Math.hypot(p.x, p.y) <= MAP_EDGE_KM }

/** The ice or Artemis targets a goal aims at, inside the map. */
export function goalTargets(goal: GoalId) {
  if (goal !== 'ice' && goal !== 'artemis') return []
  return SCIENCE_SITES.filter((s) => s.kind === goal && insideMap(s.lat, s.lon))
}

/** Distance to the nearest target of the goal, or null for goals without targets. */
export function targetKm(goal: GoalId, lat: number, lon: number): number | null {
  const t = goalTargets(goal)
  return t.length ? Math.min(...t.map((s) => gcKm(lat, lon, s.lat, s.lon))) : null
}

/** The closest labelled crater, for "8 km from Shackleton". */
export function nearestLabel(lat: number, lon: number): { name: string; km: number } {
  let best = { name: MAP_LABELS[0].name, km: Infinity }
  for (const l of MAP_LABELS) {
    const km = gcKm(lat, lon, l.lat, l.lon)
    if (km < best.km) best = { name: l.name, km }
  }
  return best
}

// ---- the message a phone sends ----

export interface PlanMsg { type: 'plan'; goal: GoalId; days: Length; lat: number; lon: number }

export function parsePlan(raw: unknown): PlanMsg | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (m.type !== 'plan' || typeof m.goal !== 'string' || !goalById(m.goal)) return null
  if (!LENGTHS.includes(m.days as Length)) return null
  const lat = Number(m.lat)
  const lon = Number(m.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > -84.5 || lon < 0 || lon >= 360) return null
  return { type: 'plan', goal: m.goal as GoalId, days: m.days as Length, lat, lon }
}

// ---- comparing a judge's spot with AdaptLab's ----

export interface ApiSite { rank: number; lat: number; lon: number; lon_360?: number; go_dates: number; best_date: string; sun_pct: number; earth_pct: number; longest_dark_h: number; go: boolean }

/** One spot, as both screens compare it: the API's best landing day in the window, plus the distance to the goal. */
export interface Spot { lat: number; lon: number; goDays: number; date: string; sun: number; earth: number; dark: number; go: boolean; targetKm: number | null }

export function spotFromSite(goal: GoalId, s: ApiSite): Spot {
  const lon = s.lon_360 ?? ((s.lon % 360) + 360) % 360
  return { lat: s.lat, lon, goDays: s.go_dates, date: s.best_date, sun: s.sun_pct, earth: s.earth_pct, dark: s.longest_dark_h, go: s.go, targetKm: targetKm(goal, s.lat, lon) }
}

export const TARGET_KM = 15
const meetsGoal = (s: Spot) => s.targetKm === null || s.targetKm <= TARGET_KM

/** Sunlight, Earth contact and the longest night in one number; "most sunlight" counts the Sun twice. */
function light(goal: GoalId, s: Spot): number {
  return s.sun * (goal === 'sun' ? 2 : 1) + s.earth - s.dark * 0.25
}

/** One number per spot, for the judges' leaderboard. */
export function spotScore(goal: GoalId, s: Spot): number {
  return (s.goDays > 0 ? 2000 : 0) + (meetsGoal(s) ? 1000 : 0) + s.goDays * 20 + light(goal, s)
}

export type Why = 'far' | 'days' | 'light' | 'same'
export interface Verdict { winner: 'judge' | 'pick' | 'tie'; why: Why }

/** Which spot is better for the goal, and the first reason that decides it: a spot that can land beats one that
 *  cannot, then the distance to the goal (ice, Artemis), then more good landing days, then sunlight and Earth. */
export function compareSpots(goal: GoalId, judge: Spot, pick: Spot): Verdict {
  if ((judge.goDays > 0) !== (pick.goDays > 0)) return { winner: judge.goDays > 0 ? 'judge' : 'pick', why: 'days' }
  const jOk = meetsGoal(judge)
  const pOk = meetsGoal(pick)
  if (jOk !== pOk) return { winner: jOk ? 'judge' : 'pick', why: 'far' }
  if (judge.goDays !== pick.goDays) return { winner: judge.goDays > pick.goDays ? 'judge' : 'pick', why: 'days' }
  const d = light(goal, judge) - light(goal, pick)
  if (Math.abs(d) < 3) return { winner: 'tie', why: 'same' }
  return { winner: d > 0 ? 'judge' : 'pick', why: 'light' }
}

/** AdaptLab's spot for a goal from the API's ranked list. Safe: the top site. Most sunlight: the sunniest site,
 *  GO first. Ice and Artemis: the best-ranked GO site within 15 km of a target, else the GO site closest to one
 *  (else, when nothing is GO, the closest site). */
export function pickForGoal(goal: GoalId, sites: ApiSite[]): Spot | null {
  if (!sites.length) return null
  const spots = sites.map((s) => spotFromSite(goal, s))
  if (goal === 'safe') return spots[0]
  if (goal === 'sun') return [...spots].sort((a, b) => Number(b.go) - Number(a.go) || b.sun - a.sun || b.goDays - a.goDays)[0]
  const go = spots.filter((s) => s.go)
  const pool = go.length ? go : spots
  return pool.find((s) => meetsGoal(s)) ?? [...pool].sort((a, b) => a.targetKm! - b.targetKm!)[0]
}

/** A better spot near the judge's: the closest GO site in the ranked list that meets the goal, else the closest GO
 *  site at all. Null when nothing in the list is GO. */
export function suggestNear(goal: GoalId, lat: number, lon: number, sites: ApiSite[]): { spot: Spot; km: number } | null {
  let best: { spot: Spot; km: number } | null = null
  let anyGo: { spot: Spot; km: number } | null = null
  for (const s of sites) {
    const spot = spotFromSite(goal, s)
    if (!spot.go) continue
    const km = gcKm(lat, lon, spot.lat, spot.lon)
    if (!anyGo || km < anyGo.km) anyGo = { spot, km }
    if (meetsGoal(spot) && (!best || km < best.km)) best = { spot, km }
  }
  return best ?? anyGo
}
