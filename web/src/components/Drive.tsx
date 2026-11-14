// "Be there": stand on the lander or drive a rover over the real LOLA terrain, with the Sun and Earth where the
// ephemeris puts them for the chosen landing date. Terrain: 10 m LOLA site maps where available, else the 200 m polar
// grid (curvature included). Lighting: the real Sun direction, nearby relief shadows from a shadow map, distant
// ridges from a horizon ray-march per vertex. Power and radio use the same horizon method as the search engine.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import type { Ephem } from '../engine'
import { pointLatLon } from '../engine'
import type { Lang } from '../i18n'
import { R_M, altAz, bodies, conditions, diskAbove, horizonElev, horizonProfile, makeGround, nextChanges, parseDem,
  localSky, parsePatch, parseScience, parseThermal, thermalAt, type Thermal, planeAz, planeDir, scienceAt, findIceTarget, type Dem, type Patch, type Science, type SiteInfo } from '../terrain'
import { dataUrl } from '../data'
import { planRoute, type Route } from '../route'
import { eclipseAt } from '../eclipse'
import { NasaModel } from './Models'
import { connectSerial, disconnectSerial, sendSky, serialConnected, serialSupported, skyLine } from '../serial'

export type DriveMode = 'lander' | 'rover'
export interface DriveStart { x: number; y: number; hour: number; missionH: number; label: string; startMs: number }

// Rover power model (illustrative, VIPER-class): stated on screen so nobody mistakes it for a real spec.
const ROVER = { batteryWh: 3000, panelW: 450, driveW: 220, idleW: 120, maxSpeed: 0.25, maxSlope: 20, mast: 2 }
const WARPS = [1, 10, 60, 600, 3600]
const PARK = [9, 5]   // rover parking spot beside the lander (m)
const NEAR = { half: 1200, step: 10 }
const FAR = { half: 80000, step: 800 }

const L = {
  lander: { en: 'Lander view', tr: 'İniş aracı görünümü' },
  rover: { en: 'Rover', tr: 'Gezgin' },
  deploy: { en: 'Deploy the rover', tr: 'Gezgini indir' },
  back: { en: 'Back to the lander', tr: 'İniş aracına dön' },
  exit: { en: 'Exit', tr: 'Çık' },
  battery: { en: 'Battery', tr: 'Batarya' },
  solar: { en: 'Solar', tr: 'Güneş' },
  use: { en: 'Use', tr: 'Tüketim' },
  sun: { en: 'Sun', tr: 'Güneş' },
  earth: { en: 'Earth', tr: 'Dünya' },
  up: { en: 'in view', tr: 'görünür' },
  down: { en: 'hidden', tr: 'görünmez' },
  sets: { en: 'sets in', tr: 'batmasına' },
  rises: { en: 'rises in', tr: 'doğmasına' },
  link: { en: 'Radio link', tr: 'Radyo bağlantısı' },
  dsnOk: { en: 'via NASA DSN', tr: 'NASA DSN ile' },
  noDsn: { en: 'no DSN dish free', tr: 'DSN anteni yok' },
  steep: { en: 'Too steep: the rover cannot climb this', tr: 'Çok dik: gezgin buraya tırmanamaz' },
  dead: { en: 'Battery empty: the rover froze in the dark.', tr: 'Batarya bitti: gezgin karanlıkta dondu.' },
  driven: { en: 'driven', tr: 'yol' },
  survived: { en: 'survived', tr: 'dayandı' },
  restart: { en: 'Try again', tr: 'Tekrar dene' },
  terrain10: { en: 'LOLA 10 m terrain', tr: 'LOLA 10 m arazi' },
  terrain200: { en: 'LOLA 200 m terrain', tr: 'LOLA 200 m arazi' },
  keys: { en: 'W/S drive · A/D steer · P plan route · E drill · V science view · C camera · L lights · 1–5 time speed · drag to look',
    tr: 'W/S sür · A/D dön · P rota · E del · V bilim görünümü · C kamera · L far · 1–5 zaman hızı · sürükle: bak' },
  target: { en: 'Ice target', tr: 'Buz hedefi' },
  inPsr: { en: 'in permanent shadow', tr: 'kalıcı gölgede' },
  iceIdx: { en: 'ice favorability', tr: 'buz olasılık endeksi' },
  drillHint: { en: 'Hold E to drill (2 h at 300 W)', tr: 'Delmek için E basılı tutun (2 sa, 300 W)' },
  drilling: { en: 'Drilling', tr: 'Deliniyor' },
  bringBack: { en: 'Sample collected: bring it back into sunlight', tr: 'Örnek alındı: güneş ışığına geri getirin' },
  complete: { en: 'Mission complete', tr: 'Görev tamam' },
  noTarget: { en: 'No permanent shadow within 6 km: explore freely', tr: '6 km içinde kalıcı gölge yok: serbest keşif' },
  science: { en: 'Science view: blue = permanent shadow (never sunlit), cyan = ice-favourable',
    tr: 'Bilim görünümü: mavi = kalıcı gölge (hiç güneş görmez), camgöbeği = buz için elverişli' },
  psrHere: { en: 'You are in permanent shadow', tr: 'Kalıcı gölgedesiniz' },
  sciSrc: { en: 'Permanent shadow: Mazarico et al. 2011 (NASA PGDA) · ice index: USGS · temperatures: LRO Diviner (Paige et al.)', tr: 'Kalıcı gölge: Mazarico vd. 2011 (NASA PGDA) · buz endeksi: USGS · sıcaklık: LRO Diviner (Paige vd.)' },
  keysLander: { en: 'Drag to look around · play the mission clock below · dashed lines: where the Sun (yellow) and Earth (blue) travel during the mission',
    tr: 'Etrafa bakmak için sürükleyin · görev saatini aşağıdan oynatın · kesikli çizgiler: görev boyunca Güneş (sarı) ve Dünya (mavi) yolu' },
  model: { en: 'Rover power model is illustrative (450 W panel, 3 kWh battery, 0.25 m/s); terrain, Sun, Earth and DSN are real data.',
    tr: 'Gezgin güç modeli temsilidir (450 W panel, 3 kWh batarya, 0,25 m/sn); arazi, Güneş, Dünya ve DSN gerçek veridir.' },
  loading: { en: 'Loading LOLA terrain…', tr: 'LOLA arazisi yükleniyor…' },
  speed: { en: 'time', tr: 'zaman' },
  mission: { en: 'Mission day', tr: 'Görev günü' },
  compass: { en: 'Sky compass', tr: 'Gökyüzü pusulası' },
  plan: { en: 'Plan a sunlit route', tr: 'Güneşli rota planla' },
  planning: { en: 'Planning over the terrain…', tr: 'Arazi üzerinde planlanıyor…' },
  noRoute: { en: 'No safe route found (too steep)', tr: 'Güvenli rota yok (çok dik)' },
  route: { en: 'Route', tr: 'Rota' },
  inShadow: { en: 'in shadow', tr: 'gölgede' },
  steepest: { en: 'steepest', tr: 'en dik' },
  driving: { en: 'driving', tr: 'sürüş' },
  auto: { en: 'Autopilot', tr: 'Otopilot' },
  clearRoute: { en: 'Clear', tr: 'Temizle' },
  toLander: { en: 'to the lander', tr: 'iniş aracına' },
  compassOn: { en: 'Sky compass connected', tr: 'Gökyüzü pusulası bağlı' },
} as const

interface World { dem: Dem; patches: Patch[]; ground: ReturnType<typeof makeGround>; sci: Science | null; thermal: Thermal | null }

let demPromise: Promise<{ dem: Dem; sites: SiteInfo[]; sci: Science | null; thermal: Thermal | null }> | null = null
function loadDem() {
  demPromise ??= Promise.all([
    fetch(dataUrl('pole_dem.bin')).then((r) => r.arrayBuffer()),
    fetch(dataUrl('sites.json')).then((r) => (r.ok ? r.json() : { sites: [] })).catch(() => ({ sites: [] })),
    fetch(dataUrl('psr.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
    fetch(dataUrl('thermal.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
  ]).then(([b, s, p, th]) => ({ dem: parseDem(b), sites: s.sites as SiteInfo[], sci: p ? parseScience(p) : null, thermal: th ? parseThermal(th) : null }))
  return demPromise
}
const patchCache = new Map<string, Promise<Patch>>()
function loadPatch(s: SiteInfo) {
  if (!patchCache.has(s.id)) patchCache.set(s.id, fetch(dataUrl(s.file)).then((r) => r.arrayBuffer()).then((b) => parsePatch(b, s.id, s.name)))
  return patchCache.get(s.id)!
}
const near = (s: SiteInfo, x: number, y: number, margin: number) =>
  x > s.bounds_m[0] - margin && x < s.bounds_m[2] + margin && y > s.bounds_m[1] - margin && y < s.bounds_m[3] + margin

/** Shared mutable simulation state (kept out of React so the frame loop does not re-render). */
interface Sim {
  mode: DriveMode
  x: number; y: number; heading: number      // stereographic metres; heading = plane angle (rad)
  speed: number; throttle: number; steer: number
  hour: number; warp: number; playing: boolean
  battery: number; solarW: number; useW: number
  driven: number; startHour: number; dead: boolean; steep: boolean; lights: boolean
  cam: 'chase' | 'mast'; yaw: number; pitch: number; pad: boolean; padBtn: boolean[]
  origin: { x: number; y: number; h: number }
  profile: Float32Array | null; profileAt: { x: number; y: number }
  cond: ReturnType<typeof conditions> | null
  ecl: number
  science: boolean; drillKey: boolean
  target: { x: number; y: number; ice: number } | null
  phase: 'go' | 'return' | 'done'; drilled: number; doneHour: number
  route: Route | null; routeVer: number; routeI: number; autopilot: boolean
}

export default function Drive({ start, eph, dsn, lang, initialMode, onExit }:
  { start: DriveStart; eph: Ephem; dsn: boolean[]; lang: Lang; initialMode: DriveMode; onExit: () => void }) {
  const [world, setWorld] = useState<World | null>(null)
  const [hud, setHud] = useState(0)
  const sim = useRef<Sim>({
    mode: initialMode, x: start.x + PARK[0], y: start.y + PARK[1], heading: 0, speed: 0, throttle: 0, steer: 0,
    hour: start.hour, warp: initialMode === 'rover' ? 60 : 600, playing: initialMode === 'rover', battery: ROVER.batteryWh,
    solarW: 0, useW: 0, driven: 0, startHour: start.hour, dead: false, steep: false, lights: true,
    cam: 'chase', pad: false, padBtn: [], yaw: 0, pitch: initialMode === 'lander' ? 0.02 : -0.12,
    origin: { x: start.x, y: start.y, h: 0 }, profile: null, profileAt: { x: NaN, y: NaN }, cond: null, ecl: 0,
    science: false, drillKey: false, target: null, phase: 'go', drilled: 0, doneHour: 0,
    route: null, routeVer: 0, routeI: 0, autopilot: false,
  })

  // load the 200 m grid and any 10 m site maps within reach of the start
  useEffect(() => {
    let live = true
    loadDem().then(async ({ dem, sites, sci, thermal }) => {
      const patches = await Promise.all(sites.filter((s) => near(s, start.x, start.y, 30000)).map(loadPatch))
      if (!live) return
      const ground = makeGround(dem, patches)
      const s = sim.current
      s.origin = { x: start.x, y: start.y, h: ground.height(start.x, start.y) }
      // face the Sun's side at the start so the first view is lit
      const sky = conditions(eph, horizonProfile(ground.height, start.x, start.y), start.x, start.y, start.hour)
      const [dx, dy] = planeDir(sky.lon, sky.sun.az)
      s.heading = Math.atan2(dy, dx) + (initialMode === 'rover' ? 0.6 : 0)
      const tg = sci ? findIceTarget(sci, start.x, start.y) : null
      s.target = tg && { x: tg.x, y: tg.y, ice: tg.ice }
      setWorld({ dem, patches, ground, sci, thermal })
    })
    return () => { live = false }
  }, [start.x, start.y])  // eslint-disable-line react-hooks/exhaustive-deps

  // HUD refresh at 6 Hz
  useEffect(() => {
    const t = setInterval(() => {
      setHud((v) => v + 1)
      // mirror the sky on the USB LED ring (hardware/sky_link), relative to where the vehicle (or the view) points
      const s = sim.current
      const c = s.cond
      if (!c || !serialConnected()) return
      const [, lon] = pointLatLon(s.x / 1000, s.y / 1000)
      const yaw = s.heading + (s.mode === 'lander' ? s.yaw : 0)
      const nose = planeAz(lon, Math.cos(yaw), Math.sin(yaw))
      const sci = sciRef.current ? scienceAt(sciRef.current, s.x, s.y) : null
      sendSky(skyLine(c.sun.az - nose, c.sunFrac, c.earth.az - nose, c.earthUp, (s.battery / ROVER.batteryWh) * 100, (sci?.psr ?? 0) > 0.5))
    }, 160)
    return () => { clearInterval(t); disconnectSerial() }
  }, [])
  const sciRef = useRef<Science | null>(null)
  sciRef.current = world?.sci ?? null
  const [serialOn, setSerialOn] = useState(false)
  const [planning, setPlanning] = useState<'idle' | 'busy' | 'none'>('idle')
  const plan = () => {
    if (!world || planning === 'busy') return
    const s = sim.current
    const goal: [number, number] = s.phase === 'go' && s.target ? [s.target.x, s.target.y] : [start.x + PARK[0], start.y + PARK[1]]
    setPlanning('busy')
    setTimeout(() => {
      const h = world.ground.height
      const b = bodies(eph, s.hour)
      const cache = new Map<string, number>()
      // sunlight at the current hour from the real horizon, cached on a 100 m lattice
      const lit = (x: number, y: number) => {
        const key = `${Math.round(x / 100)},${Math.round(y / 100)}`
        let v = cache.get(key)
        if (v === undefined) {
          const [la, lo] = pointLatLon(x / 1000, y / 1000)
          const sun = altAz(b.sun, la, lo)
          v = sun.alt < -1 ? 0 : diskAbove(sun.alt, horizonElev(h, x, y, lo, sun.az, 1, 30000), b.sunR)
          cache.set(key, v)
        }
        return v
      }
      const r = planRoute(h, [s.x, s.y], goal, { cell: 20, maxSlope: ROVER.maxSlope - 2, lit, darkCost: 2, margin: 1500 })
      s.route = r
      s.routeI = 0
      s.routeVer++
      s.autopilot = !!r
      s.playing = true
      setPlanning(r ? 'idle' : 'none')
    }, 40)
  }
  const planRef = useRef(plan)
  planRef.current = plan

  // keyboard
  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const s = sim.current
      s.throttle = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
      s.steer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0)
      s.drillKey = keys.has('e')
      if (s.throttle || s.steer) s.autopilot = false
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const s = sim.current
      if (k === 'escape') onExit()
      if (k === 'c') s.cam = s.cam === 'chase' ? 'mast' : 'chase'
      if (k === 'l') s.lights = !s.lights
      if (k === 'v') s.science = !s.science
      if (k === 'p') planRef.current()
      if (k === ' ') s.playing = !s.playing
      if (k >= '1' && k <= '5') s.warp = WARPS[+k - 1]
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      keys.add(k)
      apply()
    }
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); apply() }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up) }
  }, [onExit])

  const s = sim.current
  const t = (k: keyof typeof L) => L[k][lang]
  const c = s.cond
  const next = useMemo(() => (c && s.profile ? nextChanges(eph, s.profile, s.x, s.y, s.hour, 720) : null),
    [Math.floor(s.hour * 4), s.profileAt.x, s.profileAt.y])  // eslint-disable-line react-hooks/exhaustive-deps
  const hrs = (h: number | null) => (h === null ? '> 30 d' : h < 48 ? `${h} h` : `${(h / 24).toFixed(1)} d`)
  const date = new Date(start.startMs + (s.hour - start.hour) * 3600e3)
  const dsnUp = dsn[Math.floor(s.hour)] ?? false
  const link = !!c?.earthUp && dsnUp
  const pct = Math.max(0, s.battery / ROVER.batteryWh)
  const [lat, lon] = pointLatLon(s.x / 1000, s.y / 1000)
  const src = world?.ground.source(s.x, s.y)
  const headingAz = planeAz(lon, Math.cos(s.heading + (s.mode === 'lander' ? s.yaw : 0)), Math.sin(s.heading + (s.mode === 'lander' ? s.yaw : 0)))
  void hud
  const here = world?.sci ? scienceAt(world.sci, s.x, s.y) : null
  const tgt = s.target
  const therm = world?.thermal ? thermalAt(world.thermal, s.x, s.y) : null
  const degC = (k: number) => `${Math.round(k - 273.15)} °C`
  const tDist = tgt ? Math.hypot(tgt.x - s.x, tgt.y - s.y) : 0
  const tAz = tgt ? planeAz(lon, tgt.x - s.x, tgt.y - s.y) : null

  const restart = () => {
    Object.assign(s, { x: start.x + PARK[0], y: start.y + PARK[1], hour: start.hour, startHour: start.hour, battery: ROVER.batteryWh, driven: 0, dead: false, speed: 0, phase: 'go', drilled: 0 })
    s.profileAt = { x: NaN, y: NaN }
  }

  return (
    <div className="drive">
      {!world && <div className="drive-loading">{t('loading')}</div>}
      {world && (
        <Canvas shadows gl={{ logarithmicDepthBuffer: true, antialias: true }} dpr={[1, 2]}
                camera={{ fov: 62, near: 0.3, far: 600000, position: [0, 3, 0] }}
                onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1 }}>
          <Suspense fallback={null}><Scene world={world} sim={sim} eph={eph} start={start} /></Suspense>
        </Canvas>
      )}
      <LookDrag sim={sim} />

      <div className="hud top-left">
        <div className="hud-title">{s.mode === 'lander' ? '🛬 ' + t('lander') : '🚙 ' + t('rover')}</div>
        <div className="hud-sub">{start.label}</div>
        <div className="hud-sub">{lat.toFixed(3)}°, {(((lon % 360) + 360) % 360).toFixed(2)}°E · {src ? `${t('terrain10')} · ${src.name}` : t('terrain200')}</div>
      </div>

      {s.mode === 'rover' && (
        <div className="hud objective">
          {!tgt && <div>🧭 {t('noTarget')}</div>}
          {tgt && s.phase === 'go' && (
            <>
              <div><b>🎯 {t('target')}</b> · {tDist < 1000 ? `${Math.round(tDist)} m` : `${(tDist / 1000).toFixed(2)} km`} · {Math.round(tAz ?? 0)}°</div>
              <div className="hud-sub">{t('inPsr')} · {t('iceIdx')} {tgt.ice.toFixed(2)}</div>
              {tDist < 25 && <div className="drill">{s.drilled > 0 ? `⛏ ${t('drilling')} ${Math.round((s.drilled / 2) * 100)}%` : `⛏ ${t('drillHint')}`}</div>}
            </>
          )}
          {s.phase === 'return' && <div className="drill">🧪 {t('bringBack')}</div>}
          {s.phase === 'done' && <div className="done">✅ {t('complete')} · {(s.driven / 1000).toFixed(2)} km · {hrs(Math.round(s.doneHour - s.startHour))}</div>}
          {here && here.psr > 0.5 && <div className="hud-sub psr">🌑 {t('psrHere')}</div>}
          {therm && (
            <div className="hud-sub">🌡 {lang === 'tr' ? 'Yüzey ort.' : 'Surface avg'} {degC(therm.avgK)} · {lang === 'tr' ? 'en sıcak' : 'max'} {degC(therm.maxK)} ·{' '}
              {therm.iceM === null ? (lang === 'tr' ? 'kalıcı buz yok' : 'no stable ice') : `${lang === 'tr' ? 'buz kararlı' : 'ice stable below'} ${Math.round(therm.iceM * 100)} cm`}</div>
          )}
          {s.phase !== 'done' && (
            <div className="route-row">
              <button className="mini" disabled={planning === 'busy'} onClick={plan}>
                🧭 {planning === 'busy' ? t('planning') : `${t('plan')}${s.phase === 'return' || !tgt ? ` (${t('toLander')})` : ''}`}
              </button>
              {s.route && <button className={`mini ${s.autopilot ? 'on' : ''}`} onClick={() => { s.autopilot = !s.autopilot; s.playing = true }}>{s.autopilot ? '⏸' : '▶'} {t('auto')}</button>}
              {s.route && <button className="mini" onClick={() => { s.route = null; s.autopilot = false; s.routeVer++ }}>{t('clearRoute')}</button>}
            </div>
          )}
          {planning === 'none' && !s.route && <div className="hud-sub bad">{t('noRoute')}</div>}
          {s.route && (
            <div className="hud-sub">🧭 {t('route')} {(s.route.lengthM / 1000).toFixed(2)} km · {hrs(Math.round(s.route.lengthM / ROVER.maxSpeed / 3600))} {t('driving')} ·{' '}
              {(s.route.darkM / 1000).toFixed(2)} km {t('inShadow')} · {t('steepest')} {s.route.maxSlopeDeg.toFixed(0)}°</div>
          )}
        </div>
      )}
      {s.science && <div className="hud science">{t('science')}<br /><small>{t('sciSrc')}</small></div>}
      <Compass target={s.mode === 'rover' && s.phase === 'go' ? tAz : null} az={headingAz} sunAz={c?.sun.az ?? 0} earthAz={c?.earth.az ?? 0} sunUp={(c?.sunFrac ?? 0) > 0} earthUp={!!c?.earthUp} lang={lang} />

      <div className="hud top-right">
        <div className="clock">{date.toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
        <div className="hud-sub">{t('mission')} {Math.floor((s.hour - start.hour) / 24) + 1}</div>
        <div className="warps">
          <button className={s.playing ? 'on' : ''} onClick={() => { s.playing = !s.playing }}>{s.playing ? '⏸' : '▶'}</button>
          {WARPS.map((w, k) => (
            <button key={w} className={s.warp === w ? 'on' : ''} onClick={() => { s.warp = w; s.playing = true }} title={`${k + 1}`}>
              {w >= 3600 ? '1h/s' : w >= 60 ? `${w / 60}m/s` : `${w}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="hud bottom-left">
        <div className={`gauge ${pct < 0.2 ? 'low' : ''}`}>
          <span>🔋 {t('battery')}</span><b>{Math.round(pct * 100)}%</b>
          <i style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="flows">
          <span className="in">☀ {t('solar')} +{Math.round(s.solarW)} W</span>
          <span className="out">⚙ {t('use')} −{Math.round(s.useW)} W</span>
        </div>
        <div className={`status ${(c?.sunFrac ?? 0) >= 0.5 ? 'ok' : 'bad'}`}>
          ☀ {t('sun')}: {c ? `${Math.round(c.sunFrac * 100)}% · ${c.sun.alt.toFixed(1)}°` : '—'}
          {next && <em> · {next.sunUp ? t('sets') : t('rises')} {hrs(next.sunH)}</em>}
          {s.ecl > 0 && <b className="ecl"> · 🌘 {lang === 'tr' ? 'tutulma' : 'eclipse'} {Math.round(s.ecl * 100)}%</b>}
        </div>
        <div className={`status ${c?.earthUp ? 'ok' : 'bad'}`}>
          🌍 {t('earth')}: {c ? (c.earthUp ? t('up') : t('down')) + ` · ${c.earth.alt.toFixed(1)}°` : '—'}
          {next && <em> · {next.earthUp ? t('sets') : t('rises')} {hrs(next.earthH)}</em>}
        </div>
        <div className={`status ${link ? 'ok' : 'bad'}`}>📡 {t('link')}: {link ? t('dsnOk') : c?.earthUp ? t('noDsn') : '—'}</div>
        {s.mode === 'rover' && <div className="hud-sub">{t('driven')} {(s.driven / 1000).toFixed(2)} km · {(s.speed * 100).toFixed(0)} cm/s</div>}
      </div>

      <div className="hud bottom-right">
        {s.mode === 'lander'
          ? <button className="big" onClick={() => { s.mode = 'rover'; s.warp = 60; s.playing = true; s.pitch = -0.12; s.yaw = 0 }}>🚙 {t('deploy')}</button>
          : <button className="big ghost" onClick={() => { s.mode = 'lander'; s.x = start.x + PARK[0]; s.y = start.y + PARK[1]; s.yaw = 0; s.pitch = 0.02; s.profileAt = { x: NaN, y: NaN } }}>🛬 {t('back')}</button>}
        {serialSupported() && (
          <button className={`big ghost ${serialOn ? 'on' : ''}`} onClick={async () => {
            if (serialOn) { await disconnectSerial(); setSerialOn(false) } else setSerialOn(await connectSerial())
          }}>🔌 {serialOn ? t('compassOn') : t('compass')}</button>
        )}
        <button className="big ghost" onClick={onExit}>✕ {t('exit')}</button>
        <p className="keys">{s.mode === 'lander' ? t('keysLander') : t('keys')}</p>
        <p className="keys">{t('model')}</p>
      </div>

      {s.mode === 'lander' && (
        <div className="hud timeline">
          <input type="range" min={start.hour} max={start.hour + start.missionH} step={0.25} value={s.hour}
                 onChange={(e) => { s.hour = +e.target.value; s.playing = false }} />
        </div>
      )}
      {s.mode === 'rover' && s.steep && !s.dead && <div className="toast">⛰ {t('steep')}</div>}
      {s.dead && (
        <div className="gameover">
          <h2>❄ {t('dead')}</h2>
          <p>{t('driven')} {(s.driven / 1000).toFixed(2)} km · {t('survived')} {hrs(Math.round(s.hour - s.startHour))}</p>
          <button className="big" onClick={restart}>{t('restart')}</button>
        </div>
      )}
    </div>
  )
}

function LookDrag({ sim }: { sim: React.MutableRefObject<Sim> }) {
  // pointer-drag look-around on the canvas area
  useEffect(() => {
    let drag: { x: number; y: number } | null = null
    const el = document.querySelector('.drive') as HTMLElement | null
    if (!el) return
    const down = (e: PointerEvent) => { if ((e.target as HTMLElement).tagName === 'CANVAS') drag = { x: e.clientX, y: e.clientY } }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const s = sim.current
      s.yaw -= (e.clientX - drag.x) * 0.004
      s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch - (e.clientY - drag.y) * 0.003))
      drag = { x: e.clientX, y: e.clientY }
    }
    const up = () => { drag = null }
    el.addEventListener('pointerdown', down)
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    return () => { el.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up) }
  }, [sim])
  return null
}

function Compass({ az, sunAz, earthAz, sunUp, earthUp, lang, target }: { az: number; sunAz: number; earthAz: number; sunUp: boolean; earthUp: boolean; lang: Lang; target: number | null }) {
  const span = 120
  const marks: [number, string, string][] = [[0, lang === 'tr' ? 'K' : 'N', 'cdir'], [90, lang === 'tr' ? 'D' : 'E', 'cdir'],
    [180, 'S', 'cdir'], [270, lang === 'tr' ? 'B' : 'W', 'cdir'], [sunAz, '☀', sunUp ? 'sun' : 'sun off'], [earthAz, '🌍', earthUp ? 'earth' : 'earth off']]
  for (let a = 0; a < 360; a += 30) if (a % 90) marks.push([a, String(a), 'deg'])
  if (target !== null) marks.push([target, '◆', 'tgt'])
  return (
    <div className="compass">
      {marks.map(([a, label, cls]) => {
        const d = ((a - az + 540) % 360) - 180
        if (Math.abs(d) > span / 2) return null
        return <span key={label + a} className={cls} style={{ left: `${50 + (d / span) * 100}%` }}>{label}</span>
      })}
      <i className="needle" />
      <b>{Math.round(az)}°</b>
    </div>
  )
}

// ---------------------------------------------------------------- 3D scene

function Scene({ world, sim, eph, start }: { world: World; sim: React.MutableRefObject<Sim>; eph: Ephem; start: DriveStart }) {
  const { camera, scene } = useThree()
  const h = world.ground.height
  const sun = useRef<THREE.DirectionalLight>(null)
  const skyGroup = useRef<THREE.Group>(null)
  const sunMesh = useRef<THREE.Mesh>(null)
  const earthMesh = useRef<THREE.Mesh>(null)
  const rover = useRef<THREE.Group>(null)
  const panel = useRef<THREE.Group>(null)
  const lander = useRef<THREE.Group>(null)
  const dish = useRef<THREE.Group>(null)
  const head = useRef<THREE.SpotLight>(null)
  const nearMesh = useRef<THREE.Mesh>(null)
  const farMesh = useRef<THREE.Mesh>(null)
  const chunk = useRef({ cx: NaN, cy: NaN, ox: NaN, oy: NaN, litHour: NaN, litX: NaN, litY: NaN, sci: false })
  const ambient = useRef<THREE.HemisphereLight>(null)
  const beacon = useRef<THREE.Group>(null)
  // regolith PBR texture from NASA's Artemis south-pole simulation kit (USGS Astrogeology, 84S project), 1024 px
  const [regColor, regNormal, earthMap] = useTexture([dataUrl('regolith_color.jpg'), dataUrl('regolith_normal.jpg'), dataUrl('earth.jpg')])
  useMemo(() => {
    for (const x of [regColor, regNormal]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8 }
    regColor.colorSpace = THREE.SRGBColorSpace
    earthMap.colorSpace = THREE.SRGBColorSpace
  }, [regColor, regNormal, earthMap])
  const glareRef = useRef<THREE.Sprite>(null)
  const landerYaw = useRef(sim.current.heading)

  useEffect(() => {
    scene.background = new THREE.Color('#000000')
    if (import.meta.env.DEV) Object.assign(window, { __drive: { sim: sim.current, camera, scene } })
  }, [scene, camera])
  useEffect(() => {
    const l = head.current
    if (!l) return
    l.add(l.target)
    l.target.position.set(6, -0.8, 0)
  }, [])
  const stars = useMemo(starField, [])
  const glare = useMemo(sunGlare, [])
  const routeLine = useMemo(() => new THREE.Line(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#5ee7ff', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })), [])
  const routeKey = useRef('')
  const paths = useRef<THREE.Group>(null)
  // Sun and Earth paths over the whole mission, seen from the lander (drawn on the sky; terrain hides the parts behind ridges)
  const pathLines = useMemo(() => {
    const mk = (body: 'sun' | 'earth', color: string) => {
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= start.missionH; k += 1) {
        const sk = localSky(eph, start.x, start.y, start.hour + k)
        const b = sk[body]
        const [dx, dy] = planeDir(sk.lon, b.az)
        const ca = Math.cos((b.alt * Math.PI) / 180)
        pts.push(new THREE.Vector3(dx * ca, Math.sin((b.alt * Math.PI) / 180), -dy * ca).multiplyScalar(240000))
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 2500, gapSize: 2000, transparent: true, opacity: 0.85, toneMapped: false }))
      line.computeLineDistances()
      return line
    }
    return [mk('sun', '#f2b705'), mk('earth', '#4ea8de')]
  }, [eph, start])

  // world <-> three: x = sx - ox, z = -(sy - oy), y = height - oh - curvature drop from the origin
  const toV = (sx: number, sy: number, lift = 0) => {
    const o = sim.current.origin
    const dx = sx - o.x
    const dy = sy - o.y
    return new THREE.Vector3(dx, h(sx, sy) - o.h - (dx * dx + dy * dy) / (2 * R_M) + lift, -dy)
  }
  const skyDir = (alt: number, az: number, lon: number) => {
    const [dx, dy] = planeDir(lon, az)
    const ca = Math.cos((alt * Math.PI) / 180)
    return new THREE.Vector3(dx * ca, Math.sin((alt * Math.PI) / 180), -dy * ca)
  }

  function buildGrid(mesh: THREE.Mesh, cx: number, cy: number, half: number, step: number, hole?: { cx: number; cy: number; half: number }) {
    const n = Math.round((2 * half) / step) + 1
    const o = sim.current.origin
    const pos = new Float32Array(n * n * 3)
    const uv = new Float32Array(n * n * 2)
    const col = new Float32Array(n * n * 3)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const sx = cx - half + j * step
        const sy = cy + half - i * step
        const dx = sx - o.x
        const dy = sy - o.y
        let z = h(sx, sy)
        if (Number.isNaN(z)) z = -3000
        let y = z - o.h - (dx * dx + dy * dy) / (2 * R_M)
        if (hole && Math.abs(sx - hole.cx) < hole.half - step && Math.abs(sy - hole.cy) < hole.half - step) y -= 60
        const k = i * n + j
        pos.set([dx, y, -dy], k * 3)
        uv.set([sx / 12, sy / 12], k * 2)
        col.set([1, 1, 1], k * 3)
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6)
    let q = 0
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j
        idx.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], q)
        q += 6
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('sunlit', new THREE.BufferAttribute(new Float32Array(n * n).fill(1), 1))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    g.computeVertexNormals()
    g.userData = { cx, cy, half, step, n }
    mesh.geometry.dispose()
    mesh.geometry = g
  }

  /** Distant-terrain shadow per vertex: ray-march toward the Sun from a sub-grid and paint vertex colours. */
  function paintLit(mesh: THREE.Mesh, hour: number, sub: number, maxM: number) {
    const g = mesh.geometry
    const { cx, cy, half, step, n } = g.userData as { cx: number; cy: number; half: number; step: number; n: number }
    if (!n) return
    const b = bodies(eph, hour)
    const m = Math.floor((n - 1) / sub) + 1
    const lit = new Float32Array(m * m)
    for (let a = 0; a < m; a++) {
      for (let c = 0; c < m; c++) {
        const sx = cx - half + c * sub * step
        const sy = cy + half - a * sub * step
        const [lat, lon] = pointLatLon(sx / 1000, sy / 1000)
        const s = altAz(b.sun, lat, lon)
        if (s.alt < -2) { lit[a * m + c] = 0; continue }
        const hz = horizonElev(h, sx, sy, lon, s.az, 1, maxM)
        lit[a * m + c] = diskAbove(s.alt, hz, b.sunR)
      }
    }
    const col = g.getAttribute('color') as THREE.BufferAttribute
    const sunlit = g.getAttribute('sunlit') as THREE.BufferAttribute
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const fi = Math.min(i / sub, m - 1.0001)
        const fj = Math.min(j / sub, m - 1.0001)
        const a = Math.floor(fi)
        const c = Math.floor(fj)
        const u = fi - a
        const v = fj - c
        const val = lit[a * m + c] * (1 - u) * (1 - v) + lit[a * m + c + 1] * (1 - u) * v + lit[(a + 1) * m + c] * u * (1 - v) + lit[(a + 1) * m + c + 1] * u * v
        const k = i * n + j
        sunlit.setX(k, val)
        if (sim.current.science && world.sci) {
          const pos = g.getAttribute('position') as THREE.BufferAttribute
          const o = sim.current.origin
          const sc = scienceAt(world.sci, pos.getX(k) + o.x, -pos.getZ(k) + o.y)
          const psr = sc?.psr ?? 0
          const ice = Math.min(1, (sc?.ice ?? 0) / 0.4) * psr
          col.setXYZ(k, 1 - 0.7 * psr, 1 - 0.45 * psr + 0.5 * ice, 1 + 0.6 * psr)
        } else col.setXYZ(k, 1, 1, 1)
      }
    }
    col.needsUpdate = true
    sunlit.needsUpdate = true
  }

  useFrame((_, dtRaw) => {
    const s = sim.current
    const dt = Math.min(dtRaw, 0.1)
    if (!nearMesh.current || !farMesh.current) return
    readPad(s)

    // ---- rebase the origin when far from it (keeps curvature and float precision honest)
    if (Math.hypot(s.x - s.origin.x, s.y - s.origin.y) > 4000) {
      s.origin = { x: s.x, y: s.y, h: h(s.x, s.y) }
      chunk.current.ox = NaN
    }
    const ck = chunk.current
    if (ck.ox !== s.origin.x || ck.oy !== s.origin.y) {
      buildGrid(farMesh.current, s.origin.x, s.origin.y, FAR.half, FAR.step, { cx: s.x, cy: s.y, half: NEAR.half })
      ck.ox = s.origin.x; ck.oy = s.origin.y; ck.cx = NaN; ck.litHour = NaN
    }
    if (!(Math.abs(s.x - ck.cx) < NEAR.half * 0.45 && Math.abs(s.y - ck.cy) < NEAR.half * 0.45)) {
      buildGrid(nearMesh.current, Math.round(s.x / NEAR.step) * NEAR.step, Math.round(s.y / NEAR.step) * NEAR.step, NEAR.half, NEAR.step)
      buildGrid(farMesh.current, s.origin.x, s.origin.y, FAR.half, FAR.step, { cx: s.x, cy: s.y, half: NEAR.half })
      ck.cx = s.x; ck.cy = s.y; ck.litHour = NaN
    }
    if (!(Math.abs(s.hour - ck.litHour) < 0.5) || Math.hypot(s.x - ck.litX, s.y - ck.litY) > 300 || ck.sci !== s.science) {
      ck.sci = s.science
      paintLit(nearMesh.current, s.hour, 8, 60000)
      paintLit(farMesh.current, s.hour, 4, 60000)
      ck.litHour = s.hour; ck.litX = s.x; ck.litY = s.y
    }

    // ---- horizon profile at the vehicle (for power and radio), refreshed after moving 25 m
    if (!(Math.hypot(s.x - s.profileAt.x, s.y - s.profileAt.y) < 25)) {
      s.profile = horizonProfile(h, s.x, s.y, ROVER.mast)
      s.profileAt = { x: s.x, y: s.y }
    }

    // ---- time and driving
    const isRover = s.mode === 'rover'
    const simDt = s.playing && !s.dead ? dt * s.warp : 0
    const [, lon] = pointLatLon(s.x / 1000, s.y / 1000)
    if (isRover && s.autopilot && s.route && !s.dead) {
      const pts = s.route.pts
      while (s.routeI < pts.length - 1 && Math.hypot(pts[s.routeI][0] - s.x, pts[s.routeI][1] - s.y) < 12) s.routeI++
      const [tx, ty] = pts[Math.min(s.routeI + 1, pts.length - 1)]
      const last = s.routeI >= pts.length - 1 && Math.hypot(pts[pts.length - 1][0] - s.x, pts[pts.length - 1][1] - s.y) < 6
      if (last) { s.autopilot = false; s.throttle = 0; s.steer = 0 }
      else {
        const want = Math.atan2(ty - s.y, tx - s.x)
        const diff = Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading))
        s.heading += Math.max(-1, Math.min(1, diff)) * Math.min(1, dt * 4)
        s.throttle = Math.abs(diff) > 0.7 ? 0.15 : 1
        s.steer = 0
      }
    }
    if (isRover && !s.dead && s.playing) {
      const target = s.throttle * ROVER.maxSpeed
      s.speed += (target - s.speed) * Math.min(1, dt * 3)
      s.heading += s.steer * 0.9 * dt
      const step = s.speed * simDt
      if (Math.abs(step) > 1e-4) {
        const nx = s.x + Math.cos(s.heading) * step
        const ny = s.y + Math.sin(s.heading) * step
        const rise = h(nx, ny) - h(s.x, s.y)
        const slope = Math.atan2(rise * Math.sign(step), Math.abs(step)) * 180 / Math.PI
        s.steep = slope > ROVER.maxSlope
        if (!s.steep && !Number.isNaN(rise)) { s.x = nx; s.y = ny; s.driven += Math.abs(step) }
        else s.speed = 0
      } else s.steep = false
    }
    s.hour = Math.min(s.hour + simDt / 3600, eph.n - 2)

    // ---- power
    if (s.profile) s.cond = conditions(eph, s.profile, s.x, s.y, s.hour)
    const c = s.cond
    {
      const la = (c?.lat ?? -90) * Math.PI / 180, lo = (c?.lon ?? 0) * Math.PI / 180
      s.ecl = eclipseAt(eph, s.hour, [1737.4 * Math.cos(la) * Math.cos(lo), 1737.4 * Math.cos(la) * Math.sin(lo), 1737.4 * Math.sin(la)])
    }
    s.solarW = c ? ROVER.panelW * c.sunFrac * (1 - s.ecl) * Math.max(0, Math.cos((c.sun.alt * Math.PI) / 180)) : 0
    s.useW = ROVER.idleW + (isRover && Math.abs(s.speed) > 0.01 ? ROVER.driveW : 0) + (s.lights && isRover ? 30 : 0)
    if (isRover && s.target && s.phase === 'go' && Math.hypot(s.target.x - s.x, s.target.y - s.y) < 25 && s.drillKey && !s.dead) {
      s.useW += 300
      s.drilled += simDt / 3600
      if (s.drilled >= 2) s.phase = 'return'
    }
    if (isRover && s.phase === 'return' && c && c.sunFrac >= 0.5) { s.phase = 'done'; s.doneHour = s.hour }
    if (isRover && !s.dead) {
      s.battery = Math.min(ROVER.batteryWh, s.battery + ((s.solarW - s.useW) * simDt) / 3600)
      if (s.battery <= 0) { s.battery = 0; s.dead = true; s.speed = 0 }
    }

    // ---- vehicle placement
    const f2 = [Math.cos(s.heading), Math.sin(s.heading)]
    const p = toV(s.x, s.y)
    const nrm = (() => {
      const e = 1.5
      const hx = (h(s.x + e, s.y) - h(s.x - e, s.y)) / (2 * e)
      const hy = (h(s.x, s.y + e) - h(s.x, s.y - e)) / (2 * e)
      return new THREE.Vector3(-hx, 1, hy).normalize()
    })()
    const fwd = new THREE.Vector3(f2[0], 0, -f2[1])
    fwd.addScaledVector(nrm, -fwd.dot(nrm)).normalize()
    const basis = new THREE.Matrix4().makeBasis(fwd, nrm, fwd.clone().cross(nrm))
    if (rover.current) {
      rover.current.visible = true
      const rp = s.mode === 'rover' ? p : toV(start.x + PARK[0], start.y + PARK[1])
      rover.current.position.copy(rp)
      if (s.mode === 'rover') rover.current.quaternion.setFromRotationMatrix(basis)
    }
    if (lander.current) { lander.current.position.copy(toV(start.x, start.y)); lander.current.rotation.y = landerYaw.current }
    if (ambient.current) ambient.current.intensity = s.science ? 0.9 : 0.04
    const rk = `${s.routeVer}:${s.origin.x}:${s.origin.y}`
    if (routeKey.current !== rk) {
      routeKey.current = rk
      const pts: THREE.Vector3[] = []
      const rp = s.route?.pts ?? []
      for (let k = 1; k < rp.length; k++) {
        const [ax, ay] = rp[k - 1]
        const [bx, by] = rp[k]
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5))
        for (let q = 0; q < n; q++) pts.push(toV(ax + ((bx - ax) * q) / n, ay + ((by - ay) * q) / n, 0.7))
      }
      if (rp.length) pts.push(toV(rp[rp.length - 1][0], rp[rp.length - 1][1], 0.7))
      routeLine.geometry.dispose()
      routeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
      routeLine.visible = pts.length > 1
    }
    if (paths.current) paths.current.visible = s.mode === 'lander'
    if (beacon.current) {
      beacon.current.visible = !!s.target && s.mode === 'rover' && s.phase === 'go'
      if (s.target && Math.hypot(s.target.x - s.x, s.target.y - s.y) < 6000) beacon.current.position.copy(toV(s.target.x, s.target.y))
    }

    // ---- sky: Sun, Earth, light
    if (c) {
      const sd = skyDir(c.sun.alt, c.sun.az, lon)
      const ed = skyDir(c.earth.alt, c.earth.az, lon)
      if (skyGroup.current) skyGroup.current.position.copy(camera.position)
      sunMesh.current?.position.copy(sd.clone().multiplyScalar(250000))
      glareRef.current?.position.copy(sd.clone().multiplyScalar(249000))
      earthMesh.current?.position.copy(ed.clone().multiplyScalar(250000))
      earthMesh.current?.lookAt(0, 0, 0)
      if (sun.current) {
        sun.current.position.copy(p).addScaledVector(sd, 3000)
        sun.current.target.position.copy(p)
        sun.current.target.updateMatrixWorld()
        sun.current.intensity = c.sun.alt > -1 ? 4.2 * (1 - s.ecl) : 0
      }
      if (panel.current && s.mode === 'rover') {
        // vertical panel turned toward the Sun's azimuth (in the rover frame)
        const local = sd.clone().applyMatrix4(new THREE.Matrix4().copy(basis).invert())
        panel.current.rotation.y = Math.atan2(-local.z, local.x)
      }
      if (dish.current && lander.current) dish.current.lookAt(dish.current.getWorldPosition(new THREE.Vector3()).addScaledVector(ed, 1000))
    }
    if (head.current) {
      head.current.intensity = s.lights && isRover ? ((c?.sunFrac ?? 0) < 0.5 ? 60 : 8) : 0
    }

    // ---- camera
    const look = new THREE.Vector3()
    if (s.mode === 'lander') {
      // camera at the ascent-stage window height, facing the landing heading
      const ly = landerYaw.current
      const base = toV(start.x, start.y).add(new THREE.Vector3(Math.cos(ly) * 2.4, 5.6, -Math.sin(ly) * 2.4))
      camera.position.copy(base)
      const yaw = s.heading + s.yaw
      look.set(Math.cos(yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(yaw) * Math.cos(s.pitch))
      camera.lookAt(base.clone().add(look))
    } else if (s.cam === 'mast') {
      const eye = p.clone().addScaledVector(nrm, ROVER.mast).addScaledVector(fwd, 0.3)
      camera.position.copy(eye)
      const dir = fwd.clone().applyAxisAngle(nrm, s.yaw)
      dir.addScaledVector(nrm, Math.tan(s.pitch)).normalize()
      camera.lookAt(eye.clone().add(dir))
    } else {
      const back = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw)
      const eye = p.clone().addScaledVector(back, -11).add(new THREE.Vector3(0, Math.max(1.5, 3.5 - s.pitch * 12), 0))
      const camGround = toV(s.x + (eye.x - p.x), s.y - (eye.z - p.z)).y + 1.2
      if (eye.y < camGround) eye.y = camGround
      camera.position.lerp(eye, Math.min(1, dt * 6))
      camera.lookAt(p.clone().add(new THREE.Vector3(0, 1.2, 0)))
    }
  })

  const sunR = 250000 * Math.tan((0.27 * Math.PI) / 180)
  const earthR = 250000 * Math.tan((0.95 * Math.PI) / 180)
  return (
    <>
      <hemisphereLight ref={ambient} args={['#9fb4d6', '#000000', 0.04]} />
      <directionalLight ref={sun} castShadow intensity={4} color="#fff6e6"
                        shadow-mapSize={[4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.6}
                        shadow-camera-left={-700} shadow-camera-right={700} shadow-camera-top={700} shadow-camera-bottom={-700}
                        shadow-camera-near={10} shadow-camera-far={8000} />
      <mesh ref={nearMesh} receiveShadow castShadow>
        <bufferGeometry />
        <meshStandardMaterial map={regColor} normalMap={regNormal} normalScale={[0.8, 0.8]} vertexColors roughness={1} metalness={0} color="#d6d2ca" onBeforeCompile={sunlitShader} />
      </mesh>
      <mesh ref={farMesh} receiveShadow>
        <bufferGeometry />
        <meshStandardMaterial vertexColors roughness={1} metalness={0} color="#a7a29a" onBeforeCompile={sunlitShader} />
      </mesh>
      <group ref={skyGroup}>
        <primitive object={stars} />
        <group ref={paths}>{pathLines.map((l, k) => <primitive key={k} object={l} />)}</group>
        <sprite ref={glareRef} scale={[60000, 60000, 1]} material={glare} />
        <mesh ref={sunMesh}>
          <sphereGeometry args={[sunR, 24, 16]} />
          <meshBasicMaterial color="#fffbe8" toneMapped={false} fog={false} />
        </mesh>
        <mesh ref={earthMesh}>
          <sphereGeometry args={[earthR, 48, 32]} />
          <meshStandardMaterial map={earthMap} emissive="#0b1a33" emissiveIntensity={0.3} roughness={0.7} />
        </mesh>
      </group>
      <primitive object={routeLine} />
      <Lander ref={lander} dish={dish} />
      <group ref={beacon} visible={false}>
        <mesh position={[0, 25, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 50, 16, 1, true]} />
          <meshBasicMaterial color="#5ee7ff" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[7, 9, 48]} />
          <meshBasicMaterial color="#5ee7ff" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      <group ref={rover}>
        <RoverModel panel={panel} />
        <spotLight ref={head} position={[1, 1.1, 0]} angle={0.5} penumbra={0.4} distance={120} decay={1} color="#eaf2ff" castShadow={false} />
      </group>
    </>
  )
}

/** Distant-ridge shadow: a per-vertex 'sunlit' factor that dims only the Sun (directional light), not the headlights. */
function sunlitShader(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float sunlit;\nvarying float vSunlit;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSunlit = sunlit;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vSunlit;')
    .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSunlit;'))
}

function sunGlare() {
  // soft glare around the 0.5 degree solar disk (the disk itself is drawn true to size)
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const g = cv.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grd.addColorStop(0, 'rgba(255,250,235,1)')
  grd.addColorStop(0.04, 'rgba(255,245,220,0.9)')
  grd.addColorStop(0.15, 'rgba(255,230,180,0.25)')
  grd.addColorStop(0.5, 'rgba(255,220,160,0.05)')
  grd.addColorStop(1, 'rgba(255,220,160,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })
}

function starField() {
  // 6000 stars on a 300 km sphere around the camera (PointsMaterial works with the logarithmic depth buffer)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const n = 6000
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    const z = rnd() * 2 - 1
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    pos.set([r * Math.cos(a) * 300000, z * 300000, r * Math.sin(a) * 300000], k * 3)
    const b = 0.25 + rnd() ** 4 * 0.75
    const warm = rnd() * 0.15
    col.set([b, b * (1 - warm * 0.3), b * (1 - warm)], k * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, toneMapped: false }))
}

const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v)
/** Game controller: left stick / triggers drive, right stick looks, A camera, Y lights, bumpers time speed. */
function readPad(s: Sim) {
  const gp = navigator.getGamepads?.().find((g) => g)
  if (!gp) return
  const ax = gp.axes
  const btn = (i: number) => gp.buttons[i]?.pressed ?? false
  const trig = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0)
  const thr = Math.abs(trig) > 0.05 ? trig : -dz(ax[1] ?? 0)
  const steer = -dz(ax[0] ?? 0)
  if (thr || steer || s.pad) { s.throttle = thr; s.steer = steer; s.pad = !!(thr || steer) }
  s.yaw -= dz(ax[2] ?? 0) * 0.04
  s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch - dz(ax[3] ?? 0) * 0.03))
  const edge = (i: number) => btn(i) && !s.padBtn[i]
  if (edge(0)) s.cam = s.cam === 'chase' ? 'mast' : 'chase'
  if (edge(1)) s.science = !s.science
  s.drillKey = btn(2) || s.drillKey && !s.pad
  if (edge(3)) s.lights = !s.lights
  if (edge(9)) s.playing = !s.playing
  const wi = WARPS.indexOf(s.warp)
  if (edge(5)) s.warp = WARPS[Math.min(WARPS.length - 1, wi + 1)]
  if (edge(4)) s.warp = WARPS[Math.max(0, wi - 1)]
  s.padBtn = gp.buttons.map((b) => b.pressed)
}

const Lander = ({ ref, dish }: { ref: React.Ref<THREE.Group>; dish: React.Ref<THREE.Group> }) => (
  // NASA 3D Resources: Apollo Lunar Module (about 7 m tall)
  <group ref={ref}>
    <Suspense fallback={null}><NasaModel file="lander.glb" size={7} fit="height" /></Suspense>
    <group ref={dish} position={[0, 6, 0]} />
  </group>
)

const RoverModel = ({ panel }: { panel: React.Ref<THREE.Group> }) => (
  // NASA 3D Resources: Mars 2020 Perseverance (3 m long), standing in for a lunar rover; forward = +x
  <group>
    <Suspense fallback={null}><NasaModel file="rover.glb" size={3} fit="length" /></Suspense>
    <group ref={panel} />
  </group>
)

