// Broadcast graphics for the mission film: a nominal-profile HUD, the sunlight sparkline,
// the Monte Carlo gauge, and the title starfield. Numbers come from filmProfile or from
// the mission that was passed in. No drei <Html>.
import { useEffect, useRef } from 'react'
import type { Lang } from '../i18n'
import type { Probability } from '../probability'
import { coastReadout, dayIndex, descentReadout, fmtClock, fmtKm, fmtLat, fmtLon, fmtVel, rise, siteReadout } from '../filmProfile'

const CAUSE: Record<keyof Probability['causes'], Record<Lang, string>> = {
  landing: { en: 'Landing', tr: 'İniş' },
  tip: { en: 'Tip-over', tr: 'Devrilme' },
  power: { en: 'Power', tr: 'Güç' },
  comms: { en: 'Link', tr: 'Bağlantı' },
}
const CAUSE_ORDER: (keyof Probability['causes'])[] = ['landing', 'tip', 'power', 'comms']

function clamp01(t: number) {
  if (!Number.isFinite(t) || t < 0) return 0
  return t > 1 ? 1 : t
}

export function TitleBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w < 2 || h < 2) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      let s = 20261114
      const rnd = () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0
        return s / 4294967296
      }
      for (let i = 0; i < 180; i++) {
        const x = rnd() * w
        const y = rnd() * h
        const r = rnd() * 1.25 + 0.25
        g.globalAlpha = 0.22 + rnd() * 0.78
        g.fillStyle = rnd() > 0.9 ? '#ffd7a8' : '#ffffff'
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])
  return (
    <>
      <canvas ref={ref} className="fx-stars" aria-hidden />
      <svg className="fx-arc" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.2">
          <circle cx="790" cy="310" r="148" />
          <circle cx="790" cy="310" r="228" strokeDasharray="3 8" />
          <circle cx="790" cy="310" r="312" stroke="rgba(255,255,255,.09)" />
        </g>
        <circle cx="790" cy="310" r="2.4" fill="#fff" />
      </svg>
    </>
  )
}

export function SunSpark({ values, t, lang, compact = false }: { values: number[]; t: number; lang: Lang; compact?: boolean }) {
  const tr = lang === 'tr'
  if (values.length === 0) return null
  const W = 240
  const H = 36
  const n = values.length
  const u = clamp01(t)
  const yOf = (v: number) => 2 + (1 - Math.max(0, Math.min(1, v))) * (H - 4)
  const xOf = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * (W - 2) + 1)
  const pos = (n - 1) * u
  const i = Math.min(n - 1, Math.floor(pos))
  const f = pos - i
  const head: [number, number][] = []
  for (let k = 0; k <= i; k++) head.push([xOf(k), yOf(values[k])])
  if (i < n - 1) {
    const x0 = xOf(i)
    const y0 = yOf(values[i])
    head.push([x0 + (xOf(i + 1) - x0) * f, y0 + (yOf(values[i + 1]) - y0) * f])
  }
  const d = head.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = head[head.length - 1]
  const area = `${d} L${last[0].toFixed(1)} ${H} L${head[0][0].toFixed(1)} ${H} Z`
  const day = n === 1 ? 0 : Math.min(n - 1, Math.round(pos))
  const pct = Math.round(values[day] * 100)
  return (
    <div className="fx-spark">
      <div className="fx-spark-h">
        <span>{tr ? 'Güneş · görev günü' : 'Sun · mission day'}</span>
        <b>D{String(day + 1).padStart(2, '0')} {pct}%</b>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr ? `Görev günü ${day + 1}, güneş %${pct}` : `Mission day ${day + 1}, sunlight ${pct}%`}>
        <line x1="1" y1="2" x2={W - 1} y2="2" stroke="rgba(255,255,255,.16)" strokeWidth="1" />
        <line x1="1" y1={H - 1} x2={W - 1} y2={H - 1} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
        <path d={area} fill="rgba(255,200,61,.16)" stroke="none" />
        <path d={d} fill="none" stroke="var(--sun)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0]} cy={last[1]} r="2.4" fill="#fff" />
      </svg>
      <p>{compact
        ? (tr ? 'Hesap · Güneş en az yarı yukarıda' : 'Computed · Sun at least half up')
        : (tr ? 'En iyi iniş tarihinde, Güneşin ufkun en az yarı üstünde olduğu her görev gününün payı.' : 'Share of each mission day with the Sun at least half above the horizon, on the best landing date.')}</p>
    </div>
  )
}

export function FilmHud({ lang, phase, t, heightM, lat, lon, sunDaily }: {
  lang: Lang
  phase: 'coast' | 'descent' | 'site'
  t: number
  heightM: number
  lat: number
  lon: number
  sunDaily: number[]
}) {
  const tr = lang === 'tr'
  const loc = tr ? 'tr-TR' : 'en-GB'
  const read = phase === 'coast' ? coastReadout(t) : phase === 'descent' ? descentReadout(t) : siteReadout(heightM)
  const rows: { k: string; sub: string; v: string }[] = phase === 'site'
    ? [
        { k: 'ALT', sub: tr ? 'arazi · hesap' : 'terrain · computed', v: `${Math.round(heightM).toLocaleString(loc)} m` },
        { k: 'VEL', sub: tr ? 'iniş · plan' : 'touchdown · planned', v: fmtVel(0, lang) },
        { k: 'RNG', sub: tr ? 'Ay’a · plan' : 'to Moon · planned', v: fmtKm(0, lang) },
        { k: 'T−', sub: tr ? 'iniş · plan' : 'landing · planned', v: fmtClock(0, lang) },
      ]
    : [
        {
          k: 'ALT',
          sub: phase === 'descent' ? (tr ? 'Ay · profil' : 'Moon · profile') : (tr ? 'Dünya · profil' : 'Earth · profile'),
          v: fmtKm(read.altKm, lang),
        },
        { k: 'VEL', sub: phase === 'descent' ? (tr ? 'fren · profil' : 'braking · profile') : (tr ? 'TLI → yörünge' : 'TLI → orbit'), v: fmtVel(read.velKms, lang) },
        {
          k: 'RNG',
          sub: phase === 'descent' ? (tr ? 'noktaya · profil' : 'to site · profile') : (tr ? 'Ay’a · profil' : 'to Moon · profile'),
          v: fmtKm(read.rangeKm, lang),
        },
        { k: 'T−', sub: tr ? 'inişe · profil' : 'to landing · profile', v: fmtClock(read.ttlS, lang) },
      ]
  const day = dayIndex(t, sunDaily.length)
  return (
    <aside className={`fx-hud fx-hud-${phase}`} aria-hidden>
      <header>
        <b>{phase === 'site' ? (tr ? 'Yüzey' : 'Surface') : (tr ? 'Nominal profil' : 'Nominal profile')}</b>
        <i>{phase === 'site'
          ? (tr ? 'yükseklik ve güneş hesap' : 'height and sun computed')
          : (tr ? 'ölçüm değil' : 'not a measurement')}</i>
      </header>
      <ul>
        {rows.map((row) => (
          <li key={row.k}>
            <span><b>{row.k}</b><em>{row.sub}</em></span>
            <strong>{row.v}</strong>
          </li>
        ))}
      </ul>
      {phase === 'site' && <p className="fx-hud-where">{fmtLat(lat, lang)} {fmtLon(lon, lang)} · D{String(day + 1).padStart(2, '0')}</p>}
      <SunSpark values={sunDaily} t={t} lang={lang} compact />
    </aside>
  )
}

export function SimGauge({ prob, t, lang, reduce }: { prob: Probability; t: number; lang: Lang; reduce: boolean }) {
  const tr = lang === 'tr'
  const u = rise(t, 0.18, 0.24, reduce)
  const R = 46
  const C = 2 * Math.PI * R
  const shown = prob.p * u
  const pc = Math.round(shown * 100)
  const tone = prob.p >= 0.7 ? 'var(--go)' : prob.p >= 0.4 ? 'var(--sun)' : 'var(--nogo)'
  const lo = Math.round(prob.lo * 100)
  const hi = Math.round(prob.hi * 100)
  const trials = Math.round(prob.trials * u)
  return (
    <>
      <div className="fx-gauge" style={{ opacity: rise(t, 0.16, 0.1, reduce) }}>
        <svg viewBox="0 0 120 120" role="img" aria-label={tr ? `Başarı olasılığı %${Math.round(prob.p * 100)}` : `Success probability ${Math.round(prob.p * 100)}%`}>
          <circle cx="60" cy="60" r={R} className="fx-gauge-track" />
          <circle cx="60" cy="60" r={R} className="fx-gauge-arc" stroke={tone} strokeDasharray={`${(shown * C).toFixed(2)} ${C.toFixed(2)}`} transform="rotate(-90 60 60)" />
          <text x="60" y="58" textAnchor="middle" className="fx-gauge-num">{pc}%</text>
          <text x="60" y="76" textAnchor="middle" className="fx-gauge-sub" opacity={u > 0.82 ? 1 : 0}>{lo}–{hi}%</text>
        </svg>
      </div>
      <div className="fx-sim" style={{ opacity: rise(t, 0.22, 0.1, reduce) }}>
        <header>
          <b>{tr ? 'Başarı olasılığı' : 'Success probability'}</b>
          <i>{trials.toLocaleString(tr ? 'tr-TR' : 'en-GB')}/{prob.trials.toLocaleString(tr ? 'tr-TR' : 'en-GB')}</i>
        </header>
        <p>{tr ? `Simüle görevlerin tekrarı · 90% aralık ${lo}–${hi}` : `Replay of simulated missions · 90% range ${lo}–${hi}`}</p>
        {CAUSE_ORDER.map((k) => (
          <div className="fx-sim-row" key={k}>
            <span>{CAUSE[k][lang]}</span>
            <i><b style={{ width: `${prob.causes[k] * u * 100}%` }} /></i>
            <em>{Math.round(prob.causes[k] * u * 100)}%</em>
          </div>
        ))}
        {prob.main && <p className="fx-sim-main">{tr ? 'En büyük pay' : 'Largest share'}: {CAUSE[prob.main][lang]}</p>}
      </div>
    </>
  )
}
