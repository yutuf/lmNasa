// Decision lab: rank candidate landing sites by several criteria at once, with weights the team chooses.
//
// TOPSIS (Hwang & Yoon, 1981): each site is a point in criteria space; the best possible site takes the best value
// of every criterion (the "ideal"), the worst takes the worst (the "anti-ideal"). A site's score is how close it is
// to the ideal relative to the anti-ideal, 0 to 1. Weights stretch the space, so what the team cares about counts more.
//
// Robustness: weights are a judgement, so the ranking is re-done many times with every weight shaken (log-normal,
// about ±35 %). A site that stays #1 under most shakes is a robust choice; one that wins only at the exact weights is
// a knife-edge pick. This is the sensitivity analysis decision boards ask for.

export type Dir = 1 | -1     // 1: more is better, -1: less is better

/** Score sites (rows) on criteria (columns). Missing values count as the column's worst. Returns closeness 0..1. */
export function topsis(rows: (number | null)[][], weights: number[], dirs: Dir[]): number[] {
  const n = rows.length, m = dirs.length
  if (!n) return []
  const cols = Array.from({ length: m }, (_, j) => fillWorst(rows.map((r) => r[j]), dirs[j]))
  // vector normalisation, then weights
  const v = cols.map((col, j) => {
    const norm = Math.hypot(...col) || 1
    return col.map((x) => (x / norm) * (weights[j] || 0))
  })
  const best = v.map((col, j) => (dirs[j] > 0 ? Math.max(...col) : Math.min(...col)))
  const worst = v.map((col, j) => (dirs[j] > 0 ? Math.min(...col) : Math.max(...col)))
  return Array.from({ length: n }, (_, i) => {
    let dPlus = 0, dMinus = 0
    for (let j = 0; j < m; j++) { dPlus += (v[j][i] - best[j]) ** 2; dMinus += (v[j][i] - worst[j]) ** 2 }
    dPlus = Math.sqrt(dPlus); dMinus = Math.sqrt(dMinus)
    return dPlus + dMinus === 0 ? 0.5 : dMinus / (dPlus + dMinus)
  })
}

function fillWorst(col: (number | null)[], dir: Dir): number[] {
  const known = col.filter((x): x is number => x !== null && Number.isFinite(x))
  const worst = known.length ? (dir > 0 ? Math.min(...known) : Math.max(...known)) : 0
  // TOPSIS needs non-negative values; shift if a column dips below zero
  const lo = Math.min(0, ...known)
  return col.map((x) => (x !== null && Number.isFinite(x) ? x : worst) - lo)
}

/** Each site's standing on each criterion, 0 (worst of the candidates) to 1 (best). For the heat map and the "why". */
export function standing(rows: (number | null)[][], dirs: Dir[]): number[][] {
  const m = dirs.length
  const cols = Array.from({ length: m }, (_, j) => fillWorst(rows.map((r) => r[j]), dirs[j]))
  return rows.map((_, i) => cols.map((col, j) => {
    const lo = Math.min(...col), hi = Math.max(...col)
    if (hi === lo) return 1
    const s = (col[i] - lo) / (hi - lo)
    return dirs[j] > 0 ? s : 1 - s
  }))
}

export function order(scores: number[]) { return scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i) }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Robustness { wins: number[]; top3: number[]; meanRank: number[]; draws: number }

/** Re-rank under shaken weights: how often each site comes first, makes the top 3, and its average rank. */
export function robustness(rows: (number | null)[][], weights: number[], dirs: Dir[], draws = 500, spread = 0.35, seed = 42): Robustness {
  const n = rows.length
  const u = rng(seed)
  const wins = new Array(n).fill(0), top3 = new Array(n).fill(0), rankSum = new Array(n).fill(0)
  for (let k = 0; k < draws; k++) {
    const w = weights.map((x) => x * Math.exp(spread * Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u())))
    const o = order(topsis(rows, w, dirs))
    o.forEach((i, r) => { rankSum[i] += r + 1; if (r === 0) wins[i]++; if (r < 3) top3[i]++ })
  }
  return { wins: wins.map((x) => x / draws), top3: top3.map((x) => x / draws), meanRank: rankSum.map((x) => x / draws), draws }
}

/** The criteria that lift a site most above the field (weight x how much better than the average candidate). */
export function reasons(stand: number[][], weights: number[], i: number, k = 2): number[] {
  const n = stand.length
  const lift = weights.map((w, j) => {
    const avg = stand.reduce((s, r) => s + r[j], 0) / n
    return [w * (stand[i][j] - avg), j] as const
  })
  return lift.filter(([v]) => v > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, j]) => j)
}
