// Mission scenarios: ready-made requirement sets for different kinds of missions, and the ranking the search uses.
// The numbers are planning assumptions for comparison, not the requirements of any real mission.
import type { Atlas, PointResult } from './engine'
import type { Lang } from './i18n'

export interface ScenarioParams { days: number; sun: number; earth: number; shadow: number; batt: number; zone: number; zslope: number; ice: number; dsn: boolean }

export interface Scenario extends ScenarioParams {
  id: string
  short: Record<Lang, string>
  name: Record<Lang, string>
  desc: Record<Lang, string>
}

export const SCENARIOS: Scenario[] = [
  { id: 'lander', short: { en: 'Lander', tr: 'İniş aracı' }, name: { en: 'Solar lander · 14 days', tr: 'Güneş enerjili iniş aracı · 14 gün' },
    desc: { en: 'A robotic lander (CLPS class): two weeks of science, lands within about 1 km.', tr: 'Robotik iniş aracı (CLPS sınıfı): iki hafta bilim, yaklaşık 1 km hassasiyetle iner.' },
    days: 14, sun: 70, earth: 50, shadow: 48, batt: 2000, zone: 1000, zslope: 12, ice: 0, dsn: true },
  { id: 'crew', short: { en: 'Crewed', tr: 'İnsanlı' }, name: { en: 'Crewed landing · 7 days', tr: 'İnsanlı iniş · 7 gün' },
    desc: { en: 'Astronauts on the surface: near-constant sunlight and Earth contact, precision landing on gentle ground.', tr: 'Yüzeyde astronotlar: neredeyse sürekli güneş ve Dünya bağlantısı, düz zemine hassas iniş.' },
    days: 7, sun: 90, earth: 80, shadow: 12, batt: 8000, zone: 100, zslope: 8, ice: 0, dsn: true },
  { id: 'rover', short: { en: 'Rover', tr: 'Gezgin' }, name: { en: 'Ice rover · 21 days', tr: 'Buz gezgini · 21 gün' },
    desc: { en: 'A three-week rover base (VIPER-style): tolerates long shadows with a big battery, ice within 2 km.', tr: 'Üç haftalık gezgin üssü (VIPER benzeri): büyük bataryayla uzun gölgelere dayanır, 2 km içinde buz.' },
    days: 21, sun: 50, earth: 40, shadow: 96, batt: 12000, zone: 250, zslope: 12, ice: 2, dsn: true },
  { id: 'long', short: { en: 'Long stay', tr: 'Uzun kalış' }, name: { en: 'Long stay · 28 days', tr: 'Uzun kalış · 28 gün' },
    desc: { en: 'A lander that must live through a whole lunar day cycle.', tr: 'Tam bir Ay günü döngüsünü yaşaması gereken iniş aracı.' },
    days: 28, sun: 60, earth: 50, shadow: 72, batt: 6000, zone: 500, zslope: 12, ice: 0, dsn: true },
  { id: 'sprint', short: { en: 'Sprint', tr: 'Kısa görev' }, name: { en: 'Short sprint · 5 days', tr: 'Kısa görev · 5 gün' },
    desc: { en: 'A small, short mission: almost no darkness allowed, small battery.', tr: 'Küçük ve kısa görev: neredeyse hiç karanlık yok, küçük batarya.' },
    days: 5, sun: 80, earth: 70, shadow: 24, batt: 1000, zone: 1000, zslope: 12, ice: 0, dsn: true },
  { id: 'night', short: { en: 'Night', tr: 'Gece' }, name: { en: 'Night survivor · 30 days', tr: 'Geceye dayanıklı · 30 gün' },
    desc: { en: 'Built to survive darkness (heaters, big battery) next to the ice: ice within 5 km.', tr: 'Buzun yanında karanlığa dayanacak şekilde (ısıtıcı, büyük batarya): 5 km içinde buz.' },
    days: 30, sun: 40, earth: 30, shadow: 240, batt: 20000, zone: 500, zslope: 12, ice: 5, dsn: false },
]

// a scenario is the mission (how long, how much Sun and Earth, ice); the battery and landing precision come from
// the chosen lander, so they are not part of the match
const KEYS: (keyof ScenarioParams)[] = ['sun', 'earth', 'shadow', 'ice', 'dsn']

/** The scenario whose settings match exactly, if any. */
export function matchScenario(p: ScenarioParams): Scenario | undefined {
  return SCENARIOS.find((s) => KEYS.every((k) => s[k] === p[k]))
}

/** Ranking: most GO landing dates, then best score; picks at least `minKm` apart. */
export function rankTop(results: PointResult[], atlas: Atlas, n = 10, minKm = 6): PointResult[] {
  const order = [...results].sort((a, b) => b.goCount - a.goCount || b.bestScore - a.bestScore)
  const picks: PointResult[] = []
  for (const r of order) {
    if (picks.length >= n) break
    if (picks.every((q) => Math.hypot(atlas.xKm[q.index] - atlas.xKm[r.index], atlas.yKm[q.index] - atlas.yKm[r.index]) >= minKm)) picks.push(r)
  }
  return picks
}

/** One scenario's outcome over a landing window. */
export interface ScenarioOutcome {
  id: string
  searched: number          // points flat enough to search
  goSites: number           // points GO on at least one landing date
  best: PointResult | null
  ms: number
  windowDays: number        // landing dates actually checked (the window can be cut by the end of the data)
}

export function summarise(id: string, results: PointResult[], atlas: Atlas, ms: number, windowDays: number): ScenarioOutcome {
  const best = rankTop(results, atlas, 1)[0] ?? null
  return { id, searched: results.length, goSites: results.filter((r) => r.goCount > 0).length, best, ms, windowDays }
}
