// Two missions head to head: pin the current mission as "A", change anything (goal, length, date, vehicle, relay),
// run again, and the best site of each is compared number by number.
import { ArrowLeftRight, Pin, X } from 'lucide-react'
import type { Lang } from '../i18n'
import type { CardSite } from './SiteCard'

export interface MissionSnap {
  label: string           // mission name and window
  site: string
  goDays: string          // "4/30"
  bestDate: string
  sunPct: number; earthPct: number; darkH: number
  prob: number | null     // 0..1
  slope: number | null; iceKm: number | null
}

export function snapOf(label: string, c: CardSite | undefined): MissionSnap | null {
  if (!c) return null
  return { label, site: c.name, goDays: `${c.r.goCount}/${c.row.windowDays}`, bestDate: c.bestDate, sunPct: c.row.sunPct, earthPct: c.row.earthPct,
    darkH: c.row.longestDarkH, prob: c.prob?.p ?? null, slope: c.row.zoneSlopeDeg ?? c.row.slopeDeg, iceKm: c.row.iceKm }
}

type Row = { k: string; a: number | null; b: number | null; fmt: (v: number) => string; better: 1 | -1 }

export default function MissionCompare({ a, b, lang, onPin, onClear }: { a: MissionSnap | null; b: MissionSnap | null; lang: Lang; onPin: () => void; onClear: () => void }) {
  const tr = lang === 'tr'
  if (!a) {
    return (
      <button className="mc-pin" onClick={onPin} disabled={!b}>
        <Pin size={15} /> {tr ? 'Bu görevi sabitle, sonra başka bir görevle karşılaştır' : 'Pin this mission, then compare it with another'}
      </button>
    )
  }
  const pct = (v: number) => `${Math.round(v)}%`
  const rows: Row[] = b ? [
    { k: tr ? 'Güneş' : 'Sunlight', a: a.sunPct, b: b.sunPct, fmt: pct, better: 1 },
    { k: tr ? 'Dünya bağlantısı' : 'Earth contact', a: a.earthPct, b: b.earthPct, fmt: pct, better: 1 },
    { k: tr ? 'En uzun karanlık' : 'Longest dark', a: a.darkH, b: b.darkH, fmt: (v) => `${v} h`, better: -1 },
    { k: tr ? 'Başarı şansı' : 'Success odds', a: a.prob === null ? null : a.prob * 100, b: b.prob === null ? null : b.prob * 100, fmt: pct, better: 1 },
    { k: tr ? 'Eğim' : 'Slope', a: a.slope, b: b.slope, fmt: (v) => `${v.toFixed(1)}°`, better: -1 },
    { k: tr ? 'Buza uzaklık' : 'To water ice', a: a.iceKm, b: b.iceKm, fmt: (v) => `${v.toFixed(1)} km`, better: -1 },
  ] : []
  const win = (r: Row, side: 'a' | 'b') => r.a !== null && r.b !== null && r.a !== r.b && ((side === 'a') === ((r.a - r.b) * r.better > 0))
  return (
    <div className="mc">
      <div className="mc-h"><ArrowLeftRight size={17} /><b>{tr ? 'İki görev karşı karşıya' : 'Two missions head to head'}</b>
        <button className="icon-btn" onClick={onClear} aria-label={tr ? 'Kaldır' : 'Clear'}><X size={16} /></button></div>
      <div className="mc-grid">
        <div className="mc-col a"><span className="mc-tag">A</span><b>{a.label}</b><small>{a.site} · GO {a.goDays} · {a.bestDate}</small></div>
        <div className="mc-col b"><span className="mc-tag">B</span>{b ? <><b>{b.label}</b><small>{b.site} · GO {b.goDays} · {b.bestDate}</small></> : <small>{tr ? 'Bir şeyi değiştir ve yeniden ara.' : 'Change something and search again.'}</small>}</div>
      </div>
      {b && (
        <table className="mc-table"><tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className={win(r, 'a') ? 'w' : ''}>{r.a === null ? '–' : r.fmt(r.a)}</td>
              <th>{r.k}</th>
              <td className={win(r, 'b') ? 'w' : ''}>{r.b === null ? '–' : r.fmt(r.b)}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}
