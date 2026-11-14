// "Tell me the mission": a short film of the mission, built from the computed result. Seven scenes play in order:
// title, launch from Earth, the coast, the descent (cockpit), the site (terrain + numbers), the rover drive (camera
// cuts), and the verdict. 3D scenes come from the app's own engines (the globe, the drive view, the launch scene);
// subtitles and every number come from the mission story, which only uses computed values.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, Footprints, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import type { Lang } from '../i18n'
import type { Chapter } from '../story'
import type { Lander } from '../vehicles'
import Patch from './Patch'
import VehiclePhoto from './VehiclePhoto'
import { useSiteImage, type CardSite } from './SiteCard'
import { useSpeechVoice } from '../speech'

const LaunchScene = lazy(() => import('./LaunchScene'))

type SceneId = 'title' | 'launch' | 'coast' | 'descent' | 'landing' | 'site' | 'rover' | 'verdict'
const DUR: Record<SceneId, number> = { title: 5, launch: 10, coast: 6, descent: 7, landing: 30, site: 9, rover: 13, verdict: 9 }

const NAMES: Record<SceneId, Record<Lang, string>> = {
  title: { en: 'Mission', tr: 'Görev' }, launch: { en: 'Launch', tr: 'Fırlatma' }, coast: { en: 'To the Moon', tr: 'Ay’a yolculuk' },
  descent: { en: 'Descent', tr: 'Alçalma' }, landing: { en: 'Touchdown', tr: 'Yere iniş' }, site: { en: 'The site', tr: 'Nokta' }, rover: { en: 'On the surface', tr: 'Yüzeyde' },
  verdict: { en: 'Verdict', tr: 'Karar' },
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
    const tick = () => { setT((performance.now() - origin.current) / 1000); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [paused])
  const seek = (s: number) => { origin.current = performance.now() - s * 1000; if (pausedAt.current !== null) pausedAt.current = performance.now(); setT(s) }
  return [t, seek] as const
}

/** A number that counts up over the first part of the scene. */
function Count({ to, t, digits = 0, suffix = '' }: { to: number; t: number; digits?: number; suffix?: string }) {
  const v = to * Math.min(1, Math.max(0, t / 0.45)) ** 0.6
  return <>{v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}{suffix}</>
}

export default function MissionFilm({ lang, card, chapters, lander, roverName, missionName, launch, landing, globe, rover, touchdown, onClose, onWalk }: {
  touchdown: (() => ReactNode) | null
  lang: Lang; card: CardSite; chapters: Chapter[]; lander: Lander; roverName: string; missionName: string
  launch: Date; landing: Date
  globe: (view: 'overview' | 'pilot', start: number) => ReactNode
  rover: (() => ReactNode) | null
  onClose: () => void; onWalk: (() => void) | null
}) {
  const tr = lang === 'tr'
  const scenes = useMemo(() => (['title', 'launch', 'coast', 'descent', ...(touchdown ? ['landing' as const] : []), 'site', ...(rover ? ['rover' as const] : []), 'verdict'] as SceneId[]), [rover, touchdown])
  const starts = useMemo(() => scenes.reduce<number[]>((a, _s, k) => [...a, k ? a[k - 1] + DUR[scenes[k - 1]] : 0], []), [scenes])
  const total = starts[starts.length - 1] + DUR[scenes[scenes.length - 1]]
  const [paused, setPaused] = useState(false)
  const [voice, setVoice] = useState(false)
  const speech = useSpeechVoice(lang)
  const [time, setTime] = useClock(paused)
  const k = starts.reduce((last, s0, i) => (time >= s0 ? i : last), 0)
  const scene = scenes[k]
  const t = Math.min(1, (time - starts[k]) / DUR[scene])
  const ended = time >= total
  const img = useSiteImage(card)
  const ch = (tone: Chapter['tone']) => chapters.find((c) => c.tone === tone)?.text ?? ''
  const fmt = (d: Date) => d.toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const r = card.row

  const subtitle: Record<SceneId, string> = {
    title: lander.pitch[lang],
    launch: ch('launch'),
    coast: tr ? 'Yaklaşık 4,5 gün ve 384.000 km. Ay bizi bir kutup yörüngesine yakalar; seçilen nokta tam altımızdan geçer.'
      : 'About 4.5 days and 384,000 km. The Moon captures us into a polar orbit whose track runs right over the chosen site.',
    descent: tr ? 'Kutup yörüngesinden fren ateşlemesi başlar: saatte 6.000 km’den sıfıra, yaklaşık 12 dakikada.'
      : 'From the polar orbit the braking burn begins: from 6,000 km/h to zero in about 12 minutes.',
    landing: ch('land'),
    site: `${ch('place')} ${ch('sun')}`,
    rover: tr ? `${roverName} rampadan iner ve güneşli bir rota planlar.${r.iceKm !== null ? ` Buz ${r.iceKm.toFixed(1)} km ötede.` : ''}`
      : `${roverName} rolls off the ramp and plans a sunlit route.${r.iceKm !== null ? ` The ice is ${r.iceKm.toFixed(1)} km away.` : ''}`,
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

  return (
    <div className="film" role="dialog" aria-label={tr ? 'Görev filmi' : 'Mission film'}>
      <div className={`film-stage s-${scene}`} key={scene}>
        {scene === 'title' && (
          <div className="fs-title">
            <Patch size={120} />
            <div className="fs-title-text">
              <span className="fs-kicker">{tr ? 'LunaNav sunar' : 'LunaNav presents'}</span>
              <h1>{missionName}</h1>
              <span className="fs-sub">{card.name} · {fmt(landing)}</span>
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
        {scene === 'coast' && (
          <>
            {globe('overview', 0)}
            <div className="fs-boxes right">
              <div className="fs-box big"><b><Count to={384400} t={t} /> km</b><span>{tr ? 'Dünya’dan' : 'from Earth'}</span></div>
              <div className="fs-box big"><b>{tr ? 'Gün' : 'Day'} <Count to={4.5} t={t} digits={1} /></b><span>{tr ? 'yolda' : 'of the coast'}</span></div>
            </div>
          </>
        )}
        {scene === 'descent' && (
          <>
            {globe('pilot', 0.5)}
            <div className="flight-hud-wrap pilot"><div className="reticle" /><div id="flight-hud" className="flight-hud" /></div>
          </>
        )}
        {scene === 'landing' && touchdown && touchdown()}
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
          </div>
        )}
        {scene === 'rover' && rover && (
          <>
            {rover()}
            <div className="fs-boxes left">
              <div className="fs-box"><b>{roverName}</b><span>{tr ? 'otopilot · güneşli rota' : 'autopilot · sunlit route'}</span></div>
            </div>
          </>
        )}
        {scene === 'verdict' && (
          <div className={`fs-verdict ${r.goDates > 0 ? 'go' : 'nogo'}`}>
            {img && <img src={img} alt="" className="fs-bg" />}
            <div className="fs-left">
              <span className="fs-kicker">{missionName} · {card.name}</span>
              <h1>{r.goDates > 0 ? 'GO' : 'NO-GO'}</h1>
              <p>{subtitle.verdict}</p>
              <VehiclePhoto kind="lander" id={lander.id} alt={lander.name} className="fs-lander-v" />
            </div>
            <div className="fs-right">
              <div className="fs-summary">
                <div style={{ ['--k' as string]: 'var(--red)' }}><span>{tr ? 'Fırlatma' : 'Launch'}</span><b>{fmt(launch)}</b></div>
                <div style={{ ['--k' as string]: 'var(--go)' }}><span>{tr ? 'İniş' : 'Landing'}</span><b>{fmt(landing)}</b></div>
                <div style={{ ['--k' as string]: card.colour }}><span>{tr ? 'Nokta' : 'Site'}</span><b>{card.name}</b></div>
                <div><span>{tr ? 'İniş aracı' : 'Lander'}</span><b>{lander.name}</b></div>
                <div style={{ ['--k' as string]: 'var(--sun)' }}><span>{tr ? 'Güneş' : 'Sunlight'}</span><b>{r.sunPct}%</b></div>
                <div style={{ ['--k' as string]: 'var(--earth)' }}><span>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</span><b>{r.earthPct}%</b></div>
                <div style={{ ['--k' as string]: '#9d7bff' }}><span>{tr ? 'En uzun karanlık' : 'Longest dark'}</span><b>{r.longestDarkH} h</b></div>
                <div style={{ ['--k' as string]: 'var(--go)' }}><span>{tr ? 'Uygun iniş tarihi' : 'GO landing dates'}</span><b>{r.goDates}/{r.windowDays}</b></div>
              </div>
              {card.prob && (
                <div className="fs-prob"><span>{tr ? 'Görev başarı olasılığı' : 'Mission success probability'}</span>
                  <b>{Math.round(card.prob.p * 100)}%</b><em>{Math.round(card.prob.lo * 100)}–{Math.round(card.prob.hi * 100)}% · {card.prob.trials} {tr ? 'simüle görev' : 'simulated missions'}</em></div>
              )}
              <span className="fs-dates-label">{tr ? 'Penceredeki her iniş tarihi' : 'Every landing date in the window'}</span>
              <div className="fs-dates">{r.perStart.map((g, i) => <i key={i} className={`${g ? 'go' : ''} ${i === card.r.bestStart ? 'best' : ''}`} />)}</div>
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
