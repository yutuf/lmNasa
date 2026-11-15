// Real NASA CLPS (Commercial Lunar Payload Services) deliveries with published landing targets, as one-click missions.
// Targets are the published ones; launch years are as planned at the time of writing and slip often, so the landing
// window used here is illustrative and labelled as such.
import type { Lang } from './i18n'

type T = Record<Lang, string>

export interface ClpsMission {
  id: string
  name: string            // mission name
  company: string
  year: number            // planned launch year
  target: string          // science-site id (scienceSites.ts)
  start: string           // illustrative landing-window start (the search date; may fall the year after `year`)
  days: number
  relay: boolean          // far side: talks home through a relay satellite
  note: T
}

export const CLPS: ClpsMission[] = [
  { id: 'im3', name: 'IM-3', company: 'Intuitive Machines', year: 2026, target: 'reinergamma', start: '2026-12-01', days: 12, relay: false,
    note: { en: 'Nova-C to Reiner Gamma, a bright lunar swirl, to study why it is magnetic.', tr: 'Nova-C, manyetizmasını incelemek için parlak bir Ay girdabı olan Reiner Gamma’ya.' } },
  { id: 'griffin1', name: 'Griffin Mission 1', company: 'Astrobotic', year: 2026, target: 'nobile', start: '2027-02-01', days: 14, relay: false,
    note: { en: 'Griffin with the FLIP rover to the Nobile region near the south pole.', tr: 'Griffin ve FLIP gezgini, güney kutbu yakınındaki Nobile bölgesine.' } },
  { id: 'cp12', name: 'CP-12 (APEX 1.0)', company: 'Draper / ispace-U.S.', year: 2026, target: 'schrodinger', start: '2027-06-01', days: 14, relay: true,
    note: { en: 'To Schrödinger basin on the far side, where Earth never rises: it talks home through relay satellites.', tr: 'Uzak yüzdeki Schrödinger havzasına; Dünya hiç doğmaz, eve röle uydularıyla konuşur.' } },
  { id: 'bg3', name: 'Blue Ghost Mission 3', company: 'Firefly Aerospace', year: 2028, target: 'gruithuisen', start: '2028-03-01', days: 14, relay: false,
    note: { en: 'To the Gruithuisen domes, rare silica-rich volcanoes (the Lunar-VISE instruments).', tr: 'Nadir silika zengini volkanlar olan Gruithuisen kubbelerine (Lunar-VISE aletleri).' } },
]

const CHIP_MONTH = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
}

/**
 * The year printed on a CLPS chip. It is the year of the window that is searched.
 * When that year is later than the planned launch year, the chip keeps the planned year and says
 * which month is actually searched, and when the ephemeris starts (default 2026-11-01).
 */
export function clpsChipWhen(m: ClpsMission, lang: Lang, dataStart = '2026-11-01'): string {
  const searchYear = Number(m.start.slice(0, 4))
  if (searchYear === m.year) return String(m.year)
  const sm = Number(m.start.slice(5, 7)) - 1
  const dm = Number(dataStart.slice(5, 7)) - 1
  const sy = m.start.slice(0, 4)
  const dy = dataStart.slice(0, 4)
  if (lang === 'tr') {
    return `${m.year} (${CHIP_MONTH.tr[sm]} ${sy}’den aranır: veri ${CHIP_MONTH.tr[dm]} ${dy}’da başlar)`
  }
  return `${m.year} (searched from ${CHIP_MONTH.en[sm]} ${sy}: the data starts ${CHIP_MONTH.en[dm]} ${dy})`
}
