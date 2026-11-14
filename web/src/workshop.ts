// The mission workshop's engineering model: the parts you choose become budgets (mass, power, propellant) and the
// budgets become the search's requirements, so a design is judged by the same engine as everything else.
// Simple, standard first-order relations, with the constants stated; a planning model, not a spacecraft design tool.
import type { ScienceKind } from './scienceSites'

export type VehicleType = 'lander' | 'rover' | 'orbiter'
export type LandingStyle = 'soft' | 'rough'

export interface Design {
  name: string
  type: VehicleType
  solarW: number            // solar array output at full Sun (W)
  batteryWh: number
  landing: LandingStyle     // soft: powered to ~1 m/s; rough: crushable legs / airbags, ~5 m/s
  nav: 'standard' | 'precision'   // precision = terrain-relative navigation with a lidar
  legs: 'narrow' | 'wide'
  comms: 'dte' | 'relay'    // direct to Earth, or through a relay satellite
  days: number
  goal: ScienceKind | ''
  rover: string             // rover carried (type 'rover')
  orbit: { periKm: number; apoKm: number; incDeg: number }   // orbiter
}

export const DEFAULT_DESIGN: Design = {
  name: 'My lander', type: 'lander', solarW: 800, batteryWh: 3000, landing: 'soft', nav: 'standard', legs: 'wide',
  comms: 'dte', days: 14, goal: '', rover: 'viper', orbit: { periKm: 100, apoKm: 100, incDeg: 90 },
}

// constants (planning values)
export const K = {
  g0: 9.80665,
  isp: 320,                  // s, storable bipropellant descent engine
  dvSoft: 1900,              // m/s from a 100 km lunar orbit to touchdown, powered all the way
  dvRough: 1820,             // m/s: the last metres are not hovered, the legs/airbags take the rest
  arrayWPerKg: 100,          // W per kg of solar array
  battWhPerKg: 150,          // Wh per kg of space-rated Li-ion
  avionicsW: 80, heatersW: 60, dteW: 45, relayW: 25,
  instrumentW: { '': 0, ice: 90, volcanic: 50, impact: 50, magnetic: 30, pit: 70, history: 20 } as Record<string, number>,
  roverKg: { viper: 430, lrv: 210, yutu: 140, pragyan: 26 } as Record<string, number>,
}

export interface Budget {
  dryKg: number; propKg: number; wetKg: number
  dayW: number; nightW: number
  // what the design needs from a landing site (the search's requirements)
  minSunPct: number; maxDarkH: number; earthPct: number; zone: number; zslope: number
  touchdownMs: number
  warnings: { level: 'ok' | 'warn' | 'bad'; text: string }[]
  parts: { name: string; kg: number }[]
}

export function budget(d: Design): Budget {
  const parts: { name: string; kg: number }[] = [
    { name: 'Structure & avionics', kg: d.type === 'orbiter' ? 180 : 260 },
    { name: 'Solar array', kg: d.solarW / K.arrayWPerKg },
    { name: 'Battery', kg: d.batteryWh / K.battWhPerKg },
    { name: 'Communications', kg: d.comms === 'dte' ? 22 : 9 },
  ]
  if (d.type !== 'orbiter') {
    parts.push({ name: d.landing === 'rough' ? 'Crushable legs + airbags' : 'Landing legs', kg: (d.legs === 'wide' ? 42 : 28) + (d.landing === 'rough' ? 55 : 0) })
    if (d.nav === 'precision') parts.push({ name: 'Hazard lidar (TRN)', kg: 16 })
  }
  if (d.goal) parts.push({ name: 'Science instruments', kg: 35 })
  if (d.type === 'rover') parts.push({ name: `Rover`, kg: K.roverKg[d.rover] ?? 200 })
  const dryKg = parts.reduce((s, p) => s + p.kg, 0)
  // rocket equation: propellant to get from lunar orbit to the surface (orbiters: only orbit insertion trims, ~300 m/s)
  const dv = d.type === 'orbiter' ? 300 : d.landing === 'rough' ? K.dvRough : K.dvSoft
  const propKg = dryKg * (Math.exp(dv / (K.isp * K.g0)) - 1)
  const commsW = d.comms === 'dte' ? K.dteW : K.relayW
  const dayW = K.avionicsW + commsW + (K.instrumentW[d.goal] ?? 0)
  const nightW = K.avionicsW + K.heatersW + commsW * 0.5
  // the requirements this hardware implies
  const minSunPct = Math.round(Math.min(95, Math.max(10, (dayW / Math.max(1, d.solarW)) * 100 * 1.15)))   // +15 % margin
  const maxDarkH = Math.max(0, Math.round((d.batteryWh * 0.8) / nightW))                                  // 80 % depth of discharge
  const baseZone = d.nav === 'precision' ? 100 : 1000
  const zone = d.landing === 'rough' ? Math.min(1000, baseZone * 2.5) : baseZone
  const zslope = (d.legs === 'wide' ? 15 : 10) - (d.landing === 'rough' ? 3 : 0)
  const warnings: Budget['warnings'] = []
  if (d.type !== 'orbiter') {
    if (minSunPct > 85) warnings.push({ level: 'bad', text: `Solar array too small: it needs the Sun ${minSunPct}% of the time.` })
    else if (minSunPct > 65) warnings.push({ level: 'warn', text: `Tight power: the Sun must be up ${minSunPct}% of the time.` })
    else warnings.push({ level: 'ok', text: `Power margin is fine: ${minSunPct}% sunlight is enough.` })
    if (maxDarkH < 12) warnings.push({ level: 'bad', text: `The battery lasts only ${maxDarkH} h in the dark.` })
    else warnings.push({ level: maxDarkH < 48 ? 'warn' : 'ok', text: `Survives up to ${maxDarkH} h of darkness on the battery.` })
    if (d.landing === 'rough') warnings.push({ level: 'warn', text: 'Rough landing: lighter and simpler, but less precise and more likely to tip on slopes.' })
    if (d.comms === 'relay') warnings.push({ level: 'ok', text: 'Talks through a relay satellite: works even where Earth never rises.' })
  }
  if (dryKg + propKg > 15000) warnings.push({ level: 'bad', text: 'Heavier than a crewed lander: no current rocket could send this to the Moon.' })
  return { dryKg, propKg, wetKg: dryKg + propKg, dayW, nightW, minSunPct, maxDarkH, earthPct: d.comms === 'dte' ? 50 : 0, zone, zslope,
    touchdownMs: d.landing === 'rough' ? 5 : 1, warnings, parts }
}

// ---------------------------------------------------------------------------------------------------------------
// Orbits for satellites: two-body (Kepler) about the Moon; what matters for a relay or a mapper is the period and
// how often a ground site can see the satellite. NRHO-like orbits are approximated as an ellipse (labelled).
export const MU = 4902.8            // km^3/s^2, lunar GM
export const RM = 1737.4            // km
const SIDEREAL_S = 27.3217 * 86400

export interface OrbitStats { periodH: number; visiblePct: number; maxGapH: number; passesPerDay: number }

/** Coverage of a ground site (lat, lon) by a satellite over `days`, elevation mask `maskDeg`. The orbit's apolune
 *  sits over the southern hemisphere (argument of periapsis 90 deg), like relay orbits serving the south pole. */
export function orbitStats(o: { periKm: number; apoKm: number; incDeg: number }, lat: number, lon: number, days = 14, maskDeg = 10): OrbitStats {
  const rp = RM + Math.min(o.periKm, o.apoKm), ra = RM + Math.max(o.periKm, o.apoKm)
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp)
  const T = 2 * Math.PI * Math.sqrt(a ** 3 / MU)
  const inc = (o.incDeg * Math.PI) / 180, w = Math.PI / 2
  const la = (lat * Math.PI) / 180
  const site = (t: number) => {
    const lo = (lon * Math.PI) / 180 + (2 * Math.PI * t) / SIDEREAL_S   // the Moon turns under the orbit
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  }
  const step = Math.max(30, Math.min(600, T / 200))
  const n = Math.floor((days * 86400) / step)
  let vis = 0, gap = 0, maxGap = 0, passes = 0, was = false
  const sinMask = Math.sin((maskDeg * Math.PI) / 180)
  for (let k = 0; k < n; k++) {
    const t = k * step
    // mean -> eccentric anomaly (Newton), then position in the orbital plane
    const M = ((2 * Math.PI * t) / T) % (2 * Math.PI)
    let E = M
    for (let it = 0; it < 6; it++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
    const r = a * (1 - e * Math.cos(E))
    const u = nu + w
    const sat = [r * Math.cos(u), r * Math.sin(u) * Math.cos(inc), r * Math.sin(u) * Math.sin(inc)]
    const s = site(t)
    const d = [sat[0] - RM * s[0], sat[1] - RM * s[1], sat[2] - RM * s[2]]
    const len = Math.hypot(d[0], d[1], d[2])
    const up = (d[0] * s[0] + d[1] * s[1] + d[2] * s[2]) / len > sinMask
    if (up) { vis++; if (!was) passes++; maxGap = Math.max(maxGap, gap); gap = 0 } else gap += step
    was = up
  }
  maxGap = Math.max(maxGap, gap)
  return { periodH: T / 3600, visiblePct: Math.round((vis / n) * 100), maxGapH: maxGap / 3600, passesPerDay: passes / days }
}

export const ORBIT_PRESETS = [
  { id: 'llo', name: 'Low polar orbit (mapper, like LRO)', periKm: 50, apoKm: 200, incDeg: 90 },
  { id: 'elfo', name: 'Elliptical frozen orbit (relay, like Queqiao-2)', periKm: 200, apoKm: 16000, incDeg: 55 },
  { id: 'nrho', name: 'Near-rectilinear halo (Gateway, approximated)', periKm: 3000, apoKm: 70000, incDeg: 90 },
]
