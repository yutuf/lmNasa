// "Be there": stand on the lander or drive a rover over the real LOLA terrain, with the Sun and Earth where the
// ephemeris puts them for the chosen landing date. Terrain: 10 m LOLA site maps where available, else the 200 m polar
// grid (curvature included). Lighting: the real Sun direction, nearby relief shadows from a shadow map, distant
// ridges from a horizon ray-march per vertex. Power and radio use the same horizon method as the search engine.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import '../drive-fix.css'
import type { Ephem } from '../engine'
import { pointLatLon } from '../engine'
import type { Lang } from '../i18n'
import { R_M, altAz, bodies, conditions, diskAbove, horizonElev, horizonProfile, makeGround, nextChanges, parseDem,
  localSky, parsePatch, parseScience, parseThermal, thermalAt, type Thermal, planeAz, planeDir, scienceAt, findIceTarget, type Dem, type Patch, type Science, type SiteInfo } from '../terrain'
import { dataUrl } from '../data'
import { planRoute, pursue, routeProgress, type Route } from '../route'
import { eclipseAt } from '../eclipse'
import { LanderBody, RoverBody, landerEye } from './VehicleModels'
import { landerById, roverById } from '../vehicles'
import { BatteryMedium, Car, Crosshair, Footprints, Flashlight, Earth, LogOut, Navigation, PlaneLanding, Radio, Snowflake, Sun, Thermometer, Usb, Zap } from 'lucide-react'
import { connectSerial, disconnectSerial, sendSky, serialConnected, serialSupported, skyLine } from '../serial'
import { clearsLander, ease, finalApproach, UP } from '../motion3d'
import { filmDescentSeconds, sceneProgress, useMissionPlayback } from '../missionPlayback'
import { chooseApproach } from '../flight'
import type { MeshSpec, SurfaceMesh } from '../surfaceMesh'
import { filmSurfaceRoute, filmWarp } from '../filmSurfaceRoute'

export type DriveMode = 'lander' | 'rover' | 'walk' | 'landing'
export interface DriveStart { x: number; y: number; hour: number; missionH: number; label: string; startMs: number; lander?: string; rover?: string; rough?: boolean }

// Rover model, set from the chosen rover when the view opens (vehicles.ts); the default is VIPER-class.
const ROVER = { batteryWh: 3000, panelW: 450, driveW: 220, idleW: 120, maxSpeed: 0.25, maxSlope: 20, mast: 2 }
const WARPS = [1, 10, 60, 600, 3600]
const parking = (start: DriveStart) => [Math.max(14, landerById(start.lander).heightM * 0.7), 8]
// Moonwalk: walking pace on the Moon (Apollo crews loped at ~1 m/s), eye height, the steepest slope on foot
const WALK = { speed: 1.2, run: 2.6, eye: 1.7, maxSlope: 30 }
// Landing: the last ~2.4 km and 1.6 km of height, 26 s of screen time (a real terminal descent takes a few minutes)
const LAND = { secs: 26, physicalSecs: 180 }
const NEAR = { half: 1200, step: 10 }
// the landing camera starts 2.4 km out and 1.6 km up: the detailed ground must reach past it, or its square edge shows
const NEAR_LANDING = { half: 3200, step: 16 }
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
  walk: { en: 'Moonwalk', tr: 'Ay yürüyüşü' },
  stepOut: { en: 'Walk on the Moon', tr: 'Ay’da yürü' },
  keysWalk: { en: 'W/S walk · A/D turn · Shift run · drag to look · F flashlight · 1–5 time speed',
    tr: 'W/S yürü · A/D dön · Shift koş · sürükle: bak · F el feneri · 1–5 zaman hızı' },
  tooSteepWalk: { en: 'Too steep to climb on foot', tr: 'Yürüyerek tırmanmak için çok dik' },
  torchOn: { en: 'Flashlight on', tr: 'El feneri açık' },
  torchOff: { en: 'Flashlight off', tr: 'El feneri kapalı' },
  walked: { en: 'walked', tr: 'yürünen' },
  darkHint: { en: 'In shadow: press F for the flashlight', tr: 'Gölgedesiniz: el feneri için F' },
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

/** On foot: 18 m out from the lander, facing away from it with the low Sun to the side (long, readable shadows). */
function placeWalker(s: Sim, start: DriveStart) {
  const a = s.sunHeading + 2.2
  const distance = Math.max(18, landerById(start.lander).heightM * .7 + 3)
  s.x = start.x + Math.cos(a) * distance
  s.y = start.y + Math.sin(a) * distance
  s.heading = a
  s.yaw = 0
  s.pitch = -0.08
}

/** Shared mutable simulation state (kept out of React so the frame loop does not re-render). */
interface Sim {
  mode: DriveMode
  x: number; y: number; heading: number      // stereographic metres; heading = plane angle (rad)
  speed: number; throttle: number; steer: number
  travel: number; wheelSteer: number; wheelYaw: number
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
  route: Route | null; routeVer: number; routeI: number; routeS: number; autopilot: boolean
  cinematic: boolean; descT: number; sunHeading: number; run: boolean; bob: number; torch: boolean; prints: { x: number; y: number; a: number }[]; printVer: number; lastPrint: number
}

export default function Drive({ start, eph, dsn, lang, initialMode, onExit, cinematic = false, filmMode }:
  { start: DriveStart; eph: Ephem; dsn: boolean[]; lang: Lang; initialMode: DriveMode; onExit: () => void; cinematic?: boolean
    /** the film keeps one drive view from touchdown to the rover scene: 'rover' deploys the rover and drives to the ice */
    filmMode?: 'landing' | 'rover' }) {
  const rv = roverById(start.rover)
  const playback = useMissionPlayback()
  const ld = landerById(start.lander)
  const PARK = useMemo(() => parking(start), [start])
  Object.assign(ROVER, { maxSpeed: rv.maxSpeed, maxSlope: rv.maxSlope, batteryWh: rv.batteryWh, panelW: rv.panelW, driveW: rv.driveW, idleW: rv.idleW })
  const [world, setWorld] = useState<World | null>(null)
  const [surfaceReady, setSurfaceReady] = useState(false)
  const [hud, setHud] = useState(0)
  const sim = useRef<Sim>({
    mode: initialMode, x: start.x + PARK[0], y: start.y + PARK[1], heading: 0, speed: 0, throttle: 0, steer: 0, travel: 0, wheelSteer: 0, wheelYaw: 0,
    hour: start.hour, warp: initialMode === 'rover' ? 60 : initialMode === 'walk' ? 1 : 600, playing: initialMode === 'rover' || initialMode === 'walk', battery: ROVER.batteryWh,
    solarW: 0, useW: 0, driven: 0, startHour: start.hour, dead: false, steep: false, lights: true,
    cam: 'chase', pad: false, padBtn: [], yaw: 0, pitch: initialMode === 'lander' ? 0.02 : initialMode === 'walk' ? -0.05 : -0.12,
    origin: { x: start.x, y: start.y, h: 0 }, profile: null, profileAt: { x: NaN, y: NaN }, cond: null, ecl: 0,
    science: false, drillKey: false, target: null, phase: 'go', drilled: 0, doneHour: 0,
    route: null, routeVer: 0, routeI: 0, routeS: 0, autopilot: false,
    cinematic, descT: 0, sunHeading: 0, run: false, bob: 0, torch: true, prints: [], printVer: 0, lastPrint: 0,
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
      s.heading = initialMode === 'rover' ? Math.atan2(-PARK[1], -PARK[0]) : Math.atan2(dy, dx)
      const approach = chooseApproach(sky.sun.az)
      const [ax, ay] = planeDir(sky.lon, approach.headingDeg + 180)
      s.sunHeading = Math.atan2(ay, ax)
      if (initialMode === 'walk') placeWalker(s, start)
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
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
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
      // sunlight at the current hour from the real horizon, cached on a 100 m lattice (200 m and a shorter horizon in
      // the film, where planning must not freeze the picture)
      const film = s.cinematic, lat = film ? 200 : 100, reach = film ? 12000 : 30000
      const lit = (x: number, y: number) => {
        const key = `${Math.round(x / lat)},${Math.round(y / lat)}`
        let v = cache.get(key)
        if (v === undefined) {
          const [la, lo] = pointLatLon(x / 1000, y / 1000)
          const sun = altAz(b.sun, la, lo)
          v = sun.alt < -1 ? 0 : diskAbove(sun.alt, horizonElev(h, x, y, lo, sun.az, 1, reach), b.sunR)
          cache.set(key, v)
        }
        return v
      }
      const obstacle = Math.max(4, ld.heightM * .65) + 2
      const routeGround = (x: number, y: number) => Math.hypot(x - start.x, y - start.y) < obstacle ? NaN : h(x, y)
      const r = planRoute(routeGround, [s.x, s.y], goal, { cell: film ? 40 : 20, maxSlope: ROVER.maxSlope - 2, lit, darkCost: 2, margin: film ? 900 : 1500 })
      s.route = r
      s.routeI = 0
      s.routeS = 0
      s.routeVer++
      s.autopilot = !!r
      s.playing = true
      setPlanning(r ? 'idle' : 'none')
    }, 40)
  }
  const planRef = useRef(plan)
  planRef.current = plan
  // Prepare a short illustrative departure before the cut, independent of the long science traverse.
  const departure = useMemo(() => cinematic && world
    ? filmSurfaceRoute(world.ground.height, [start.x + PARK[0], start.y + PARK[1]], [start.x, start.y], Math.max(3, ld.heightM * .65) + 1.5, rv.maxSlope - 2)
    : null, [cinematic, world, start.x, start.y, PARK, ld.heightM, rv.maxSlope])
  const filmScene = playback?.current.scene
  const filmVisit = playback?.current.visit
  useEffect(() => {
    if (!cinematic || !surfaceReady || !world) return
    playback?.current.onSurfaceReady?.('landing')
    playback?.current.onSurfaceReady?.('rover')
  }, [cinematic, surfaceReady, world, playback])
  // film: the same world (terrain, shaders, models already loaded) switches from the landing to the rover drive
  useEffect(() => {
    if (cinematic && world && filmMode === 'landing') {
      sim.current.mode = 'landing'; sim.current.descT = 0
      const hud = document.getElementById('landing-hud')
      if (hud) hud.style.display = ''
      return
    }
    if (!cinematic || !world || !(filmMode === 'rover' || !filmMode && initialMode === 'rover')) return
    const s = sim.current
    Object.assign(s, { mode: 'rover', x: start.x + PARK[0], y: start.y + PARK[1], pitch: -.12, yaw: 0,
      speed: 0, travel: 0, driven: 0, wheelYaw: 0, wheelSteer: 0, throttle: 0, steer: 0,
      battery: rv.batteryWh, dead: false, steep: false, hour: start.hour, startHour: start.hour,
      route: departure, routeI: 0, routeS: 0, autopilot: !!departure, playing: !!departure, warp: filmWarp(rv.maxSpeed) })
    s.routeVer++
    if (departure && departure.pts.length > 1) s.heading = Math.atan2(departure.pts[1][1] - s.y, departure.pts[1][0] - s.x)
    const hud = document.getElementById('landing-hud')
    if (hud) hud.style.display = 'none'                      // the touchdown banner belongs to the landing only
    s.lights = true; s.profileAt = { x: NaN, y: NaN }
  }, [cinematic, world, filmMode, initialMode, start, PARK, departure, rv.batteryWh, rv.maxSpeed, filmScene, filmVisit])

  // keyboard
  useEffect(() => {
    if (cinematic) return
    const keys = new Set<string>()
    const apply = () => {
      const s = sim.current
      s.throttle = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
      s.steer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0)
      s.drillKey = keys.has('e')
      s.run = keys.has('shift')
      if (s.throttle || s.steer) s.autopilot = false
    }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const s = sim.current
      if (k === 'escape') onExit()
      if (k === 'c') s.cam = s.cam === 'chase' ? 'mast' : 'chase'
      if (k === 'l') s.lights = !s.lights
      if (k === 'f') s.torch = !s.torch
      if (k === 'v') s.science = !s.science
      if (k === 'p') planRef.current()
      if (k === ' ' && !cinematic) s.playing = !s.playing
      if (k >= '1' && k <= '5') s.warp = WARPS[+k - 1]
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      keys.add(k)
      apply()
    }
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); apply() }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up) }
  }, [onExit, cinematic])

  const s = sim.current
  const t = (k: keyof typeof L) => L[k][lang]
  const c = s.cond
  const next = useMemo(() => (c && s.profile ? nextChanges(eph, s.profile, s.x, s.y, s.hour, 720) : null),
    [Math.floor(s.hour * 4), s.profileAt.x, s.profileAt.y])  // eslint-disable-line react-hooks/exhaustive-deps
  const hrs = (h: number | null) => h === null ? `> 30 ${lang === 'tr' ? 'g' : 'd'}` : h < 48 ? `${h} ${lang === 'tr' ? 'sa' : 'h'}` : `${(h / 24).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 1 })} ${lang === 'tr' ? 'g' : 'd'}`
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
    <div className={`drive ${cinematic ? 'cinematic' : ''} ${s.mode === 'landing' ? 'landing' : ''}`}>
      <div id="landing-hud" className="landing-hud" />
      {!cinematic && s.mode === 'landing' && <button className="big ghost descent-exit" onClick={onExit}><LogOut size={14} /> {t('exit')}</button>}
      {!cinematic && s.mode === 'landing' && s.descT >= LAND.secs && <button className="big ghost descent-exit landing-enter" onClick={() => { s.mode = 'lander'; s.pitch = .02; s.yaw = 0; s.playing = false }}>{lang === 'tr' ? 'İniş aracına geç' : 'Enter the lander'}</button>}
      {(!world || !surfaceReady) && <div className="drive-loading">{t('loading')}</div>}
      {world && (
        <Canvas shadows gl={{ logarithmicDepthBuffer: true, antialias: true }} dpr={cinematic ? [1, 1.25] : [1, 1.6]}
                frameloop={!surfaceReady || cinematic && playback && (playback.current.paused || !['landing', 'rover'].includes(playback.current.scene)) ? 'never' : 'always'}
                camera={{ fov: 62, near: 0.3, far: 600000, position: [0, 3, 0] }}
                onCreated={({ gl }) => { gl.debug.checkShaderErrors = false; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = cinematic ? 1.8 : 1.15 }}>
          <Suspense fallback={null}><Scene world={world} sim={sim} eph={eph} start={start} lang={lang} onReady={setSurfaceReady} /></Suspense>
        </Canvas>
      )}
      <LookDrag sim={sim} />
      {cinematic && s.mode === 'rover' && <div className="film-drive-status" data-moving={s.speed > .001 && s.playing && !s.dead ? '1' : '0'} data-distance={s.driven.toFixed(3)}>
        <b>{rv.name}</b>
        <span>{!surfaceReady ? (lang === 'tr' ? 'Arazi hazırlanıyor…' : 'Preparing terrain…')
          : s.dead ? (lang === 'tr' ? 'Durdu: batarya tükendi.' : 'Stopped: battery depleted.')
          : !s.route ? (lang === 'tr' ? 'Durdu: bu arazide güvenli rota bulunamadı.' : 'Stopped: no safe route on this terrain.')
          : s.steep ? (lang === 'tr' ? 'Durdu: arazi gezgin için çok dik.' : 'Stopped: terrain exceeds the rover’s slope limit.')
          : !s.autopilot ? (lang === 'tr' ? 'Kısa sürüş tamamlandı.' : 'Short drive complete.')
          : (lang === 'tr' ? `Sürüş · ${Math.round(s.driven)} m yol alındı` : `Driving · ${Math.round(s.driven)} m travelled`)}</span>
        <small>{Math.round(s.warp)}× · {lang === 'tr' ? 'temsili yüzey sürüşü' : 'illustrative surface drive'}{(c?.sunFrac ?? 1) < .5 ? (lang === 'tr' ? ' · gölgede, batarya ile' : ' · in shadow, on battery') : ''}</small>
      </div>}
      {s.mode === 'landing' && <p className="drive-scene-note">{cinematic
        ? (lang === 'tr' ? 'Nominal son yaklaşma · 180 sn, bu sahneye sığdırıldı · arazi çözünürlüğüyle sınırlı' : 'Nominal final approach · 180 s, fit into this shot · limited by terrain resolution')
        : (lang === 'tr' ? 'Nominal son yaklaşma · 180 sn / 26 sn · arazi çözünürlüğüyle sınırlı' : 'Nominal final approach · 180 s / 26 s · limited by terrain resolution')}</p>}
      {coarse && (s.mode === 'rover' || s.mode === 'walk') && !s.dead && <TouchStick sim={sim} lang={lang} />}

      <div className="hud top-left">
        <div className="hud-title">{s.mode === 'lander' ? `${t('lander')} · ${ld.name}` : s.mode === 'walk' ? t('walk') : `${t('rover')} · ${rv.name}`}</div>
        <div className="hud-sub">{start.label}</div>
        <div className="hud-sub">{lat.toFixed(3)}°, {(((lon % 360) + 360) % 360).toFixed(2)}°{lang === 'tr' ? 'D' : 'E'} · {src ? `${t('terrain10')} · ${src.name}` : t('terrain200')}</div>
      </div>

      {s.mode === 'rover' && (
        <div className="hud objective">
          {!tgt && <div>{t('noTarget')}</div>}
          {tgt && s.phase === 'go' && (
            <>
              <div className="ico"><Crosshair size={13} /><b>{t('target')}</b> · {tDist < 1000 ? `${Math.round(tDist)} m` : `${(tDist / 1000).toFixed(2)} km`} · {Math.round(tAz ?? 0)}°</div>
              <div className="hud-sub">{t('inPsr')} · {t('iceIdx')} <span className="drive-value">{tgt.ice.toFixed(2)}</span></div>
              {tDist < 25 && <div className="drill">{s.drilled > 0 ? `${t('drilling')} ${Math.round((s.drilled / 2) * 100)}%` : t('drillHint')}</div>}
            </>
          )}
          {s.phase === 'return' && <div className="drill">{t('bringBack')}</div>}
          {s.phase === 'done' && <div className="done">{t('complete')} · {(s.driven / 1000).toFixed(2)} km · {hrs(Math.round(s.doneHour - s.startHour))}</div>}
          {here && here.psr > 0.5 && <div className="hud-sub psr">{t('psrHere')}</div>}
          {therm && (
            <div className="hud-sub ico"><Thermometer size={12} /> {lang === 'tr' ? 'Yüzey ort.' : 'Surface avg'} {degC(therm.avgK)} · {lang === 'tr' ? 'en sıcak' : 'max'} {degC(therm.maxK)} ·{' '}
              {therm.iceM === null ? (lang === 'tr' ? 'kalıcı buz yok' : 'no stable ice') : <>{lang === 'tr' ? 'buz kararlı' : 'ice stable below'} <span className="drive-value">{Math.round(therm.iceM * 100)} cm</span></>}</div>
          )}
          {s.phase !== 'done' && (
            <div className="route-row">
              <button className="mini" disabled={planning === 'busy'} onClick={plan}>
                <Navigation size={12} /> {planning === 'busy' ? t('planning') : `${t('plan')}${s.phase === 'return' || !tgt ? ` (${t('toLander')})` : ''}`}
              </button>
              {s.route && <button className={`mini ${s.autopilot ? 'on' : ''}`} onClick={() => { s.autopilot = !s.autopilot; s.playing = true }}>{s.autopilot ? '⏸' : '▶'} {t('auto')}</button>}
              {s.route && <button className="mini" onClick={() => { s.route = null; s.autopilot = false; s.routeS = 0; s.routeVer++ }}>{t('clearRoute')}</button>}
            </div>
          )}
          {planning === 'none' && !s.route && <div className="hud-sub bad">{t('noRoute')}</div>}
          {s.route && (
            <div className="hud-sub">{t('route')} {(s.route.lengthM / 1000).toFixed(2)} km · {hrs(Math.round(s.route.lengthM / ROVER.maxSpeed / 3600))} {t('driving')} ·{' '}
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
              {w >= 3600 ? (lang === 'tr' ? '1 sa/sn' : '1 h/s') : w >= 60 ? `${w / 60} ${lang === 'tr' ? 'dk/sn' : 'min/s'}` : `${w}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="hud bottom-left">
        {s.mode !== 'walk' && <><div className={`gauge ${pct < 0.2 ? 'low' : ''}`}>
          <span className="ico"><BatteryMedium size={13} /> {t('battery')}</span><b>{Math.round(pct * 100)}%</b>
          <i style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="flows">
          <span className="in ico"><Zap size={12} /> {t('solar')} +{Math.round(s.solarW)} W</span>
          <span className="out">{t('use')} −{Math.round(s.useW)} W</span>
        </div></>}
        <div className={`status ${(c?.sunFrac ?? 0) >= 0.5 ? 'ok' : 'bad'}`}>
          <Sun size={12} /> {t('sun')}: {c ? `${Math.round(c.sunFrac * 100)}% · ${c.sun.alt.toFixed(1)}°` : '—'}
          {next && <em> · {next.sunUp ? t('sets') : t('rises')} {hrs(next.sunH)}</em>}
          {s.ecl > 0 && <b className="ecl"> · {lang === 'tr' ? 'tutulma' : 'eclipse'} {Math.round(s.ecl * 100)}%</b>}
        </div>
        <div className={`status ${c?.earthUp ? 'ok' : 'bad'}`}>
          <Earth size={12} /> {t('earth')}: {c ? (c.earthUp ? t('up') : t('down')) + ` · ${c.earth.alt.toFixed(1)}°` : '—'}
          {next && <em> · {next.earthUp ? t('sets') : t('rises')} {hrs(next.earthH)}</em>}
        </div>
        <div className={`status ${link ? 'ok' : 'bad'}`}><Radio size={12} /> {t('link')}: {link ? t('dsnOk') : c?.earthUp ? t('noDsn') : '—'}</div>
        {s.mode === 'rover' && <div className="hud-sub">{t('driven')} {s.driven < 1000 ? `${Math.round(s.driven)} m` : `${(s.driven / 1000).toFixed(2)} km`} · {(s.speed * 100).toFixed(0)} {lang === 'tr' ? 'cm/sn' : 'cm/s'}</div>}
        {s.mode === 'walk' && <div className="hud-sub"><Footprints size={12} /> {t('walked')} {s.driven < 1000 ? `${Math.round(s.driven)} m` : `${(s.driven / 1000).toFixed(2)} km`} · <Flashlight size={12} /> {s.torch ? t('torchOn') : t('torchOff')}</div>}
      </div>

      <div className="hud bottom-right">
        {s.mode === 'lander'
          ? <>
              <button className="big" onClick={() => { s.mode = 'rover'; s.heading = Math.atan2(-PARK[1], -PARK[0]); s.warp = 60; s.playing = true; s.pitch = -0.12; s.yaw = 0 }}><Car size={14} /> {t('deploy')}</button>
              <button className="big" onClick={() => { s.mode = 'walk'; placeWalker(s, start); s.warp = 1; s.playing = true; s.driven = 0; s.lastPrint = 0; s.profileAt = { x: NaN, y: NaN } }}><Footprints size={14} /> {t('stepOut')}</button>
            </>
          : <button className="big ghost" onClick={() => { s.mode = 'lander'; s.x = start.x + PARK[0]; s.y = start.y + PARK[1]; s.yaw = 0; s.pitch = 0.02; s.profileAt = { x: NaN, y: NaN } }}><PlaneLanding size={14} /> {t('back')}</button>}
        {serialSupported() && (
          <button className={`big ghost ${serialOn ? 'on' : ''}`} onClick={async () => {
            if (serialOn) { await disconnectSerial(); setSerialOn(false) } else setSerialOn(await connectSerial())
          }}><Usb size={14} /> {serialOn ? t('compassOn') : t('compass')}</button>
        )}
        <button className="big ghost" onClick={onExit}><LogOut size={14} /> {t('exit')}</button>
        <p className="keys">{s.mode === 'lander' ? t('keysLander') : s.mode === 'walk' ? t('keysWalk') : t('keys')}</p>
        {rv.id === 'viper' && s.mode !== 'walk' && <p className="keys">{lang === 'tr' ? 'VIPER için ölçeklenmiş Perseverance görsel modeli.' : 'Scaled Perseverance visual model for VIPER.'}</p>}
        {!['apollo', 'vikram', 'hls'].includes(ld.id) && <p className="keys">{lang === 'tr' ? 'İniş aracı: boyutu ölçeklenmiş Apollo görsel modeli.' : 'Lander: Apollo visual model scaled to vehicle height.'}</p>}
        {s.mode !== 'walk' && <p className="keys">{lang === 'tr'
          ? `${rv.name}: ${rv.panelW ? `${rv.panelW} W panel, ` : 'güneş paneli yok, '}${(rv.batteryWh / 1000).toFixed(1)} kWh batarya, ${rv.maxSpeed} m/sn, en çok ${rv.maxSlope}° eğim (yaklaşık değerler); arazi, Güneş, Dünya ve DSN gerçek veridir.`
          : `${rv.name}: ${rv.panelW ? `${rv.panelW} W panel, ` : 'no solar panel, '}${(rv.batteryWh / 1000).toFixed(1)} kWh battery, ${rv.maxSpeed} m/s, up to ${rv.maxSlope}° slopes (approximate); terrain, Sun, Earth and DSN are real data.`}</p>}
      </div>

      {s.mode === 'lander' && (
        <div className="hud timeline">
          <input type="range" min={start.hour} max={start.hour + start.missionH} step={0.25} value={s.hour}
                 onChange={(e) => { s.hour = +e.target.value; s.playing = false }} />
        </div>
      )}
      {s.mode === 'rover' && s.steep && !s.dead && <div className="toast">{t('steep')}</div>}
      {s.mode === 'walk' && s.steep && <div className="toast">{t('tooSteepWalk')}</div>}
      {s.mode === 'walk' && !s.steep && !s.torch && (c?.sunFrac ?? 1) < 0.5 && <div className="toast">{t('darkHint')}</div>}
      {s.mode === 'rover' && s.dead && (
        <div className="gameover">
          <h2><Snowflake size={20} /> {t('dead')}</h2>
          <p>{t('driven')} {(s.driven / 1000).toFixed(2)} km · {t('survived')} {hrs(Math.round(s.hour - s.startHour))}</p>
          <button className="big" onClick={restart}>{t('restart')}</button>
        </div>
      )}
    </div>
  )
}

/** On-screen joystick for touch screens: up/down drives, left/right steers. */
function TouchStick({ sim, lang }: { sim: React.MutableRefObject<Sim>; lang: Lang }) {
  const [knob, setKnob] = useState<[number, number]>([0, 0])
  const base = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)))
    const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)))
    setKnob([dx, dy])
    const s = sim.current
    s.throttle = Math.abs(dy) > 0.2 ? -dy : 0
    s.steer = Math.abs(dx) > 0.2 ? -dx : 0
    if (s.throttle || s.steer) { s.autopilot = false; s.playing = true }
  }
  const end = () => { pointer.current = null; setKnob([0, 0]); sim.current.throttle = 0; sim.current.steer = 0 }
  return (
    <div className="stick" ref={base} role="group" aria-label={lang === 'tr' ? 'Hareket çubuğu: sürmek için sürükleyin' : 'Movement stick: drag to drive'}
         onPointerDown={(e) => { pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
         onPointerMove={(e) => pointer.current === e.pointerId && move(e)} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <i style={{ transform: `translate(${knob[0] * 34}px, ${knob[1] * 34}px)` }} />
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
    [180, lang === 'tr' ? 'G' : 'S', 'cdir'], [270, lang === 'tr' ? 'B' : 'W', 'cdir'], [sunAz, '☀', sunUp ? 'sun' : 'sun off'], [earthAz, '🌍', earthUp ? 'earth' : 'earth off']]
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

function preparedGeometry(data: SurfaceMesh) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(data.color, 3))
  g.setAttribute('sunlit', new THREE.BufferAttribute(data.sunlit, 1))
  g.setIndex(new THREE.BufferAttribute(data.index, 1))
  g.userData = data.grid
  return g
}

function Scene({ world, sim, eph, start, lang, onReady }: { world: World; sim: React.MutableRefObject<Sim>; eph: Ephem; start: DriveStart; lang: Lang; onReady: (ready: boolean) => void }) {
  const playback = useMissionPlayback()
  const ld = landerById(start.lander)
  const PARK = useMemo(() => parking(start), [start])
  const rv = roverById(start.rover)
  const { camera, scene, gl, invalidate, advance } = useThree()
  const h = world.ground.height
  const sun = useRef<THREE.DirectionalLight>(null)
  const earthshine = useRef<THREE.DirectionalLight>(null)
  const skyGroup = useRef<THREE.Group>(null)
  const sunMesh = useRef<THREE.Mesh>(null)
  const earthMesh = useRef<THREE.Mesh>(null)
  const rover = useRef<THREE.Group>(null)
  const panel = useRef<THREE.Group>(null)
  const lander = useRef<THREE.Group>(null)
  const dish = useRef<THREE.Group>(null)
  const head = useRef<THREE.SpotLight>(null)
  const torch = useRef<THREE.SpotLight>(null)
  const plumeG = useRef<THREE.Group>(null)
  const dust = useRef<THREE.Points>(null)
  const landCam = useRef({ look: new THREE.Vector3(), started: false, touchT: 0 })
  const dustTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g; x.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])
  const dustSeed = useMemo(() => Array.from({ length: 420 }, () => ({ a: Math.random() * Math.PI * 2, r: 1 + Math.random() * 3, v: 6 + Math.random() * 16, h: Math.random() * 0.8 })), [])
  const dustPositions = useMemo(() => new Float32Array(420 * 3), [])
  const prints = useRef<THREE.InstancedMesh>(null)
  const printKey = useRef('')
  const nearMesh = useRef<THREE.Mesh>(null)
  const farMesh = useRef<THREE.Mesh>(null)
  const chunk = useRef({ cx: NaN, cy: NaN, ox: NaN, oy: NaN, litHour: NaN, litX: NaN, litY: NaN, sci: false, nearHalf: NaN })
  const prepared = useRef(false)
  const modelReady = useRef({ lander: false, rover: false, finish: null as (() => void) | null })
  const landerReady = useCallback(() => { modelReady.current.lander = true; modelReady.current.finish?.() }, [])
  const roverReady = useCallback(() => { modelReady.current.rover = true; modelReady.current.finish?.() }, [])
  const roverTerrain = useRef<{ near: SurfaceMesh; far: SurfaceMesh } | null>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  const beacon = useRef<THREE.Group>(null)
  // regolith PBR texture from NASA's Artemis south-pole simulation kit (USGS Astrogeology, 84S project), 1024 px
  const [regColor, regNormal, earthMap] = useTexture([dataUrl('regolith_color.jpg'), dataUrl('regolith_normal.jpg'), dataUrl('earth.jpg')])
  useMemo(() => {
    for (const x of [regColor, regNormal]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 16; x.minFilter = THREE.LinearMipmapLinearFilter; x.needsUpdate = true }
    regColor.colorSpace = THREE.SRGBColorSpace
    earthMap.colorSpace = THREE.SRGBColorSpace
  }, [regColor, regNormal, earthMap])
  const glareRef = useRef<THREE.Sprite>(null)
  const landerYaw = useRef(sim.current.heading)
  useEffect(() => {
    let live = true, timer = 0
    const readiness = modelReady.current
    const worker = new Worker(new URL('../driveTerrain.worker.ts', import.meta.url), { type: 'module' })
    const s = sim.current, landing = s.mode === 'landing', near = landing ? NEAR_LANDING : NEAR
    const sky = bodies(eph, s.hour), hour = s.hour
    const nearSpec: MeshSpec = { cx: Math.round(s.x / near.step) * near.step, cy: Math.round(s.y / near.step) * near.step,
      ...near, origin: { ...s.origin }, sun: sky.sun, sunR: sky.sunR, sub: landing ? 4 : 8, reach: landing ? 30000 : 60000 }
    const farSpec: MeshSpec = { cx: s.origin.x, cy: s.origin.y, ...FAR, origin: { ...s.origin },
      hole: { cx: s.x, cy: s.y, half: near.half }, sun: sky.sun, sunR: sky.sunR, sub: 4, reach: 60000 }
    const fallback = () => {
      worker.terminate()
      const finish = () => {
        if (!live || !readiness.lander || !readiness.rover) return
        readiness.finish = null; prepared.current = true; onReady(true); invalidate()
      }
      readiness.finish = finish; finish()
    }
    worker.onerror = (event) => { event.preventDefault(); clearTimeout(timer); fallback() }
    worker.onmessage = (event: MessageEvent<{ near?: SurfaceMesh; far?: SurfaceMesh; roverNear?: SurfaceMesh; roverFar?: SurfaceMesh }>) => {
      if (!live) return
      const data = event.data
      if (data.roverNear && data.roverFar) { roverTerrain.current = { near: data.roverNear, far: data.roverFar }; worker.terminate(); return }
      if (!data.near || !data.far || !nearMesh.current || !farMesh.current) return
      clearTimeout(timer)
      nearMesh.current.geometry.dispose(); nearMesh.current.geometry = preparedGeometry(data.near)
      farMesh.current.geometry.dispose(); farMesh.current.geometry = preparedGeometry(data.far)
      Object.assign(chunk.current, { cx: s.x, cy: s.y, ox: s.origin.x, oy: s.origin.y, nearHalf: near.half,
        litHour: hour, litX: s.x, litY: s.y, sci: false })
      // Compile real attributes before the first visible frame. An unseen world gets one warm-up
      // frame; the film clock and HUD must not redraw its terrain throughout the orbital shot.
      const finish = () => {
        if (!live || !readiness.lander || !readiness.rover) return
        readiness.finish = null
        void gl.compileAsync(scene, camera).then(() => {
          if (!live) return
          prepared.current = true
          if (playback && !['landing', 'rover'].includes(playback.current.scene)) advance(performance.now() / 1000)
          onReady(true); invalidate()
        }).catch(fallback)
      }
      readiness.finish = finish; finish()
      if (!landing) worker.terminate()
    }
    timer = window.setTimeout(fallback, 10000)
    worker.postMessage({ dem: world.dem, patches: world.patches, near: nearSpec, far: farSpec })
    return () => { live = false; clearTimeout(timer); readiness.finish = null; worker.terminate() }
  }, [world.dem, world.patches, eph, sim, onReady, invalidate, gl, scene, camera, advance]) // eslint-disable-line react-hooks/exhaustive-deps
  const scratch = useMemo(() => ({
    vectors: Array.from({ length: 96 }, () => new THREE.Vector3()), matrices: Array.from({ length: 4 }, () => new THREE.Matrix4()),
    quat: new THREE.Quaternion(), printPos: new THREE.Vector3(), approach: { altitude: 0, range: 0, vertical: 0, horizontal: 0, tilt: 0 },
    landing: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), alt: 0, x: 0 },
    skyAt: { hour: NaN, x: NaN, y: NaN }, shot: -1, elapsed: 0,
  }), [])
  let vectorIndex = 0, matrixIndex = 0
  const V = (x = 0, y = 0, z = 0) => scratch.vectors[vectorIndex++].set(x, y, z)
  const copyV = (v: THREE.Vector3) => V().copy(v)
  const M = () => scratch.matrices[matrixIndex++].identity()
  const contact = useMemo(() => {
    const e = Math.max(1, ld.heightM * .5)
    const dx = (h(start.x + e, start.y) - h(start.x - e, start.y)) / (2 * e)
    const dy = (h(start.x, start.y + e) - h(start.x, start.y - e)) / (2 * e)
    const normal = new THREE.Vector3(-dx, 1, dy).normalize()
    const foot = ld.heightM * (ld.id === 'hls' ? .12 : .65)
    let lift = 0
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, x = Math.cos(a) * foot, y = Math.sin(a) * foot
      lift = Math.max(lift, h(start.x + x, start.y + y) - h(start.x, start.y) - dx * x - dy * y)
    }
    return { normal, lift, radius: Math.max(3, foot) }
  }, [h, start.x, start.y, ld.heightM, ld.id])

  useEffect(() => {
    scene.background = new THREE.Color('#000000')
    if (import.meta.env.DEV) Object.assign(window, { __drive: { sim: sim.current, camera, scene, gl, ground: world.ground } })
  }, [scene, camera, sim, gl, world.ground])
  useEffect(() => {
    const l = head.current
    if (!l) return
    l.add(l.target)
    l.target.position.set(6, -0.8, 0)
  }, [])
  useEffect(() => { if (torch.current) scene.add(torch.current.target) }, [scene])
  const stars = useMemo(starField, [])
  const glare = useMemo(sunGlare, [])
  const ribbon = useMemo(routeRibbon, [])
  const ribKey = useRef({ ver: -1, ox: NaN, oy: NaN })
  const pursuitIn = useRef({ pts: [] as [number, number][], cum: [] as number[], x: 0, y: 0, heading: 0, s: 0, dt: 0, realSpeed: 0 })
  useEffect(() => () => {
    ribbon.geometry.dispose()
    const m = ribbon.material
    if (!Array.isArray(m)) m.dispose()
  }, [ribbon])
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
  const toV = (sx: number, sy: number, lift = 0, out?: THREE.Vector3) => {
    const o = sim.current.origin
    const dx = sx - o.x
    const dy = sy - o.y
    return (out ?? V()).set(dx, h(sx, sy) - o.h - (dx * dx + dy * dy) / (2 * R_M) + lift, -dy)
  }
  const skyDir = (alt: number, az: number, lon: number) => {
    const a = (lon + az) * Math.PI / 180
    const ca = Math.cos((alt * Math.PI) / 180)
    return V(Math.sin(a) * ca, Math.sin((alt * Math.PI) / 180), -Math.cos(a) * ca)
  }

  function safeEye(eye: THREE.Vector3) {
    const o = sim.current.origin
    const dx = eye.x - (start.x - o.x), dz = eye.z + (start.y - o.y)
    const distance = Math.hypot(dx, dz), clearance = contact.radius + 1
    if (distance < clearance && eye.y < h(start.x, start.y) - o.h + ld.heightM + 1) {
      const f = clearance / (distance || 1)
      eye.x = start.x - o.x + (distance ? dx * f : clearance)
      eye.z = -(start.y - o.y) + dz * f
    }
    const ground = h(o.x + eye.x, o.y - eye.z) - o.h - (eye.x * eye.x + eye.z * eye.z) / (2 * R_M)
    eye.y = Math.max(eye.y, ground + .5)
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
        // under the detailed patch the coarse grid sinks well below it: its 800 m faces cut across hollows and would
        // otherwise poke up through the detailed ground as flat slabs
        if (hole && Math.abs(sx - hole.cx) < hole.half && Math.abs(sy - hole.cy) < hole.half) y -= 250
        const k = i * n + j
        pos.set([dx, y, -dy], k * 3)
        uv.set([sx / 26, sy / 26], k * 2)          // regolith detail repeats every 26 m (shorter repeats flicker at a distance)
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

  useFrame((st, dtRaw) => {
    vectorIndex = 0; matrixIndex = 0
    const s = sim.current
    const active = !playback || !playback.current.paused && (playback.current.scene === 'landing' || playback.current.scene === 'rover')
    const dt = active ? Math.min(dtRaw, .1) : 0
    scratch.elapsed += dt
    if (!nearMesh.current || !farMesh.current || !prepared.current) return
    readPad(s, dt)

    // ---- rebase the origin when far from it (keeps curvature and float precision honest)
    if (Math.hypot(s.x - s.origin.x, s.y - s.origin.y) > 4000) {
      s.origin = { x: s.x, y: s.y, h: h(s.x, s.y) }
      chunk.current.ox = NaN
    }
    const ck = chunk.current
    if (ck.ox !== s.origin.x || ck.oy !== s.origin.y) {
      buildGrid(farMesh.current, s.origin.x, s.origin.y, FAR.half, FAR.step, { cx: s.x, cy: s.y, half: s.mode === 'landing' ? NEAR_LANDING.half : NEAR.half })
      ck.ox = s.origin.x; ck.oy = s.origin.y; ck.cx = NaN; ck.litHour = NaN
    }
    const near = s.mode === 'landing' ? NEAR_LANDING : NEAR
    const cached = roverTerrain.current
    if (near.half === NEAR.half && ck.nearHalf !== near.half && cached) {
      nearMesh.current.geometry.dispose(); nearMesh.current.geometry = preparedGeometry(cached.near)
      farMesh.current.geometry.dispose(); farMesh.current.geometry = preparedGeometry(cached.far)
      ck.cx = s.x; ck.cy = s.y; ck.nearHalf = near.half
      roverTerrain.current = null
    }
    if (!(Math.abs(s.x - ck.cx) < near.half * 0.45 && Math.abs(s.y - ck.cy) < near.half * 0.45) || ck.nearHalf !== near.half) {
      buildGrid(nearMesh.current, Math.round(s.x / near.step) * near.step, Math.round(s.y / near.step) * near.step, near.half, near.step)
      buildGrid(farMesh.current, s.origin.x, s.origin.y, FAR.half, FAR.step, { cx: s.x, cy: s.y, half: near.half })
      ck.nearHalf = near.half
      ck.cx = s.x; ck.cy = s.y; ck.litHour = NaN
    }
    if (!(Math.abs(s.hour - ck.litHour) < 0.5) || Math.hypot(s.x - ck.litX, s.y - ck.litY) > 300 || ck.sci !== s.science) {
      ck.sci = s.science
      // in the landing view the ground is seen from above: sample sunlight more finely so it shades smoothly
      paintLit(nearMesh.current, s.hour, s.mode === 'landing' ? 4 : 8, s.mode === 'landing' ? 30000 : 60000)
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
    const lon = Math.atan2(s.x, s.y) * 180 / Math.PI
    const beforeHeading = s.heading
    // Plane heading matches the step below (0 = +x, π/2 = +y). Look-ahead is metres along the curve.
    if (isRover && s.route && s.route.pts.length > 1 && !(s.playing && s.autopilot && !s.dead)) {
      s.routeS = routeProgress(s.route.pts, s.route.cum, s.x, s.y, s.routeS)
    }
    if (isRover && !s.dead && s.playing) {
      if (s.autopilot && s.route && s.route.pts.length > 1) {
        const pur = pursuitIn.current
        pur.pts = s.route.pts
        pur.cum = s.route.cum
        pur.x = s.x
        pur.y = s.y
        pur.heading = s.heading
        pur.s = s.routeS
        pur.dt = dt
        pur.realSpeed = Math.abs(s.speed) * s.warp
        const step = pursue(pur)
        s.routeS = step.s
        s.routeI = step.seg
        s.heading = step.heading
        s.throttle = step.throttle
        s.steer = 0
        if (step.done) { s.autopilot = false; s.throttle = 0; s.steer = 0; s.speed = 0 }
      }
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
        if (!s.steep && !Number.isNaN(rise) && clearsLander(s.x, s.y, nx, ny, start.x, start.y, contact.radius + 1.5)) { s.x = nx; s.y = ny; s.driven += Math.abs(step); s.travel += step }
        else s.speed = 0
      } else s.steep = false
    }
    if (s.mode === 'walk') {
      s.heading += s.steer * 1.7 * dt
      const step = s.throttle * (s.run ? WALK.run : WALK.speed) * dt
      if (Math.abs(step) > 1e-5) {
        const nx = s.x + Math.cos(s.heading + s.yaw) * step
        const ny = s.y + Math.sin(s.heading + s.yaw) * step
        const rise = h(nx, ny) - h(s.x, s.y)
        const slope = Math.atan2(rise * Math.sign(step), Math.abs(step)) * 180 / Math.PI
        s.steep = slope > WALK.maxSlope
        if (!s.steep && !Number.isNaN(rise) && clearsLander(s.x, s.y, nx, ny, start.x, start.y, contact.radius + .5)) {
          s.x = nx; s.y = ny; s.driven += Math.abs(step); s.bob += Math.abs(step)
          // a boot print every 0.8 m, alternating left and right of the walking line
          if (s.driven - s.lastPrint > 0.8) {
            s.lastPrint = s.driven
            const side = s.prints.length % 2 ? 0.16 : -0.16
            const a = s.heading + s.yaw
            s.prints.push({ x: s.x - Math.sin(a) * side, y: s.y + Math.cos(a) * side, a })
            if (s.prints.length > 800) s.prints.shift()
            s.printVer++
          }
        }
      } else s.steep = false
    }
    const yawStep = Math.atan2(Math.sin(s.heading - beforeHeading), Math.cos(s.heading - beforeHeading))
    s.wheelYaw += yawStep
    s.wheelSteer = Math.max(-.55, Math.min(.55, Math.atan2(yawStep * 1.5, Math.max(.01, Math.abs(s.speed) * simDt))))
    s.hour = Math.min(s.hour + simDt / 3600, eph.n - 2)

    // ---- power
    const skyAt = scratch.skyAt
    if (s.profile && (!s.cond || Math.abs(s.hour - skyAt.hour) > .01 || Math.hypot(s.x - skyAt.x, s.y - skyAt.y) > .5)) {
      s.cond = conditions(eph, s.profile, s.x, s.y, s.hour)
      skyAt.hour = s.hour; skyAt.x = s.x; skyAt.y = s.y
      const la = s.cond.lat * Math.PI / 180, lo = s.cond.lon * Math.PI / 180
      s.ecl = eclipseAt(eph, s.hour, [1737.4 * Math.cos(la) * Math.cos(lo), 1737.4 * Math.cos(la) * Math.sin(lo), 1737.4 * Math.sin(la)])
    }
    const c = s.cond
    s.solarW = c ? ROVER.panelW * c.sunFrac * (1 - s.ecl) * Math.max(0, Math.cos((c.sun.alt * Math.PI) / 180)) : 0
    s.useW = ROVER.idleW + (isRover && Math.abs(s.speed) > .0001 ? ROVER.driveW : 0) + (s.lights && isRover ? 30 : 0)
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
    const p = toV(s.x, s.y)
    const e = 1.5
    const hx = (h(s.x + e, s.y) - h(s.x - e, s.y)) / (2 * e)
    const hy = (h(s.x, s.y + e) - h(s.x, s.y - e)) / (2 * e)
    const nrm = V(-hx, 1, hy).normalize()
    const fwd = V(Math.cos(s.heading), 0, -Math.sin(s.heading))
    fwd.addScaledVector(nrm, -fwd.dot(nrm)).normalize()
    const basis = M().makeBasis(fwd, nrm, V().crossVectors(fwd, nrm))
    if (rover.current) {
      rover.current.visible = s.mode !== 'landing'
      const rp = s.mode === 'rover' ? p : toV(start.x + PARK[0], start.y + PARK[1])
      rover.current.position.copy(rp)
      if (s.mode === 'rover') rover.current.quaternion.setFromRotationMatrix(basis)
      else {
        const x = start.x + PARK[0], y = start.y + PARK[1]
        const n = V(-(h(x + e, y) - h(x - e, y)) / (2 * e), 1, (h(x, y + e) - h(x, y - e)) / (2 * e)).normalize()
        rover.current.quaternion.setFromUnitVectors(UP, n)
      }
    }
    if (lander.current) {
      lander.current.position.copy(toV(start.x, start.y, contact.lift))
      lander.current.quaternion.setFromUnitVectors(UP, contact.normal)
      scratch.quat.setFromAxisAngle(UP, landerYaw.current)
      lander.current.quaternion.multiply(scratch.quat)
    }
    let landing = null as typeof scratch.landing | null
    if (s.mode === 'landing' && lander.current) {
      if (playback) {
        const pb = playback.current
        // The film shot is shorter than the 26 s approach. Map its progress onto that
        // approach so the lander touches down inside the shot. A hidden premount during
        // descent must not spend that clock.
        if (pb.scene === 'landing') s.descT = filmDescentSeconds(sceneProgress(pb), LAND.secs)
      } else s.descT += dt
      const x = Math.min(1, s.descT / LAND.secs)
      landCam.current.touchT = Math.max(0, s.descT - LAND.secs)
      const profile = finalApproach(x, scratch.approach)
      const dir = V(Math.cos(s.sunHeading), 0, -Math.sin(s.sunHeading))
      const base = toV(start.x, start.y, contact.lift)
      const pos = scratch.landing.pos.copy(base).addScaledVector(dir, profile.range)
      pos.y += profile.altitude
      // Keep the feet clear of any intervening terrain ridge, not merely above the site's datum.
      const ground = toV(start.x + dir.x * profile.range, start.y - dir.z * profile.range).y
      pos.y = Math.max(pos.y, ground + contact.lift)
      const up = V().copy(UP).lerp(contact.normal, ease((x - .75) / .25)).normalize()
      const side = V().crossVectors(up, dir).normalize()
      scratch.quat.setFromUnitVectors(UP, up)
      lander.current.quaternion.setFromAxisAngle(side, profile.tilt).multiply(scratch.quat)
      scratch.quat.setFromAxisAngle(UP, landerYaw.current)
      lander.current.quaternion.multiply(scratch.quat)
      lander.current.position.copy(pos)
      landing = scratch.landing
      landing.vel.copy(dir).multiplyScalar(profile.horizontal).addScaledVector(UP, profile.vertical).normalize()
      landing.alt = Math.max(0, pos.y - ground - contact.lift); landing.x = x
      if (playback?.current.surface) {
        const telemetry = playback.current.surface
        telemetry.altitude = landing.alt; telemetry.range = profile.range
        telemetry.seconds = Math.max(0, (1 - x) * LAND.physicalSecs); telemetry.landed = x >= 1
      }
      if (plumeG.current) {
        plumeG.current.visible = x < 1
        plumeG.current.position.copy(pos)
        plumeG.current.quaternion.copy(lander.current.quaternion)
        const height = ld.heightM
        const length = height * 1.5 * THREE.MathUtils.clamp(landing.alt / (height * 3), .08, 1)
        plumeG.current.position.add(V(0, height * .12, 0).applyQuaternion(lander.current.quaternion))
        plumeG.current.scale.set(height * .18, length, height * .18)
      }
      const el = document.getElementById('landing-hud')
      if (el) {
        el.dataset.done = x >= 1 ? '1' : '0'
        el.textContent = x >= 1
          ? (lang === 'tr' ? (start.rough ? 'TEMAS · SERT İNİŞ SENARYOSU (ŞEMA)' : 'TEMAS IŞIĞI · İNİŞ')
            : (start.rough ? 'CONTACT · HARD-LANDING SCENARIO (SCHEMATIC)' : 'CONTACT LIGHT · TOUCHDOWN'))
          : `${lang === 'tr' ? 'İRTİFA' : 'ALTITUDE'} ${Math.round(landing.alt).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} m · ${lang === 'tr' ? 'MESAFE' : 'RANGE'} ${Math.round(profile.range).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} m · T−${Math.ceil((1 - x) * LAND.physicalSecs)} ${lang === 'tr' ? 'sn' : 's'}`
      }
      if (x >= 1) landCam.current.touchT = Math.max(0, s.descT - LAND.secs)
      // Hold the exterior touchdown composition. The owner can enter the lander with a deliberate action.
    } else if (plumeG.current) plumeG.current.visible = false
    if (dust.current) {
      const gpos = dust.current.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
      const material = dust.current.material as THREE.PointsMaterial
      if (landing && landing.alt < 30) {
        const strength = Math.min(1, (30 - landing.alt) / 25)
        const base = toV(start.x, start.y)
        for (let i = 0; i < dustSeed.length; i++) {
          const d = dustSeed[i]
          d.r += d.v * dt * (landing.x < 1 ? strength : .15)
          const px = Math.cos(d.a) * d.r, pz = Math.sin(d.a) * d.r
          const terrainY = base.y - (contact.normal.x * px + contact.normal.z * pz) / contact.normal.y
          gpos?.setXYZ(i, base.x + px, terrainY + .08 + d.h * strength * Math.exp(-landCam.current.touchT * 2), base.z + pz)
        }
        if (gpos) gpos.needsUpdate = true
        material.opacity = landing.x < 1 ? .24 * strength : Math.max(0, .24 - landCam.current.touchT * .16)
        dust.current.visible = material.opacity > .001
      } else dust.current.visible = false
    }
    if (ambient.current) ambient.current.intensity = s.science ? .16 : s.cinematic ? .09 : .025
    const mat = ribbon.material as THREE.ShaderMaterial
    mat.uniforms.uTime.value = st.clock.elapsedTime
    mat.uniforms.uProgress.value = s.routeS
    const key = ribKey.current
    if (key.ver !== s.routeVer || key.ox !== s.origin.x || key.oy !== s.origin.y) {
      key.ver = s.routeVer
      key.ox = s.origin.x
      key.oy = s.origin.y
      const rp = s.route
      if (!rp || rp.pts.length < 2) ribbon.visible = false
      else fillRouteRibbon(ribbon, rp.pts, rp.cum, h, s.origin)
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
      sunMesh.current?.position.copy(copyV(sd).multiplyScalar(250000))
      glareRef.current?.position.copy(copyV(sd).multiplyScalar(249000))
      earthMesh.current?.position.copy(copyV(ed).multiplyScalar(250000))
      earthMesh.current?.lookAt(0, 0, 0)
      if (sun.current) {
        sun.current.position.copy(p).addScaledVector(sd, 3000)
        sun.current.target.position.copy(p)
        sun.current.target.updateMatrixWorld()
        sun.current.intensity = c.sun.alt > -1 ? 4.2 * (1 - s.ecl) : 0
      }
      if (earthshine.current) {
        earthshine.current.visible = c.earthUp
        earthshine.current.position.copy(p).addScaledVector(ed, 3000)
        earthshine.current.target.position.copy(p); earthshine.current.target.updateMatrixWorld()
        earthshine.current.intensity = c.earthUp ? (s.cinematic ? .12 : .035) : 0
      }
      if (panel.current && s.mode === 'rover') {
        // vertical panel turned toward the Sun's azimuth (in the rover frame)
        const local = copyV(sd).applyMatrix4(M().copy(basis).invert())
        panel.current.rotation.y = Math.atan2(-local.z, local.x)
      }
      if (dish.current && lander.current) dish.current.lookAt(dish.current.getWorldPosition(V()).addScaledVector(ed, 1000))
    }
    if (head.current) {
      head.current.intensity = s.lights && isRover ? ((c?.sunFrac ?? 0) < 0.5 ? 60 : 8) : 0
    }
    if (prints.current) {
      const pk = `${s.printVer}:${s.origin.x}:${s.origin.y}`
      if (printKey.current !== pk) {
        printKey.current = pk
        const m = M(), q = scratch.quat, sc = V(1, 1, 1), up = V(0, 1, 0)
        s.prints.forEach((f, k) => {
          q.setFromAxisAngle(up, f.a)
          m.compose(toV(f.x, f.y, .03, scratch.printPos), q, sc)
          prints.current!.setMatrixAt(k, m)
        })
        prints.current.count = s.prints.length
        prints.current.instanceMatrix.needsUpdate = true
      }
    }

    if (landing) {
      const L = landCam.current
      const dir = V(Math.cos(s.sunHeading), 0, -Math.sin(s.sunHeading))
      const side = V(0, 1, 0).cross(dir).normalize()
      const site = toV(start.x, start.y)
      // Track the moving craft directly: smoothing its world position trails hundreds of metres
      // behind during the accelerated descent. Keep a fixed offset from the craft instead.
      const height = ld.heightM
      // The cinematic touchdown holds a readable, roughly quarter-frame lander.
      const distance = s.cinematic ? height * 3.2 : Math.max(18, height * 3.5)
      // At altitude, look down past the craft onto distant terrain. A low horizontal chase shot
      // made a kilometre-high lander look as though it was hovering just above a nearby ridge.
      const overhead = s.cinematic ? distance * .2 * ease(landing.alt / 40) : distance * .95 * ease((landing.alt - 40) / 360)
      const eye = copyV(landing.pos).addScaledVector(dir, distance)
        .addScaledVector(side, distance * 0.45).add(V(0, height * (s.cinematic ? .85 : 1.3) + overhead, 0))
      const ground = toV(start.x + eye.x - site.x, start.y - eye.z + site.z).y + 1.2
      eye.y = Math.max(eye.y, ground)
      camera.position.copy(eye)
      L.look.copy(landing.pos).add(V(0, height * 0.45, 0))
      camera.lookAt(L.look)
      return
    }
    // Two deliberate shots; cut between them rather than moving the camera through the rover.
    if (s.cinematic && s.mode === 'rover') {
      if (torch.current) torch.current.intensity = 0
      const pb = playback?.current
      const t = pb ? Math.max(0, pb.time() - pb.start) : scratch.elapsed
      const cut = pb && pb.duration > 0 ? pb.duration * 0.5 : 6.5
      const shot = t < cut ? 0 : 1
      const length = rv.id === 'pragyan' ? .92 : rv.id === 'yutu' ? 1.5 : rv.id === 'viper' ? 2.5 : 3.1
      const side = V().crossVectors(fwd, nrm).normalize()
      const litSide = c && side.dot(skyDir(c.sun.alt, c.sun.az, lon)) < 0 ? -1 : 1
      const sideDistance = (camera as THREE.PerspectiveCamera).aspect < .8 ? 2.65 : 2.1
      const eye = copyV(p).addScaledVector(fwd, shot ? length * 1.2 : -length)
        .addScaledVector(side, length * sideDistance * litSide).add(V(0, length * (shot ? .55 : .75), 0))
      safeEye(eye)
      if (shot !== scratch.shot) { camera.position.copy(eye); scratch.shot = shot }
      else camera.position.lerp(eye, 1 - Math.exp(-dt * 7))
      safeEye(camera.position)
      camera.lookAt(copyV(p).add(V(0, length * .3, 0)))
      return
    }
    // ---- camera (the helmet flashlight only exists on foot)
    if (torch.current && s.mode !== 'walk') torch.current.intensity = 0
    const look = V()
    if (s.mode === 'walk') {
      // first person, with the slow bounce of walking in one-sixth gravity
      const bob = Math.abs(Math.sin(s.bob * 2.1)) * (s.run ? 0.22 : 0.1)
      const eye = copyV(p).add(V(0, WALK.eye + bob, 0))
      camera.position.lerp(eye, 1 - Math.exp(-dt * 12))
      safeEye(camera.position)
      const yaw = s.heading + s.yaw
      look.set(Math.cos(yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(yaw) * Math.cos(s.pitch))
      camera.lookAt(copyV(camera.position).add(look))
      if (torch.current) {
        torch.current.position.copy(camera.position).add(V(0, -0.15, 0))
        torch.current.target.position.copy(camera.position).addScaledVector(look, 20)
        torch.current.target.updateMatrixWorld()
        torch.current.intensity = s.torch ? 90 : 0
      }
    } else if (s.mode === 'lander') {
      // camera at the ascent-stage window height, facing the landing heading
      const ly = landerYaw.current
      const base = toV(start.x, start.y).add(V(Math.cos(ly) * Math.max(2.4, ld.heightM * .15), landerEye(ld.id), -Math.sin(ly) * Math.max(2.4, ld.heightM * .15)))
      camera.position.copy(base)
      const yaw = s.heading + s.yaw
      look.set(Math.cos(yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(yaw) * Math.cos(s.pitch))
      camera.lookAt(copyV(base).add(look))
    } else if (s.cam === 'mast') {
      const eye = copyV(p).addScaledVector(nrm, ROVER.mast).addScaledVector(fwd, 0.3)
      camera.position.copy(eye)
      const dir = copyV(fwd).applyAxisAngle(nrm, s.yaw)
      dir.addScaledVector(nrm, Math.tan(s.pitch)).normalize()
      camera.lookAt(copyV(eye).add(dir))
    } else {
      // A rear three-quarter view keeps a vertical solar panel from hiding the chassis edge-on.
      const back = copyV(fwd).applyAxisAngle(V(0, 1, 0), s.yaw + (s.mode === 'rover' ? .55 : 0))
      const length = rv.id === 'pragyan' ? 0.92 : rv.id === 'yutu' ? 1.5 : rv.id === 'viper' ? 2.5 : 3.1
      const eye = copyV(p).addScaledVector(back, -length * 2.5)
        .add(V(0, Math.max(0.9, length * 0.9 - s.pitch * 3), 0))
      // Keep the chase camera outside the lander's footprint for any viewing angle.
      const base = toV(start.x, start.y)
      const clearance = Math.max(6, ld.heightM * 0.4)
      const away = V(eye.x - base.x, 0, eye.z - base.z)
      if (away.length() < clearance) {
        away.setLength(clearance)
        eye.x = base.x + away.x; eye.z = base.z + away.z
      }
      const camGround = toV(s.x + (eye.x - p.x), s.y - (eye.z - p.z)).y + 1.2
      if (eye.y < camGround) eye.y = camGround
      camera.position.lerp(eye, 1 - Math.exp(-dt * 6))
      safeEye(camera.position)
      camera.lookAt(copyV(p).add(V(0, length * 0.25, 0)))
    }
  })

  const sunR = 250000 * Math.tan((0.27 * Math.PI) / 180)
  const earthR = 250000 * Math.tan((0.95 * Math.PI) / 180)
  return (
    <>
      <ambientLight ref={ambient} intensity={.025} />
      <directionalLight ref={earthshine} intensity={.035} color="#b9c8da" visible={false} />
      <directionalLight ref={sun} castShadow intensity={4} color="#fff6e6"
                        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} shadow-normalBias={0.02}
                        shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90}
                        shadow-camera-near={10} shadow-camera-far={8000} />
      <mesh ref={nearMesh} receiveShadow castShadow>
        <bufferGeometry />
        <meshStandardMaterial map={regColor} normalMap={regNormal} normalScale={[0.45, 0.45]} vertexColors roughness={1} metalness={0} color="#d6d2ca" onBeforeCompile={sunlitShader} />
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
          <meshStandardMaterial map={earthMap} roughness={1} />
        </mesh>
      </group>
      <primitive object={ribbon} />
      <Lander ref={lander} dish={dish} id={ld.id} onReady={landerReady} />
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
      <group ref={plumeG} visible={false}>
        <mesh position={[0, -0.5, 0]}>
          <coneGeometry args={[1, 1, 32, 1, true]} />
          <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
            vertexShader={`
              #include <common>
              #include <logdepthbuf_pars_vertex>
              varying vec2 vUv;
              varying vec3 vNormal;
              varying vec3 vView;
              void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vView = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
                #include <logdepthbuf_vertex>
              }
            `}
            fragmentShader={`
              #include <logdepthbuf_pars_fragment>
              varying vec2 vUv;
              varying vec3 vNormal;
              varying vec3 vView;
              void main() {
                #include <logdepthbuf_fragment>
                float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5);
                float fade = smoothstep(0.0, 0.65, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
                gl_FragColor = vec4(0.75, 0.83, 1.0, 0.12 * edge * fade);
              }
            `} />
        </mesh>
      </group>
      <points ref={dust} visible={false} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[dustPositions, 3]} /></bufferGeometry>
        <pointsMaterial size={0.7} color="#cfc6b8" map={dustTex} alphaMap={dustTex} transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
      <spotLight ref={torch} angle={0.42} penumbra={0.55} distance={90} decay={1.2} color="#fff4e0" intensity={0} />
      <instancedMesh ref={prints} args={[undefined, undefined, 800]} frustumCulled={false} renderOrder={1}>
        <boxGeometry args={[0.3, 0.012, 0.12]} />
        <meshStandardMaterial color="#3b3833" roughness={1} />
      </instancedMesh>
      <group ref={rover}>
        <RoverModel panel={panel} id={rv.id} motion={sim} onReady={roverReady} />
        <spotLight ref={head} position={[1, 1.1, 0]} angle={0.5} penumbra={0.4} distance={120} decay={1} color="#eaf2ff" castShadow={false} />
      </group>
    </>
  )
}

// Soft ribbon in the same frame as toV: three.js x = plane x, z = -plane y. DoubleSide because a path
// draped on terrain has no single up-facing winding. One geometry; the frame loop only writes uniforms.
const ROUTE_VERT = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSide;
  attribute float aDist;
  varying float vSide;
  varying float vDist;
  void main() {
    vSide = aSide;
    vDist = aDist;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`
const ROUTE_FRAG = `
  #include <logdepthbuf_pars_fragment>
  varying float vSide;
  varying float vDist;
  uniform float uTime;
  uniform float uProgress;
  uniform float uLength;
  void main() {
    #include <logdepthbuf_fragment>
    float side = abs(vSide);
    float edge = pow(1.0 - smoothstep(0.02, 1.0, side), 1.35);
    float core = 1.0 - smoothstep(0.0, 0.38, side);
    float along = clamp(vDist / max(uLength, 1.0), 0.0, 1.0);
    vec3 col = mix(vec3(0.18, 0.55, 0.68), vec3(0.62, 0.96, 1.0), along);
    col = mix(col, vec3(0.88, 1.0, 1.0), core * 0.72);
    float ahead = smoothstep(uProgress - 4.0, uProgress + 14.0, vDist);
    float dim = mix(0.2, 1.0, ahead);
    float flow = 0.7 + 0.3 * sin(vDist * 0.48 - uTime * 6.5);
    float dash = mix(0.55, flow, ahead);
    gl_FragColor = vec4(col * dim, edge * dim * dash * 0.92);
    #include <colorspace_fragment>
  }
`

function routeRibbon() {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array([-1, 1]), 1))
  geo.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(2), 1))
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array([0, 1, 0]), 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uLength: { value: 1 } },
    vertexShader: ROUTE_VERT, fragmentShader: ROUTE_FRAG,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.visible = false
  return mesh
}

function fillRouteRibbon(mesh: THREE.Mesh, pts: readonly [number, number][], cum: readonly number[], height: (x: number, y: number) => number, origin: { x: number; y: number; h: number }) {
  const n = pts.length
  if (n < 2) { mesh.visible = false; return }
  const geo = mesh.geometry
  const need = n * 2
  let pos = geo.getAttribute('position') as THREE.BufferAttribute
  const fresh = !pos || pos.count !== need
  if (fresh) {
    pos = new THREE.BufferAttribute(new Float32Array(need * 3), 3)
    geo.setAttribute('position', pos)
    geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(need), 1))
    geo.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(need), 1))
    const idx = new Uint32Array((n - 1) * 6)
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, q = i * 6
      idx[q] = a; idx[q + 1] = a + 1; idx[q + 2] = a + 2
      idx[q + 3] = a + 1; idx[q + 4] = a + 3; idx[q + 5] = a + 2
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    const side = geo.getAttribute('aSide') as THREE.BufferAttribute
    for (let i = 0; i < n; i++) { side.setX(i * 2, -1); side.setX(i * 2 + 1, 1) }
  }
  const pa = pos.array as Float32Array
  const da = (geo.getAttribute('aDist') as THREE.BufferAttribute).array as Float32Array
  const half = 2.7, lift = 0.9
  const ox = origin.x, oy = origin.y, oh = origin.h
  for (let i = 0; i < n; i++) {
    const x = pts[i][0], y = pts[i][1]
    let tx: number, ty: number
    if (i === 0) { tx = pts[1][0] - x; ty = pts[1][1] - y }
    else if (i === n - 1) { tx = x - pts[i - 1][0]; ty = y - pts[i - 1][1] }
    else { tx = pts[i + 1][0] - pts[i - 1][0]; ty = pts[i + 1][1] - pts[i - 1][1] }
    const len = Math.hypot(tx, ty) || 1
    const px = -ty / len, py = tx / len
    const d = cum.length === n ? cum[i] : 0
    da[i * 2] = d
    da[i * 2 + 1] = d
    writeEdge(pa, i * 6, x + px * half, y + py * half, height, ox, oy, oh, lift)
    writeEdge(pa, i * 6 + 3, x - px * half, y - py * half, height, ox, oy, oh, lift)
  }
  pos.needsUpdate = true
  ;(geo.getAttribute('aDist') as THREE.BufferAttribute).needsUpdate = true
  if (fresh) (geo.getAttribute('aSide') as THREE.BufferAttribute).needsUpdate = true
  geo.computeBoundingSphere()
  const mat = mesh.material as THREE.ShaderMaterial
  mat.uniforms.uLength.value = Math.max(1, cum.length === n ? cum[n - 1] : 1)
  mesh.visible = true
}

function writeEdge(out: Float32Array, o: number, sx: number, sy: number, height: (x: number, y: number) => number, ox: number, oy: number, oh: number, lift: number) {
  const dx = sx - ox, dy = sy - oy
  let z = height(sx, sy)
  if (!Number.isFinite(z)) z = oh
  out[o] = dx
  out[o + 1] = z - oh - (dx * dx + dy * dy) / (2 * R_M) + lift
  out[o + 2] = -dy
}

/** Distant-ridge shadow: a per-vertex 'sunlit' factor that dims only the Sun (directional light), not the headlights. */
function sunlitShader(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float sunlit;\nvarying float vSunlit;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSunlit = sunlit;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vSunlit;')
    .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tif (UNROLLED_LOOP_INDEX == 0) directLight.color *= vSunlit;'))
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
function readPad(s: Sim, dt: number) {
  const pads = navigator.getGamepads?.()
  let gp: Gamepad | null = null
  if (pads) for (const pad of pads) if (pad) { gp = pad; break }
  if (!gp) return
  const ax = gp.axes
  const btn = (i: number) => gp.buttons[i]?.pressed ?? false
  const trig = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0)
  const thr = Math.abs(trig) > 0.05 ? trig : -dz(ax[1] ?? 0)
  const steer = -dz(ax[0] ?? 0)
  if (thr || steer || s.pad) { s.throttle = thr; s.steer = steer; s.pad = !!(thr || steer) }
  s.yaw -= dz(ax[2] ?? 0) * 2.4 * dt
  s.pitch = Math.max(-1.2, Math.min(1.2, s.pitch - dz(ax[3] ?? 0) * 1.8 * dt))
  const edge = (i: number) => btn(i) && !s.padBtn[i]
  if (edge(0)) s.cam = s.cam === 'chase' ? 'mast' : 'chase'
  if (edge(1)) s.science = !s.science
  s.drillKey = btn(2) || s.drillKey && !s.pad
  if (edge(3)) s.lights = !s.lights
  if (edge(9)) s.playing = !s.playing
  const wi = WARPS.indexOf(s.warp)
  if (edge(5)) s.warp = WARPS[Math.min(WARPS.length - 1, wi + 1)]
  if (edge(4)) s.warp = WARPS[Math.max(0, wi - 1)]
  for (let i = 0; i < gp.buttons.length; i++) s.padBtn[i] = gp.buttons[i].pressed
}

const Lander = ({ ref, dish, id, onReady }: { ref: React.Ref<THREE.Group>; dish: React.Ref<THREE.Group>; id: string; onReady: () => void }) => (
  <group ref={ref}>
    <LanderBody id={id} onReady={onReady} />
    <group ref={dish} position={[0, landerEye(id) + 0.4, 0]} />
  </group>
)

const RoverModel = ({ panel, id, motion, onReady }: { panel: React.Ref<THREE.Group>; id: string; motion: React.RefObject<Sim>; onReady: () => void }) => (
  // forward = +x
  <group>
    <RoverBody id={id} motion={motion} onReady={onReady} />
    <group ref={panel} />
  </group>
)

