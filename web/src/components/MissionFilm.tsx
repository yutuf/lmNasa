// "Tell me the mission": a short film of the computed result.
// Default cut, about 45 s: title, launch, coast, descent, touchdown, a few seconds of the rover, verdict.
// The window, the site board, the ellipse and the odds stay on the site page. Pass `technical` to put them back.
// The launch picture is a typical heavy-lift ascent, not this lander's pad. Coast and descent readouts are a
// nominal profile (see filmProfile), labelled as such. Ellipse positions are a schematic of the reported totals.
import { preloadModel } from './Models'
import { landerFile, roverFile } from './VehicleModels'
import { ROVERS } from '../vehicles'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronRight, Footprints, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import type { Lang } from '../i18n'
import type { Chapter } from '../story'
import type { Lander } from '../vehicles'
import { FILM_DUR, filmScenes, fmtLat, fmtLon, fmtNum, rise, windowPlan, type FilmSceneId } from '../filmProfile'
import Patch from './Patch'
import VehiclePhoto from './VehiclePhoto'
import { useSiteImage, type CardSite } from './SiteCard'
import { useSpeechVoice } from '../speech'
import { FilmHud, TitleBackdrop } from './FilmHud'
import { EllipseScene, OddsScene, WindowScene } from './FilmScenes'
import '../film.css'
import '../film-fix.css'
import { MissionPlaybackContext, type MissionPlayback } from '../missionPlayback'

const LaunchScene = lazy(() => import('./LaunchScene'))
const TransferScene = lazy(() => import('./TransferScene'))

type SceneId = FilmSceneId
const DUR: Record<SceneId, number> = FILM_DUR
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
  const seekRevision = useRef(0)
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
  const seek = useCallback((s: number) => { origin.current = performance.now() - s * 1000; if (pausedAt.current !== null) pausedAt.current = performance.now(); seekRevision.current++; setT(s) }, [])
  const readTime = useCallback(() => ((pausedAt.current ?? performance.now()) - origin.current) / 1000, [])
  return [t, seek, readTime, seekRevision.current] as const
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

function wipeOf(local: number, dur: number, last: boolean, paused: boolean): { cover: number; mode: 'in' | 'out' | 'none' } {
  if (paused) return { cover: 0, mode: 'none' }
  const remain = dur - local
  const inC = local >= 0 && local < FADE ? 1 - local / FADE : 0
  const outC = !last && remain >= 0 && remain < FADE ? 1 - remain / FADE : 0
  if (outC <= 0 && inC <= 0) return { cover: 0, mode: 'none' }
  if (outC >= inC) return { cover: outC, mode: 'out' }
  return { cover: inC, mode: 'in' }
}

export default function MissionFilm({ lang, card, chapters, lander, roverName, missionName, launch, landing, globe, rover, touchdown, onClose, onWalk, technical = false }: {
  technical?: boolean
  touchdown: ((mode: 'landing' | 'rover') => ReactNode) | null
  lang: Lang; card: CardSite; chapters: Chapter[]; lander: Lander; roverName: string; missionName: string
  launch: Date; landing: Date
  globe: (view: 'overview' | 'pilot', start: number) => ReactNode
  rover: (() => ReactNode) | null
  onClose: () => void; onWalk: (() => void) | null
}) {
  const tr = lang === 'tr'
  const ellipseOn = technical && !!card.ellipse && card.ellipse.points > 1
  const oddsOn = technical && !!card.prob && card.prob.trials > 0
  // The default film tells the flight. Window, site, ellipse and odds stay on the site page
  // unless technical mode is on.
  const scenes = useMemo(() => filmScenes(technical, {
    landing: !!touchdown, rover: !!rover, ellipse: ellipseOn, odds: oddsOn,
  }), [technical, touchdown, rover, ellipseOn, oddsOn])
  const starts = useMemo(() => scenes.reduce<number[]>((a, _s, k) => [...a, k ? a[k - 1] + DUR[scenes[k - 1]] : 0], []), [scenes])
  const total = starts[starts.length - 1] + DUR[scenes[scenes.length - 1]]
  const [paused, setPaused] = useState(false)
  const [autoHold, setAutoHold] = useState(false)
  const [groundReady, setGroundReady] = useState({ landing: false, rover: false })
  const markSurfaceReady = useCallback((mode: 'landing' | 'rover') => setGroundReady(old => old[mode] ? old : { ...old, [mode]: true }), [])
  const [voice, setVoice] = useState(false)
  const speech = useSpeechVoice(lang)
  const reduce = useReducedMotion()
  const [time, setTime, readTime, seekRevision] = useClock(paused || autoHold)
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
  const playback = useRef<MissionPlayback>({ scene, start: starts[k], duration: DUR[scene], paused, time: readTime, handoff: !!touchdown })
  playback.current.scene = scene
  playback.current.start = starts[k]
  playback.current.duration = DUR[scene]
  playback.current.paused = paused || autoHold || ended
  playback.current.time = readTime
  playback.current.handoff = !!touchdown
  playback.current.lander = lander.id
  playback.current.visit = seekRevision
  playback.current.onSurfaceReady = markSurfaceReady
  const surfaceVisit = useRef('')
  const visitKey = `${scene}:${seekRevision}`
  if (scene === 'landing' && surfaceVisit.current !== visitKey) {
    playback.current.surface = { altitude: 1600, range: 2400, seconds: 180, landed: false }
    surfaceVisit.current = visitKey
  }
  // Notify consumers at a cut or pause, sharing the mutable clock at full frame rate.
  const playbackContext = useMemo(() => ({ current: playback.current }), [scene, paused, autoHold, seekRevision]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const verdictLine = tr
    ? `${card.name}, ${fmt(landing)}. ${go ? 'UYGUN.' : 'UYGUN DEĞİL.'}`
    : `${card.name}, ${fmt(landing)}. ${go ? 'GO.' : 'NO-GO.'}`

  const subtitle: Record<SceneId, string> = {
    title: lander.pitch[lang],
    launch: ch('launch'),
    window: win.known
      ? (tr ? `${fmtNum(win.go, 0, lang)} / ${fmtNum(win.total, 0, lang)} gün uygun. Yeşil günler UYGUN, sönük günler UYGUN DEĞİL. Halka seçilen iniştir.`
        : `${fmtNum(win.go, 0, lang)} of ${fmtNum(win.total, 0, lang)} days work. Green is GO, dim is NO-GO. The ring is the chosen landing.`)
      : (tr ? `${fmtNum(win.go, 0, lang)} / ${fmtNum(win.total, 0, lang)} gün uygun. Gün gün liste yok; yalnızca seçilen tarih işaretli.`
        : `${fmtNum(win.go, 0, lang)} of ${fmtNum(win.total, 0, lang)} days work. The day-by-day list is not on this card; only the chosen date is marked.`),
    coast: tr ? 'Nominal 4,5 günlük bir yol, bu uçuşun rotası değil. Ay ileri yönde hareket eder; rota varıştaki konumuna yönelir. Yörüngeye girmek için fren ateşlemesi gerekir. Görüntü şematik ve hızlandırılmıştır.'
      : 'A nominal 4.5-day coast, not this flight’s path. The Moon moves prograde; the route aims for its arrival position. A braking burn is needed to enter lunar orbit. The picture is a schematic, sped up.',
    descent: tr ? 'Kutup yörüngesinden fren ateşlemesi başlar: saatte 6.000 km’den sıfıra, yaklaşık 12 dakikada.'
      : 'From the polar orbit the braking burn begins: from 6,000 km/h to zero in about 12 minutes.',
    landing: ch('land'),
    site: `${ch('place')} ${ch('sun')}`,
    ellipse: card.ellipse
      ? (tr ? `Şema. Aynı iniş tarihi, ${kmTxt} km içindeki her ızgara noktası. Konumlar harita değil.`
        : `Schematic. Same landing date, every grid point within ${kmTxt} km. Positions are not the map.`)
      : '',
    rover: tr ? `${roverName}, gerçek arazi üzerinde kısa ve temsili bir sürüşe çıkar. Zaman çarpanı ekranda gösterilir; bu, buz hedefine giden bir sefer değildir.`
      : `${roverName} makes a short illustrative departure over the real terrain. The time multiplier is shown on screen; this is not the traverse to the ice target.`,
    odds: card.prob
      ? (tr ? `${fmtNum(card.prob.trials, 0, lang)} simüle görev. Noktalar bildirilen paylara göre beş sonuca iner.`
        : `${fmtNum(card.prob.trials, 0, lang)} simulated missions. The dots fall into five outcomes, in the reported shares.`)
      : '',
    verdict: verdictLine,
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
    { at: 0.02, k: 'T+0', v: tr ? 'KALKIŞ · tipik ağır profil · bu aracın rampası değil' : 'LIFTOFF · typical heavy-lift profile · not this vehicle’s pad' },
    { at: 0.18, k: tr ? 'T+8 dk' : 'T+8 min', v: tr ? 'NOMİNAL YÖRÜNGE · 185 km · 7,8 km/sn' : 'NOMINAL ORBIT · 185 km · 7.8 km/s' },
    { at: 0.72, k: tr ? 'T+1 sa 30 dk' : 'T+1 h 30', v: tr ? 'NOMİNAL TRANSFER · +3,1 km/sn' : 'NOMINAL TRANS-LUNAR INJECTION · +3.1 km/s' },
    { at: 0.82, k: fmt(launch), v: tr ? 'PLANLAMA TARİHİ · inişten 5 gün önce' : 'PLANNING DATE · 5 days before landing' },
  ]
  const hud = (phase: 'coast' | 'descent' | 'site') => (
    <FilmHud lang={lang} phase={phase} t={t} heightM={r.heightM} lat={r.lat} lon={r.lon} sunDaily={r.sunDaily} />
  )

  // The 3D scenes are built once per scene, not on every clock tick: the film re-renders 60 times a second for its
  // text and counters, and rebuilding a react-three-fiber tree that often makes the 3D stutter.
  const descentEl = useMemo(() => (scene === 'descent' ? globe('pilot', 0.5) : null), [scene])   // eslint-disable-line react-hooks/exhaustive-deps
  // One drive world for the descent premount, touchdown and rover. Hidden during descent so the
  // short landing shot is not a load hitch. filmMode stays "landing" across that cut, so the world
  // is not rebuilt and the approach clock is not reset. Technical inserts keep it hidden too.
  const groundLive = !!touchdown && (scene === 'descent' || scene === 'landing' || scene === 'site' || scene === 'ellipse' || scene === 'rover')
  const groundMode: 'landing' | 'rover' = scene === 'descent' || scene === 'landing' ? 'landing' : 'rover'
  const groundShown = scene === 'landing' || scene === 'rover'
  const readyForShot = !touchdown || !groundShown || groundReady[scene === 'landing' ? 'landing' : 'rover']
  useEffect(() => { setAutoHold(!readyForShot) }, [readyForShot])
  useEffect(() => {
    if (!groundLive) setGroundReady(old => old.landing || old.rover ? { landing: false, rover: false } : old)
  }, [groundLive])
  const groundEl = useMemo(() => (groundLive ? touchdown!(groundMode) : null), [groundLive, groundMode]) // eslint-disable-line react-hooks/exhaustive-deps
  // the rover scene starts loading (terrain, route, shaders) while the light 2D site scene plays, hidden, so the cut
  // to it is instant instead of freezing for a few seconds
  const roverLive = !touchdown && !!rover && (scene === 'site' || scene === 'ellipse' || scene === 'rover')
  const roverEl = useMemo(() => (roverLive ? rover!() : null), [roverLive])          // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MissionPlaybackContext.Provider value={playbackContext}><div className="film" role="dialog" aria-label={tr ? 'Görev filmi' : 'Mission film'}>
      <div className={`film-stage s-${scene}`}>
        {scene === 'title' && (
          /* Flex row, not a centered absolute. translateX(-50%) here once collapsed the title. */
          <div className="fs-title">
            <TitleBackdrop />
            <Patch size={128} />
            <div className="fs-title-text">
              <span className="fs-kicker">{tr ? 'Touchdown sunar' : 'Touchdown presents'}</span>
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
            <Suspense fallback={null}><LaunchScene t={t} launch={launch} /></Suspense>
            <div className="fs-boxes left">
              {launchBoxes.filter((b) => t >= b.at).map((b) => <div key={b.k} className="fs-box"><b>{b.k}</b><span>{b.v}</span></div>)}
            </div>
            <span className="fs-note">{tr ? 'Nominal profil · zaman sıkıştırılmış · ölçeksiz. Işık: fırlatma tarihi (yaklaşık).' : 'Nominal profile · time compressed · not to scale. Lighting: launch date (approximate).'}</span>
          </>
        )}
        {scene === 'window' && <WindowScene plan={win} landing={landing} t={t} lang={lang} reduce={reduce} />}
        {scene === 'coast' && (
          <>
            <Suspense fallback={null}><TransferScene launch={launch} /></Suspense>
            {hud('coast')}
            <span className="fs-note">{tr ? `Şema · nominal 4,5 gün / ${DUR.coast} sn · boyutlar ve uzaklıklar ölçeksiz` : `Schematic · nominal 4.5 days / ${DUR.coast} s · sizes and distances not to scale`}</span>
          </>
        )}
        {scene === 'descent' && (
          <>
            {descentEl}
            {hud('descent')}
          </>
        )}
        {groundLive && <div className={groundShown ? 'fs-rover-live' : 'fs-premount'} aria-hidden={!groundShown}>{groundEl}</div>}
        {groundShown && !readyForShot && <div className="fs-ground-loading">
          {img && <img src={img} alt="" />}
          <p>{tr ? 'Arazi ve araç hazırlanıyor…' : 'Preparing terrain and vehicle…'}</p>
        </div>}
        {scene === 'site' && (
          <div className="fs-site" style={{ ['--team' as string]: card.colour }}>
            {img && <img src={img} alt="" className="fs-site-img" style={{ transform: `scale(${1 + t * 0.12}) translateX(${-t * 2}%)` }} />}
            <div className="fs-site-name"><span>{card.region ?? (tr ? 'Açık arazi' : 'Open terrain')}</span><h2>{card.name}</h2></div>
            <div className="fs-boxes grid">
              <div className="fs-box stat sun"><b><Count to={r.sunPct} t={t} suffix="%" /></b><span>{tr ? 'Güneş' : 'Sunlight'}</span></div>
              <div className="fs-box stat earth"><b><Count to={r.earthPct} t={t} suffix="%" /></b><span>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</span></div>
              <div className="fs-box stat dark"><b><Count to={r.longestDarkH} t={t} suffix={tr ? ' sa' : ' h'} /></b><span>{tr ? 'En uzun karanlık' : 'Longest dark'}</span></div>
              {r.zoneSlopeDeg !== null && <div className="fs-box stat safe"><b><Count to={r.zoneSlopeDeg} t={t} digits={1} suffix="°" /></b><span>{tr ? 'İniş alanı eğimi' : 'Landing zone slope'}</span></div>}
              {r.iceKm !== null && <div className="fs-box stat ice"><b><Count to={r.iceKm} t={t} digits={1} suffix=" km" /></b><span>{tr ? 'Buza uzaklık' : 'To water ice'}</span></div>}
              <div className="fs-box stat go"><b><Count to={r.goDates} t={t} />/{r.windowDays}</b><span>{tr ? 'Uygun iniş tarihi' : 'GO landing dates'}</span></div>
            </div>
            {hud('site')}
          </div>
        )}
        {scene === 'ellipse' && card.ellipse && card.ellipse.points > 1 && <EllipseScene ellipse={card.ellipse} t={t} lang={lang} reduce={reduce} />}
        {roverLive && <div className={scene === 'rover' ? 'fs-rover-live' : 'fs-premount'} aria-hidden={scene !== 'rover'}>{roverEl}</div>}
        {scene === 'odds' && card.prob && <OddsScene prob={card.prob} t={t} lang={lang} reduce={reduce} />}
        {scene === 'verdict' && (
          <div className={`fs-verdict fv-verdict ${go ? 'go' : 'nogo'}`} style={{ ['--team' as string]: card.colour }}>
            <section className="fv-summary">
              <span className="fs-kicker">{tr ? 'Hesaplanan görev kararı' : 'Computed mission verdict'}</span>
              <h1 style={enter(t, 0, reduce, 0.08)}>{tr ? (go ? 'UYGUN' : 'UYGUN DEĞİL') : (go ? 'GO' : 'NO-GO')}</h1>
              <h2 className="fv-site">{card.name}</h2>
              <p className="fv-date">{fmt(landing)}</p>
              <dl className="fv-metrics">
                <div><dt>{tr ? 'Güneş ışığı' : 'Sunlight'}</dt><dd>{fmtNum(r.sunPct, 0, lang)}%</dd></div>
                <div><dt>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</dt><dd>{fmtNum(r.earthPct, 0, lang)}%</dd></div>
                <div><dt>{tr ? 'En uzun karanlık' : 'Longest darkness'}</dt><dd>{fmtNum(r.longestDarkH, 0, lang)} <small>{tr ? 'sa' : 'h'}</small></dd></div>
                {card.prob && <div><dt>{tr ? 'Simüle başarı' : 'Simulated success'}</dt><dd>{fmtNum(card.prob.p * 100, 0, lang)}%</dd></div>}
              </dl>
              <p className="fv-limit">{tr ? 'Planlama kararıdır; iniş sertifikası değildir.' : 'A planning verdict, not a landing certification.'}</p>
              {ended && (
                <div className="fs-actions">
                  {onWalk && <button className="btn primary" onClick={onWalk}><Footprints size={15} /> {tr ? 'Ay’da yürü' : 'Walk on the Moon'}</button>}
                  <button className="btn" onClick={() => setTime(0)}><RotateCcw size={15} /> {tr ? 'Tekrar izle' : 'Watch again'}</button>
                  <button className="btn" onClick={onClose}>{tr ? 'Kapat' : 'Close'}</button>
                </div>
              )}
            </section>
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
      {scene === 'landing' && (() => {
        const state = playback.current.surface!
        return <div className="film-landing-telemetry" data-landed={state.landed ? '1' : '0'}>
          <b>{state.landed ? (tr ? 'TEMAS · MOTOR KAPALI' : 'CONTACT · ENGINE OFF')
            : `${tr ? 'İRTİFA' : 'ALTITUDE'} ${fmtNum(state.altitude, 0, lang)} m · ${tr ? 'MESAFE' : 'RANGE'} ${fmtNum(state.range, 0, lang)} m · T−${Math.ceil(state.seconds)} ${tr ? 'sn' : 's'}`}</b>
          <span>{tr ? `Nominal son yaklaşma · 180 sn / ${DUR.landing} sn` : `Nominal final approach · 180 s / ${DUR.landing} s`}</span>
        </div>
      })()}
      {scene !== 'verdict' && <p className="film-sub" key={`sub-${scene}`}>{subtitle[scene]}</p>}
      <div className="film-ctl">
        <button onClick={() => setPaused(!paused)} aria-label={paused ? (tr ? 'Oynat' : 'Play') : (tr ? 'Duraklat' : 'Pause')}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button onClick={() => setTime(starts[Math.min(scenes.length - 1, k + 1)])} aria-label={tr ? 'Sonraki' : 'Next'}><ChevronRight size={16} /></button>
        <div className="film-progress">
          {scenes.map((s, i) => (
            <button key={s} className={i < k ? 'done' : i === k ? 'on' : ''} onClick={() => setTime(starts[i])} title={NAMES[s][lang]}>
              <i style={{ width: i < k ? '100%' : i === k ? `${t * 100}%` : 0 }} />
            </button>
          ))}
        </div>
        <button onClick={() => { if (voice) speechSynthesis.cancel(); setVoice(!voice) }} aria-label={voice ? (tr ? 'Sessize al' : 'Mute') : (tr ? 'Seslendir' : 'Narrate')}>{voice ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        <button onClick={onClose} aria-label={tr ? 'Kapat' : 'Close'}><X size={16} /></button>
      </div>
    </div></MissionPlaybackContext.Provider>
  )
}
