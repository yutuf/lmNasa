// Mission models, ported line by line from lunanav/metrics.py and lunanav/power.py.
// src/model.test.ts checks them against the Python results in public/data/expected.json.

export interface Constraints {
  duration_days: number
  min_sun_frac: number
  min_comm_frac: number
  max_dark_hours: number
  array_peak_w: number
  load_w: number
  battery_wh: number
  initial_soc: number
  charge_eff: number
  discharge_eff: number
  min_soc: number
  weights: [number, number, number]
}

export interface Power {
  soc: Float64Array
  minSoc: number
  survived: boolean
  firstFailure: number | null
}

export interface Window {
  sunFrac: number
  commFrac: number
  longestDarkH: number
  longestCommGapH: number
  minSoc: number
  survived: boolean
  go: boolean
  score: number
  power: Power
  reasons: { kind: 'sun' | 'earth' | 'shadow' | 'battery'; value: number }[]
}

export function longestRun(mask: ArrayLike<boolean>): number {
  let best = 0
  let run = 0
  for (let i = 0; i < mask.length; i++) {
    run = mask[i] ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

export function simulateBattery(sunFraction: ArrayLike<number>, stepH: number, c: Constraints): Power {
  let energy = c.initial_soc * c.battery_wh
  const soc = new Float64Array(sunFraction.length)
  let first: number | null = null
  let min = sunFraction.length ? Infinity : c.initial_soc
  for (let i = 0; i < sunFraction.length; i++) {
    const net = (c.array_peak_w * sunFraction[i] - c.load_w) * stepH
    energy += net > 0 ? net * c.charge_eff : net / c.discharge_eff
    energy = Math.min(Math.max(energy, 0), c.battery_wh)
    soc[i] = energy / c.battery_wh
    if (soc[i] < min) min = soc[i]
    if (first === null && soc[i] < c.min_soc) first = i
  }
  return { soc, minSoc: min, survived: first === null, firstFailure: first }
}

export function requiredBatteryWh(sunFraction: ArrayLike<number>, stepH: number, c: Constraints): number {
  let deficit = 0
  let worst = 0
  for (let i = 0; i < sunFraction.length; i++) {
    const e = (c.array_peak_w * sunFraction[i] - c.load_w) * stepH
    deficit = e > 0 ? Math.max(0, deficit - e * c.charge_eff) : deficit - e / c.discharge_eff
    worst = Math.max(worst, deficit)
  }
  if (worst === 0) return 0
  return c.min_soc >= 1 ? Infinity : worst / (1 - c.min_soc)
}

export function evaluateWindow(sunFraction: ArrayLike<number>, earthVisible: ArrayLike<boolean>, stepH: number,
                               c: Constraints): Window {
  const n = sunFraction.length
  const lit: boolean[] = new Array(n)
  const dark: boolean[] = new Array(n)
  const noComm: boolean[] = new Array(n)
  let litN = 0
  let commN = 0
  for (let i = 0; i < n; i++) {
    lit[i] = sunFraction[i] >= 0.5
    dark[i] = !lit[i]
    noComm[i] = !earthVisible[i]
    if (lit[i]) litN++
    if (earthVisible[i]) commN++
  }
  const sunFrac = litN / n
  const commFrac = commN / n
  const longestDarkH = longestRun(dark) * stepH
  const longestCommGapH = longestRun(noComm) * stepH
  const power = simulateBattery(sunFraction, stepH, c)
  const reasons: Window['reasons'] = []
  if (sunFrac < c.min_sun_frac) reasons.push({ kind: 'sun', value: sunFrac })
  if (commFrac < c.min_comm_frac) reasons.push({ kind: 'earth', value: commFrac })
  if (longestDarkH > c.max_dark_hours) reasons.push({ kind: 'shadow', value: longestDarkH })
  if (!power.survived) reasons.push({ kind: 'battery', value: (power.firstFailure ?? 0) * stepH })
  const [wSun, wComm, wBat] = c.weights
  const margin = Math.min(Math.max((power.minSoc - c.min_soc) / (1 - c.min_soc), 0), 1)
  let score = (100 * (wSun * sunFrac + wComm * commFrac + wBat * margin)) / (wSun + wComm + wBat)
  if (reasons.length) score *= 0.25
  return {
    sunFrac, commFrac, longestDarkH, longestCommGapH, minSoc: power.minSoc, survived: power.survived,
    go: reasons.length === 0, score: roundHalfEven(score, 1), power, reasons,
  }
}

/** Python's round(x, digits): ties go to the even neighbour. */
export function roundHalfEven(x: number, digits: number): number {
  const m = 10 ** digits
  const v = x * m
  const f = Math.floor(v)
  const d = v - f
  const r = Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(v)
  return r / m
}

export function hoursUntilChange(mask: ArrayLike<boolean>, i: number, stepH: number): number | null {
  for (let j = i + 1; j < mask.length; j++) if (mask[j] !== mask[i]) return (j - i) * stepH
  return null
}
