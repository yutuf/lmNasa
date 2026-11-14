// Every landing date in the data range for one site: a month-by-month calendar of GO / NO-GO.
import { useMemo } from 'react'
import { pointTrack, type Atlas, type Ephem } from '../engine'
import { evaluateWindow, type Constraints } from '../model'
import type { Lang } from '../i18n'

interface Props {
  atlas: Atlas; eph: Ephem; dsn: boolean[]; index: number; c: Constraints; days: number; needDsn: boolean
  startUnix: number; lang: Lang; current: string; onPick: (date: string) => void
}

export function yearGo(atlas: Atlas, eph: Ephem, dsn: boolean[], index: number, c: Constraints, days: number, needDsn: boolean) {
  const tr = pointTrack(atlas, eph, dsn, index, 0, eph.n)
  const ev = needDsn ? tr.earthVisible.map((v, k) => v && !!dsn[k]) : tr.earthVisible
  const len = days * 24
  const out: boolean[] = []
  for (let s = 0; s * 24 + len <= eph.n; s++) out.push(evaluateWindow(tr.sunFraction.subarray(s * 24, s * 24 + len), ev.slice(s * 24, s * 24 + len), 1, c).go)
  return out
}

export default function YearView({ atlas, eph, dsn, index, c, days, needDsn, startUnix, lang, current, onPick }: Props) {
  const go = useMemo(() => yearGo(atlas, eph, dsn, index, c, days, needDsn), [atlas, eph, dsn, index, c, days, needDsn])
  // the ephemeris starts at 00:00 UTC; day s = start + s days
  const day0 = Math.round(startUnix / 86400)
  const months = useMemo(() => {
    const m = new Map<string, { label: string; cells: { s: number; d: number; dow: number }[] }>()
    go.forEach((_, s) => {
      const dt = new Date((day0 + s) * 86400e3)
      const key = dt.toISOString().slice(0, 7)
      if (!m.has(key)) m.set(key, { label: dt.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }), cells: [] })
      m.get(key)!.cells.push({ s, d: dt.getUTCDate(), dow: (dt.getUTCDay() + 6) % 7 })
    })
    return [...m.values()]
  }, [go, day0, lang])
  const share = go.filter(Boolean).length / Math.max(1, go.length)
  const iso = (s: number) => new Date((day0 + s) * 86400e3).toISOString().slice(0, 10)
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{lang === 'tr' ? 'Tüm yıl: hangi iniş tarihleri çalışır' : 'All year: which landing dates work'}</h2>
          <p className="sub">{lang === 'tr'
            ? `Bu nokta, ${days} günlük görev için tarihlerin %${Math.round(share * 100)}'inde uygun. Bir güne tıklayın: arama o tarihten başlar.`
            : `This site is GO on ${Math.round(share * 100)}% of landing dates for a ${days}-day mission. Click a day to search from that date.`}</p>
        </div>
      </div>
      <div className="year">
        {months.map((mo) => (
          <div className="month" key={mo.label}>
            <div className="month-label">{mo.label}</div>
            <div className="month-grid">
              {Array.from({ length: mo.cells[0].dow }, (_, k) => <i key={`b${k}`} className="blank" />)}
              {mo.cells.map((cell) => (
                <button key={cell.s} className={`${go[cell.s] ? 'go' : 'nogo'} ${iso(cell.s) === current ? 'cur' : ''}`}
                        title={`${iso(cell.s)} · ${go[cell.s] ? 'GO' : 'NO-GO'}`} onClick={() => onPick(iso(cell.s))} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
