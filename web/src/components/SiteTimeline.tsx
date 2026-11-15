// Site-page timeline: countdowns after touchdown, a 0–10 day launch slip, and nearby GO dates.
import { useMemo, useState } from 'react'
import { CalendarCheck, Earth, Hourglass, Sun, Timer } from 'lucide-react'
import type { Lang } from '../i18n'
import type { CardSite } from './SiteCard'
import type { SiteCtx } from './SiteExtras'
import '../timeline.css'
import {
  SLIP_MAX,
  buildTimeline,
  clockSummary,
  coverageNote,
  datesNote,
  deltaLabel,
  ephemHourAt,
  ephemLength,
  ephemSide,
  formatDay,
  formatSpan,
  hourIso,
  limitNote,
  rightNowText,
  slipLine,
  touchdownText,
  type BodyClock,
  type GoDate,
} from '../siteTimeline'

function ClockGrid({ sun, earth, lang }: { sun: BodyClock; earth: BodyClock; lang: Lang }) {
  const tr = lang === 'tr'
  const cells: { key: string; tone: string; label: string; h: number | null; summary: string }[] = [
    { key: 'ss', tone: 'tl-sun', label: tr ? 'Güneş batar' : 'Sun sets', h: sun.setInH, summary: clockSummary('sun', sun, lang) },
    { key: 'sr', tone: 'tl-sun', label: tr ? 'Güneş doğar' : 'Sun rises', h: sun.riseInH, summary: clockSummary('sun', sun, lang) },
    { key: 'es', tone: 'tl-earth', label: tr ? 'Dünya batar' : 'Earth sets', h: earth.setInH, summary: clockSummary('earth', earth, lang) },
    { key: 'er', tone: 'tl-earth', label: tr ? 'Dünya doğar' : 'Earth rises', h: earth.riseInH, summary: clockSummary('earth', earth, lang) },
  ]
  return (
    <div className="sx-grid">
      {cells.map((cell) => (
        <div key={cell.key} className={cell.tone} title={cell.summary}>
          <span className="tl-lab">{cell.tone === 'tl-sun' ? <Sun size={12} /> : <Earth size={12} />}{cell.label}</span>
          <b className={cell.h === null ? 'tl-na' : undefined}>{cell.h === null ? '—' : formatSpan(cell.h, lang)}</b>
        </div>
      ))}
    </div>
  )
}

export default function SiteTimeline({ ctx, s, lang, onPickDate }: {
  ctx: SiteCtx
  s: CardSite
  lang: Lang
  /** UTC day (YYYY-MM-DD) of a GO landing the visitor picked. */
  onPickDate?: (isoDate: string) => void
}) {
  const tr = lang === 'tr'
  const { atlas, eph, dsn, c, firstHour, days, needDsn, relay, startUnix } = ctx
  const index = s.r.index
  const bestStart = s.r.bestStart
  const nowMs = Date.now()
  const hourKey = ephemHourAt(startUnix, ephemLength(eph), nowMs) ?? ephemSide(startUnix, ephemLength(eph), nowMs)
  // cKey stands in for ctx.c. The site page builds a new constraints object on every render.
  const cKey = `${c.duration_days}|${c.min_sun_frac}|${c.min_comm_frac}|${c.max_dark_hours}|${c.array_peak_w}|${c.load_w}|${c.battery_wh}|${c.initial_soc}|${c.charge_eff}|${c.discharge_eff}|${c.min_soc}|${c.weights[0]}|${c.weights[1]}|${c.weights[2]}`
  const data = useMemo(() => buildTimeline({
    atlas, eph, dsn, index, firstHour, bestStart, days, needDsn, relay, c, startUnix, nowMs,
  }), [atlas, eph, dsn, index, firstHour, bestStart, days, needDsn, relay, cKey, startUnix, hourKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const slipKey = `${index}:${Math.round(firstHour)}:${Math.round(bestStart)}`
  const [slipState, setSlipState] = useState({ slipKey, slip: 0 })
  const slip = slipState.slipKey === slipKey ? slipState.slip : 0
  const pickSlip = (n: number) => setSlipState({ slipKey, slip: Math.max(0, Math.min(SLIP_MAX, n)) })
  const shown = data.slips[slip] ?? data.slips[0]
  const live = data.nowSun !== null && data.nowEarth !== null
  const dates: GoDate[] = data.prev ? [data.prev, ...data.next] : data.next
  const note = datesNote(data.prev !== null, data.next.length, lang)
  const slipped = formatDay(hourIso(startUnix, data.landingHour + slip * 24), lang)

  return (
    <div className="sx tl">
      <section className="sx-box" aria-label={tr ? 'Geri sayım' : 'Countdown'}>
        <div className="sx-h"><Timer size={18} /><b>{tr ? 'Geri sayım' : 'Countdown'}</b>
          <span>{tr
            ? 'Seçilen inişten ve, bugün katalogda varsa, bu saatten Güneş ile Dünya.'
            : 'Sun and Earth from the chosen landing, and from this hour when today is in the catalogue.'}</span></div>
        <div className="tl-block">
          <p className="tl-kicker">{tr ? 'İnişten sonra' : 'After touchdown'} · {formatDay(data.landingIso, lang)}</p>
          <p className="tl-line">{touchdownText(data.landingSun, data.landingEarth, lang)}</p>
          <ClockGrid sun={data.landingSun} earth={data.landingEarth} lang={lang} />
        </div>
        <div className="tl-now">
          <p className="tl-kicker">{tr ? 'Şu an' : 'Right now'}</p>
          <p className="tl-line">{live && data.nowSun && data.nowEarth
            ? rightNowText(data.nowSun, data.nowEarth, lang)
            : (coverageNote(startUnix, ephemLength(eph), nowMs, lang) ?? '')}</p>
          {live && data.nowSun && data.nowEarth && <ClockGrid sun={data.nowSun} earth={data.nowEarth} lang={lang} />}
        </div>
        <p className="sx-note">{limitNote(needDsn, relay, lang)}</p>
      </section>

      <section className="sx-box" aria-label={tr ? 'Fırlatma gecikirse' : 'If the launch slips'}>
        <div className="sx-h"><Hourglass size={18} /><b>{tr ? 'Fırlatma gecikirse' : 'If the launch slips'}</b>
          <span>{tr ? 'Aynı görev, iniş en fazla 10 gün sonra.' : 'The same mission, landing up to 10 days later.'}</span></div>
        <label className="tl-slip">
          <span>{tr ? 'Gecikme' : 'Delay'}</span>
          <input type="range" className="rng" min={0} max={SLIP_MAX} step={1} value={slip}
            aria-label={tr ? 'Fırlatma gecikmesi, gün' : 'Launch delay in days'}
            aria-valuetext={slipLine(shown, c, lang)}
            onChange={(e) => pickSlip(Number(e.target.value))} />
          <b>{slip}{tr ? ' g' : ' d'}</b>
        </label>
        <p className={`tl-why ${shown.covered && shown.go ? 'go' : 'nogo'}`}>{slipLine(shown, c, lang)}</p>
        <p className="sx-note">{tr ? 'Kaymış iniş' : 'Slipped landing'} · {slipped}</p>
        <div className="tl-strip" role="group" aria-label={tr ? '0 ile 10 gün gecikme' : 'Delay of 0 to 10 days'}>
          {data.slips.map((v) => {
            const tone = !v.covered ? 'off' : v.go ? 'go' : 'nogo'
            return (
              <button key={v.slip} type="button" className={`tl-cell ${tone}`} aria-pressed={v.slip === slip}
                aria-label={slipLine(v, c, lang)} title={slipLine(v, c, lang)}
                onClick={() => pickSlip(v.slip)}>{v.slip}</button>
            )
          })}
        </div>
        <p className="sx-note">{tr
          ? 'Her kutu bir gün daha gecikme. Yeşil: GO. Kırmızı: NO-GO. Çizgili: verinin dışı.'
          : 'Each cell is one extra day of delay. Green: GO. Red: NO-GO. Hatched: past the data.'}</p>
      </section>

      <section className="sx-box" aria-label={tr ? 'Uygun iniş günleri' : 'Dates that work'}>
        <div className="sx-h"><CalendarCheck size={18} /><b>{tr ? 'Uygun iniş günleri' : 'Dates that work'}</b>
          <span>{tr
            ? 'İki yıl içinde önceki GO günü ve sonraki üç gün.'
            : 'The previous GO day and the next three, within two years.'}</span></div>
        {dates.length > 0 && (
          <div className="tl-chips">
            {dates.map((d) => (
              <button key={`${d.deltaDays}:${d.iso}`} type="button" className={`tl-chip${d.deltaDays < 0 ? ' prev' : ''}`}
                onClick={() => onPickDate?.(d.iso)} title={d.iso}>
                <small>{deltaLabel(d.deltaDays, lang)}</small>
                <b>{formatDay(d.iso, lang)}</b>
              </button>
            ))}
          </div>
        )}
        {note && <p className="sx-note">{note}</p>}
      </section>
    </div>
  )
}
