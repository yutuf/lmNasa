// The survival-vs-science trade-off: which sites are not beaten on both counts by any other.
import type { PointResult } from './engine'

export interface TradePoint { r: PointResult; d: number; area: number; f: number }   // d: km to ice, f: share of dates GO

/** Sites no other site beats on both: at least as close to ice and passing more often. Sorted by distance. */
export function paretoFront(pts: TradePoint[]): TradePoint[] {
  const sorted = [...pts].sort((a, b) => a.d - b.d || b.f - a.f)
  const out: TradePoint[] = []
  let best = -1
  for (const p of sorted) if (p.f > best) { out.push(p); best = p.f }
  return out
}

