// Launch and orbit scenarios: which landing sites a mission can reach from its lunar parking orbit.
// A lander descends from its orbit's plane, so it can reach latitudes up to the orbit inclination (|lat| <= i). A site
// further toward a pole needs a plane change: delta-v = 2 v sin(delta_i / 2), with v the circular speed in a 100 km
// orbit (about 1.63 km/s). The launch site's latitude does not limit the lunar orbit (the transfer sets it), but
// the inclination you choose does.
import type { PointResult } from './engine'

export const V_LLO = Math.sqrt(4902.8 / (1737.4 + 100))   // km/s, circular speed at 100 km altitude

export interface OrbitScenario { id: string; inc: number; name: { en: string; tr: string }; why: { en: string; tr: string } }

export const ORBIT_SCENARIOS: OrbitScenario[] = [
  { id: 'polar', inc: 90, name: { en: 'Polar orbit · 90°', tr: 'Kutup yörüngesi · 90°' },
    why: { en: 'Passes over every latitude: the only way to the poles without extra fuel (Artemis, LRO).', tr: 'Her enlemin üzerinden geçer: kutuplara ek yakıt olmadan tek yol (Artemis, LRO).' } },
  { id: 'high', inc: 75, name: { en: 'High-inclination · 75°', tr: 'Yüksek eğimli · 75°' },
    why: { en: 'Reaches high latitudes, but not the polar regions.', tr: 'Yüksek enlemlere ulaşır ama kutup bölgelerine değil.' } },
  { id: 'mid', inc: 45, name: { en: 'Mid-inclination · 45°', tr: 'Orta eğimli · 45°' },
    why: { en: 'Covers most of the near-side maria and the Apollo sites.', tr: 'Yakın yüzdeki denizlerin çoğunu ve Apollo yerlerini kapsar.' } },
  { id: 'low', inc: 20, name: { en: 'Near-equatorial · 20°', tr: 'Ekvatora yakın · 20°' },
    why: { en: 'Cheapest to reach from Earth, like early Apollo: only an equatorial band.', tr: 'Dünya’dan ulaşması en ucuz, ilk Apollo gibi: yalnızca ekvator kuşağı.' } },
]

/** Delta-v (km/s) to tilt the orbit from `inc` far enough to pass over latitude `lat`; 0 when already reachable. */
export function planeChangeDv(lat: number, inc: number): number {
  const di = Math.max(0, Math.abs(lat) - inc)
  return 2 * V_LLO * Math.sin(((di * Math.PI) / 180) / 2)
}

export interface ScenarioRow { s: OrbitScenario; reachable: number; go: number; best: PointResult | null; dvToBest: number }

/** For each scenario: how many searched points it can reach, how many of those are GO, the best reachable site, and
 *  the plane-change cost to reach the overall best site instead. */
export function scenarioRows(results: PointResult[], scenarios = ORBIT_SCENARIOS): ScenarioRow[] {
  const ranked = [...results].sort((a, b) => b.goCount - a.goCount || b.bestScore - a.bestScore)
  const overall = ranked[0] ?? null
  return scenarios.map((s) => {
    const reach = ranked.filter((r) => Math.abs(r.lat) <= s.inc + 1e-9)
    return { s, reachable: reach.length, go: reach.filter((r) => r.goCount > 0).length, best: reach[0] ?? null,
      dvToBest: overall ? planeChangeDv(overall.lat, s.inc) : 0 }
  })
}
