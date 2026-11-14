// "Tell me the mission": a short film of the mission, built from the computed result. Scenes play in order:
// title, launch from Earth, the landing window, the coast, the descent (cockpit), touchdown, the site,
// the landing ellipse (when that check has more than one point), the rover drive,
// the odds (when a Monte Carlo was passed in), and the verdict.
// 3D scenes come from the app's own engines; subtitles and every number come from the mission that was passed in.
// Coast and descent readouts are a nominal profile (see filmProfile), labelled as such.
// The window, the odds and the ellipse are 2D. Ellipse positions are a schematic of the reported totals.
import { preloadModel } from './Models'
import { landerFile, roverFile } from './VehicleModels'
import { ROVERS } from '../vehicles'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronRight, Footprints, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import type { Lang } from '../i18n'
import type { Chapter } from '../story'
import type { Lander } from '../vehicles'
import { fmtLat, fmtLon, fmtNum, rise, windowPlan } from '../filmProfile'
import Patch from './Patch'
import VehiclePhoto from './VehiclePhoto'
import { useSiteImage, type CardSite } from './SiteCard'
import { useSpeechVoice } from '../speech'
import { FilmHud, SimGauge, SunSpark, TitleBackdrop } from './FilmHud'
import { EllipseScene, OddsScene, WindowScene } from './FilmScenes'
import '../film.css'
import '../film-fix.css'

const LaunchScene = lazy(() => import('./LaunchScene'))

type SceneId = 'title' | 'launch' | 'window' | 'coast' | 'descent' | 'landing' | 'site' | 'ellipse' | 'rover' | 'odds' | 'verdict'
const DUR: Record<SceneId, number> = {
  title: 5, launch: 10, window: 6, coast: 6, descent: 7, landing: 30, site: 9, ellipse: 6, rover: 13, odds: 7, verdict: 9,
}
const FADE = 0.36

const NAMES: Record<SceneId, Record<Lang, string>> = {
  title: { en: 'Mission', tr: 'Görev' }, launch: { en: 'Launch', tr: 'Fırlatma' }, window: { en: 'The window', tr: 'Pencere' },
  coast: { en: 'To the Moon', tr: 'Ay’a yolculuk' },
  descent: { en: 'Descent', tr: 'Alçalma' }, landing: { en: 'Touchdown', tr: 'Yere iniş' }, site: { en: 'The site', tr: 'Nokta' },
  ellipse: { en: 'The ellipse', tr: 'Elips' }, rover: { en: 'On the surface', tr: 'Yüzeyde' },
  odds: { en: 'The odds', tr: 'Olasılık' }, verdict: { en: 'Verdict', tr: 'Karar' },
}

function useClock(paused: boolean) {
  // film time = wall-clock time since the (re)start, minus time spent paused: it stays real-time even when a heavy
  // 3D scene drops frames
  const [t, setT] = useState(0)
  const origin = useRef(performance.now())
  const pausedAt = useRef<number | null>(null)
  useEffect(() => {
    if (paused) { pausedAt.current = performance.now(); return }
    if (pausedAt.current !== null) { origin.current += performance.now() - pausedAt.current; pausedAt.current = null }
    let id = 0
    // ~30 updates a second is plenty for text and counters; the 3D scenes animate on their own at full rate
    let last = 0
    const tick = (now: number) => { if (now - last > 32) { last = now; setT((now - origin.current) / 1000) } id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [paused])
  const seek = (s: number) => { origin.current = performance.now() - s * 1000; if (pausedAt.current !== null) pausedAt.current = performance.now(); setT(s) }
  return [t, seek] as const
}

function useReducedMotion() {
  const [v, setV] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}

/** A number that counts up over the first part of the scene. */
function Count({ to, t, digits = 0, suffix = '' }: { to: number; t: number; digits?: number; suffix?: string }) {
  const v = to * Math.min(1, Math.max(0, t / 0.45)) ** 0.6
  return <>{v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}{suffix}</>
}

function enter(t: number, at: number, reduce: boolean, span = 0.1): CSSProperties {
  const u = rise(t, at, span, reduce)
  return { opacity: u, transform: `translateY(${((1 - u) * 12).toFixed(1)}px)` }
}

function counted(to: number, t: number, at: number, reduce: boolean) {
  return to * rise(t, at, 0.16, reduce) ** 0.6
}

function wipeOf(local: number, dur: number, last: boolean, paused: boolean): { cover: number; mode: 'in' | 'out' | 'none' } {
  if (paused) return { cover: 0, mode: 'none' }
  const remain = dur - local
  const inC = local >= 0 && local < FADE ? 1 - local / FADE : 0
  const outC = !last && remain >= 0 && remain < FADE ? 1 - remain / FADE : 0
  if (outC <= 0 && inC <= 0) return { cover: 0, mode: 'none' }
  if (outC >= inC) return { cover: outC, mode: 'out' }
  return { cover: inC, mode: 'in' }
}

export default function MissionFilm({ lang, card, chapters, lander, roverName, missionName, launch, landing, globe, rover, touchdown, onClose, onWalk }: {
  touchdown: ((mode: 'landing' | 'rover') => ReactNode) | null
  lang: Lang; card: CardSite; chapters: Chapter[]; lander: Lander; roverName: string; missionName: string
  launch: Date; landing: Date
  globe: (view: 'overview' | 'pilot', start: number) => ReactNode
  rover: (() => ReactNode) | null
  onClose: () => void; onWalk: (() => void) | null
}) {
  const tr = lang === 'tr'
  useEffect(() => {
    document.documentElement.classList.add('mission-film-open')
    return () => document.documentElement.classList.remove('mission-film-open')
  }, [])
  const ellipseOn = !!card.ellipse && card.ellipse.points > 1
  const oddsOn = !!card.prob && card.prob.trials > 0
  const scenes = useMemo(() => (['title', 'launch', 'window', 'coast', 'descent', ...(touchdown ? ['landing' as const] : []), 'site', ...(ellipseOn ? ['ellipse' as const] : []), ...(rover ? ['rover' as const] : []), ...(oddsOn ? ['odds' as const] : []), 'verdict'] as SceneId[]), [rover, touchdown, ellipseOn, oddsOn])
  const starts = useMemo(() => scenes.reduce<number[]>((a, _s, k) => [...a, k ? a[k - 1] + DUR[scenes[k - 1]] : 0], []), [scenes])
  const total = starts[starts.length - 1] + DUR[scenes[scenes.length - 1]]
  const [paused, setPaused] = useState(false)
  const [voice, setVoice] = useState(false)
  const speech = useSpeechVoice(lang)
  const reduce = useReducedMotion()
  const [time, setTime] = useClock(paused)
  // decode the mission's lander and rover now, not on the first frame of the scenes that show them
  useEffect(() => {
    preloadModel(landerFile(lander.id))
    const rv = ROVERS.find((x) => x.name === roverName)
    preloadModel(roverFile(rv?.id ?? 'viper'))
  }, [lander.id, roverName])
  const k = starts.reduce((last, s0, i) => (time >= s0 ? i : last), 0)
  const scene = scenes[k]
  const local = time - starts[k]
  const t = Math.min(1, Math.max(0, local / DUR[scene]))
  const ended = time >= total
  const wipe = wipeOf(local, DUR[scene], k === scenes.length - 1, paused || reduce)
  const img = useSiteImage(card)
  const ch = (tone: Chapter['tone']) => chapters.find((c) => c.tone === tone)?.text ?? ''
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), [tr])
  const fmt = (d: Date) => dateFmt.format(d)
  const r = card.row
  const go = r.goDates > 0
  const loc = tr ? 'tr-TR' : 'en-GB'
  const win = useMemo(() => windowPlan(r.perStart, r.windowDays, card.r.bestStart, r.goDates, card.r.bestGo), [r.perStart, r.windowDays, card.r.bestStart, r.goDates, card.r.bestGo])
  const kmTxt = card.ellipse ? fmtNum(card.ellipse.radiusKm, 0, lang) : ''

  const subtitle: Record<SceneId, string> = {
    title: lander.pitch[lang],
    launch: ch('launch'),
    window: win.known
      ? (tr ? `${fmtNum(win.go, 0, lang)} / ${fmtNum(win.total, 0, lang)} gün uygun. Yeşil günler GO, sönük günler NO-GO. Halka seçilen iniştir.`
        : `${fmtNum(win.go, 0, lang)} of ${fmtNum(win.total, 0, lang)} days work. Green is GO, dim is NO-GO. The ring is the chosen landing.`)
      : (tr ? `${fmtNum(win.go, 0, lang)} / ${fmtNum(win.total, 0, lang)} gün uygun. Gün gün liste yok; yalnızca seçilen tarih işaretli.`
        : `${fmtNum(win.go, 0, lang)} of ${fmtNum(win.total, 0, lang)} days work. The day-by-day list is not on this card; only the chosen date is marked.`),
    coast: tr ? 'Yaklaşık 4,5 gün ve 384.000 km. Ay bizi bir kutup yörüngesine yakalar; seçilen nokta tam altımızdan geçer.'
      : 'About 4.5 days and 384,000 km. The Moon captures us into a polar orbit whose track runs right over the chosen site.',
    descent: tr ? 'Kutup yörüngesinden fren ateşlemesi başlar: saatte 6.000 km’den sıfıra, yaklaşık 12 dakikada.'
      : 'From the polar orbit the braking burn begins: from 6,000 km/h to zero in about 12 minutes.',
    landing: ch('land'),
    site: `${ch('place')} ${ch('sun')}`,
    ellipse: card.ellipse
      ? (tr ? `Şema. Aynı iniş tarihi, ${kmTxt} km içindeki her ızgara noktası. Konumlar harita değil.`
        : `Schematic. Same landing date, every grid point within ${kmTxt} km. Positions are not the map.`)
      : '',
    rover: tr ? `${roverName} rampadan iner ve güneşli bir rota planlar.${r.iceKm !== null ? ` Buz ${r.iceKm.toFixed(1)} km ötede.` : ''}`
      : `${roverName} rolls off the ramp and plans a sunlit route.${r.iceKm !== null ? ` The ice is ${r.iceKm.toFixed(1)} km away.` : ''}`,
    odds: card.prob
      ? (tr ? `${fmtNum(card.prob.trials, 0, lang)} simüle görev. Noktalar bildirilen paylara göre beş sonuca iner.`
        : `${fmtNum(card.prob.trials, 0, lang)} simulated missions. The dots fall into five outcomes, in the reported shares.`)
      : '',
    verdict: ch('verdict'),
  }
  // read each scene's subtitle aloud when voice is on
  useEffect(() => {
    if (!voice || typeof speechSynthesis === 'undefined') return
    speech.speak(subtitle[scene], 0.98)
  }, [scene, voice])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') { e.preventDefault(); setPaused((x) => !x) }
      if (e.key === 'ArrowRight') setTime(starts[Math.min(scenes.length - 1, k + 1)])
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [k, starts, scenes, onClose, setTime])

  const launchBoxes = [
    { at: 0.02, k: 'T+0', v: tr ? 'KALKIŞ · Kennedy LC-39B · 28,6°K' : 'LIFTOFF · Kennedy LC-39B · 28.6°N' },
    { at: 0.13, k: 'T+8 min', v: tr ? 'YÖRÜNGE · 185 km · 7,8 km/sn' : 'ORBIT · 185 km · 7.8 km/s' },
    { at: 0.7, k: 'T+1 h 30', v: tr ? 'AY’A TRANSFER ATEŞLEMESİ · +3,1 km/sn' : 'TRANS-LUNAR INJECTION · +3.1 km/s' },
    { at: 0.82, k: fmt(launch), v: tr ? 'AY’A DOĞRU · 10,9 km/sn' : 'BOUND FOR THE MOON · 10.9 km/s' },
  ]

  const metrics: { key: string; label: string; text: string; color: string; at: number }[] = [
    { key: 'sun', label: tr ? 'Güneş' : 'Sunlight', text: `${fmtNum(counted(r.sunPct, t, 0.34, reduce), 0, lang)}%`, color: 'var(--sun)', at: 0.32 },
    { key: 'earth', label: tr ? 'Dünya' : 'Earth', text: `${fmtNum(counted(r.earthPct, t, 0.42, reduce), 0, lang)}%`, color: 'var(--earth)', at: 0.40 },
    { key: 'dark', label: tr ? 'Karanlık' : 'Dark', text: `${fmtNum(counted(r.longestDarkH, t, 0.50, reduce), 0, lang)} h`, color: '#9d7bff', at: 0.48 },
    { key: 'go', label: tr ? 'Uygun gün' : 'GO days', text: `${fmtNum(counted(r.goDates, t, 0.58, reduce), 0, lang)}/${r.windowDays}`, color: 'var(--go)', at: 0.56 },
  ]
  const hud = (phase: 'coast' | 'descent' | 'site') => (
    <FilmHud lang={lang} phase={phase} t={t} heightM={r.heightM} lat={r.lat} lon={r.lon} sunDaily={r.sunDaily} />
  )

  // The 3D scenes are built once per scene, not on every clock tick: the film re-renders 60 times a second for its
  // text and counters, and rebuilding a react-three-fiber tree that often makes the 3D stutter.
  const coastEl = useMemo(() => (scene === 'coast' ? globe('overview', 0) : null), [scene])      // eslint-disable-line react-hooks/exhaustive-deps
  const descentEl = useMemo(() => (scene === 'descent' ? globe('pilot', 0.5) : null), [scene])   // eslint-disable-line react-hooks/exhaustive-deps
  // one drive view for touchdown, site and rover: built once, hidden behind the 2D site scene, then switched to the
  // rover, so the rover scene needs no new 3D world (that rebuild froze the picture for seconds).
  // The ellipse is a 2D insert between site and rover; keep the same view mounted and hidden across it.
  const groundLive = !!touchdown && (scene === 'landing' || scene === 'site' || scene === 'ellipse' || scene === 'rover')
  const groundMode: 'landing' | 'rover' = scene === 'landing' ? 'landing' : 'rover'
  const groundEl = useMemo(() => (groundLive ? touchdown!(groundMode) : null), [groundLive, groundMode]) // eslint-disable-line react-hooks/exhaustive-deps
  // the rover scene starts loading (terrain, route, shaders) while the light 2D site scene plays, hidden, so the cut
  // to it is instant instead of freezing for a few seconds
  const roverLive = !touchdown && !!rover && (scene === 'site' || scene === 'ellipse' || scene === 'rover')
  const roverEl = useMemo(() => (roverLive ? rover!() : null), [roverLive])          // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="film" role="dialog" aria-label={tr ? 'Görev filmi' : 'Mission film'}>
      <div className={`film-stage s-${scene}`}>
        {scene === 'title' && (
          /* Flex row, not a centered absolute. translateX(-50%) here once collapsed the title. */
          <div className="fs-title">
            <TitleBackdrop />
            <Patch size={128} />
            <div className="fs-title-text">
              <span className="fs-kicker">{tr ? 'LunaNav sunar' : 'LunaNav presents'}</span>
              <h1>{missionName}</h1>
              <span className="fs-sub">{card.name} · {fmt(landing)}</span>
              <div className="fx-meta" style={{ opacity: reduce ? 1 : Math.min(1, t / 0.22) }}>
                <span><i>{tr ? 'Fırlatma' : 'Launch'}</i><b>{fmt(launch)}</b></span>
                <span><i>{tr ? 'Araç' : 'Vehicle'}</i><b>{lander.name}</b></span>
                <span><i>{tr ? 'Konum' : 'Site'}</i><b>{fmtLat(r.lat, lang)} {fmtLon(r.lon, lang)}</b></span>
                <span><i>{tr ? 'Yükseklik' : 'Height'}</i><b>{r.heightM.toLocaleString(loc)} m</b></span>
              </div>
            </div>
            <VehiclePhoto kind="lander" id={lander.id} alt={lander.name} className="fs-lander" />
          </div>
        )}
        {scene === 'launch' && (
          <>
            <Suspense fallback={null}><LaunchScene t={t} /></Suspense>
            <div className="fs-boxes left">
              {launchBoxes.filter((b) => t >= b.at).map((b) => <div key={b.k} className="fs-box"><b>{b.k}</b><span>{b.v}</span></div>)}
            </div>
            <span className="fs-note">{tr ? 'Gerçek olay sırası ve süreleri; çizim ölçeksiz.' : 'Real event sequence and timings; not to scale.'}</span>
          </>
        )}
        {scene === 'window' && <WindowScene plan={win} landing={landing} t={t} lang={lang} reduce={reduce} />}
        {scene === 'coast' && (
          <>
            {coastEl}
            {hud('coast')}
          </>
        )}
        {scene === 'descent' && (
          <>
            {descentEl}
            <div className="flight-hud-wrap pilot"><div className="reticle" /><div id="flight-hud" className="flight-hud" /></div>
            {hud('descent')}
          </>
        )}
        {groundLive && <div className={scene === 'landing' || scene === 'rover' ? 'fs-rover-live' : 'fs-premount'} aria-hidden={scene !== 'landing' && scene !== 'rover'}>{groundEl}</div>}
        {scene === 'site' && (
          <div className="fs-site" style={{ ['--team' as string]: card.colour }}>
            {img && <img src={img} alt="" className="fs-site-img" style={{ transform: `scale(${1 + t * 0.12}) translateX(${-t * 2}%)` }} />}
            <div className="fs-site-name"><span>{card.region ?? (tr ? 'Açık arazi' : 'Open terrain')}</span><h2>{card.name}</h2></div>
            <div className="fs-boxes grid">
              <div className="fs-box stat sun"><b><Count to={r.sunPct} t={t} suffix="%" /></b><span>{tr ? 'Güneş' : 'Sunlight'}</span></div>
              <div className="fs-box stat earth"><b><Count to={r.earthPct} t={t} suffix="%" /></b><span>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</span></div>
              <div className="fs-box stat dark"><b><Count to={r.longestDarkH} t={t} suffix=" h" /></b><span>{tr ? 'En uzun karanlık' : 'Longest dark'}</span></div>
              {r.zoneSlopeDeg !== null && <div className="fs-box stat safe"><b><Count to={r.zoneSlopeDeg} t={t} digits={1} suffix="°" /></b><span>{tr ? 'İniş alanı eğimi' : 'Landing zone slope'}</span></div>}
              {r.iceKm !== null && <div className="fs-box stat ice"><b><Count to={r.iceKm} t={t} digits={1} suffix=" km" /></b><span>{tr ? 'Buza uzaklık' : 'To water ice'}</span></div>}
              <div className="fs-box stat go"><b><Count to={r.goDates} t={t} />/{r.windowDays}</b><span>{tr ? 'Uygun iniş tarihi' : 'GO landing dates'}</span></div>
            </div>
            {hud('site')}
          </div>
        )}
        {scene === 'ellipse' && card.ellipse && card.ellipse.points > 1 && <EllipseScene ellipse={card.ellipse} t={t} lang={lang} reduce={reduce} />}
        {roverLive && <div className={scene === 'rover' ? 'fs-rover-live' : 'fs-premount'} aria-hidden={scene !== 'rover'}>{roverEl}</div>}
        {scene === 'rover' && rover && (
          <>
            <div className="fs-boxes left">
              <div className="fs-box"><b>{roverName}</b><span>{tr ? 'otopilot · güneşli rota' : 'autopilot · sunlit route'}</span></div>
            </div>
          </>
        )}
        {scene === 'odds' && card.prob && <OddsScene prob={card.prob} t={t} lang={lang} reduce={reduce} />}
        {scene === 'verdict' && (
          <div className={`fs-verdict ${go ? 'go' : 'nogo'}`}>
            {img && <img src={img} alt="" className="fs-bg" />}
            <div className="fx-v-left">
              <figure className="fx-frame" style={{ ['--team' as string]: card.colour, ...enter(t, 0.06, reduce, 0.12) }}>
                {img ? <img src={img} alt="" /> : <div className="fx-wait">{tr ? 'Arazi çiziliyor' : 'Rendering terrain'}</div>}
                <i className="fx-br fx-br-tl" /><i className="fx-br fx-br-tr" /><i className="fx-br fx-br-bl" /><i className="fx-br fx-br-br" />
                <figcaption>
                  <b>{card.name}</b>
                  <span>{fmtLat(r.lat, lang)} {fmtLon(r.lon, lang)} · {r.heightM.toLocaleString(loc)} m</span>
                </figcaption>
                <VehiclePhoto kind="lander" id={lander.id} alt={lander.name} className="fx-ship" />
              </figure>
              <div className="fx-v-lower">
                {card.prob && <SimGauge prob={card.prob} t={t} lang={lang} reduce={reduce} />}
                <SunSpark values={r.sunDaily} t={rise(t, 0.48, 0.34, reduce)} lang={lang} />
              </div>
            </div>
            <div className="fx-v-right">
              <span className="fs-kicker">{missionName}</span>
              <h1 style={enter(t, 0, reduce, 0.08)}>{go ? 'GO' : 'NO-GO'}</h1>
              <div className="fx-when" style={enter(t, 0.08, reduce)}>
                <span><i>{tr ? 'Fırlatma' : 'Launch'}</i><b>{fmt(launch)}</b></span>
                <span><i>{tr ? 'İniş' : 'Landing'}</i><b>{fmt(landing)}</b></span>
              </div>
              <p className="fx-blurb" style={enter(t, 0.12, reduce)}>{subtitle.verdict}</p>
              <span className="fx-craft" style={enter(t, 0.16, reduce)}>{lander.name}{rover ? ` · ${roverName}` : ''}</span>
              <div className="fx-metrics">
                {metrics.map((m) => (
                  <div key={m.key} className="fx-metric" style={{ ['--k' as string]: m.color, ...enter(t, m.at, reduce) }}>
                    <span>{m.label}</span>
                    <b>{m.text}</b>
                  </div>
                ))}
              </div>
              <span className="fs-dates-label" style={enter(t, 0.62, reduce)}>{tr ? 'Penceredeki her iniş tarihi' : 'Every landing date in the window'}</span>
              <div className="fs-dates" style={enter(t, 0.64, reduce)}>{r.perStart.map((g, i) => <i key={i} className={`${g ? 'go' : ''} ${i === card.r.bestStart ? 'best' : ''}`} />)}</div>
              {ended && (
                <div className="fs-actions">
                  {onWalk && <button className="btn primary" onClick={onWalk}><Footprints size={15} /> {tr ? 'Ay’da yürü' : 'Walk on the Moon'}</button>}
                  <button className="btn" onClick={() => setTime(0)}><RotateCcw size={15} /> {tr ? 'Tekrar izle' : 'Watch again'}</button>
                  <button className="btn" onClick={onClose}>{tr ? 'Kapat' : 'Close'}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {wipe.mode !== 'none' && (
        <div className="fx-wipe" aria-hidden>
          <div className="fx-wipe-black" style={{ left: wipe.mode === 'out' ? 0 : `${(1 - wipe.cover) * 100}%`, width: `${wipe.cover * 100}%` }} />
          <div className="fx-wipe-edge" style={{ left: wipe.mode === 'out' ? `${wipe.cover * 100}%` : `${(1 - wipe.cover) * 100}%` }} />
        </div>
      )}

      <div className="film-bar top" />
      <div className="film-bar bottom" />
      <div className="film-scene"><b>{String(k + 1).padStart(2, '0')}</b> {NAMES[scene][lang]}</div>
      {scene !== 'verdict' && <p className="film-sub" key={`sub-${scene}`}>{subtitle[scene]}</p>}
      <div className="film-ctl">
        <button onClick={() => setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button onClick={() => setTime(starts[Math.min(scenes.length - 1, k + 1)])} aria-label="Next"><ChevronRight size={16} /></button>
        <div className="film-progress">
          {scenes.map((s, i) => (
            <button key={s} className={i < k ? 'done' : i === k ? 'on' : ''} onClick={() => setTime(starts[i])} title={NAMES[s][lang]}>
              <i style={{ width: i < k ? '100%' : i === k ? `${t * 100}%` : 0 }} />
            </button>
          ))}
        </div>
        <button onClick={() => { if (voice) speechSynthesis.cancel(); setVoice(!voice) }} aria-label={voice ? 'Mute' : 'Narrate'}>{voice ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        <button onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
    </div>
  )
}
