import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { dataUrl, loadManifest, type Manifest, type Series } from './data'
import { insideRing, parseAtlas, parseEphem, parseHazard, pointTrack, sunlitMap, zoneSlopeAt, type Atlas, type Hazard, type PointResult } from './engine'
import { T, fmtPct, hours, why, type Lang } from './i18n'
import { evaluateWindow, requiredBatteryWh, type Constraints } from './model'
import { EngineRunner } from './runner'
import { listEclipses } from './eclipse'
import { describePlace, type Feature } from './places'
import YearView from './components/YearView'
import { download, reportHtml, siteRow, toCsv, type SiteRow } from './report'
import HorizonView from './components/HorizonView'
import Luna, { type LunaAction } from './components/Luna'
import { AlertTriangle, ArrowLeftRight, Mountain, Link2, MapPin, Pause, Play, BatteryMedium, Car, Download, Earth, Github, MoonStar, PlaneLanding, Printer, Sun } from 'lucide-react'
import type { Overlay, Pin } from './components/Globe'
import type { DriveMode, DriveStart } from './components/Drive'

const Globe = lazy(() => import('./components/Globe'))
const Drive = lazy(() => import('./components/Drive'))

const PLANNER_URL = 'https://limitlessapps.streamlit.app/'
const REPO_URL = 'https://github.com/yutuf/lmNasa'

type Text = Record<Lang, string>
const S = {
  hero: { en: 'Landing site search', tr: 'İniş yeri arama' },
  sub: {
    en: 'Describe your mission. LunaNav searches 21,856 points near the lunar south pole, hour by hour, over the real terrain, and shows where and when a solar lander survives.',
    tr: "Görevinizi tarif edin. LunaNav Ay'ın güney kutbu çevresindeki 21.856 noktayı, gerçek arazi üzerinde saat saat tarar ve güneş enerjili bir aracın nerede ve ne zaman yaşayabileceğini gösterir.",
  },
  mission: { en: 'Mission profile', tr: 'Görev profili' },
  window: { en: 'Landing window', tr: 'İniş penceresi' },
  from: { en: 'from', tr: 'başlangıç' },
  days: { en: 'days', tr: 'gün' },
  stay: { en: 'Stay on the surface', tr: 'Yüzeyde kalış' },
  needSun: { en: 'Sunlight at least', tr: 'En az güneş' },
  needEarth: { en: 'Earth contact at least', tr: 'En az Dünya bağlantısı' },
  maxShadow: { en: 'Longest shadow at most', tr: 'En uzun gölge en çok' },
  battery: { en: 'Battery', tr: 'Batarya' },
  slope: { en: 'Steepest ground', tr: 'En dik zemin' },
  touchdown: { en: 'Touchdown zone', tr: 'İniş alanı' },
  zoneRadius: { en: 'Landing zone radius', tr: 'İniş alanı yarıçapı' },
  zoneOff: { en: 'Off', tr: 'Kapalı' },
  zoneSlope: { en: '95% of the zone gentler than', tr: 'Alanın %95’i şundan az eğimli' },
  zoneHint: { en: 'LOLA 40 m slopes inside the circle the lander may touch down in. 100 m ≈ precision landing, 1 km ≈ a typical robotic lander.', tr: 'İniş aracının konabileceği daire içindeki LOLA 40 m eğimleri. 100 m ≈ hassas iniş, 1 km ≈ tipik robotik iniş aracı.' },
  colZone: { en: 'Zone slope', tr: 'Alan eğimi' },
  dsn: { en: 'Earth contact needs a NASA DSN dish too', tr: 'Dünya bağlantısı NASA DSN anteni de gerektirsin' },
  search: { en: 'Run search', tr: 'Aramayı çalıştır' },
  searching: { en: 'Searching', tr: 'Aranıyor' },
  results: { en: 'Best landing sites', tr: 'En iyi iniş yerleri' },
  goDays: { en: 'GO on', tr: 'Uygun' },
  of: { en: 'of', tr: '/' },
  landingDates: { en: 'landing dates', tr: 'iniş tarihi' },
  bestDate: { en: 'best landing', tr: 'en iyi iniş' },
  inRegion: { en: 'Artemis III region', tr: 'Artemis III bölgesi' },
  nothing: { en: 'No point meets these requirements in this window. Loosen a requirement or move the window.', tr: 'Bu pencerede gereksinimleri karşılayan nokta yok. Bir gereksinimi gevşetin veya pencereyi kaydırın.' },
  legend: { en: 'Green: GO on most landing dates · red: never GO · clear: too steep', tr: 'Yeşil: çoğu tarihte uygun · kırmızı: hiç uygun değil · boş: çok dik' },
  stats: { en: 'points checked', tr: 'nokta tarandı' },
  hoursChecked: { en: 'hour-by-hour checks', tr: 'saatlik kontrol' },
  seconds: { en: 's', tr: 'sn' },
  thisSite: { en: 'This site', tr: 'Bu nokta' },
  otherDates: { en: 'Other landing dates in the window', tr: 'Penceredeki diğer iniş tarihleri' },
  standHere: { en: 'Stand on the lander', tr: 'İniş aracında dur' },
  driveHere: { en: 'Drive a rover here', tr: 'Burada gezgin sür' },
  compare: { en: 'Compare', tr: 'Karşılaştır' },
  navResults: { en: 'Results', tr: 'Sonuçlar' },
  navSite: { en: 'Site', tr: 'Nokta' },
  navMethod: { en: 'Method & data', tr: 'Yöntem ve veri' },
  requirements: { en: 'Requirements', tr: 'Gereksinimler' },
  resultsSub: { en: 'Ranked by the number of landing dates that pass, then by score. Picks are at least 6 km apart.', tr: 'Uygun iniş tarihi sayısına, sonra puana göre sıralı. Seçimler en az 6 km aralıklı.' },
  colSite: { en: 'Site', tr: 'Nokta' },
  colGo: { en: 'GO dates', tr: 'Uygun tarih' },
  colEarth: { en: 'Earth contact', tr: 'Dünya bağlantısı' },
  colSlope: { en: 'Slope', tr: 'Eğim' },
  siteN: { en: 'Site', tr: 'Nokta' },
  longestDark: { en: 'Longest darkness', tr: 'En uzun karanlık' },
  otherDatesSub: { en: 'Each square is a landing date in the window; outlined = best.', tr: 'Her kare penceredeki bir iniş tarihi; çerçeveli = en iyi.' },
  legGo: { en: 'GO on some dates', tr: 'Bazı tarihlerde uygun' },
  legNo: { en: 'Never GO', tr: 'Hiç uygun değil' },
  legSteep: { en: 'Too steep (not searched)', tr: 'Çok dik (taranmadı)' },

  compareTitle: { en: 'Side by side', tr: 'Yan yana' },
  compareHint: { en: 'Tick two to four rows to compare them side by side.', tr: 'Yan yana karşılaştırmak için iki ile dört satır işaretleyin.' },
  csv: { en: 'CSV', tr: 'CSV' },
  report: { en: 'Report', tr: 'Rapor' },
  clear: { en: 'Clear', tr: 'Temizle' },
  beThere: { en: 'Be there: see what the lander sees on the best landing date, or drive a rover over the real terrain.', tr: 'Oradaymış gibi: en iyi iniş tarihinde iniş aracının gördüğünü görün ya da gerçek arazide gezgin sürün.' },
} satisfies Record<string, Text>

const STEPS: Record<Lang, string[][]> = {
    en: [['Terrain', 'Horizons ray-marched in 180 directions over NASA LOLA elevation maps for 21,856 points around the south pole.'],
      ['Sky', 'Sun and Earth positions every hour from JPL DE440, with Earth parallax for each point.'],
      ['Mission check', 'For every landing date: sunlight share, Earth contact (optionally needing a free NASA DSN dish), longest darkness and a battery simulation.'],
      ['Ranking', 'Points that pass on the most landing dates come first; the detail shows why each one passes or fails.']],
    tr: [['Arazi', 'Güney kutbu çevresindeki 21.856 nokta için NASA LOLA yükseklik haritaları üzerinde 180 yönde ufuk hesaplandı.'],
      ['Gökyüzü', 'Güneş ve Dünya konumları JPL DE440 ile saat saat, her nokta için Dünya paralaksı dahil.'],
      ['Görev kontrolü', 'Her iniş tarihi için güneş payı, Dünya bağlantısı (isteğe bağlı boş bir NASA DSN anteni), en uzun karanlık ve batarya simülasyonu.'],
      ['Sıralama', 'En çok iniş tarihinde geçen noktalar önce gelir; ayrıntı her birinin neden geçtiğini ya da kaldığını gösterir.']],
  }

const PRESETS = [
  { id: 'lander', short: { en: 'Lander', tr: 'İniş aracı' }, name: { en: 'Solar lander · 14 days', tr: 'Güneş enerjili iniş aracı · 14 gün' }, days: 14, sun: 70, earth: 50, shadow: 48, batt: 2000 },
  { id: 'long', short: { en: 'Long stay', tr: 'Uzun kalış' }, name: { en: 'Long stay · 28 days', tr: 'Uzun kalış · 28 gün' }, days: 28, sun: 60, earth: 50, shadow: 72, batt: 6000 },
  { id: 'sprint', short: { en: 'Sprint', tr: 'Kısa görev' }, name: { en: 'Short sprint · 5 days', tr: 'Kısa görev · 5 gün' }, days: 5, sun: 80, earth: 70, shadow: 24, batt: 1000 },
]

interface Params { start: string; windowDays: number; days: number; sun: number; earth: number; shadow: number; batt: number; slope: number; zone: number; zslope: number; dsn: boolean }

function readHash(): { lang: Lang; p: Params } {
  const q = new URLSearchParams(location.hash.slice(1))
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return {
    lang: q.get('lang') === 'tr' ? 'tr' : 'en',
    p: { start: [q.get('start') ?? '2027-09-01'].map((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '2026-11-01' && s <= '2028-11-30' ? s : '2027-09-01'))[0], windowDays: num('window', 30), days: num('days', 14), sun: num('sun', 70),
      earth: num('earth', 50), shadow: num('shadow', 48), batt: num('batt', 2000), slope: num('slope', 8),
      zone: [num('zone', 100)].map((z) => ([0, 100, 250, 500, 1000].includes(z) ? z : 100))[0], zslope: num('zslope', 10), dsn: q.get('dsn') !== '0' },
  }
}

export default function App() {
  const init = readHash()
  const [lang, setLang] = useState<Lang>(init.lang)
  const [p, setP] = useState<Params>(init.p)
  const [m, setM] = useState<Manifest | null>(null)
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [hazard, setHazard] = useState<Hazard | null>(null)
  const [results, setResults] = useState<PointResult[] | null>(null)
  const [ran, setRan] = useState<{ q: Params; ms: number; hoursChecked: number } | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [sel, setSelRaw] = useState(0)
  const [pinned, setPinned] = useState<PointResult | null>(null)
  const initSite = useRef<number | null>(Number(new URLSearchParams(location.hash.slice(1)).get('site')) || null)
  const setSel = (k: number) => { setPinned(null); setSelRaw(k) }
  const [copied, setCopied] = useState(false)
  const [mapMode, setMapMode] = useState<'results' | 'sun'>('results')
  const [mapH, setMapH] = useState(0)
  const [mapPlay, setMapPlay] = useState(false)
  const siteIndex = pinned?.index ?? null
  const [dsn, setDsn] = useState<boolean[] | null>(null)
  const ephemRef = useRef<ArrayBuffer | null>(null)
  const runner = useRef<EngineRunner | null>(null)
  const [drive, setDrive] = useState<{ mode: DriveMode; start: DriveStart } | null>(null)
  const [cmp, setCmp] = useState<number[]>([])
  const [feats, setFeats] = useState<Feature[]>([])
  useEffect(() => { fetch(dataUrl('features.json')).then((r) => r.json()).then((j) => setFeats(j.features)).catch(() => {}) }, [])

  useEffect(() => {
    (async () => {
      const man = await loadManifest()
      const [a, e, d] = await Promise.all(['atlas.bin', 'ephem.bin', man.dsn].map((f) => fetch(dataUrl(f)).then((r) => r.arrayBuffer())))
      const hz = await fetch(dataUrl('hazard.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
      ephemRef.current = e
      setHazard(hz ? parseHazard(hz) : null)
      setDsn(Array.from(new Uint8Array(d), (x) => x === 1))
      setAtlas(parseAtlas(a))
      runner.current = new EngineRunner(a, e, d, man.n, hz)
      setM(man)
    })()
  }, [])
  useEffect(() => {
    history.replaceState(null, '', `#lang=${lang}&start=${p.start}&window=${p.windowDays}&days=${p.days}&sun=${p.sun}` +
      `&earth=${p.earth}&shadow=${p.shadow}&batt=${p.batt}&slope=${p.slope}&zone=${p.zone}&zslope=${p.zslope}&dsn=${p.dsn ? 1 : 0}` +
      (siteIndex !== null ? `&site=${siteIndex}` : ''))
  }, [lang, p, siteIndex])  // eslint-disable-line react-hooks/exhaustive-deps

  const constraints = (q: Params): Constraints | null => m && ({ ...m.constraints, duration_days: q.days,
    min_sun_frac: q.sun / 100, min_comm_frac: q.earth / 100, max_dark_hours: q.shadow, battery_wh: q.batt })

  const firstHour = (q: Params) => (m ? Math.round((Date.parse(q.start + 'T00:00:00Z') / 1000 - m.start_unix) / 3600) : 0)

  async function run(q: Params) {
    if (!m || !atlas || !runner.current) return
    const c = constraints(q)!
    const fh = firstHour(q)
    const nStarts = Math.max(1, Math.min(q.windowDays, Math.floor((m.n - fh - q.days * 24) / 24) + 1))
    if (fh < 0 || nStarts < 1) return
    setProgress(0)
    const t0 = performance.now()
    const res = await runner.current.run(atlas.n, { firstHour: fh, nStarts, strideH: 24, durationH: q.days * 24,
      maxSlope: q.slope, needDsn: q.dsn, zone: q.zone, zoneSlope: q.zslope }, c, setProgress)
    setRan({ q: { ...q, windowDays: nStarts }, ms: performance.now() - t0, hoursChecked: res.length * ((nStarts - 1) * 24 + q.days * 24) })
    setResults(res)
    setSel(0)
    if (initSite.current !== null) {
      const hit = res.find((r) => r.index === initSite.current)
      if (hit) setPinned(hit)
      initSite.current = null
    }
    setProgress(null)
  }
  useEffect(() => { if (m && atlas) run(p) }, [m, atlas])  // eslint-disable-line react-hooks/exhaustive-deps

  // ranking: most GO landing dates, then best score; keep picks at least 6 km apart
  const top = useMemo(() => {
    if (!results || !atlas) return []
    const order = [...results].sort((a, b) => b.goCount - a.goCount || b.bestScore - a.bestScore)
    const picks: PointResult[] = []
    for (const r of order) {
      if (picks.length >= 10) break
      if (picks.every((q) => Math.hypot(atlas.xKm[q.index] - atlas.xKm[r.index], atlas.yKm[q.index] - atlas.yKm[r.index]) >= 6)) picks.push(r)
    }
    return picks
  }, [results, atlas])

  const overlay: Overlay | null = useMemo(() => {
    if (!results || !atlas || !ran) return null
    const n = Math.round((2 * atlas.rMaxM) / atlas.spacingM) + 1
    const px = new Uint8Array(n * n * 4)
    for (const r of results) {
      const col = Math.round((atlas.xKm[r.index] * 1000 + atlas.rMaxM) / atlas.spacingM)
      const row = Math.round((atlas.yKm[r.index] * 1000 + atlas.rMaxM) / atlas.spacingM)
      const f = r.goCount / ran.q.windowDays
      const k = (row * n + col) * 4
      if (f > 0) { px[k] = 40; px[k + 1] = 200 + 55 * f; px[k + 2] = 110; px[k + 3] = 90 + 150 * Math.min(1, f * 1.5) }
      else { px[k] = 229; px[k + 1] = 72; px[k + 2] = 77; px[k + 3] = 70 }
    }
    const tex = new THREE.DataTexture(px, n, n, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { texture: tex, rMaxM: atlas.rMaxM, edgeLat: -84.5 }
  }, [results, atlas, ran])

  const pick = pinned ?? top[sel]
  const pickRank = pinned ? (top.findIndex((r) => r.index === pinned.index) + 1 || null) : sel + 1
  const eph = useMemo(() => (m && ephemRef.current ? parseEphem(ephemRef.current, m.n) : null), [m])
  const eclipses = useMemo(() => (eph ? listEclipses(eph) : []), [eph])
  const region = (r: PointResult) => m?.regions?.find((g) => g.rings.some((ring) => insideRing(atlas!.xKm[r.index], atlas!.yKm[r.index], ring)))?.name.replace(/_/g, ' ')
  const detail = useMemo(() => {
    if (!pick || !atlas || !ran || !m || !dsn || !ephemRef.current) return null
    const fh = firstHour(ran.q)
    const hoursN = (ran.q.windowDays - 1) * 24 + ran.q.days * 24
    const tr = pointTrack(atlas, eph!, dsn, pick.index, fh, hoursN)
    const c = constraints(ran.q)!
    const a = pick.bestStart * 24
    const len = ran.q.days * 24
    const sf = tr.sunFraction.subarray(a, a + len)
    const ev = (ran.q.dsn ? tr.earthVisible.map((v, k) => v && dsn[fh + k]) : tr.earthVisible).slice(a, a + len)
    const w = evaluateWindow(sf, ev, 1, c)
    const series: Series = { sunFraction: Float32Array.from(tr.sunFraction), sunAlt: tr.sunAlt, sunAz: tr.sunAz,
      earthAlt: tr.earthAlt, earthAz: tr.earthAz, earthVisible: ran.q.dsn ? tr.earthVisible.map((v, k) => v && dsn[fh + k]) : tr.earthVisible }
    const perStart = Array.from({ length: ran.q.windowDays }, (_, s) => evaluateWindow(
      tr.sunFraction.subarray(s * 24, s * 24 + len), series.earthVisible.slice(s * 24, s * 24 + len), 1, c).go)
    return { tr, w, need: requiredBatteryWh(sf, 1, c), series, a, len, fh, perStart, c }
  }, [pick, atlas, ran, m, dsn, eph])  // eslint-disable-line react-hooks/exhaustive-deps

  // metrics for every ranked site (comparison, CSV, report)
  const rows: SiteRow[] = useMemo(() => {
    if (!atlas || !ran || !m || !dsn || !eph) return []
    const c = constraints(ran.q)!
    return top.map((r, k) => siteRow(atlas, eph, dsn, r, k + 1, ran.q, c, firstHour(ran.q), [region(r), describePlace(r.lat, ((r.lon % 360) + 360) % 360, feats, lang)?.text].filter(Boolean).join(' · ') || null))
  }, [top, atlas, ran, m, dsn, eph, feats, lang])  // eslint-disable-line react-hooks/exhaustive-deps
  const cmpRows = rows.filter((r) => cmp.includes(r.index))
  const mapSpan = ran ? (ran.q.windowDays - 1) * 24 + ran.q.days * 24 : 0
  const mapHour = ran && m ? Math.min(m.n - 1, Math.max(0, firstHour(ran.q) + mapH)) : 0
  useEffect(() => {
    if (!mapPlay) return
    const id = setInterval(() => setMapH((h) => (h + 2 >= mapSpan ? 0 : h + 2)), 90)
    return () => clearInterval(id)
  }, [mapPlay, mapSpan])
  const sunOverlay: Overlay | null = useMemo(() => {
    if (mapMode !== 'sun' || !atlas || !eph) return null
    const lit = sunlitMap(atlas, eph, mapHour)
    const n = Math.round((2 * atlas.rMaxM) / atlas.spacingM) + 1
    const px = new Uint8Array(n * n * 4)
    for (let i = 0; i < atlas.n; i++) {
      const col = Math.round((atlas.xKm[i] * 1000 + atlas.rMaxM) / atlas.spacingM)
      const row = Math.round((atlas.yKm[i] * 1000 + atlas.rMaxM) / atlas.spacingM)
      const k = (row * n + col) * 4
      const f = lit[i]
      if (f >= 0.5) { px[k] = 245; px[k + 1] = 196; px[k + 2] = 70; px[k + 3] = 70 + 80 * f }
      else { px[k] = 12; px[k + 1] = 20; px[k + 2] = 48; px[k + 3] = 215 }
    }
    const tex = new THREE.DataTexture(px, n, n, THREE.RGBAFormat)
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { texture: tex, rMaxM: atlas.rMaxM, edgeLat: -84.5 }
  }, [mapMode, atlas, eph, mapHour])
  // nearby alternatives: points within 8 km that pass on more landing dates than the pick
  const nearby = useMemo(() => {
    if (!pick || !results || !atlas) return []
    const x0 = atlas.xKm[pick.index], y0 = atlas.yKm[pick.index]
    return results.filter((r) => r.index !== pick.index && r.goCount > pick.goCount &&
      Math.hypot(atlas.xKm[r.index] - x0, atlas.yKm[r.index] - y0) <= 8)
      .map((r) => ({ r, d: Math.hypot(atlas.xKm[r.index] - x0, atlas.yKm[r.index] - y0) }))
      .sort((a, b) => b.r.goCount - a.r.goCount || a.d - b.d).slice(0, 3)
  }, [pick, results, atlas])

  if (!m || !atlas) return <div className="loading">LunaNav<small>{lang === 'tr' ? 'NASA verisi yükleniyor…' : 'loading NASA data…'}</small></div>
  const startDate = (s: number) => new Date(Date.parse(ran!.q.start + 'T00:00:00Z') + s * 86400e3)
  const fmtDate = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  const pins: Pin[] = top.map((r, k) => ({ lat: r.lat, lon: r.lon, label: String(k + 1), good: r.goCount > 0 }))
  const sunDir = mapMode === 'sun' && eph ? [eph.sun[0][mapHour], eph.sun[1][mapHour], eph.sun[2][mapHour]] : detail ? detail.tr.sunDir(detail.a) : [1, 0, 0]
  const earthDir = detail ? detail.tr.earthDir(detail.a) : [1, 0, 0]
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((o) => ({ ...o, [k]: v }))
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
  const lunaContext = () => ({
    settings: ran?.q ?? p,
    meaning: 'sun/earth = minimum % of mission hours; shadow = longest tolerated darkness (h); batt = Wh; slope = max degrees over 400 m at the point; zone = landing-zone radius in m (0 = off; 100, 250, 500 or 1000); zslope = 95% of that zone must be gentler than this many degrees (LOLA 40 m slopes); dsn = Earth contact also needs a NASA DSN dish',
    engine: ran ? { pointsChecked: atlas.n, hourlyChecks: ran.hoursChecked, landingDatesInWindow: ran.q.windowDays, firstDate: ran.q.start } : null,
    results: top.map((r, k) => ({ rank: k + 1, lat: +r.lat.toFixed(3), lon: +r.lon.toFixed(3), artemisRegion: region(r) ?? null, place: place(r) ?? null,
      goLandingDates: r.goCount, bestLanding: startDate(r.bestStart).toISOString().slice(0, 10),
      bestWindow: { sunlightPct: Math.round(r.sunFrac * 100), earthContactPct: Math.round(r.commFrac * 100), longestDarkHours: r.longestDarkH },
      slopeDeg: atlas.slope[r.index], zoneSlopeP95Deg: zoneSlopeAt(hazard, ran?.q.zone, r.index), heightM: atlas.height[r.index] })),
    selected: detail && pick ? { rank: sel + 1, verdict: detail.w.go ? 'GO' : 'NO-GO', sunlightPct: Math.round(detail.w.sunFrac * 100),
      earthContactPct: Math.round(detail.w.commFrac * 100), longestDarkHours: detail.w.longestDarkH,
      batterySurvives: detail.w.survived, batteryNeededWh: Math.round(detail.need),
      goOnEachLandingDate: detail.perStart.map((g, s) => `${startDate(s).toISOString().slice(0, 10)}:${g ? 'GO' : 'NO-GO'}`) } : null,
  })
  const onLuna = (a: LunaAction) => {
    if (a.type === 'select') { if (a.rank >= 1 && a.rank <= top.length) setSel(a.rank - 1); return }
    const q = a.params
    const start = typeof q.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.start) && q.start >= '2026-11-01' && q.start <= '2028-11-30' ? q.start : p.start
    const next: Params = { start, windowDays: clamp(q.windowDays, 5, 90, p.windowDays), days: clamp(q.days, 1, 30, p.days),
      sun: clamp(q.sun, 0, 100, p.sun), earth: clamp(q.earth, 0, 100, p.earth), shadow: clamp(q.shadow, 0, 240, p.shadow),
      batt: clamp(q.batt, 500, 20000, p.batt), slope: clamp(q.slope, 2, 20, p.slope),
      zone: [0, 100, 250, 500, 1000].includes(q.zone as number) ? (q.zone as number) : p.zone, zslope: clamp(q.zslope, 2, 30, p.zslope), dsn: typeof q.dsn === 'boolean' ? q.dsn : p.dsn }
    setP(next)
    run(next)
  }

  const events = (() => {
    if (!detail) return []
    const out: { h: number; kind: 'sunset' | 'sunrise' | 'earthset' | 'earthrise' }[] = []
    for (let j = 1; j < detail.len; j++) {
      const k = detail.a + j
      const s0 = detail.series.sunFraction[k - 1] >= 0.5, s1 = detail.series.sunFraction[k] >= 0.5
      const e0 = detail.series.earthVisible[k - 1], e1 = detail.series.earthVisible[k]
      if (s0 !== s1) out.push({ h: j, kind: s1 ? 'sunrise' : 'sunset' })
      if (e0 !== e1) out.push({ h: j, kind: e1 ? 'earthrise' : 'earthset' })
    }
    return out
  })()
  const EV = { sunrise: { en: 'Sunrise', tr: 'Güneş doğuyor' }, sunset: { en: 'Sun goes behind terrain', tr: 'Güneş arazinin arkasına geçiyor' },
    earthrise: { en: 'Earth link back', tr: 'Dünya bağlantısı geri' }, earthset: { en: 'Earth link lost', tr: 'Dünya bağlantısı kesiliyor' } }

  const enter = (mode: DriveMode) => {
    if (!pick || !detail || !ran) return
    setDrive({ mode, start: { x: atlas.xKm[pick.index] * 1000, y: atlas.yKm[pick.index] * 1000, hour: detail.fh + detail.a,
      missionH: detail.len, startMs: startDate(pick.bestStart).getTime(),
      label: `${siteName(pick)} · ${fmtDate(startDate(pick.bestStart))}` } })
  }

  const loc = lang === 'tr' ? 'tr-TR' : 'en-US'
  const place = (r: PointResult) => describePlace(r.lat, ((r.lon % 360) + 360) % 360, feats, lang)?.text
  const coords = (r: PointResult) => `${r.lat.toFixed(2)}°, ${(((r.lon % 360) + 360) % 360).toFixed(1)}°E`
  const siteName = (r: PointResult) => region(r) ?? place(r) ?? coords(r)
  const preset = PRESETS.find((pr) => p.days === pr.days && p.sun === pr.sun && p.batt === pr.batt)?.id ?? 'custom'

  return (
    <div className={`app ${drive ? 'driving' : ''}`}>
      {drive && eph && dsn && (
        <Suspense fallback={<div className="drive"><div className="drive-loading">…</div></div>}>
          <Drive start={drive.start} eph={eph} dsn={dsn} lang={lang} initialMode={drive.mode} onExit={() => setDrive(null)} />
        </Suspense>
      )}
      <header className="nav">
        <a className="logo" href="#top"><MoonStar size={18} strokeWidth={2} /> LunaNav</a>
        <nav className="nav-links">
          <a href="#results">{S.navResults[lang]}</a>
          <a href="#site">{S.navSite[lang]}</a>
          <a href="#method">{S.navMethod[lang]}</a>
        </nav>
        <div className="nav-r">
          <div className="seg" role="group" aria-label="Language">
            {(['en', 'tr'] as Lang[]).map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={16} /></a>
        </div>
      </header>

      <div className="shell" id="top">
        <aside className="side">
          <div className="side-head">
            <h1>{S.hero[lang]}</h1>
            <p>{S.sub[lang]}</p>
          </div>
          <div className="group">
            <div className="group-label">{S.mission[lang]}</div>
            <div className="seg full">
              {PRESETS.map((pr) => (
                <button key={pr.id} title={pr.name[lang]} className={preset === pr.id ? 'on' : ''}
                        onClick={() => setP((o) => ({ ...o, days: pr.days, sun: pr.sun, earth: pr.earth, shadow: pr.shadow, batt: pr.batt }))}>
                  {pr.short[lang]}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <div className="group-label">{S.window[lang]}</div>
            <div className="pair">
              <input className="input" type="date" value={p.start} min="2026-11-01" max="2028-11-30" onChange={(e) => e.target.value && set('start', e.target.value)} />
              <NumberInput v={p.windowDays} min={5} max={90} step={5} on={(v) => set('windowDays', v)} unit={S.days[lang]} />
            </div>
          </div>
          <div className="group">
            <div className="group-label">{S.requirements[lang]}</div>
            <Field label={S.stay[lang]} v={p.days} min={1} max={30} on={(v) => set('days', v)} unit={S.days[lang]} />
            <Field label={S.needSun[lang]} v={p.sun} min={0} max={100} step={5} on={(v) => set('sun', v)} unit="%" />
            <Field label={S.needEarth[lang]} v={p.earth} min={0} max={100} step={5} on={(v) => set('earth', v)} unit="%" />
            <Field label={S.maxShadow[lang]} v={p.shadow} min={0} max={240} step={6} on={(v) => set('shadow', v)} unit="h" />
            <Field label={S.battery[lang]} v={p.batt} min={500} max={20000} step={500} on={(v) => set('batt', v)} unit="Wh" />
            <Field label={S.slope[lang]} v={p.slope} min={2} max={20} on={(v) => set('slope', v)} unit="°" />
            <label className="checkbox"><input type="checkbox" checked={p.dsn} onChange={(e) => set('dsn', e.target.checked)} /><span>{S.dsn[lang]}</span></label>
          </div>
          {hazard && (
            <div className="group">
              <div className="group-label">{S.touchdown[lang]}</div>
              <div className="field">
                <div className="field-top"><label>{S.zoneRadius[lang]}</label></div>
                <div className="seg full">
                  {[0, ...hazard.radii].map((z) => (
                    <button key={z} className={p.zone === z ? 'on' : ''} onClick={() => set('zone', z)}>
                      {z === 0 ? S.zoneOff[lang] : z >= 1000 ? `${z / 1000} km` : `${z} m`}
                    </button>
                  ))}
                </div>
              </div>
              {p.zone > 0 && <Field label={S.zoneSlope[lang]} v={p.zslope} min={2} max={30} on={(v) => set('zslope', v)} unit="°" />}
              <p className="meta">{S.zoneHint[lang]}</p>
            </div>
          )}
          <div className="side-foot">
            <button className="btn primary block" disabled={progress !== null} onClick={() => run(p)}>
              {progress !== null ? `${S.searching[lang]} ${Math.round(progress * 100)}%` : S.search[lang]}
            </button>
            {progress !== null && <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>}
            {ran && progress === null && (
              <p className="meta">{atlas.n.toLocaleString(loc)} {S.stats[lang]} · {(ran.hoursChecked / 1e6).toFixed(1)} M {S.hoursChecked[lang]} · {(ran.ms / 1000).toFixed(1)} {S.seconds[lang]}</p>
            )}
          </div>
        </aside>

        <main className="main">
          <section className="card map-card">
            <div className="map">
              <Suspense fallback={null}>
                <Globe poleCap={m.pole_cap} overlay={sunOverlay ?? overlay} pins={pins} earthLabel={lang === 'tr' ? 'Dünya' : 'Earth'}
                       selected={pick ? { lat: pick.lat, lon: pick.lon, label: `#${sel + 1}` } : null}
                       sunDir={sunDir} earthDir={earthDir} onPick={setSel} />
              </Suspense>
              <div className="map-tools">
                <div className="seg">
                  <button className={mapMode === 'results' ? 'on' : ''} onClick={() => { setMapMode('results'); setMapPlay(false) }}>{S.navResults[lang]}</button>
                  <button className={mapMode === 'sun' ? 'on' : ''} onClick={() => setMapMode('sun')}>{T.sunlight[lang]}</button>
                </div>
                {mapMode === 'sun' && ran && (
                  <div className="map-time">
                    <button className="icon-btn" onClick={() => setMapPlay(!mapPlay)} aria-label="Play">{mapPlay ? <Pause size={14} /> : <Play size={14} />}</button>
                    <input className="rng" type="range" min={0} max={Math.max(1, mapSpan - 1)} value={mapH}
                           style={{ ['--p' as string]: `${(mapH / Math.max(1, mapSpan - 1)) * 100}%` }}
                           onChange={(e) => { setMapPlay(false); setMapH(+e.target.value) }} />
                    <span className="num">{new Date((m.start_unix + mapHour * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
                  </div>
                )}
              </div>
              <div className="map-legend">
                {mapMode === 'results' ? (
                  <>
                    <span><i className="sw go" />{S.legGo[lang]}</span>
                    <span><i className="sw nogo" />{S.legNo[lang]}</span>
                    <span><i className="sw none" />{S.legSteep[lang]}</span>
                  </>
                ) : (
                  <>
                    <span><i className="sw lit" />{lang === 'tr' ? 'Güneş görüyor' : 'In sunlight'}</span>
                    <span><i className="sw dark" />{lang === 'tr' ? 'Gölgede' : 'In shadow'}</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {results && ran && (
            <section className="card" id="results">
              <div className="card-head">
                <div>
                  <h2>{S.results[lang]}</h2>
                  <p className="sub">{S.resultsSub[lang]}</p>
                </div>
                <div className="actions">
                  <button className="btn" onClick={() => download(`lunanav-${ran.q.start}.csv`, toCsv(rows))}><Download size={14} /> CSV</button>
                  <button className="btn" onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(reportHtml(cmpRows.length >= 2 ? cmpRows : rows, ran.q, constraints(ran.q)!, m.sources, lang)); w.document.close() }
                  }}><Printer size={14} /> {S.report[lang]}</button>
                </div>
              </div>
              {top.length === 0 || top[0].goCount === 0 ? <div className="empty">{S.nothing[lang]}</div> : null}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="c-cmp" title={S.compare[lang]}><ArrowLeftRight size={13} /></th>
                      <th>#</th><th>{S.colSite[lang]}</th><th>{S.colGo[lang]}</th><th>{lang === 'tr' ? 'En iyi iniş' : 'Best landing'}</th>
                      <th className="num">{T.sunlight[lang]}</th><th className="num">{S.colEarth[lang]}</th><th className="num">{S.colSlope[lang]}</th>
                      {ran.q.zone > 0 && hazard && <th className="num" title={S.zoneSlope[lang]}>{S.colZone[lang]}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((r, k) => (
                      <tr key={r.index} className={k === sel ? 'sel' : ''} onClick={() => setSel(k)}>
                        <td className="c-cmp" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={cmp.includes(r.index)} aria-label={S.compare[lang]}
                                 onChange={() => setCmp((c) => c.includes(r.index) ? c.filter((x) => x !== r.index) : [...c, r.index].slice(-4))} />
                        </td>
                        <td className="rank">{k + 1}</td>
                        <td><div className="site">{siteName(r)}</div><div className="sub">{region(r) && place(r) ? `${place(r)} · ` : ''}{coords(r)}</div></td>
                        <td>
                          <div className="go-cell">
                            <span className="meter"><i className={r.goCount > 0 ? 'go' : 'nogo'} style={{ width: `${Math.max(4, (r.goCount / ran.q.windowDays) * 100)}%` }} /></span>
                            <span className="num">{r.goCount}/{ran.q.windowDays}</span>
                          </div>
                        </td>
                        <td>{fmtDate(startDate(r.bestStart))}</td>
                        <td className="num">{Math.round(r.sunFrac * 100)}%</td>
                        <td className="num">{Math.round(r.commFrac * 100)}%</td>
                        <td className="num">{atlas.slope[r.index].toFixed(1)}°</td>
                        {ran.q.zone > 0 && hazard && <td className="num">{zoneSlopeAt(hazard, ran.q.zone, r.index)?.toFixed(1)}°</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cmpRows.length < 2 && <p className="hint">{S.compareHint[lang]}</p>}
            </section>
          )}

          {cmpRows.length >= 2 && <Compare rows={cmpRows} lang={lang} onClear={() => setCmp([])} />}

          {detail && ran && pick && (
            <>
              <section className="card" id="site">
                <div className="card-head">
                  <div>
                    <div className="eyebrow">{S.siteN[lang]}{pickRank ? ` ${pickRank}` : ''}{region(pick) ? ` · ${S.inRegion[lang]}` : ''}</div>
                    <h2>{siteName(pick)}</h2>
                    <p className="sub">{region(pick) && place(pick) ? `${place(pick)} · ` : ''}{pick.lat.toFixed(3)}°, {(((pick.lon % 360) + 360) % 360).toFixed(3)}°E · {S.bestDate[lang]} {fmtDate(startDate(pick.bestStart))} · {ran.q.days} {S.days[lang]} ·{' '}
                      {lang === 'tr' ? 'eğim' : 'slope'} {atlas.slope[pick.index].toFixed(1)}° · {lang === 'tr' ? 'yükseklik' : 'height'} {atlas.height[pick.index].toLocaleString(loc)} m</p>
                  </div>
                  <div className="actions">
                    <button className="btn" onClick={() => {
                      const u = new URL(location.href)
                      u.hash = u.hash.replace(/&site=\d+/, '') + `&site=${pick.index}`
                      navigator.clipboard?.writeText(u.toString()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
                    }}><Link2 size={14} /> {copied ? (lang === 'tr' ? 'Kopyalandı' : 'Copied') : (lang === 'tr' ? 'Bağlantı' : 'Copy link')}</button>
                    <button className="btn" onClick={() => enter('lander')}><PlaneLanding size={14} /> {S.standHere[lang]}</button>
                    <button className="btn" onClick={() => enter('rover')}><Car size={14} /> {S.driveHere[lang]}</button>
                  </div>
                </div>
                <div className={`verdict-row ${detail.w.go ? 'go' : 'nogo'}`}>
                  <span className={`badge ${detail.w.go ? 'go' : 'nogo'}`}>{detail.w.go ? 'GO' : 'NO-GO'}</span>
                  <p>{why(detail.w, 1, detail.c, lang)}</p>
                </div>
                {(() => {
                  const zs = zoneSlopeAt(hazard, ran.q.zone, pick.index)
                  if (zs === null) return null
                  const zLabel = ran.q.zone >= 1000 ? `${ran.q.zone / 1000} km` : `${ran.q.zone} m`
                  return (
                    <p className="touchdown"><Mountain size={13} />{' '}
                      {lang === 'tr'
                        ? `İniş alanı (${zLabel} yarıçap): alanın %95’i ${zs.toFixed(1)}°’den az eğimli (LOLA 40 m), sınır ${ran.q.zslope}°.`
                        : `Touchdown zone (${zLabel} radius): 95% of it is gentler than ${zs.toFixed(1)}° (LOLA 40 m slopes), limit ${ran.q.zslope}°.`}
                    </p>
                  )
                })()}
                <div className="stats">
                  <Stat icon={<Sun size={14} />} label={T.sunlight[lang]} value={fmtPct(detail.w.sunFrac, lang)} need={`≥ ${ran.q.sun}%`}
                        frac={detail.w.sunFrac} ok={detail.w.sunFrac >= detail.c.min_sun_frac} />
                  <Stat icon={<Earth size={14} />} label={S.colEarth[lang]} value={fmtPct(detail.w.commFrac, lang)} need={`≥ ${ran.q.earth}%${ran.q.dsn ? ' · DSN' : ''}`}
                        frac={detail.w.commFrac} ok={detail.w.commFrac >= detail.c.min_comm_frac} />
                  <Stat icon={<MoonStar size={14} />} label={S.longestDark[lang]} value={hours(detail.w.longestDarkH, lang)} need={`≤ ${ran.q.shadow} h`}
                        frac={Math.min(1, detail.w.longestDarkH / Math.max(1, ran.q.shadow))} ok={detail.w.longestDarkH <= detail.c.max_dark_hours} invert />
                  <Stat icon={<BatteryMedium size={14} />} label={T.battery[lang]} ok={detail.w.survived}
                        value={detail.w.survived ? T.lasts[lang] : `${lang === 'tr' ? 'Biter' : 'Empty at'} ${hours(detail.w.power.firstFailure ?? 0, lang)}`}
                        need={detail.need === 0 ? (lang === 'tr' ? 'gece yok' : 'no night to bridge') : `${Math.round(detail.need).toLocaleString(loc)} Wh ${lang === 'tr' ? 'gerekli' : 'needed'}`}
                        frac={detail.need === 0 ? 0 : Math.min(1, detail.need / ran.q.batt)} invert />
                </div>
                {nearby.length > 0 && (
                  <div className="nearby">
                    <span className="nearby-label"><MapPin size={13} /> {lang === 'tr' ? 'Yakında daha iyisi var' : 'Better spots nearby'}</span>
                    {nearby.map(({ r, d }) => (
                      <button key={r.index} className="chip-btn" onClick={() => setPinned(r)}>
                        {d.toFixed(1)} km · {siteName(r)} · <b>{r.goCount}/{ran.q.windowDays}</b> {lang === 'tr' ? 'tarih' : 'dates'}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <div className="card-head"><div><h2>{S.otherDates[lang]}</h2><p className="sub">{S.otherDatesSub[lang]}</p></div></div>
                <div className="calendar">
                  {detail.perStart.map((go, s) => (
                    <span key={s} className={`${go ? 'go' : 'nogo'} ${s === pick.bestStart ? 'best' : ''}`} title={fmtDate(startDate(s))}>
                      {startDate(s).getUTCDate()}
                    </span>
                  ))}
                </div>
                {events.length > 0 && (
                  <>
                    <h3 className="sec">{lang === 'tr' ? 'Görev olayları' : 'Mission events'}</h3>
                    <ul className="events">
                      {events.slice(0, 12).map((e, k) => (
                        <li key={k}><span className={`ev ${e.kind}`} /><b>{lang === 'tr' ? 'Gün' : 'Day'} {Math.floor(e.h / 24) + 1}, {String(e.h % 24).padStart(2, '0')}:00</b>{EV[e.kind][lang]}</li>
                      ))}
                      {events.length > 12 && <li className="more">+{events.length - 12}</li>}
                    </ul>
                  </>
                )}
                <h3 className="sec">{T.dayByDay[lang]}</h3>
                <DayStrip sun={Array.from({ length: detail.len }, (_, j) => detail.series.sunFraction[detail.a + j] >= 0.5)}
                          earth={Array.from({ length: detail.len }, (_, j) => detail.series.earthVisible[detail.a + j])}
                          link={Array.from({ length: detail.len }, (_, j) => detail.tr.link[detail.a + j])} lang={lang} />
                {eclipses.filter((e) => e.endH >= detail.fh + detail.a && e.startH <= detail.fh + detail.a + detail.len).map((e) => {
                  const when = new Date((m.start_unix + e.peakH * 3600) * 1000)
                  return (
                    <div key={e.startH} className="alert"><AlertTriangle size={15} /><span>{lang === 'tr'
                      ? `Tutulma ${fmtDate(when)}: Dünya Güneş'in %${Math.round(e.peak * 100)}'ini kapatıyor, ${(e.endH - e.startH).toFixed(1).replace('.', ',')} saat${e.totalH > 0 ? ` (${e.totalH.toFixed(1).replace('.', ',')} saat tam karanlık)` : ''}. Arama motoru bunu hesaba katmaz; bataryayı buna göre seçin.`
                      : `Eclipse on ${fmtDate(when)}: Earth covers ${Math.round(e.peak * 100)}% of the Sun for ${(e.endH - e.startH).toFixed(1)} h${e.totalH > 0 ? ` (${e.totalH.toFixed(1)} h of total darkness)` : ''}. The search does not include eclipses; size the battery for it.`}</span></div>
                  )
                })}
                <p className="hint">{T.dsnNote[lang]}</p>
              </section>

              <HorizonView horizon={detail.tr.horizon} series={detail.series} i0={detail.a} len={detail.len} stepH={1}
                           startMs={startDate(pick.bestStart).getTime()} lang={lang} />
              {eph && dsn && (
                <YearView atlas={atlas} eph={eph} dsn={dsn} index={pick.index} c={detail.c} days={ran.q.days} needDsn={ran.q.dsn}
                          startUnix={m.start_unix} lang={lang} current={startDate(pick.bestStart).toISOString().slice(0, 10)}
                          onPick={(d) => { const next = { ...p, start: d }; setP(next); run(next); scrollTo({ top: 0, behavior: 'smooth' }) }} />
              )}
            </>
          )}

          <section className="card" id="method">
            <div className="card-head"><div><h2>{S.navMethod[lang]}</h2></div></div>
            <ol className="steps">
              {STEPS[lang].map((s, k) => <li key={k}><b>{s[0]}</b><span>{s[1]}</span></li>)}
            </ol>
            <p className="hint">{m.sources.join(' · ')}</p>
            <div className="links">
              <a href={REPO_URL} target="_blank" rel="noreferrer">{T.source[lang]} · GitHub ↗</a>
              <a href={PLANNER_URL} target="_blank" rel="noreferrer">{T.planner[lang]} ↗</a>
            </div>
          </section>
        </main>
      </div>
      <Luna lang={lang} context={lunaContext} onAction={onLuna} />
    </div>
  )
}

function Compare({ rows, lang, onClear }: { rows: SiteRow[]; lang: Lang; onClear: () => void }) {
  const tr = lang === 'tr'
  // metric, value, higher-is-better (null = no ranking)
  const lines: [string, (r: SiteRow) => string, ((r: SiteRow) => number) | null, boolean][] = [
    [tr ? 'Uygun iniş tarihleri' : 'GO landing dates', (r) => `${r.goDates} / ${r.windowDays}`, (r) => r.goDates, true],
    [tr ? 'En iyi iniş' : 'Best landing', (r) => `${r.bestLanding} · ${r.go ? 'GO' : 'NO-GO'}`, null, true],
    [tr ? 'Güneş ışığı' : 'Sunlight', (r) => `${r.sunPct}%`, (r) => r.sunPct, true],
    [tr ? 'Dünya bağlantısı' : 'Earth contact', (r) => `${r.earthPct}%`, (r) => r.earthPct, true],
    [tr ? 'En uzun karanlık' : 'Longest dark', (r) => `${r.longestDarkH} h`, (r) => r.longestDarkH, false],
    [tr ? 'Gereken batarya' : 'Battery needed', (r) => `${r.batteryNeedWh.toLocaleString()} Wh`, (r) => r.batteryNeedWh, false],
    [tr ? 'Eğim' : 'Slope', (r) => `${r.slopeDeg.toFixed(1)}°`, (r) => r.slopeDeg, false],
    [tr ? 'Yükseklik' : 'Height', (r) => `${r.heightM} m`, null, true],
  ]
  return (
    <section className="card compare">
      <div className="card-head"><div><h2>{S.compareTitle[lang]}</h2></div><div className="actions"><button className="btn" onClick={onClear}>{S.clear[lang]}</button></div></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th />{rows.map((r) => <th key={r.index}>#{r.rank}<small>{r.region ?? `${r.lat.toFixed(2)}°, ${r.lon.toFixed(1)}°E`}</small></th>)}</tr></thead>
        <tbody>
          {lines.map(([name, show, score, up]) => {
            const vals = score ? rows.map(score) : []
            const best = score ? (up ? Math.max(...vals) : Math.min(...vals)) : NaN
            return (
              <tr key={name}><td>{name}</td>
                {rows.map((r, k) => <td key={r.index} className={score && vals[k] === best && new Set(vals).size > 1 ? 'best' : ''}>{show(r)}</td>)}
              </tr>
            )
          })}
          <tr><td>{tr ? 'Gün gün güneş' : 'Sun, day by day'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.sunDaily.map((v, d) => <i key={d} style={{ background: `rgba(242,183,5,${0.1 + 0.9 * v})` }} />)}</span></td>)}</tr>
          <tr><td>{tr ? 'Gün gün bağlantı' : 'Link, day by day'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.earthDaily.map((v, d) => <i key={d} style={{ background: `rgba(78,168,222,${0.1 + 0.9 * v})` }} />)}</span></td>)}</tr>
          <tr><td>{tr ? 'Tarih takvimi' : 'Landing dates'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.perStart.map((g, d) => <i key={d} className={g ? 'g' : 'r'} />)}</span></td>)}</tr>
        </tbody>
      </table></div>
    </section>
  )
}

function NumberInput({ v, min, max, step = 1, on, unit }: { v: number; min: number; max: number; step?: number; on: (v: number) => void; unit: string }) {
  const [txt, setTxt] = useState(String(v))
  useEffect(() => setTxt(String(v)), [v])
  const commit = () => { const n = Number(txt); if (Number.isFinite(n)) on(Math.min(max, Math.max(min, Math.round(n / step) * step))); else setTxt(String(v)) }
  return (
    <span className="num-input">
      <input inputMode="numeric" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit}
             onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); on(Math.min(max, Math.max(min, v + (e.key === 'ArrowUp' ? step : -step)))) } }} />
      <em>{unit}</em>
    </span>
  )
}

function Field({ label, v, min, max, step = 1, on, unit }: { label: string; v: number; min: number; max: number; step?: number; on: (v: number) => void; unit: string }) {
  return (
    <div className="field">
      <div className="field-top"><label>{label}</label><NumberInput v={v} min={min} max={max} step={step} on={on} unit={unit} /></div>
      <input className="rng" type="range" min={min} max={max} step={step} value={v} aria-label={label}
             style={{ ['--p' as string]: `${((v - min) / (max - min)) * 100}%` }} onChange={(e) => on(+e.target.value)} />
    </div>
  )
}

function Stat({ icon, label, value, need, frac, ok, invert }: { icon: React.ReactNode; label: string; value: string; need: string; frac: number; ok: boolean; invert?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{icon}{label}<span className={`dot ${ok ? 'ok' : 'bad'}`} /></div>
      <div className="stat-value">{value}</div>
      <div className="stat-bar"><i className={ok ? 'ok' : 'bad'} style={{ width: `${Math.max(2, Math.min(1, frac) * 100)}%`, opacity: invert ? 0.6 : 1 }} /></div>
      <div className="stat-need">{need}</div>
    </div>
  )
}

function DayStrip({ sun, earth, link, lang }: { sun: boolean[]; earth: boolean[]; link: boolean[]; lang: Lang }) {
  const days = Math.floor(sun.length / 24)
  const share = (a: boolean[], d: number) => a.slice(d * 24, d * 24 + 24).filter(Boolean).length / 24
  const rows: [string, string, boolean[]][] = [[T.sunUp[lang], '229,165,10', sun], [T.earthUp[lang], '59,130,246', earth],
    [T.radio[lang], '34,197,94', link]]
  return (
    <div className="strip" style={{ ['--days' as string]: days }}>
      {rows.map(([label, rgb, a]) => (
        <div className="strip-row" key={label}>
          <span>{label}</span>
          {Array.from({ length: days }, (_, d) => <i key={d} style={{ background: `rgba(${rgb},${0.08 + 0.92 * share(a, d)})` }} />)}
        </div>
      ))}
    </div>
  )
}
