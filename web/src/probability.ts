// Mission success probability: a Monte Carlo over simulated missions for one site. GO/NO-GO says whether the
// planned mission works on paper; this asks how often it works when the real world wobbles. Each simulated mission
// draws:
//   - a launch slip (most launches go on time or a day late; some slip a week),
//   - a horizon error plus the scatter of touching down anywhere in the landing zone (shifts sunrise/sunset and
//     Earth-rise/set),
//   - battery wear (0-15 % of capacity),
//   - the slope under the footpads, from the zone's measured slope distribution, against the lander's limit (tip-over),
//   - optionally, whether the landing system works at all, from the record of recent robotic landing attempts.
// A fixed random seed keeps the answer the same every time for the same inputs.
import { diskFraction, horizonAt, pointTrack, type Atlas, type Ephem, type PointResult } from './engine'
import { evaluateWindow, type Constraints } from './model'

/** Robotic lunar landing attempts 2019 to mid-2025 (Peregrine is left out: it never attempted a landing). */
export const LANDING_RECORD = {
  period: '2019 – mid-2025',
  attempts: 13,
  reached: 8,          // touched down: Chang'e 4, 5, 6, Chandrayaan-3, Blue Ghost 1, and SLIM, IM-1, IM-2 (these three tipped)
  crashed: 5,          // Beresheet, Vikram (Chandrayaan-2), Hakuto-R M1, Luna 25, Hakuto-R M2
}

export interface ProbabilityInput {
  atlas: Atlas; eph: Ephem; dsn: ArrayLike<boolean>; r: PointResult
  firstHour: number; days: number; windowDays: number; needDsn: boolean; c: Constraints
  zoneSlopeP95: number         // 95th-percentile slope in the landing zone (deg)
  slopeLimit: number           // the lander's limit (deg)
  zoneM: number                // landing-zone radius (m)
  history: boolean             // include the landing record
  trials?: number
}

export interface Probability {
  p: number; lo: number; hi: number; trials: number
  causes: { tip: number; power: number; comms: number; landing: number }   // share of trials failing for each cause
  main: 'tip' | 'power' | 'comms' | 'landing' | null
  sunPct: [number, number, number]       // 5th, median, 95th percentile across trials
  earthPct: [number, number, number]
  darkH: [number, number, number]
}

function rng(seed: number) {
  // mulberry32: small, fast, deterministic
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (u: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u())
const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] }

/** A launch slip in days: about half on time, then quickly fewer, rarely a week or more (capped at 10). */
export function drawSlip(u: () => number) { return Math.min(10, Math.floor(-Math.log(Math.max(1e-9, u())) * 1.4)) }

export function successProbability(inp: ProbabilityInput): Probability {
  const N = inp.trials ?? 400
  const u = rng(0x5eed ^ inp.r.index ^ (inp.firstHour << 4))
  const len = inp.days * 24
  const hours = Math.min(inp.eph.n - inp.firstHour - 1, (inp.windowDays - 1) * 24 + len + 10 * 24)
  const tr = pointTrack(inp.atlas, inp.eph, inp.dsn, inp.r.index, inp.firstHour, hours)
  const off = inp.r.index * inp.atlas.nAz
  // horizon error: what we measured for the fast horizon (about 0.5 deg) plus terrain scatter across the zone
  const sigmaHz = 0.5 + 0.6 * (inp.zoneM / 1000)
  const sigmaSlope = Math.max(0.3, inp.zoneSlopeP95 / 1.96)   // half-normal with its 95th percentile at the zone's p95
  let ok = 0
  const fail = { tip: 0, power: 0, comms: 0, landing: 0 }
  const sun: number[] = [], earth: number[] = [], dark: number[] = []
  const sunF = new Float64Array(len)
  const earthV: boolean[] = new Array(len)
  for (let k = 0; k < N; k++) {
    // landing system (history), then tip-over, then the mission itself
    if (inp.history) {
      // Beta(1 + reached, 1 + crashed) for the chance the landing works at all
      const a = 1 + LANDING_RECORD.reached, b = 1 + LANDING_RECORD.crashed
      const pLand = betaMean(a, b) + gauss(u) * Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))
      if (u() > Math.min(0.98, Math.max(0.05, pLand))) { fail.landing++; continue }
    }
    const slope = Math.abs(gauss(u)) * sigmaSlope
    if (slope > inp.slopeLimit) { fail.tip++; continue }
    const slip = drawSlip(u)
    const start = Math.min(inp.r.bestStart + slip, inp.windowDays - 1 + 10) * 24
    if (start + len > hours) { fail.power++; continue }
    const dh = gauss(u) * sigmaHz
    const batt = inp.c.battery_wh * (1 - 0.15 * u())
    for (let i = 0; i < len; i++) {
      const h = start + i
      const hz = horizonAt(inp.atlas.horizon, off, inp.atlas.nAz, tr.sunAz[h]) + dh
      sunF[i] = diskFraction(tr.sunAlt[h], hz, inp.eph.sunR[inp.firstHour + h])
      const he = horizonAt(inp.atlas.horizon, off, inp.atlas.nAz, tr.earthAz[h]) + dh
      earthV[i] = tr.earthAlt[h] > he && (!inp.needDsn || !!inp.dsn[inp.firstHour + h])
    }
    const w = evaluateWindow(sunF, earthV, 1, { ...inp.c, battery_wh: batt })
    sun.push(w.sunFrac * 100); earth.push(w.commFrac * 100); dark.push(w.longestDarkH)
    if (w.go) ok++
    else if (w.commFrac < inp.c.min_comm_frac) fail.comms++
    else fail.power++
  }
  // a 90 % interval from the Beta posterior (normal approximation; Monte Carlo noise is small next to it)
  const a = ok + 1, b = N - ok + 1
  const mean = betaMean(a, b), sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))
  const causes = { tip: fail.tip / N, power: fail.power / N, comms: fail.comms / N, landing: fail.landing / N }
  const top = (Object.entries(causes) as [Probability['main'] & string, number][]).sort((x, y) => y[1] - x[1])[0]
  const tri = (xs: number[]): [number, number, number] => (xs.length ? [pct(xs, 0.05), pct(xs, 0.5), pct(xs, 0.95)] : [0, 0, 0])
  return {
    p: ok / N, lo: Math.max(0, mean - 1.645 * sd), hi: Math.min(1, mean + 1.645 * sd), trials: N, causes,
    main: top && top[1] > 0 ? top[0] : null, sunPct: tri(sun), earthPct: tri(earth), darkH: tri(dark),
  }
}

function betaMean(a: number, b: number) { return a / (a + b) }
