// "What the lander sees": the terrain horizon all around, and the Sun and Earth moving over the mission.
import { useEffect, useMemo, useState } from 'react'
import type { Series } from '../data'
import { T, type Lang } from '../i18n'

interface Props {
  horizon: number[]
  series: Series
  i0: number
  len: number
  stepH: number
  startMs: number
  lang: Lang
}

const W = 1000
const H = 300

export default function HorizonView({ horizon, series, i0, len, stepH, startMs, lang }: Props) {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => { setK(0); setPlaying(false) }, [i0, series])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 2 >= len ? (setPlaying(false), x) : x + 2)), 70)
    return () => clearInterval(id)
  }, [playing, len])

  const sAlt = series.sunAlt.subarray(i0, i0 + len)
  const sAz = series.sunAz.subarray(i0, i0 + len)
  const eAlt = series.earthAlt.subarray(i0, i0 + len)
  const eAz = series.earthAz.subarray(i0, i0 + len)
  const { lo, hi } = useMemo(() => {
    const hz = Math.max(...horizon)
    const lo = Math.min(-3, Math.min(...horizon) - 1, Math.min(...Array.from(eAlt)) - 1)
    const hi = Math.min(90, Math.max(hz, Math.max(...Array.from(sAlt)), Math.max(...Array.from(eAlt)), 5) + 2)
    return { lo, hi }
  }, [horizon, sAlt, eAlt])
  const x = (az: number) => (az / 360) * W
  const y = (alt: number) => H - ((alt - lo) / (hi - lo)) * H
  const terrain = `M0,${H} ` + horizon.map((h, a) => `L${x(a)},${y(h)}`).join(' ') + ` L${W},${y(horizon[0])} L${W},${H} Z`
  const path = (az: Float32Array, alt: Float32Array) => {
    let d = ''
    for (let i = 0; i < az.length; i += 2) {
      const jump = i > 0 && Math.abs(az[i] - az[i - 2]) > 180
      d += `${i === 0 || jump ? 'M' : 'L'}${x(az[i]).toFixed(1)},${y(alt[i]).toFixed(1)} `
    }
    return d
  }
  const sunUp = series.sunFraction[i0 + k] >= 0.5
  const earthUp = series.earthVisible[i0 + k]
  const when = new Date(startMs + k * stepH * 3600e3)
  const stamp = when.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const dirs = lang === 'tr' ? ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB', 'K'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
  return (
    <div className="card">
      <div className="card-head">
        <h3>{T.sees[lang]}</h3>
        <button className="btn" onClick={() => { if (k + 2 >= len) setK(0); setPlaying(!playing) }}>
          {playing ? T.pause[lang] : T.play[lang]}
        </button>
      </div>
      <div className="moment">
        <b>{T.day[lang]} {Math.floor((k * stepH) / 24) + 1}</b> · {stamp} UTC ·{' '}
        <span style={{ color: sunUp ? 'var(--sun)' : 'var(--text-3)' }}>{T.sunWord[lang]} {sunUp ? T.inView[lang] : T.hidden[lang]}</span> ·{' '}
        <span style={{ color: earthUp ? 'var(--earth)' : 'var(--text-3)' }}>{T.earthWord[lang]} {earthUp ? T.inView[lang] : T.hidden[lang]}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="horizon">
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#71717a" />
            <stop offset="1" stopColor="#27272a" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="#050506" />
        <path d={path(sAz, sAlt)} stroke="var(--sun)" strokeOpacity="0.45" strokeWidth="2" fill="none" />
        <path d={path(eAz, eAlt)} stroke="var(--earth)" strokeOpacity="0.45" strokeWidth="2" fill="none" />
        <path d={terrain} fill="url(#ground)" />
        <circle cx={x(sAz[k])} cy={y(sAlt[k])} r="11" fill={sunUp ? 'var(--sun)' : '#6b7280'} stroke="#09090b" strokeWidth="2" />
        <circle cx={x(eAz[k])} cy={y(eAlt[k])} r="8" fill={earthUp ? 'var(--earth)' : '#6b7280'} stroke="#09090b" strokeWidth="2" />
        {dirs.map((d, i) => (
          <text key={i} x={Math.min(Math.max(i * W / 8, 10), W - 10)} y={H + 18} fill="var(--muted)" fontSize="14" textAnchor="middle">{d}</text>
        ))}
      </svg>
      <input className="range" type="range" min={0} max={len - 1} value={k} onChange={(e) => { setPlaying(false); setK(+e.target.value) }} />
      <p className="note">{T.horizonNote[lang]}</p>
    </div>
  )
}
