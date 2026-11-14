// Offline "Ask Luna": answers without any AI service, so the guide still works with no API key, no network, or
// when the AI service fails. It understands mission descriptions (duration, month or season, year, Earth contact,
// darkness, battery, landing precision, named scenarios) and the common questions about results, in English and
// Turkish, and like the AI guide it only uses numbers from the page's context.
import type { Lang } from './i18n'
import { FIRST_DATE, LAST_DATE } from './data'
import type { LunaAction } from './components/Luna'

interface Ctx {
  settings?: Record<string, number | string | boolean>
  results?: { rank: number; goLandingDates: number; bestLanding: string; artemisRegion: string | null; place: string | null
    bestWindow: { sunlightPct: number; earthContactPct: number; longestDarkHours: number }; slopeDeg: number
    zoneSlopeP95Deg?: number | null }[]
  engine?: { landingDatesInWindow: number; pointsChecked: number } | null
  selected?: { rank: number; verdict: string; sunlightPct: number; earthContactPct: number; longestDarkHours: number
    batterySurvives: boolean; batteryNeededWh: number; goOnEachLandingDate: string[] } | null
  scenarios?: { id: string; name: string }[]
}

export interface LocalReply { reply: string; action: LunaAction | null }

const MONTHS: [RegExp, number][] = [
  [/\bjan(uary)?\b|(^|\s)ocak/, 1], [/\bfeb(ruary)?\b|şubat|subat/, 2], [/\bmar(ch)?\b|(^|\s)mart/, 3], [/\bapr(il)?\b|(^|\s)nisan/, 4],
  [/\bin may\b|\bmay 20\d\d|mayıs|mayis/, 5], [/\bjune?\b|haziran/, 6], [/\bjuly?\b|temmuz/, 7], [/\baug(ust)?\b|ağustos|agustos/, 8],
  [/\bsep(t(ember)?)?\b|eylül|eylul/, 9], [/\boct(ober)?\b|(^|\s)ekim/, 10], [/\bnov(ember)?\b|kasım|kasim/, 11], [/\bdec(ember)?\b|aralık|aralik/, 12],
]
const SEASONS: [RegExp, number][] = [
  [/(autumn|fall\b|sonbahar|güz)/, 9], [/(spring|bahar|ilkbahar)/, 3], [/(summer|yaz\b|yazın|yazin)/, 6], [/(winter|kış|kis\b|kışın)/, 12],
]
const NUM_WORDS: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5 }

const pad = (n: number) => String(n).padStart(2, '0')
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s] ?? NaN)

/** Mission settings implied by a free-text description; empty if it does not describe a mission. */
export function parseMission(text: string, now = new Date('2026-11-14')): Record<string, number | string | boolean> {
  const t = text.toLowerCase()
  const p: Record<string, number | string | boolean> = {}
  // duration: "3-week", "21 days", "a month", "3 hafta", "10 gün", "1 ay"
  const d = t.match(/(?:^|[\s(])(\d+|one|a|an|two|three|four|five|six|bir|iki|üç|uc|dört|dort|beş|bes)[\s-]*(weeks?|days?|months?|hafta(lık|lik)?|gün(lük|luk)?|gun(luk)?|ay(lık|lik)?\b)/)
  if (d) {
    const n = num(d[1])
    const unit = d[2]
    const days = /^(week|hafta)/.test(unit) ? n * 7 : /^(month|ay)/.test(unit) ? n * 28 : n
    if (days >= 1) p.days = Math.min(30, Math.round(days))
  }
  // when: month or season, and year
  const year = t.match(/\b(20(?:2[6-9]|3\d|4[0-5]))\b/)?.[1]
  let month = MONTHS.find(([re]) => re.test(t))?.[1]
  month ??= SEASONS.find(([re]) => re.test(t))?.[1]
  if (month || year) {
    const y = Number(year ?? (month && month < now.getUTCMonth() + 1 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()))
    const m = month ?? 1
    let start = `${y}-${pad(m)}-01`
    if (start < FIRST_DATE) start = FIRST_DATE
    if (start > LAST_DATE) start = LAST_DATE
    p.start = start
    if (!month) p.windowDays = 90
  }
  // Earth contact
  if (/(always|constant|continuous|every hour|her zaman|hep|sürekli|surekli|kesintisiz).{0,30}(earth|dünya|dunya|contact|reach|talk|konuş|bağlan)/.test(t) ||
      /(earth|dünya|dunya).{0,20}(always|her zaman|hep|sürekli)/.test(t)) { p.earth = 80; p.dsn = true }
  else if (/(rarely|seldom|no need|don'?t need|gerekmez|önemsiz).{0,25}(earth|dünya|contact|bağlantı)/.test(t)) p.earth = 20
  // darkness / night survival
  if (/(no (night|dark)|never dark|avoid (the )?night|always (in )?(sun|light)|hiç karanlık|gece olmadan|hep güneş)/.test(t)) { p.shadow = 6; p.sun = 90 }
  else if (/(survive (the )?(lunar )?night|night survival|geceyi atlat|gece(yi)? hayatta)/.test(t)) { p.shadow = 120; p.batt = 12000 }
  // battery: "6 kWh", "3000 Wh"
  const kwh = t.match(/(\d+(?:[.,]\d+)?)\s*kwh/)
  const wh = t.match(/(\d{3,5})\s*wh\b/)
  if (kwh) p.batt = Math.min(20000, Math.max(500, Math.round(Number(kwh[1].replace(',', '.')) * 1000)))
  else if (wh) p.batt = Math.min(20000, Math.max(500, Number(wh[1])))
  // landing precision
  if (/(precis|pinpoint|hassas|nokta atışı|crewed|astronaut|human|insanlı|astronot|artemis)/.test(t)) { p.zone = 100; p.zslope = 8 }
  else if (/(robotic|small lander|clps|küçük iniş|robotik)/.test(t)) { p.zone = 1000; p.zslope = 12 }
  // science: close to water ice
  if (/(near|close to|next to|beside|yakın|yanında|yaninda).{0,20}(ice|water|buz|su\b)|(ice|buz).{0,25}(near|nearby|close|within|yakın|yakin)/.test(t)) p.ice = 2
  // rovers drive away from the lander, so the landing site itself can be a little rougher
  if (/(rover|gezgin)/.test(t) && p.zslope === undefined) { p.zone = 250; p.zslope = 12 }
  return p
}

function describeSettings(p: Record<string, number | string | boolean>, lang: Lang): string {
  const parts: string[] = []
  const tr = lang === 'tr'
  if (p.days !== undefined) parts.push(tr ? `${p.days} gün yüzeyde` : `${p.days} days on the surface`)
  if (p.start !== undefined) parts.push(tr ? `${p.start} tarihinden başlayan pencere` : `a landing window from ${p.start}`)
  if (p.earth !== undefined) parts.push(tr ? `en az %${p.earth} Dünya bağlantısı${p.dsn ? ' (DSN ile)' : ''}` : `Earth contact at least ${p.earth}%${p.dsn ? ' (with a DSN dish)' : ''}`)
  if (p.sun !== undefined) parts.push(tr ? `en az %${p.sun} güneş` : `sunlight at least ${p.sun}%`)
  if (p.shadow !== undefined) parts.push(tr ? `en uzun karanlık ${p.shadow} saat` : `longest darkness ${p.shadow} h`)
  if (p.batt !== undefined) parts.push(tr ? `${p.batt} Wh batarya` : `a ${p.batt} Wh battery`)
  if (p.ice !== undefined) parts.push(tr ? `${p.ice} km içinde buz` : `water ice within ${p.ice} km`)
  if (p.zone !== undefined) parts.push(tr ? `${p.zone} m iniş alanı, %95'i ${p.zslope}°'den düz` : `a ${p.zone} m landing zone, 95% gentler than ${p.zslope}°`)
  return parts.join(', ')
}

const pct = (n: number) => `${n}%`

/** Answer a question or a mission description from the page context, without any AI service. */
export function askLocal(question: string, lang: Lang, context: unknown): LocalReply {
  const c = (context ?? {}) as Ctx
  const t = question.toLowerCase()
  const tr = lang === 'tr'
  const res = c.results ?? []
  const label = (r: NonNullable<Ctx['results']>[number]) => [r.place, r.artemisRegion].filter(Boolean)[0] ?? `#${r.rank}`

  // "show #3", "#3'ü göster", "select 2"
  const sel = t.match(/(?:show|select|open|pick|look at|göster|aç|seç)\s*#?(\d+)|#(\d+)\S*\s*(?:göster|aç|seç)/)
  if (sel) {
    const rank = Number(sel[1] ?? sel[2])
    if (rank >= 1 && rank <= res.length) return { reply: tr ? `#${rank} açılıyor: ${label(res[rank - 1])}.` : `Opening #${rank}: ${label(res[rank - 1])}.`, action: { type: 'select', rank } }
  }

  // compare two ranks: "why is #1 better than #2"
  const cmp = t.match(/#?(\d+)\D+#?(\d+)/)
  if (cmp && /(better|worse|compare|vs|versus|iyi|kötü|karşılaştır|fark)/.test(t)) {
    const a = res[Number(cmp[1]) - 1], b = res[Number(cmp[2]) - 1]
    if (a && b) {
      const w = (x: typeof a) => x.bestWindow
      const none = a.goLandingDates === 0 && b.goLandingDates === 0
        ? (tr ? ' Bu gereksinimlerle ikisi de hiçbir tarihte uygun değil; bir gereksinimi gevşetmeyi deneyin.' : ' With these requirements neither passes on any date; try loosening one requirement.')
        : ''
      return { action: null, reply: (tr
        ? `#${a.rank} (${label(a)}) penceredeki ${a.goLandingDates} iniş tarihinde uygun, #${b.rank} (${label(b)}) ise ${b.goLandingDates} tarihte. En iyi tarihlerinde güneş ${pct(w(a).sunlightPct)} ve ${pct(w(b).sunlightPct)}, Dünya bağlantısı ${pct(w(a).earthContactPct)} ve ${pct(w(b).earthContactPct)}, en uzun karanlık ${w(a).longestDarkHours} ve ${w(b).longestDarkHours} saat. Sıralama önce uygun tarih sayısına bakar.`
        : `#${a.rank} (${label(a)}) is GO on ${a.goLandingDates} landing dates in the window and #${b.rank} (${label(b)}) on ${b.goLandingDates}. On their best dates: sunlight ${pct(w(a).sunlightPct)} vs ${pct(w(b).sunlightPct)}, Earth contact ${pct(w(a).earthContactPct)} vs ${pct(w(b).earthContactPct)}, longest darkness ${w(a).longestDarkHours} h vs ${w(b).longestDarkHours} h. The ranking counts GO dates first.`) + none }
    }
  }

  // launch slip: "what if the launch slips a week", "bir hafta gecikirse"
  if (/(slip|delay|late|postpone|gecik|ertele)/.test(t) && c.selected) {
    const m = t.match(/(\d+|one|a|bir|iki|two|three|üç)\s*(weeks?|days?|hafta|gün)/)
    const days = m ? num(m[1]) * (/^(week|hafta)/.test(m[2]) ? 7 : 1) : 7
    const dates = c.selected.goOnEachLandingDate.map((s) => s.split(':'))
    const bestIdx = dates.findIndex(([d]) => d === res[c.selected!.rank - 1]?.bestLanding)
    const from = bestIdx >= 0 ? bestIdx : 0
    const target = dates[from + days]
    if (!target) return { action: null, reply: tr ? `${days} günlük bir gecikme pencerenin dışına çıkıyor; pencereyi uzatıp tekrar arayın.` : `A ${days}-day slip runs past the end of the window; widen the window and search again.` }
    const go = target[1] === 'GO'
    const nextGo = dates.slice(from + days).find(([, v]) => v === 'GO')?.[0]
    return { action: null, reply: tr
      ? `En iyi tarihten ${days} gün sonra (${target[0]}) bu nokta ${go ? 'hâlâ UYGUN' : 'UYGUN DEĞİL'}.${!go && nextGo ? ` Sonraki uygun tarih ${nextGo}.` : ''}`
      : `${days} days after the best date (${target[0]}) this site is ${go ? 'still GO' : 'NO-GO'}.${!go && nextGo ? ` The next GO date is ${nextGo}.` : ''}` }
  }

  // explain the selected result
  if (/(explain|why|what does|mean|simple|kid|child|anlat|neden|niye|ne demek|çocuk|basit)/.test(t) && c.selected) {
    const s = c.selected
    const r = res[s.rank - 1]
    const kid = /(kid|child|10|çocuk|basit|simple)/.test(t)
    if (kid) return { action: null, reply: tr
      ? `Bu iniş aracı güneş paneliyle çalışır ve Dünya ile telsizle konuşur. Bu noktada güneş zamanın ${pct(s.sunlightPct)}'inde görünüyor, Dünya ${pct(s.earthContactPct)}'inde. En uzun karanlık ${s.longestDarkHours} saat sürüyor ve batarya ${s.batterySurvives ? 'bunu atlatıyor' : 'yetmiyor'}. Bu yüzden karar: ${s.verdict === 'GO' ? 'UYGUN' : 'UYGUN DEĞİL'}.`
      : `This lander runs on solar panels and talks to Earth by radio. Here the Sun is up ${pct(s.sunlightPct)} of the time and Earth is in view ${pct(s.earthContactPct)} of the time. The longest dark spell is ${s.longestDarkHours} hours, and the battery ${s.batterySurvives ? 'gets through it' : 'runs out'}. So the answer is ${s.verdict}.` }
    return { action: null, reply: tr
      ? `#${s.rank}${r ? ` (${label(r)})` : ''}: ${s.verdict === 'GO' ? 'UYGUN' : 'UYGUN DEĞİL'}. Güneş ${pct(s.sunlightPct)}, Dünya bağlantısı ${pct(s.earthContactPct)}, en uzun karanlık ${s.longestDarkHours} saat; batarya ${s.batterySurvives ? 'yetiyor' : 'yetmiyor'} (${s.batteryNeededWh} Wh gerekli)${r?.zoneSlopeP95Deg != null ? `; iniş alanının %95'i ${r.zoneSlopeP95Deg.toFixed(1)}°'den düz` : ''}.`
      : `#${s.rank}${r ? ` (${label(r)})` : ''} is ${s.verdict}: sunlight ${pct(s.sunlightPct)}, Earth contact ${pct(s.earthContactPct)}, longest darkness ${s.longestDarkHours} h, and the battery ${s.batterySurvives ? 'lasts' : 'runs out'} (${s.batteryNeededWh} Wh needed)${r?.zoneSlopeP95Deg != null ? `; 95% of the landing zone is gentler than ${r.zoneSlopeP95Deg.toFixed(1)}°` : ''}.` }
  }

  // "best site", "where should we land"
  if (/(best|where|top|en iyi|nereye|nerede)/.test(t) && res.length && !Object.keys(parseMission(t)).length) {
    const r = res[0]
    return { action: { type: 'select', rank: 1 }, reply: tr
      ? `Şu ayarlarla en iyi nokta #1: ${label(r)}. ${c.engine?.landingDatesInWindow ?? '?'} iniş tarihinin ${r.goLandingDates} tanesinde uygun; en iyi tarih ${r.bestLanding}.`
      : `With these settings the best site is #1: ${label(r)}. It is GO on ${r.goLandingDates} of ${c.engine?.landingDatesInWindow ?? '?'} landing dates; best landing ${r.bestLanding}.` }
  }

  // a mission description → new search
  const p = parseMission(question)
  if (Object.keys(p).length) {
    return { action: { type: 'search', params: p }, reply: tr ? `Arama yapılıyor: ${describeSettings(p, lang)}.` : `Searching with ${describeSettings(p, lang)}.` }
  }

  return { action: null, reply: tr
    ? 'Bir görev tarif edebilirsiniz ("2027 baharında 3 haftalık, Dünya ile hep konuşan bir görev"), "#2’yi göster", "#1 neden #2’den iyi?", "bu sonucu anlat" ya da "fırlatma bir hafta gecikirse?" diye sorabilirsiniz.'
    : 'Try describing a mission ("a 3-week mission in spring 2027 that must always reach Earth"), or ask "show #2", "why is #1 better than #2?", "explain this result" or "what if the launch slips a week?".' }
}
