// Site page extras: the antenna/panel mast "what if" and the 2026-2045 mission calendar for this site.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, RadioTower } from 'lucide-react'
import { calendarLegend, fmtHoursShort, fmtPercent, verdictLabel, type Lang } from '../i18n'
import type { Atlas, Ephem } from '../engine'
import type { Constraints } from '../model'
import { mastEffect, missionCalendar, type MastResult } from '../siteExtras'
import type { CardSite } from './SiteCard'

export interface SiteCtx {
  atlas: Atlas; eph: Ephem; dsn: ArrayLike<boolean>; c: Constraints
  firstHour: number; days: number; needDsn: boolean; relay: boolean; startUnix: number
}

const MASTS = [0, 2, 5, 10]

function Calendar({ go, startUnix, firstDay, lang }: { go: Uint8Array; startUnix: number; firstDay: number; lang: Lang }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const y0 = new Date(startUnix * 1000).getUTCFullYear()
  const years = Array.from({ length: 2045 - y0 + 1 }, (_, k) => y0 + k)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const cw = 2, ch = 9, gap = 3
    cv.width = 366 * cw; cv.height = years.length * (ch + gap)
    const x = cv.getContext('2d')!
    x.clearRect(0, 0, cv.width, cv.height)
    for (let d = 0; d < go.length; d++) {
      const t = new Date((startUnix + d * 86400) * 1000)
      const row = t.getUTCFullYear() - y0
      const doy = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400e3)
      x.fillStyle = go[d] ? '#3ddc84' : 'rgba(255,255,255,0.07)'
      if (d >= firstDay && d < firstDay + 30) x.fillStyle = go[d] ? '#ffffff' : 'rgba(255,255,255,0.35)'
      x.fillRect(doy * cw, row * (ch + gap), cw, ch)
    }
  }, [go, startUnix, firstDay]) // eslint-disable-line react-hooks/exhaustive-deps
  const share = go.length ? Math.round((go.reduce((a, b) => a + b, 0) / go.length) * 100) : 0
  const months = lang === 'tr' ? ['Oca', 'Nis', 'Tem', 'Eki'] : ['Jan', 'Apr', 'Jul', 'Oct']
  return (
    <div className="sx-cal">
      <div className="sx-cal-grid">
        <div className="sx-years">{years.map((y) => <span key={y}>{y}</span>)}</div>
        <div className="sx-canvas"><canvas ref={ref} /><div className="sx-months">{months.map((m) => <span key={m}>{m}</span>)}</div></div>
      </div>
      <p className="sx-note">{calendarLegend(share, lang)}</p>
    </div>
  )
}

export default function SiteExtras({ ctx, s, lang }: { ctx: SiteCtx; s: CardSite; lang: Lang }) {
  const tr = lang === 'tr'
  const [mast, setMast] = useState(0)
  const [res, setRes] = useState<Record<number, MastResult | null>>({})
  const polar = ctx.atlas.kind === 'pole'
  const args = [ctx.atlas, ctx.eph, ctx.dsn, s.r.index, ctx.firstHour, s.r.bestStart, ctx.days, ctx.needDsn, ctx.relay, ctx.c] as const
  useEffect(() => {
    if (!polar) return
    let live = true
    for (const m of [0, mast]) {
      if (res[m] !== undefined) continue
      mastEffect(...args, m).then((r) => { if (live) setRes((o) => ({ ...o, [m]: r })) }).catch(() => {})
    }
    return () => { live = false }
  }, [mast, s.r.index]) // eslint-disable-line react-hooks/exhaustive-deps
  // the calendar: computed once per site, after the page has painted
  const [cal, setCal] = useState<Uint8Array | null>(null)
  useEffect(() => {
    const id = setTimeout(() => setCal(missionCalendar(ctx.atlas, ctx.eph, ctx.dsn, s.r.index, ctx.days, ctx.needDsn, ctx.relay, ctx.c)), 60)
    return () => clearTimeout(id)
  }, [s.r.index]) // eslint-disable-line react-hooks/exhaustive-deps
  const firstDay = useMemo(() => Math.round(ctx.firstHour / 24), [ctx.firstHour])
  const base = res[0], cur = res[mast]
  const delta = (a: number | undefined, b: number | undefined, kind: 'pct' | 'h') => {
    if (a === undefined || b === undefined) return ''
    const n = Math.round(Math.abs(b - a))
    if (n === 0) return ''
    const sign = b > a ? '+' : '−'
    if (kind === 'h') return ` (${sign}${n}${tr ? ' sa' : ' h'})`
    return tr ? ` (${sign}%${n})` : ` (${sign}${n}%)`
  }
  return (
    <div className="sx">
      {polar && (
        <section className="sx-box">
          <div className="sx-h"><RadioTower size={18} /><b>{tr ? 'Anten / panel direği' : 'Antenna / panel mast'}</b>
            <span>{tr ? 'Gözü yükseltmek yakın sırtları alçaltır: daha çok güneş, daha çok Dünya.' : 'Raising the eye lowers the nearby ridges: more Sun, more Earth.'}</span></div>
          <div className="seg sx-seg">{MASTS.map((m) => <button key={m} className={mast === m ? 'on' : ''} onClick={() => setMast(m)}>{m === 0 ? (tr ? 'Yok' : 'None') : `${m} m`}</button>)}</div>
          {cur ? (
            <div className="sx-grid">
              <div><span>{tr ? 'Güneş' : 'Sunlight'}</span><b>{fmtPercent(cur.sunPct, lang)}<em>{delta(base?.sunPct, cur.sunPct, 'pct')}</em></b></div>
              <div><span>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</span><b>{fmtPercent(cur.earthPct, lang)}<em>{delta(base?.earthPct, cur.earthPct, 'pct')}</em></b></div>
              <div><span>{tr ? 'En uzun karanlık' : 'Longest dark'}</span><b>{fmtHoursShort(cur.darkH, lang)}<em>{delta(base?.darkH, cur.darkH, 'h')}</em></b></div>
              <div><span>{tr ? 'Ufuk alçalır' : 'Horizon drops'}</span><b>{cur.lowerDeg.toFixed(2)}°</b></div>
              <div className={cur.go ? 'ok' : 'bad'}><span>{tr ? 'Karar' : 'Verdict'}</span><b>{verdictLabel(cur.go, lang)}</b></div>
            </div>
          ) : <p className="sx-note">{tr ? 'Hesaplanıyor…' : 'Computing…'}</p>}
          <p className="sx-note">{tr ? 'En iyi iniş tarihinde; ufuk 200 m kutup arazisinden 40 km’ye kadar ışın izlenerek yeniden hesaplandı.' : 'On the best landing date; the horizon is re-traced from the 200 m polar terrain out to 40 km.'}</p>
        </section>
      )}
      <section className="sx-box">
        <div className="sx-h"><CalendarRange size={18} /><b>{tr ? 'Bu görev burada ne zaman inebilir?' : 'When can this mission land here?'}</b>
          <span>{tr ? '2026’dan 2045’e her iniş günü, aynı gereksinimlerle.' : 'Every landing day from 2026 to 2045, same requirements.'}</span></div>
        {cal ? <Calendar go={cal} startUnix={ctx.startUnix} firstDay={firstDay} lang={lang} /> : <p className="sx-note">{tr ? 'Hesaplanıyor…' : 'Computing…'}</p>}
      </section>
    </div>
  )
}
