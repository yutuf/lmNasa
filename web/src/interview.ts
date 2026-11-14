// Step-by-step mission interview. The page collects a one-sentence brief, then asks only for what is still
// missing. Parsing is local and works offline; sun, Earth, darkness and battery are copied from the scenario
// presets (crew / lander / rover / long), never invented. A server model may fill gaps; it cannot override
// a fact the local parser already read, and it cannot set those four limits.
import { FIRST_DATE, LAST_DATE } from './data'
import { parseMission } from './lunaLocal'
import { SCENARIOS, type Scenario } from './scenarios'
import { GOALS, SCIENCE_KIND, SCIENCE_SITES, farSide, inPoleGrid, type ScienceKind } from './scienceSites'
import { HIDDEN_LANDERS, LANDERS, ROVERS } from './vehicles'

export type Lang = 'en' | 'tr'

export interface InterviewResult {
  name: string
  goal: ScienceKind | null
  target: string | null
  days: number
  start: string
  lander: string
  rover: string
  crewed: boolean
  relay: boolean
  scope: 'pole' | 'moon'
  sun: number
  earth: number
  shadow: number
  batt: number
}

/** What the brief and the answers have established. Undefined means the interview has not learned it yet. */
export interface MissionDraft {
  brief: string
  goal?: ScienceKind | null
  target?: string | null
  days?: number
  start?: string
  lander?: string
  /** A rover id, null when the user declined a rover, undefined when still open. */
  rover?: string | null
  crewed?: boolean
  relay?: boolean
  scope?: 'pole' | 'moon'
  /** Set when the user named south pole or the whole Moon, so a later goal edit does not wipe it. */
  scopeSource?: 'user'
  farSide?: boolean
  longStay?: boolean
  wantsRover?: boolean
}

export type QuestionId = 'crew' | 'goal' | 'relay' | 'lander' | 'days' | 'rover' | 'scope' | 'when'

export interface InterviewChoice {
  id: string
  label: string
  hint?: string
  recommended?: boolean
}

export interface InterviewQuestion {
  id: QuestionId
  prompt: string
  choices: InterviewChoice[]
}

export interface MissionSummary {
  result: InterviewResult
  title: string
  body: string
  rows: { key: string; label: string; value: string }[]
}

export const FOLLOW_UP_LIMIT = 5

const DEFAULT_START = '2027-03-01'
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const KINDS: readonly ScienceKind[] = ['ice', 'volcanic', 'impact', 'magnetic', 'pit', 'history', 'artemis']
const ORDER: readonly QuestionId[] = ['crew', 'goal', 'relay', 'lander', 'days', 'rover', 'scope', 'when']

// Longer phrases win, so "Nobile Rim 2" does not become the Nobile ice crater and "lava tube" is not a volcano.
const SITE_PHRASES: readonly [string, string][] = [
  ['mons mouton plateau', 'a3_mons_mouton_plateau'],
  ['mare tranquillitatis pit', 'tranquillitatis'],
  ['tranquillitatis pit', 'tranquillitatis'],
  ['tranquillity pit', 'tranquillitatis'],
  ['de gerlache rim', 'a3_de_gerlache_rim_2'],
  ['gerlache rim', 'a3_de_gerlache_rim_2'],
  ['south pole aitken', 'spa'],
  ['marius hills pit', 'marius'],
  ['peak near cabeus', 'a3_peak_near_cabeus_b'],
  ['mare moscoviense', 'moscoviense'],
  ['mare ingenii pit', 'ingeniipit'],
  ['compton belkovich', 'compton'],
  ['nobile rim 2', 'a3_nobile_rim_2'],
  ['nobile rim 1', 'a3_nobile_rim_1'],
  ['haworth crater', 'haworth'],
  ['mons mouton', 'a3_mons_mouton'],
  ['reiner gamma', 'reinergamma'],
  ['shiv shakti', 'chandrayaan3'],
  ['mare ingenii', 'ingenii'],
  ['lacus mortis', 'mortis'],
  ['mons rumker', 'rumker'],
  ['de gerlache', 'degerlache'],
  ['slater plain', 'a3_slater_plain'],
  ['nobile rim', 'a3_nobile_rim_1'],
  ['ingenii pit', 'ingeniipit'],
  ['cabeus b', 'a3_peak_near_cabeus_b'],
  ['apollo 11', 'apollo11'],
  ['apollo 15', 'apollo15'],
  ['apollo 17', 'apollo17'],
  ['change 4', 'change4'],
  ['change4', 'change4'],
  ['marius hills', 'mariusdomes'],
  ['chandrayaan', 'chandrayaan3'],
  ['schrodinger', 'schrodinger'],
  ['aristarchus', 'aristarchus'],
  ['gruithuisen', 'gruithuisen'],
  ['moscoviense', 'moscoviense'],
  ['shackleton', 'shackleton'],
  ['malapert', 'a3_malapert_massif'],
  ['belkovich', 'compton'],
  ['faustini', 'faustini'],
  ['sverdrup', 'sverdrup'],
  ['amundsen', 'amundsen'],
  ['orientale', 'orientale'],
  ['copernicus', 'copernicus'],
  ['lunokhod', 'lunokhod1'],
  ['descartes', 'descartes'],
  ['gerlache', 'degerlache'],
  ['compton', 'compton'],
  ['haworth', 'haworth'],
  ['slater', 'a3_slater_plain'],
  ['cabeus', 'cabeus'],
  ['nobile', 'nobile'],
  ['rumker', 'rumker'],
  ['hermite', 'hermite'],
  ['aitken', 'spa'],
  ['tycho', 'tycho'],
  ['lassell', 'lassell'],
  ['ingenii', 'ingenii'],
]

const WHEN_CHOICES: readonly { id: string; en: string; tr: string }[] = [
  { id: '2027-03-01', en: 'March 2027', tr: 'Mart 2027' },
  { id: '2027-09-01', en: 'September 2027', tr: 'Eylül 2027' },
  { id: '2028-03-01', en: 'March 2028', tr: 'Mart 2028' },
  { id: '2030-01-01', en: 'January 2030', tr: 'Ocak 2030' },
]

const scenario = (id: string): Scenario => {
  const found = SCENARIOS.find((s) => s.id === id)
  if (!found) throw new Error(`missing scenario ${id}`)
  return found
}

const landerOf = (id: string) => [...LANDERS, ...HIDDEN_LANDERS].find((l) => l.id === id)
const hlsMax = () => LANDERS.find((l) => l.id === 'hls')!.maxDays
const apolloMax = () => LANDERS.find((l) => l.id === 'apollo')!.maxDays
const siteById = (id: string | null | undefined) => SCIENCE_SITES.find((s) => s.id === id)
const isKind = (id: string): id is ScienceKind => (KINDS as readonly string[]).includes(id)

/** ASCII folding so Turkish briefs and English briefs share one set of keywords. */
function fold(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’‘`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function phraseAt(text: string, phrase: string): number {
  let from = 0
  while (from <= text.length - phrase.length) {
    const i = text.indexOf(phrase, from)
    if (i < 0) return -1
    const before = i === 0 || text[i - 1] === ' '
    const end = i + phrase.length
    const after = end === text.length || text[end] === ' '
    if (before && after) return i
    from = i + 1
  }
  return -1
}

const has = (text: string, phrase: string) => phraseAt(text, phrase) >= 0

export function validStart(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return false
  return iso >= FIRST_DATE && iso <= LAST_DATE
}

export function formatStart(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number)
  const name = (lang === 'tr' ? MONTH_TR : MONTH_EN)[m - 1]
  if (!y || !name || !d) return iso
  return lang === 'tr' ? `${d} ${name} ${y}` : `${name} ${d}, ${y}`
}

function clampStart(iso: string): string {
  if (iso < FIRST_DATE) return FIRST_DATE
  if (iso > LAST_DATE) return LAST_DATE
  return iso
}

function matchSite(text: string): string | null {
  let best: { id: string; phrase: string; at: number; len: number } | null = null
  for (const [phrase, id] of SITE_PHRASES) {
    const at = phraseAt(text, phrase)
    if (at < 0) continue
    const len = phrase.length
    if (!best || len > best.len || (len === best.len && at < best.at)) best = { id, phrase, at, len }
  }
  if (!best) return null
  // "Haworth" alone is the ice crater. With Artemis, and without the word crater, it is the candidate region.
  if (best.phrase === 'haworth' && has(text, 'artemis')) return 'a3_haworth'
  return best.id
}

function goalsIn(text: string): ScienceKind[] {
  const found: ScienceKind[] = []
  const pit = /\blava tubes?\b|\blav tup\w*\b|\blav tunel\w*\b|\bcaves?\b|\bmagara\w*\b|\bskylights?\b|\btavan pencere\w*\b/.test(text)
  if (pit) found.push('pit')
  if (/\bmagnet\w*\b|\bmanyetik\w*\b|\breiner gamma\b/.test(text)) found.push('magnetic')
  const bareLava = /\blava\b/.test(text) && !/\blava tubes?\b|\blav tup/.test(text)
  if (!pit && (/\bvolcan\w*\b|\bvolkan\w*\b/.test(text) || bareLava)) found.push('volcanic')
  if (/\bwater ice\b|\bsu buzu\b|\bice\b|\bbuz\w*\b|\bwater\b|\bcold traps?\b|\bsoguk tuzak\w*\b/.test(text)) found.push('ice')
  if (/\bhistory\b|\bhistoric\w*\b|\btarih\w*\b|\bfootprints?\b|\bayak iz\w*\b/.test(text)) found.push('history')
  if (/\bartemis\b/.test(text)) found.push('artemis')
  if (/\bapollo\b/.test(text) && !found.includes('history')) found.push('history')
  if (/\bmantle\b|\bmanto\b|\bdeep crust\b|\bderin kabuk\b/.test(text)) found.push('impact')
  return found
}

function readLander(text: string): string | undefined {
  if (has(text, 'starship') || has(text, 'hls')) return 'hls'
  if (has(text, 'apollo lm') || has(text, 'apollo lander') || has(text, 'lunar module') || has(text, 'apollo module')) return 'apollo'
  if (has(text, 'vikram')) return 'vikram'
  if (has(text, 'nova c') || has(text, 'novac') || has(text, 'nova')) return 'nova'
  if (has(text, 'blue ghost') || has(text, 'blueghost')) return 'ghost'
  if (has(text, 'blue moon') || has(text, 'bluemoon')) return 'bluemoon'
  return undefined
}

function readRover(text: string): { rover?: string | null; wants?: boolean } {
  if (/\bno rover\b|\bwithout a rover\b|\brover yok\b|\bgezgin yok\b|\bgezginsiz\b|\bgezgin olmadan\b/.test(text)) return { rover: null, wants: false }
  if (has(text, 'viper')) return { rover: 'viper', wants: true }
  if (has(text, 'pragyan')) return { rover: 'pragyan', wants: true }
  if (has(text, 'yutu 2') || has(text, 'yutu2') || has(text, 'yutu')) return { rover: 'yutu', wants: true }
  if (has(text, 'lunar roving vehicle') || has(text, 'moon buggy') || has(text, 'ay arabasi') || has(text, 'lrv')) return { rover: 'lrv', wants: true }
  if (/\brovers?\b|\bgezgin\b|\bgezici\b/.test(text)) return { wants: true }
  return {}
}

function maskVehicles(text: string): string {
  return text
    .replace(/\bapollo lm\b|\bapollo lander\b|\blunar module\b|\bapollo module\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readClock(original: string, folded: string, now: Date): { days?: number; start?: string } {
  const first = parseMission(original, now)
  const out: { days?: number; start?: string } = {}
  if (typeof first.days === 'number') out.days = first.days
  if (typeof first.start === 'string') out.start = clampStart(first.start)
  if (out.days === undefined || out.start === undefined) {
    const second = parseMission(folded, now)
    if (out.days === undefined && typeof second.days === 'number') out.days = second.days
    if (out.start === undefined && typeof second.start === 'string') out.start = clampStart(second.start)
  }
  if (out.days !== undefined) out.days = Math.max(1, Math.min(30, Math.round(out.days)))
  if (out.start && !validStart(out.start)) out.start = clampStart(out.start)
  return out
}

function targetIsFar(id: string | null | undefined): boolean {
  const site = siteById(id)
  return !!site && farSide(site.lat, site.lon)
}

function farNeeded(d: MissionDraft): boolean {
  return !!d.farSide || targetIsFar(d.target)
}

function crewCap(d: MissionDraft): number {
  return d.lander === 'apollo' ? apolloMax() : hlsMax()
}

function daysOk(d: MissionDraft): boolean {
  if (d.days === undefined || !Number.isInteger(d.days) || d.days < 1 || d.days > 30) return false
  if (d.crewed === true && d.days > crewCap(d)) return false
  return true
}

function needsScope(d: MissionDraft): boolean {
  if (d.scope || d.target || d.farSide) return false
  if (d.goal === 'ice' || d.goal === null) return true
  return false
}

function needs(q: QuestionId, d: MissionDraft): boolean {
  switch (q) {
    case 'crew': return d.crewed === undefined
    case 'goal': return d.goal === undefined && !d.target
    case 'relay': return d.relay === undefined && farNeeded(d)
    case 'lander': return d.crewed === true && d.lander !== 'hls' && d.lander !== 'apollo'
    case 'days': return !daysOk(d)
    case 'rover': return d.rover === undefined && (d.crewed === false || (d.crewed === true && !!d.wantsRover))
    case 'scope': return needsScope(d)
    case 'when': return !d.start || !validStart(d.start)
    default: return false
  }
}

/** A free-text brief becomes a partial mission. Missing fields stay undefined so the interview can ask. */
export function parseBrief(text: string, now = new Date('2026-11-14')): MissionDraft {
  const brief = text.trim().slice(0, 2000)
  const t = fold(brief)
  const clock = readClock(brief, t, now)
  const draft: MissionDraft = { brief }
  if (clock.days !== undefined) draft.days = clock.days
  if (clock.start) draft.start = clock.start

  if (/\blong stay\b|\blong duration\b|\buzun kali\w*\b|\buzun sure\w*\b/.test(t)) {
    draft.longStay = true
    if (draft.days === undefined) draft.days = scenario('long').days
  }

  const lander = readLander(t)
  if (lander) draft.lander = lander
  const rover = readRover(t)
  if (rover.rover !== undefined) draft.rover = rover.rover
  if (rover.wants !== undefined) draft.wantsRover = rover.wants

  const siteId = matchSite(t)
  const site = siteById(siteId)
  if (site) draft.target = site.id
  const kinds = goalsIn(maskVehicles(t))
  if (kinds.length === 1) draft.goal = kinds[0]
  else if (kinds.length === 0 && site) draft.goal = site.kind

  const crewHit = /\b(crewed|crew|astronauts?|astronot\w*|insanli|murettebat|humans?)\b/.test(t)
  const robotHit = /\b(robotic|robotik|uncrewed|unmanned|insansiz|clps)\b/.test(t) || /\brobot\b/.test(t)
  const namedArtemis = kinds.includes('artemis') || (site?.kind === 'artemis' && has(t, 'artemis'))
  if (crewHit && !robotHit) draft.crewed = true
  else if (robotHit && !crewHit) draft.crewed = false
  else if (!crewHit && !robotHit && (draft.lander === 'hls' || draft.lander === 'apollo')) draft.crewed = true
  else if (!crewHit && !robotHit && draft.lander && landerOf(draft.lander)?.crew === 0) draft.crewed = false
  else if (!crewHit && !robotHit && (draft.wantsRover || typeof draft.rover === 'string')) draft.crewed = false
  else if (!crewHit && !robotHit && namedArtemis) draft.crewed = true

  // "yüzde" keeps a suffix after the fold, so the far-side phrase is "uzak yuz" plus any ending.
  draft.farSide = /\bfar side\b|\bfarside\b|\buzak yuz\w*\b/.test(t) || targetIsFar(draft.target)
  if (/\bno relay\b|\brolesiz\b|\brelay off\b|\brole yok\b/.test(t)) draft.relay = false
  else if (/\brelay\b|\brole uydu\b|\brole ile\b|\bbir role\b/.test(t)) draft.relay = true

  const poleW = /\bsouth pole\b|\bguney kutb\w*\b|\bpolar\b|\bkutup\w*\b/.test(t)
  const moonW = /\bwhole moon\b|\bentire moon\b|\ball of the moon\b|\btum ay\b|\bbutun ay\b|\bayin tamami\b/.test(t)
  const sitePole = site ? inPoleGrid(site) : undefined
  const poleFits = poleW && !moonW && !(site && sitePole === false)
  const moonFits = moonW && !poleW && !(site && sitePole === true)
  if (poleFits) { draft.scope = 'pole'; draft.scopeSource = 'user' }
  else if (moonFits) { draft.scope = 'moon'; draft.scopeSource = 'user' }
  else if (!poleW && !moonW && site) draft.scope = sitePole ? 'pole' : 'moon'
  else if (!poleW && !moonW && draft.farSide) draft.scope = 'moon'

  return draft
}

/** The next thing to ask, or null when the brief is complete enough to summarise. At most five follow-ups. */
export function nextQuestion(draft: MissionDraft, asked: readonly QuestionId[] = []): QuestionId | null {
  if (asked.length >= FOLLOW_UP_LIMIT) return null
  for (const q of ORDER) {
    if (asked.includes(q)) continue
    if (needs(q, draft)) return q
  }
  return null
}

/** After the user edits one field on the summary, one more question if the edit broke the vehicle or the length. */
export function followUpAfterEdit(draft: MissionDraft): QuestionId | null {
  if (draft.crewed === true && draft.lander !== 'hls' && draft.lander !== 'apollo') return 'lander'
  if (!daysOk(draft)) return 'days'
  if (!draft.start || !validStart(draft.start)) return 'when'
  if (draft.relay === undefined && farNeeded(draft)) return 'relay'
  return null
}

function dayLabel(n: number, lang: Lang): string {
  return lang === 'tr' ? `${n} gün` : `${n} ${n === 1 ? 'day' : 'days'}`
}

function roverChoices(draft: MissionDraft, lang: Lang): InterviewChoice[] {
  const tr = lang === 'tr'
  const meta: Record<string, { en: string; tr: string; hintEn: string; hintTr: string }> = {
    viper: { en: 'VIPER', tr: 'VIPER', hintEn: 'Ice drill', hintTr: 'Buz matkabı' },
    yutu: { en: 'Yutu-2', tr: 'Yutu-2', hintEn: 'Far side, sleeps the night', hintTr: 'Uzak yüz, geceyi uyur' },
    pragyan: { en: 'Pragyan', tr: 'Pragyan', hintEn: 'Small, south pole', hintTr: 'Küçük, güney kutbu' },
    lrv: { en: 'Lunar Roving Vehicle', tr: 'Ay arabası', hintEn: 'Crew buggy, batteries', hintTr: 'Mürettebat, yalnız batarya' },
  }
  const none: InterviewChoice = { id: 'none', label: tr ? 'Gezgin yok' : 'No rover', hint: tr ? 'Yalnız iniş aracı' : 'Lander only' }
  const far = farNeeded(draft)
  const ids = far ? ['yutu', 'viper', 'pragyan', 'lrv'] : ['viper', 'pragyan', 'yutu', 'lrv']
  const lead = far ? 'yutu' : draft.goal === 'ice' || draft.wantsRover ? 'viper' : 'none'
  const chips: InterviewChoice[] = ids.map((id) => ({
    id,
    label: tr ? meta[id].tr : meta[id].en,
    hint: tr ? meta[id].hintTr : meta[id].hintEn,
    recommended: id === lead,
  }))
  if (lead === 'none') return [{ ...none, recommended: true }, ...chips]
  return [...chips, none]
}

function setGoal(draft: MissionDraft, goal: ScienceKind | null): MissionDraft {
  const next: MissionDraft = { ...draft, goal }
  if (next.scopeSource !== 'user') next.scope = undefined
  if (next.target) {
    const site = siteById(next.target)
    if (!site || (goal && site.kind !== goal)) next.target = null
  }
  if (!next.scope && next.target) {
    const site = siteById(next.target)
    if (site) next.scope = inPoleGrid(site) ? 'pole' : 'moon'
  } else if (!next.scope && next.farSide) next.scope = 'moon'
  if (goal === 'artemis' && next.crewed === undefined) next.crewed = true
  return next
}

function setCrew(draft: MissionDraft, crewed: boolean): MissionDraft {
  const next: MissionDraft = { ...draft, crewed }
  if (crewed && next.lander && next.lander !== 'hls' && next.lander !== 'apollo') next.lander = undefined
  if (!crewed && (next.lander === 'hls' || next.lander === 'apollo')) next.lander = undefined
  return next
}

function setLander(draft: MissionDraft, id: 'hls' | 'apollo'): MissionDraft {
  const cap = id === 'apollo' ? apolloMax() : hlsMax()
  return { ...draft, lander: id, crewed: true, days: draft.days !== undefined && draft.days > cap ? undefined : draft.days }
}

/** Prompt and quick replies for one question, in the user's language. */
export function questionFor(id: QuestionId, draft: MissionDraft, lang: Lang): InterviewQuestion {
  const tr = lang === 'tr'
  const cap = draft.crewed === true ? crewCap(draft) : 30
  if (id === 'crew') {
    return {
      id,
      prompt: tr ? 'Gemide insan var mı, yoksa robotik bir uçuş mu?' : 'Is anyone on board, or is this a robotic flight?',
      choices: [
        { id: 'crew', label: tr ? 'İnsanlı' : 'Crewed', hint: tr ? `En fazla ${hlsMax()} gün` : `Up to ${hlsMax()} days` },
        { id: 'robot', label: tr ? 'Robotik' : 'Robotic', hint: tr ? 'İniş aracı veya gezgin' : 'Lander or rover' },
      ],
    }
  }
  if (id === 'goal') {
    const choices: InterviewChoice[] = KINDS.map((k) => ({ id: k, label: GOALS[k][lang] }))
    choices.push({ id: 'none', label: tr ? 'Yalnızca güvenli bir iniş' : 'Just a safe landing' })
    return { id, prompt: tr ? 'Bu görev ne için?' : 'What is this mission for?', choices }
  }
  if (id === 'relay') {
    const far = farNeeded(draft)
    return {
      id,
      prompt: far
        ? (tr
          ? 'Uzak yüzde Dünya ufkun altında kalır. İniş aracının eve haber vermesi için bir röle uydu gerekir. Röle açılsın mı?'
          : 'On the far side Earth stays below the horizon. The lander needs a relay satellite to call home. Turn the relay on?')
        : (tr ? 'Bir röle uydu eklensin mi?' : 'Add a relay satellite?'),
      choices: [
        { id: 'yes', label: tr ? 'Röle olsun' : 'Use a relay', recommended: far },
        { id: 'no', label: tr ? 'Röle olmasın' : 'No relay' },
      ],
    }
  }
  if (id === 'lander') {
    const hls = LANDERS.find((l) => l.id === 'hls')!
    const apollo = LANDERS.find((l) => l.id === 'apollo')!
    return {
      id,
      prompt: tr
        ? `Hangi insanlı iniş aracı? ${hls.name} yaklaşık ${hls.maxDays} gün kalır. ${apollo.name} bataryayla yaklaşık ${apollo.maxDays} gün kalır.`
        : `Which crew lander? ${hls.name} is built for about ${hls.maxDays} days. ${apollo.name} stays about ${apollo.maxDays} days on batteries.`,
      choices: [
        { id: 'hls', label: hls.name, hint: tr ? `yaklaşık ${hls.maxDays} gün` : `about ${hls.maxDays} days`, recommended: true },
        { id: 'apollo', label: apollo.name, hint: tr ? `yaklaşık ${apollo.maxDays} gün` : `about ${apollo.maxDays} days` },
      ],
    }
  }
  if (id === 'days') {
    const prompt = draft.crewed === true
      ? (tr ? `Yüzeyde kaç gün? İnsanlı kalış en fazla ${cap} gün.` : `How many days on the surface? A crew stay is ${cap} days at most.`)
      : (tr ? 'Görev kaç gün sürsün?' : 'How many days should the mission run?')
    let choices: InterviewChoice[]
    if (draft.crewed === true && draft.lander === 'apollo') {
      choices = [3, 2, 1].map((n) => ({ id: String(n), label: dayLabel(n, lang), recommended: n === 3 }))
    } else if (draft.crewed === true) {
      choices = [hlsMax(), 5, 3].filter((n) => n <= cap).map((n) => ({ id: String(n), label: dayLabel(n, lang), recommended: n === hlsMax() }))
    } else {
      const lead = draft.longStay ? scenario('long').days : (draft.wantsRover || draft.rover || draft.goal === 'ice' ? scenario('rover').days : scenario('lander').days)
      const rest = [scenario('sprint').days, scenario('lander').days, scenario('rover').days, scenario('long').days]
      const nums = [lead, ...rest.filter((n) => n !== lead)]
      choices = nums.map((n) => ({ id: String(n), label: dayLabel(n, lang), recommended: n === lead }))
    }
    return { id, prompt, choices }
  }
  if (id === 'rover') {
    const prompt = farNeeded(draft)
      ? (tr ? 'Uzak yüzde, Ay gecesini uyuyarak geçirebilen bir gezgin daha uygun. Hangisi insin?' : 'On the far side, a rover that can sleep through the lunar night fits better. Which one drives off?')
      : (tr ? 'İniş aracından bir gezgin inecek mi?' : 'Will a rover drive off the lander?')
    return { id, prompt, choices: roverChoices(draft, lang) }
  }
  if (id === 'scope') {
    const ice = draft.goal === 'ice'
    return {
      id,
      prompt: ice
        ? (tr ? 'Su buzu, Güneş’in ulaşmadığı kraterlerde güney kutbunda birikir. Güney kutbunda mı arayalım?' : 'Water ice collects at the south pole, in craters the Sun does not reach. Search the south pole?')
        : (tr ? 'Güney kutbunda mı arayalım, tüm Ay’da mı?' : 'Search the south pole, or the whole Moon?'),
      choices: [
        { id: 'pole', label: tr ? 'Güney kutbu' : 'South pole', hint: tr ? '2 km ızgara' : '2 km grid', recommended: ice || draft.goal === 'artemis' || draft.goal === null || draft.goal === undefined },
        { id: 'moon', label: tr ? 'Tüm Ay' : 'Whole Moon', hint: tr ? 'Yaklaşık 30 km' : 'About 30 km' },
      ],
    }
  }
  return {
    id: 'when',
    prompt: tr
      ? `İniş penceresi ne zaman açılsın? Takvim ${formatStart(FIRST_DATE, lang)} ile ${formatStart(LAST_DATE, lang)} arasında.`
      : `When should the landing window open? Dates run from ${formatStart(FIRST_DATE, lang)} to ${formatStart(LAST_DATE, lang)}.`,
    choices: WHEN_CHOICES.map((c) => ({ id: c.id, label: lang === 'tr' ? c.tr : c.en })),
  }
}

function applyChoice(draft: MissionDraft, q: QuestionId, id: string): MissionDraft {
  if (q === 'crew' && (id === 'crew' || id === 'robot')) return setCrew(draft, id === 'crew')
  if (q === 'goal' && (id === 'none' || isKind(id))) return setGoal(draft, id === 'none' ? null : id)
  if (q === 'relay' && (id === 'yes' || id === 'no')) return { ...draft, relay: id === 'yes' }
  if (q === 'lander' && (id === 'hls' || id === 'apollo')) return setLander(draft, id)
  if (q === 'days') {
    const n = Number(id)
    if (Number.isInteger(n) && n >= 1 && n <= 30) return { ...draft, days: n }
  }
  if (q === 'rover' && id === 'none') return { ...draft, rover: null, wantsRover: false }
  if (q === 'rover' && ROVERS.some((r) => r.id === id)) {
    return { ...draft, rover: id, wantsRover: true, crewed: draft.crewed ?? false }
  }
  if (q === 'scope' && (id === 'pole' || id === 'moon')) return { ...draft, scope: id, scopeSource: 'user' }
  if (q === 'when' && validStart(id)) return { ...draft, start: id }
  return { ...draft }
}

function mergeMissing(base: MissionDraft, extra: MissionDraft): MissionDraft {
  const next: MissionDraft = { ...base }
  if (next.goal === undefined && extra.goal !== undefined) next.goal = extra.goal
  if (next.target === undefined && extra.target) next.target = extra.target
  if (next.days === undefined && extra.days !== undefined) next.days = extra.days
  if (next.start === undefined && extra.start) next.start = extra.start
  if (next.lander === undefined && extra.lander) next.lander = extra.lander
  if (next.rover === undefined && extra.rover !== undefined) next.rover = extra.rover
  if (next.crewed === undefined && extra.crewed !== undefined) next.crewed = extra.crewed
  if (next.relay === undefined && extra.relay !== undefined) next.relay = extra.relay
  if (next.scope === undefined && extra.scope) { next.scope = extra.scope; next.scopeSource = extra.scopeSource }
  if (extra.farSide) next.farSide = true
  if (extra.longStay) next.longStay = true
  if (next.wantsRover === undefined && extra.wantsRover !== undefined) next.wantsRover = extra.wantsRover
  return next
}

function bareDays(text: string): number | undefined {
  const m = text.match(/^(\d{1,2})$/)
  if (!m) return undefined
  const n = Number(m[1])
  return n >= 1 && n <= 30 ? n : undefined
}

function overlay(base: MissionDraft, q: QuestionId, text: string, parsed: MissionDraft): MissionDraft {
  const t = fold(text)
  if (q === 'days') {
    const n = parsed.days ?? bareDays(t)
    return n === undefined ? base : { ...base, days: n }
  }
  if (q === 'when') return parsed.start ? { ...base, start: parsed.start } : base
  if (q === 'crew') {
    if (parsed.crewed !== undefined) return setCrew(base, parsed.crewed)
    if (/^(crewed|crew|astronaut|astronauts|insanli|astronot|human|humans)$/.test(t)) return setCrew(base, true)
    if (/^(robotic|robot|robotik|uncrewed|unmanned|insansiz|clps)$/.test(t)) return setCrew(base, false)
    return base
  }
  if (q === 'goal') {
    if (parsed.goal) return setGoal(base, parsed.goal)
    if (/^(none|no goal|just land|guvenli|guvenli inis)$/.test(t) || /\b(no science|just a safe landing|bilim yok)\b/.test(t)) return setGoal(base, null)
    return base
  }
  if (q === 'lander') {
    if (parsed.lander === 'hls' || parsed.lander === 'apollo') return setLander(base, parsed.lander)
    if (has(t, 'starship') || has(t, 'hls')) return setLander(base, 'hls')
    if (has(t, 'apollo')) return setLander(base, 'apollo')
    return base
  }
  if (q === 'rover') {
    if (parsed.rover !== undefined) return { ...base, rover: parsed.rover, wantsRover: parsed.rover !== null, crewed: base.crewed ?? false }
    if (/^(none|no|no rover|yok|hayir|without)$/.test(t) || /\bno rover\b|\bgezgin yok\b|\bgezginsiz\b/.test(t)) return { ...base, rover: null, wantsRover: false }
    return base
  }
  if (q === 'relay') {
    if (/^(no|hayir|off|kapali|no relay|rolesiz)$/.test(t) || /\bno relay\b|\brolesiz\b|\bwithout a relay\b/.test(t)) return { ...base, relay: false }
    if (/^(yes|evet|on|ack|relay)$/.test(t) || /\brelay\b|\brole uydu\b/.test(t)) return { ...base, relay: true }
    if (parsed.relay !== undefined) return { ...base, relay: parsed.relay }
    return base
  }
  if (q === 'scope') {
    if (parsed.scopeSource === 'user' && parsed.scope) return { ...base, scope: parsed.scope, scopeSource: 'user' }
    if (/\b(pole|kutup)\b/.test(t) && !/\b(whole|entire|tum|butun)\b/.test(t)) return { ...base, scope: 'pole', scopeSource: 'user' }
    if (/\b(whole moon|entire moon|tum ay|butun ay)\b/.test(t) || t === 'moon' || t === 'ay') return { ...base, scope: 'moon', scopeSource: 'user' }
    return base
  }
  return base
}

/** Apply a chip id or a typed answer. Returns the same draft when the answer did not resolve the question. */
export function applyAnswer(draft: MissionDraft, q: QuestionId, answer: string): MissionDraft {
  const trimmed = answer.trim()
  if (!trimmed) return draft
  const chip = questionFor(q, draft, 'en').choices.find((c) => c.id === trimmed)
  let next: MissionDraft
  if (chip) next = applyChoice(draft, q, chip.id)
  else {
    let extra = parseBrief(trimmed)
    // "Apollo" on the lander question is the lunar module, not a history goal.
    if (q === 'lander') extra = { ...extra, goal: undefined, target: undefined }
    next = overlay(mergeMissing(draft, extra), q, trimmed, extra)
  }
  return needs(q, next) ? draft : next
}

function presetFor(crewed: boolean, rover: string, days: number, longStay: boolean): Scenario {
  // Crew limits come first: astronauts need the crewed preset even if a rover is also aboard.
  // A rover mission uses the rover preset; the long-stay preset is the lander that lives a lunar day.
  if (crewed) return scenario('crew')
  if (rover) return scenario('rover')
  if (longStay || days >= scenario('long').days) return scenario('long')
  return scenario('lander')
}

function landerName(id: string): string {
  return landerOf(id)?.name ?? id
}

function roverName(id: string): string {
  return ROVERS.find((r) => r.id === id)?.name ?? id
}

function missionTitle(crewed: boolean, goal: ScienceKind | null, lang: Lang): string {
  const who = crewed ? (lang === 'tr' ? 'İnsanlı' : 'Crewed') : (lang === 'tr' ? 'Robotik' : 'Robotic')
  const what = goal ? GOALS[goal][lang] : (lang === 'tr' ? 'Ay inişi' : 'Moon landing')
  return `${who} · ${what}`
}

/** Fill every field the search needs. Unanswered crew becomes a robotic flight so a search can still run. */
export function finalize(draft: MissionDraft, lang: Lang = 'en'): InterviewResult {
  const site = siteById(draft.target)
  const goal: ScienceKind | null = draft.goal === undefined ? (site?.kind ?? null) : draft.goal
  // "Just a safe landing" drops a named place. Otherwise the named place stays with the goal.
  const target = goal === null ? null : (site?.id ?? null)
  const crewed = draft.crewed ?? false
  let lander = draft.lander
  if (crewed) {
    if (lander !== 'hls' && lander !== 'apollo') lander = 'hls'
  } else if (!lander || !landerOf(lander)) {
    lander = LANDERS[0].id
  }
  let rover = ''
  if (typeof draft.rover === 'string' && ROVERS.some((r) => r.id === draft.rover)) rover = draft.rover
  else if (draft.rover === null) rover = ''
  else if (!crewed && draft.wantsRover) rover = farNeeded(draft) ? 'yutu' : 'viper'

  let days = draft.days
  if (crewed) {
    const cap = lander === 'apollo' ? apolloMax() : hlsMax()
    const fallback = lander === 'apollo' ? apolloMax() : scenario('crew').days
    days = Math.min(days ?? fallback, cap)
    days = Math.max(1, days)
  } else {
    if (days === undefined) {
      days = rover ? scenario('rover').days : draft.longStay ? scenario('long').days : scenario('lander').days
    }
    days = Math.max(1, Math.min(30, days))
  }

  const preset = presetFor(crewed, rover, days, !!draft.longStay && !rover)
  const far = farNeeded(draft)
  const relay = draft.relay ?? far
  let scope = draft.scope
  const placed = siteById(target)
  if (!scope && placed) scope = inPoleGrid(placed) ? 'pole' : 'moon'
  if (!scope && far) scope = 'moon'
  if (!scope && (goal === 'ice' || goal === 'artemis')) scope = 'pole'
  if (!scope && goal) scope = 'moon'
  if (!scope) scope = 'pole'
  const start = draft.start && validStart(draft.start) ? draft.start : (validStart(DEFAULT_START) ? DEFAULT_START : FIRST_DATE)

  return {
    name: missionTitle(crewed, goal, lang),
    goal,
    target,
    days,
    start,
    lander: lander!,
    rover,
    crewed,
    relay,
    scope,
    sun: preset.sun,
    earth: preset.earth,
    shadow: preset.shadow,
    batt: preset.batt,
  }
}

/** Write the summary defaults back onto the draft so a later edit starts from the mission that will actually run. */
export function commit(draft: MissionDraft): MissionDraft {
  const m = finalize(draft, 'en')
  return {
    ...draft,
    goal: m.goal,
    target: m.target,
    days: m.days,
    start: m.start,
    lander: m.lander,
    rover: m.rover ? m.rover : null,
    crewed: m.crewed,
    relay: m.relay,
    scope: m.scope,
    farSide: draft.farSide || targetIsFar(m.target),
  }
}

function presetLabel(id: string, lang: Lang): string {
  const labels: Record<string, Record<Lang, string>> = {
    crew: { en: 'crewed-landing', tr: 'insanlı iniş' },
    lander: { en: 'robotic-lander', tr: 'robotik iniş aracı' },
    rover: { en: 'rover', tr: 'gezgin' },
    long: { en: 'long-stay', tr: 'uzun kalış' },
  }
  return labels[id]?.[lang] ?? id
}

function whichPreset(m: InterviewResult, longStay: boolean): Scenario {
  return presetFor(m.crewed, m.rover, m.days, longStay && !m.rover)
}

/** Plain-language card: where we will search, for how long, and which preset supplied the four limits. */
export function summaryCopy(draft: MissionDraft, lang: Lang): MissionSummary {
  const result = finalize(draft, lang)
  const tr = lang === 'tr'
  const preset = whichPreset(result, !!draft.longStay)
  const lander = landerName(result.lander)
  const rover = result.rover ? roverName(result.rover) : ''
  const where = result.scope === 'pole'
    ? (tr ? 'güney kutbu (2 km ızgara)' : 'the south pole (2 km grid)')
    : (tr ? 'tüm Ay (yaklaşık 30 km ızgara)' : 'the whole Moon (about 30 km grid)')
  const craft = tr
    ? `${result.crewed ? 'mürettebatlı ' : ''}${lander}${rover ? ` ve ${rover} gezgini` : ''}`
    : `${result.crewed ? `${lander} with a crew` : lander}${rover ? ` and the ${rover} rover` : ''}`
  const place = result.target ? (tr ? ` İniş, ${siteById(result.target)?.name ?? result.target} yakınında kalmalı.` : ` The landing has to stay near ${siteById(result.target)?.name ?? result.target}.`) : ''
  const goalSentence = result.goal
    ? (tr ? ` Bilim amacı: ${SCIENCE_KIND[result.goal].label.tr}.` : ` Science goal: ${SCIENCE_KIND[result.goal].label.en}.`)
    : (tr ? ' Güç ve radyo sınırını geçen her nokta sıralanabilir.' : ' Any site that meets the power and radio limits can rank.')
  const far = farNeeded(draft) || targetIsFar(result.target)
  const relaySentence = far && result.relay
    ? (tr ? ' Bu hedefte Dünya ufkun altında kalır; radyoyu eve bir röle uydu taşır.' : ' Earth stays below the horizon at this target, so a relay satellite carries the radio home.')
    : far && !result.relay
      ? (tr ? ' Bu hedefte Dünya ufkun altında kalır ve röle kapalıdır; doğrudan eve bağlantı geçmez.' : ' Earth stays below the horizon here and the relay is off, so a direct link home will not pass.')
      : result.relay
        ? (tr ? ' Bir röle uydu görevde.' : ' A relay satellite is included.')
        : ''
  const limits = tr
    ? ` Güneş, Dünya, karanlık ve batarya “${presetLabel(preset.id, lang)}” hazır ayarından gelir: en az %${result.sun} güneş, en az %${result.earth} Dünya, ${result.shadow} saatten uzun karanlık yok, ${result.batt} Wh batarya.`
    : ` Sunlight, Earth in the sky, longest darkness and battery come from the ${presetLabel(preset.id, lang)} preset: at least ${result.sun}% sun, at least ${result.earth}% Earth, no darkness longer than ${result.shadow} hours, and a ${result.batt} Wh battery.`
  const shortened = typeof draft.days === 'number' && draft.days > result.days
    ? (tr ? ` İstenen ${draft.days} gün bu araçta ${result.days} güne iner.` : ` You asked for ${draft.days} days; this vehicle is limited to ${result.days}.`)
    : ''
  const body = (tr
    ? `${where[0].toUpperCase()}${where.slice(1)} üzerinde ${craft} için ${result.days} gün çalışılabilecek bir iniş yeri arayacağız. Pencere ${formatStart(result.start, lang)} tarihinde açılır.${place}${goalSentence} ${relaySentence}${limits}${shortened}`
    : `We will search ${where} for a place ${craft} can land and operate for ${result.days} days. The window opens ${formatStart(result.start, lang)}.${place}${goalSentence} ${relaySentence}${limits}${shortened}`)
    .replace(/\s+/g, ' ').trim()

  const rows: MissionSummary['rows'] = [
    { key: 'where', label: tr ? 'Arama' : 'Search', value: result.scope === 'pole' ? (tr ? 'Güney kutbu' : 'South pole') : (tr ? 'Tüm Ay' : 'Whole Moon') },
    { key: 'goal', label: tr ? 'Amaç' : 'Goal', value: result.goal ? `${GOALS[result.goal][lang]}${result.target ? ` · ${siteById(result.target)?.name ?? ''}` : ''}` : (tr ? 'Güvenli iniş' : 'Safe landing') },
    { key: 'craft', label: tr ? 'Araç' : 'Vehicle', value: rover ? `${lander} + ${rover}` : lander },
    { key: 'stay', label: tr ? 'Kalış' : 'Stay', value: tr ? `${result.days} gün` : `${result.days} days` },
    { key: 'date', label: tr ? 'İlk tarih' : 'Window opens', value: formatStart(result.start, lang) },
    { key: 'sun', label: tr ? 'Güneş' : 'Sunlight', value: tr ? `%${result.sun}` : `${result.sun}%` },
    { key: 'earth', label: tr ? 'Dünya' : 'Earth', value: tr ? `%${result.earth}` : `${result.earth}%` },
    { key: 'dark', label: tr ? 'Karanlık' : 'Darkness', value: tr ? `${result.shadow} sa` : `${result.shadow} h` },
    { key: 'batt', label: tr ? 'Batarya' : 'Battery', value: `${result.batt} Wh` },
    { key: 'relay', label: tr ? 'Röle' : 'Relay', value: result.relay ? (tr ? 'Açık' : 'On') : (tr ? 'Kapalı' : 'Off') },
  ]
  return { result, title: result.name, body, rows }
}

const caught = (draft: MissionDraft, lang: Lang): string[] => {
  const tr = lang === 'tr'
  const bits: string[] = []
  if (draft.crewed === true) bits.push(tr ? 'insanlı' : 'crewed')
  if (draft.crewed === false) bits.push(tr ? 'robotik' : 'robotic')
  if (draft.lander) bits.push(landerName(draft.lander))
  if (draft.goal) bits.push(GOALS[draft.goal][lang])
  if (draft.target) bits.push(siteById(draft.target)?.name ?? draft.target)
  if (draft.rover) bits.push(roverName(draft.rover))
  if (draft.days) bits.push(tr ? `${draft.days} gün` : `${draft.days} days`)
  if (draft.start) bits.push(formatStart(draft.start, lang))
  if (draft.scope === 'pole') bits.push(tr ? 'güney kutbu' : 'south pole')
  if (draft.scope === 'moon') bits.push(tr ? 'tüm Ay' : 'whole Moon')
  if (draft.farSide) bits.push(tr ? 'uzak yüz' : 'far side')
  return bits
}

export function acknowledge(draft: MissionDraft, lang: Lang, done = false): string {
  const tr = lang === 'tr'
  const bits = caught(draft, lang)
  if (!bits.length) {
    return done
      ? (tr ? 'Not aldım. Özet hazır.' : 'Noted. The summary is ready.')
      : (tr ? 'Bunu not aldım. Yalnızca eksik kalanları soracağım.' : 'Noted. I will only ask for what is still missing.')
  }
  const list = bits.join(', ')
  if (done) return tr ? `Şunu anladım: ${list}. Başka bir şey eksik değil.` : `Here is what I caught: ${list}. Nothing else is missing.`
  return tr ? `Şunu anladım: ${list}. Yalnızca eksik kalanları soracağım.` : `Here is what I caught: ${list}. I will only ask for what is still missing.`
}

export function openingLine(lang: Lang): string {
  return lang === 'tr'
    ? 'Görevini bir cümleyle anlat. Ay’a ne için gidiyorsun?'
    : 'Tell me about your mission in a sentence. What are you going to the Moon for?'
}

export function examples(lang: Lang): string[] {
  return lang === 'tr'
    ? [
        'Güney kutbunda su buzu arayan iki haftalık robotik görev',
        "Mart 2028'de Starship HLS ile 5 günlük insanlı Artemis inişi",
        'Uzak yüzde Schrödinger havzasına bir gezgin',
      ]
    : [
        'A two-week robotic mission to find water ice at the south pole',
        'Crewed Artemis landing on Starship HLS for 5 days in March 2028',
        'A rover to Schrödinger basin on the far side',
      ]
}

export function readyLine(lang: Lang): string {
  return lang === 'tr' ? 'Görev hazır. Aramadan önce özeti kontrol et.' : 'The mission is ready. Check the summary, then search.'
}

export function retryLine(lang: Lang): string {
  return lang === 'tr'
    ? 'Bunu ayıramadım. Bir seçeneğe dokun veya birkaç kelimeyle yaz.'
    : 'I could not read that. Tap an option, or type it in a few words.'
}

export function changeLine(lang: Lang): string {
  return lang === 'tr' ? 'Neyi değiştirmek istersin?' : 'What do you want to change?'
}

/** True when the server assistant might still know a day count, a date, or a goal the local parser missed. */
export function shouldAskModel(draft: MissionDraft): boolean {
  return draft.days === undefined || draft.start === undefined || (draft.goal === undefined && !draft.target)
}

/**
 * Copy days, a landing date, or an ice goal out of an /api/ask search action.
 * Local facts win. Sun, Earth, darkness and battery from the model are ignored.
 */
export function mergeAskParams(draft: MissionDraft, params: Record<string, number | string | boolean> | null | undefined): MissionDraft {
  if (!params) return draft
  const next: MissionDraft = { ...draft }
  if (next.days === undefined && typeof params.days === 'number' && Number.isFinite(params.days)) {
    const days = Math.round(params.days)
    if (days >= 1 && days <= 30) next.days = days
  }
  if (next.start === undefined && typeof params.start === 'string' && validStart(params.start)) next.start = params.start
  if (next.goal === undefined && !next.target && typeof params.ice === 'number' && params.ice > 0) next.goal = 'ice'
  return next
}
