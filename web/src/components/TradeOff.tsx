// Survival vs science: every site that passes on at least one landing date, by how often it passes (y) and how far
// the nearest ice cold trap is (x). The best trade-offs (no other site is both closer to ice and passes more often)
// are highlighted and listed in a table below the chart; hover any dot for its numbers, click to open it.
import { useMemo, useState } from 'react'
import type { IceReach, PointResult } from '../engine'
import type { Lang } from '../i18n'
import { paretoFront, type TradePoint } from '../tradeoff'

const W = 640, H = 260, PAD = { l: 44, r: 14, t: 12, b: 34 }
const FRONT = '#3987e5'      // series 1 (dark), validated against the card surface
const REST = '#8a8a93'       // context dots: deliberately gray

const T = {
  title: { en: 'Survival vs science', tr: 'Hayatta kalma ve bilim' },
  sub: { en: 'Every site that passes at least once: how often it passes, and how far the nearest water-ice cold trap is. Blue = best trade-offs (nothing is both closer to ice and passes more often). Click a dot to open the site.',
    tr: 'En az bir kez uygun olan her nokta: ne sıklıkla uygun olduğu ve en yakın su buzu soğuk tuzağının uzaklığı. Mavi = en iyi dengeler (hem buza daha yakın hem daha sık uygun olan başka nokta yok). Noktayı açmak için tıklayın.' },
  x: { en: 'Distance to the nearest ice cold trap (km)', tr: 'En yakın buz soğuk tuzağına uzaklık (km)' },
  y: { en: 'Landing dates GO', tr: 'Uygun iniş tarihi' },
  front: { en: 'Best trade-offs', tr: 'En iyi dengeler' },
  rest: { en: 'Other sites that pass', tr: 'Uygun diğer noktalar' },
  colIce: { en: 'Nearest ice', tr: 'En yakın buz' },
  colArea: { en: 'Ice within 5 km', tr: '5 km içinde buz' },
  none: { en: 'No site passes on any landing date, or none is inside the ice data (85°S to the pole).', tr: 'Hiçbir nokta hiçbir tarihte uygun değil ya da hiçbiri buz verisinin içinde değil (85°G ile kutup arası).' },
}

export default function TradeOff({ results, ice, windowDays, lang, name, onPick }: {
  results: PointResult[]; ice: IceReach; windowDays: number; lang: Lang
  name: (r: PointResult) => string; onPick: (r: PointResult) => void
}) {
  const pts = useMemo(() => results
    .filter((r) => r.goCount > 0 && !Number.isNaN(ice.distKm[r.index]))
    .map((r) => ({ r, d: ice.distKm[r.index], area: ice.areaKm2[r.index], f: r.goCount / windowDays })), [results, ice, windowDays])
  const front = useMemo(() => paretoFront(pts), [pts])
  const [hover, setHover] = useState<TradePoint | null>(null)
  if (!pts.length) return <section className="card"><div className="card-head"><div><h2>{T.title[lang]}</h2></div></div><div className="empty">{T.none[lang]}</div></section>

  const xMax = Math.max(4, Math.ceil(Math.min(30, Math.max(...pts.map((p) => p.d))) / 2) * 2)
  const sx = (d: number) => PAD.l + (Math.min(d, xMax) / xMax) * (W - PAD.l - PAD.r)
  const yMax = Math.min(1, Math.max(0.2, Math.ceil(Math.max(...pts.map((p) => p.f)) * 10) / 10))
  const sy = (f: number) => H - PAD.b - (f / yMax) * (H - PAD.t - PAD.b)
  const xt = Array.from({ length: 5 }, (_, k) => (xMax * k) / 4)
  const yt = Array.from({ length: 5 }, (_, k) => (yMax * k) / 4)
  const frontSet = new Set(front.map((p) => p.r.index))
  const rest = pts.filter((p) => !frontSet.has(p.r.index))
  const step = front.map((p, k) => `${k ? 'H' : 'M'}${sx(p.d).toFixed(1)}${k ? '' : ` ${sy(p.f).toFixed(1)}`} V${sy(p.f).toFixed(1)}`).join(' ')
  const km = (d: number) => `${d.toFixed(d < 10 ? 2 : 1)} km`

  return (
    <section className="card" id="tradeoff">
      <div className="card-head"><div><h2>{T.title[lang]}</h2><p className="sub">{T.sub[lang]}</p></div></div>
      <div className="trade-legend">
        <span><i style={{ background: FRONT }} />{T.front[lang]}</span>
        <span><i style={{ background: REST }} />{T.rest[lang]}</span>
      </div>
      <div className="trade-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.title[lang]} onMouseLeave={() => setHover(null)}>
          {yt.map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(f)} y2={sy(f)} className="grid" />
              <text x={PAD.l - 6} y={sy(f) + 3.5} className="tick" textAnchor="end">{Math.round(f * 100)}%</text>
            </g>
          ))}
          {xt.map((d) => <text key={d} x={sx(d)} y={H - PAD.b + 14} className="tick" textAnchor="middle">{d}</text>)}
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} className="axis" textAnchor="middle">{T.x[lang]}</text>
          <text x={12} y={(PAD.t + H - PAD.b) / 2} className="axis" textAnchor="middle" transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}>{T.y[lang]}</text>
          {rest.map((p) => <circle key={p.r.index} cx={sx(p.d)} cy={sy(p.f)} r={2.6} fill={REST} opacity={0.55} />)}
          <path d={step} fill="none" stroke={FRONT} strokeWidth={2} strokeLinejoin="round" opacity={0.6} />
          {front.map((p) => <circle key={p.r.index} cx={sx(p.d)} cy={sy(p.f)} r={4.5} fill={FRONT} stroke="var(--surface)" strokeWidth={2} />)}
          {/* hit targets bigger than the marks */}
          {pts.map((p) => (
            <circle key={`h${p.r.index}`} cx={sx(p.d)} cy={sy(p.f)} r={frontSet.has(p.r.index) ? 9 : 5} fill="transparent"
                    style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(p)} onClick={() => onPick(p.r)} />
          ))}
          {hover && <circle cx={sx(hover.d)} cy={sy(hover.f)} r={6} fill="none" stroke="var(--text)" strokeWidth={1.5} pointerEvents="none" />}
        </svg>
        {hover && (
          <div className="trade-tip" style={{ left: `${(sx(hover.d) / W) * 100}%`, top: `${(sy(hover.f) / H) * 100}%`,
            transform: sy(hover.f) < H * 0.4 ? 'translate(-50%, 14px)' : undefined }}>
            <b>{name(hover.r)}</b>
            <span>{hover.r.goCount}/{windowDays} {T.y[lang].toLowerCase()}</span>
            <span>{T.colIce[lang]}: {km(hover.d)} · {T.colArea[lang]}: {hover.area.toFixed(2)} km²</span>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{T.front[lang]}</th><th className="num">{T.y[lang]}</th><th className="num">{T.colIce[lang]}</th><th className="num">{T.colArea[lang]}</th></tr></thead>
          <tbody>
            {[...front].reverse().map((p) => (
              <tr key={p.r.index} onClick={() => onPick(p.r)}>
                <td><div className="site">{name(p.r)}</div></td>
                <td className="num">{p.r.goCount}/{windowDays}</td>
                <td className="num">{km(p.d)}</td>
                <td className="num">{p.area.toFixed(2)} km²</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
