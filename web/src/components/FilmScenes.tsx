// 2D scenes for the mission film. Layouts come from filmProfile and are memoised;
// each clock tick only reveals what was already built. No WebGL.
import { useEffect, useMemo, useRef } from 'react'
import type { Lang } from '../i18n'
import type { Probability } from '../probability'
import type { EllipseCheck } from '../ellipse'
import {
  ellipseDots, fmtNum, oddsDotY, oddsLayout, oddsSettled, revealCount, rise, windowModel, windowShownGo,
  type OddsLayout, type WindowPlan,
} from '../filmProfile'

const BIN_COLOR = ['#2fd27a', '#ff5050', '#ff8a3d', '#ffc83d', '#4ea4ff']
const BIN_NAME: Record<Lang, string>[] = [
  { en: 'Success', tr: 'Başarı' },
  { en: 'Landing failed', tr: 'İniş olmadı' },
  { en: 'Tipped over', tr: 'Devrildi' },
  { en: 'Ran out of power', tr: 'Güç tükendi' },
  { en: 'Lost contact', tr: 'Bağlantı koptu' },
]

function drawOdds(canvas: HTMLCanvasElement, layout: OddsLayout, t: number, reduce: boolean) {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w < 2 || h < 2) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pw = Math.floor(w * dpr)
  const ph = Math.floor(h * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  const g = canvas.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const Y = (ny: number) => ny * h
  const X = (nx: number) => nx * w
  g.strokeStyle = 'rgba(255,255,255,.22)'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, Y(0.98))
  g.lineTo(w, Y(0.98))
  g.stroke()
  for (let b = 1; b < 5; b++) {
    const x = X(b / 5)
    g.beginPath()
    g.strokeStyle = 'rgba(255,255,255,.1)'
    g.moveTo(x, 0)
    g.lineTo(x, Y(0.98))
    g.stroke()
  }
  const r = Math.max(1.7, Math.min(3.5, w / 5 / 16))
  for (let b = 0; b < 5; b++) {
    g.beginPath()
    let any = false
    for (let i = 0; i < layout.n; i++) {
      if (layout.bin[i] !== b) continue
      const yv = oddsDotY(layout.y[i], layout.t0[i], t, reduce)
      if (yv === null) continue
      any = true
      const x = X(layout.x[i])
      const y = Y(yv)
      g.moveTo(x + r, y)
      g.arc(x, y, r, 0, 6.283185307179586)
    }
    if (!any) continue
    g.fillStyle = BIN_COLOR[b]
    g.fill()
  }
}

function OddsCanvas({ layout, t, reduce }: { layout: OddsLayout; t: number; reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef(layout)
  const tRef = useRef(t)
  const reduceRef = useRef(reduce)
  layoutRef.current = layout
  tRef.current = t
  reduceRef.current = reduce
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const paint = () => {
      const c = ref.current
      if (c) drawOdds(c, layoutRef.current, tRef.current, reduceRef.current)
    }
    const ro = new ResizeObserver(paint)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const canvas = ref.current
    if (canvas) drawOdds(canvas, layout, t, reduce)
  }, [layout, t, reduce])
  return <canvas ref={ref} className="fx-odds-canvas" aria-hidden />
}

export function WindowScene({ plan, landing, t, lang, reduce }: {
  plan: WindowPlan
  landing: Date
  t: number
  lang: Lang
  reduce: boolean
}) {
  const tr = lang === 'tr'
  const landingMs = landing.getTime()
  const model = useMemo(() => windowModel(plan, landingMs, lang), [plan, landingMs, lang])
  const lit = revealCount(t, model.cells.length, 0.1, 0.68, reduce)
  const shownGo = windowShownGo(model.plan, lit)
  const goTxt = fmtNum(shownGo, 0, lang)
  const totTxt = fmtNum(model.plan.total, 0, lang)
  const summary = useMemo(() => {
    const go = fmtNum(model.plan.go, 0, lang)
    const tot = fmtNum(model.plan.total, 0, lang)
    const date = model.chosen ? `${model.chosen}. ` : ''
    if (tr) {
      return model.plan.known
        ? `${tot} günden ${go} gün uygun. ${date}Yeşil günler GO, sönük günler NO-GO.`
        : `${tot} günden ${go} gün uygun. ${date}Gün gün liste bu kartta yok; yalnızca seçilen tarih işaretli.`
    }
    return model.plan.known
      ? `${go} of ${tot} days work. ${date}Green is GO, dim is NO-GO.`
      : `${go} of ${tot} days work. ${date}The day-by-day list is not on this card; only the chosen date is marked.`
  }, [model, tr, lang])
  return (
    <div className="fs-window">
      <p className="fx-sr">{summary}</p>
      <div className="fx-scene-h">
        <span className="fs-kicker">{tr ? 'İniş penceresi' : 'Landing window'}</span>
        <h2 className="fx-win-count" aria-hidden>
          {tr ? <>{totTxt} günden <b>{goTxt}</b> gün uygun</> : <><b>{goTxt}</b> of {totTxt} days work</>}
        </h2>
        {model.chosen && <p className="fx-win-pick">{model.chosen}<span>{tr ? 'seçilen iniş' : 'chosen landing'}</span></p>}
      </div>
      <div className="fx-cal-wrap">
        {!reduce && model.cells.length > 0 && <i className="fx-scan" style={{ left: `${(lit / model.cells.length) * 100}%` }} />}
        <div className="fx-cal" aria-hidden>
          {model.cells.map((d, i) => {
            const on = i < lit
            const kind = d.go === true ? 'go' : d.go === false ? 'nogo' : 'unk'
            const month = d.month && (i === 0 || model.cells[i - 1].month !== d.month) ? d.month : undefined
            return <i key={i} className={`fx-day${on ? ' on' : ''} ${kind}${d.best ? ' best' : ''}`} data-month={month}>{d.num}</i>
          })}
        </div>
      </div>
      <p className="fx-legend" aria-hidden>
        <i className="go" /> GO
        <i className="nogo" /> NO-GO
        <i className="best" /> {tr ? 'seçilen gün' : 'chosen day'}
      </p>
      {!model.plan.known && (
        <p className="fx-note">{tr
          ? 'Gün gün uygunluk bu kartta yok. Toplam, görev sayısıdır; yalnızca seçilen tarih işaretli.'
          : 'Day-by-day GO flags were not on this card. The total is the mission count; only the chosen date is marked.'}</p>
      )}
    </div>
  )
}

export function OddsScene({ prob, t, lang, reduce }: {
  prob: Probability
  t: number
  lang: Lang
  reduce: boolean
}) {
  const tr = lang === 'tr'
  const layout = useMemo(() => oddsLayout(prob.p, prob.causes, prob.trials), [prob])
  const settled = oddsSettled(layout, t, reduce)
  const u = rise(t, 0.48, 0.3, reduce)
  const pc = fmtNum(prob.p * 100 * u, 0, lang)
  const lo = fmtNum(prob.lo * 100, 0, lang)
  const hi = fmtNum(prob.hi * 100, 0, lang)
  const tone = prob.p >= 0.7 ? 'var(--go)' : prob.p >= 0.4 ? 'var(--sun)' : 'var(--nogo)'
  const shares = [prob.p, prob.causes.landing, prob.causes.tip, prob.causes.power, prob.causes.comms]
  const summary = useMemo(() => {
    const parts = [prob.p, prob.causes.landing, prob.causes.tip, prob.causes.power, prob.causes.comms]
    const p = fmtNum(prob.p * 100, 0, lang)
    const a = fmtNum(prob.lo * 100, 0, lang)
    const b = fmtNum(prob.hi * 100, 0, lang)
    const bits = BIN_NAME.map((name, i) => `${name[lang]} ${fmtNum(parts[i] * 100, 0, lang)}%`).join(', ')
    return tr
      ? `Başarı %${p}. 90% aralık ${a}–${b}. ${fmtNum(prob.trials, 0, lang)} simüle görev. ${bits}.`
      : `Success ${p}%. 90% range ${a}–${b}. ${fmtNum(prob.trials, 0, lang)} simulated missions. ${bits}.`
  }, [prob, lang, tr])
  const note = layout.n === 0
    ? (tr ? 'Bu denemeler için pay bildirilmedi.' : 'No shares were reported for these trials.')
    : layout.capped
      ? (tr
        ? `${fmtNum(layout.n, 0, lang)} nokta, ${fmtNum(layout.trials, 0, lang)} simüle görevin paylarını gösterir. Konumlar bir şemadır, çekilişlerin tekrarı değil.`
        : `${fmtNum(layout.n, 0, lang)} dots show the same shares as the ${fmtNum(layout.trials, 0, lang)} simulated missions. Positions are a schematic, not a replay of the draws.`)
      : (tr
        ? `Her nokta bir simüle görev, bildirilen paylara göre. Konumlar bir şemadır, çekilişlerin tekrarı değil.`
        : `One dot per simulated mission, in the reported shares. Positions are a schematic, not a replay of the draws.`)
  return (
    <div className="fs-odds">
      <p className="fx-sr">{summary}</p>
      <div className="fx-scene-h" aria-hidden>
        <span className="fs-kicker">Monte Carlo</span>
        <h2 className="fx-odds-pc" style={{ color: tone }}>{pc}%</h2>
        <p className="fx-odds-range" style={{ opacity: rise(t, 0.7, 0.12, reduce) }}>{tr ? `90% aralık ${lo}–${hi}` : `90% range ${lo}–${hi}`}</p>
      </div>
      <div className="fx-odds-plot">
        <OddsCanvas layout={layout} t={t} reduce={reduce} />
      </div>
      <div className="fx-odds-bins" aria-hidden>
        {BIN_NAME.map((name, i) => (
          <div key={name.en} className="fx-odds-bin" style={{ ['--c' as string]: BIN_COLOR[i] }}>
            <span>{name[lang]}</span>
            <b>{fmtNum(shares[i] * 100 * u, 0, lang)}%</b>
            <em>{fmtNum(settled[i] ?? 0, 0, lang)}</em>
          </div>
        ))}
      </div>
      <p className="fx-note">{note}</p>
    </div>
  )
}

export function EllipseScene({ ellipse, t, lang, reduce }: {
  ellipse: EllipseCheck
  t: number
  lang: Lang
  reduce: boolean
}) {
  const tr = lang === 'tr'
  const dots = useMemo(() => ellipseDots(ellipse.points, ellipse.go), [ellipse.points, ellipse.go])
  const progress = reduce ? dots.length : rise(t, 0.08, 0.62, false) * dots.length
  let passShown = 0
  for (let i = 0; i < dots.length; i++) {
    if (!reduce && progress < i + 1) break
    if (dots[i].pass) passShown++
  }
  const km = fmtNum(ellipse.radiusKm, 0, lang)
  const label = tr
    ? `Şema. Aynı iniş tarihi, ${km} km içindeki her ızgara noktası.`
    : `Schematic. Same landing date, every grid point within ${km} km.`
  const darkDigits = Number.isInteger(ellipse.worstDarkH) ? 0 : 1
  const up = (to: number, at: number) => to * rise(t, at, 0.4, reduce)
  const rad = dots.length > 12 ? 3.2 : dots.length > 6 ? 4.4 : 6
  const summary = useMemo(() => {
    const line = tr
      ? `Şema. Aynı iniş tarihi, ${fmtNum(ellipse.radiusKm, 0, lang)} km içindeki her ızgara noktası. Geçen noktalar ${fmtNum(ellipse.go, 0, lang)}/${fmtNum(ellipse.points, 0, lang)}. En az güneş ${fmtNum(ellipse.worstSun, 0, lang)}%. En az Dünya ${fmtNum(ellipse.worstEarth, 0, lang)}%. En uzun karanlık ${fmtNum(ellipse.worstDarkH, darkDigits, lang)} saat. En dik ${fmtNum(ellipse.worstSlope, 1, lang)} derece.`
      : `Schematic. Same landing date, every grid point within ${fmtNum(ellipse.radiusKm, 0, lang)} km. Points that pass ${fmtNum(ellipse.go, 0, lang)}/${fmtNum(ellipse.points, 0, lang)}. Least sunlight ${fmtNum(ellipse.worstSun, 0, lang)}%. Least Earth contact ${fmtNum(ellipse.worstEarth, 0, lang)}%. Longest darkness ${fmtNum(ellipse.worstDarkH, darkDigits, lang)} hours. Steepest ${fmtNum(ellipse.worstSlope, 1, lang)} degrees.`
    return line
  }, [ellipse, lang, tr, darkDigits])
  const stats = [
    { k: 'sun', label: tr ? 'En az güneş' : 'Least sunlight', text: `${fmtNum(up(ellipse.worstSun, 0.16), 0, lang)}%`, color: 'var(--sun)' },
    { k: 'earth', label: tr ? 'En az Dünya bağlantısı' : 'Least Earth contact', text: `${fmtNum(up(ellipse.worstEarth, 0.24), 0, lang)}%`, color: 'var(--earth)' },
    { k: 'dark', label: tr ? 'En uzun karanlık' : 'Longest darkness', text: `${fmtNum(up(ellipse.worstDarkH, 0.32), darkDigits, lang)} h`, color: '#9d7bff' },
    { k: 'slope', label: tr ? 'En dik nokta' : 'Steepest point', text: `${fmtNum(up(ellipse.worstSlope, 0.4), 1, lang)}°`, color: 'var(--safe)' },
  ]
  return (
    <div className="fs-ellipse">
      <p className="fx-sr">{summary}</p>
      <figure className="fx-ell-fig" aria-hidden>
        <span className="fs-kicker">{tr ? 'İniş elipsi' : 'Landing ellipse'}</span>
        <svg viewBox="0 0 200 200" role="presentation">
          <circle cx="100" cy="100" r="86" className="fx-ell-ring" />
          <circle cx="100" cy="100" r="52" className="fx-ell-ring fx-ell-ring-in" />
          <line x1="100" y1="10" x2="100" y2="190" className="fx-ell-hair" />
          <line x1="10" y1="100" x2="190" y2="100" className="fx-ell-hair" />
          <circle cx="100" cy="100" r="1.8" fill="#fff" />
          {dots.map((d, i) => {
            const a = reduce ? 1 : Math.max(0, Math.min(1, progress - i))
            if (a <= 0) return null
            return (
              <circle key={i} cx={100 + d.x * 78} cy={100 + d.y * 78} r={rad * (0.5 + 0.5 * a)}
                fill={d.pass ? '#2fd27a' : '#ff5050'} opacity={a} />
            )
          })}
        </svg>
        <figcaption>{label}</figcaption>
        <p className="fx-note">{tr ? 'Konumlar harita değil. Yeşil geçer, kırmızı kalır.' : 'Positions are not the map. Green passes, red fails.'}</p>
      </figure>
      <div className="fx-ell-side" aria-hidden>
        <p className="fx-ell-go"><b>{fmtNum(passShown, 0, lang)}/{fmtNum(ellipse.points, 0, lang)}</b><span>{tr ? 'Geçen noktalar' : 'Points that pass'}</span></p>
        <div className="fx-metrics">
          {stats.map((s) => (
            <div key={s.k} className="fx-metric" style={{ ['--k' as string]: s.color }}>
              <span>{s.label}</span>
              <b>{s.text}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
