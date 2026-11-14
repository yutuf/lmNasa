import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { dataUrl, FIRST_DATE, LAST_DATE, loadManifest, type Manifest, type Series } from './data'
import { gcKm, insideRing, parseAtlas, parseGlobalAtlas, parseEphem, parseHazard, parseIceReach, passesIce, passesTerrain, pointTrack, searchPoint, sunlitMap, zoneSlopeAt, type Atlas, type Hazard, type IceReach, type PointResult } from './engine'
import { T, fmtPct, hours, why, type Lang } from './i18n'
import { evaluateWindow, requiredBatteryWh, type Constraints } from './model'
import { EngineRunner } from './runner'
import { chooseApproach, PHASES } from './flight'
import { artemisRows, goRun } from './artemis'
import { SCENARIOS, matchScenario, rankTop, summarise, type ScenarioOutcome } from './scenarios'
import { listEclipses } from './eclipse'
import { describePlace, type Feature } from './places'
import YearView from './components/YearView'
import { download, reportHtml, siteRow, toCsv, type SiteRow } from './report'
import HorizonView from './components/HorizonView'
import Luna, { type LunaAction } from './components/Luna'
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Footprints, Sparkles, Wrench, MoonStar as NightIcon, Snowflake, Timer, Users, Hourglass, Satellite, Droplets, FlaskConical, Rocket, X, Mountain, Link2, MapPin, Pause, Play, BatteryMedium, Car, Download, Earth, Github, MoonStar, PlaneLanding, Printer, QrCode, Scale, Sun } from 'lucide-react'
import type { FlightView, Overlay, Pin, Target } from './components/Globe'
import type { DriveMode, DriveStart } from './components/Drive'

const Globe = lazy(() => import('./components/Globe'))
const Drive = lazy(() => import('./components/Drive'))
const TradeOff = lazy(() => import('./components/TradeOff'))
const ArtemisCompare = lazy(() => import('./components/Artemis'))
import Patch from './components/Patch'
import SimpleView from './components/SimpleView'
import { MissionBar, Ticker, type NextWindow } from './components/MissionBar'
import SiteProfile from './components/SiteProfile'
import MissionStory from './components/MissionStory'
import MissionFilm from './components/MissionFilm'
import Workshop from './components/Workshop'
import DecisionLab from './components/DecisionLab'
import { ellipseCheck } from './ellipse'
import type { Budget, Design } from './workshop'
import { successProbability } from './probability'
import ProbabilityPanel from './components/ProbabilityPanel'
import { launchDate, missionStory } from './story'
import type { CardSite } from './components/SiteCard'
import { regionColour } from './teams'
import { ROVERS, landerById, type Lander } from './vehicles'
import { SCIENCE_KIND, SCIENCE_SITES, farSide, inPoleGrid, targetSites, type ScienceKind, type ScienceSite } from './scienceSites'
import { paintOverlay } from './overlays'
import ScopeTarget from './components/ScopeTarget'
import { localSky } from './terrain'

// Independent checks, each one in the tests or the build scripts (see README and docs/HACKATHON_PLAN.md).
const VALIDATION: Record<Lang, [string, string][]> = {
  en: [
    ['Sunlight vs NASA’s own illumination maps (Mazarico et al. 2011), 32 points', 'median +1.9 pts, r = 0.96'],
    ['Touchdown slopes vs LOLA’s official 40 m slope map, 6,620 points', 'median 1.15°, r = 0.94'],
    ['Earth position with parallax vs independent JPL DE440 runs', 'within 0.018°'],
    ['Fast horizon vs full-resolution horizon, 27 sites', 'sunlight within 0.5 pts (median)'],
    ['This browser engine vs the Python reference, 18 cases', 'identical'],
    ['Eclipses seen from the Moon vs NASA’s eclipse catalogue, 2027–2028', 'all found'],
  ],
  tr: [
    ['Güneş ışığı ve NASA’nın kendi aydınlanma haritaları (Mazarico vd. 2011), 32 nokta', 'medyan +1,9 puan, r = 0,96'],
    ['İniş eğimleri ve LOLA’nın resmi 40 m eğim haritası, 6.620 nokta', 'medyan 1,15°, r = 0,94'],
    ['Paralaks dahil Dünya konumu ve bağımsız JPL DE440 hesapları', '0,018° içinde'],
    ['Hızlı ufuk ve tam çözünürlüklü ufuk, 27 nokta', 'güneş 0,5 puan içinde (medyan)'],
    ['Tarayıcı motoru ve Python referansı, 18 durum', 'birebir aynı'],
    ['Ay’dan görülen tutulmalar ve NASA tutulma kataloğu, 2027–2028', 'hepsi bulundu'],
  ],
}

const SC_ICON: Record<string, React.ReactNode> = {
  lander: <Satellite size={14} className="sc-icon" />, crew: <Users size={14} className="sc-icon" />,
  rover: <Snowflake size={14} className="sc-icon" />, long: <Hourglass size={14} className="sc-icon" />,
  sprint: <Timer size={14} className="sc-icon" />, night: <NightIcon size={14} className="sc-icon" />,
}

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
  science: { en: 'Science: water ice', tr: 'Bilim: su buzu' },
  iceWithin: { en: 'An ice cold trap within', tr: 'Şu mesafede buz soğuk tuzağı' },
  iceHint: { en: 'Permanently shadowed ground where LRO Diviner says water ice is stable within 1 m of the surface: what a rover or drill could reach.', tr: 'LRO Diviner’a göre su buzunun yüzeyin 1 m altında kararlı olduğu kalıcı gölgeli zemin: bir gezginin veya matkabın ulaşabileceği yer.' },
  colIce: { en: 'Nearest ice', tr: 'En yakın buz' },
  validTitle: { en: 'How we know the numbers are right', tr: 'Sayıların doğru olduğunu nasıl biliyoruz' },
  rerun: { en: 'Run search · settings changed', tr: 'Aramayı çalıştır · ayarlar değişti' },
  guideTitle: { en: 'How to use LunaNav', tr: 'LunaNav nasıl kullanılır' },
  guide1: { en: 'Pick a mission scenario (or set your own requirements)', tr: 'Bir görev senaryosu seçin (veya kendi gereksinimlerinizi girin)' },
  guide2: { en: 'Run the search: 21,856 points, every landing date, in seconds', tr: 'Aramayı çalıştırın: 21.856 nokta, her iniş tarihi, saniyeler içinde' },
  guide3: { en: 'Open a site: verdict, touchdown zone, spacecraft route, stand on the lander', tr: 'Bir nokta açın: karar, iniş alanı, uzay aracı rotası, iniş aracında durun' },
  guideTip: { en: 'Or compare every scenario at once, or describe your mission to Luna.', tr: 'Ya da tüm senaryoları birlikte karşılaştırın veya görevinizi Luna’ya anlatın.' },
  openSource: { en: 'Open source on GitHub', tr: 'GitHub’da açık kaynak' },
  route: { en: 'Route', tr: 'Rota' },
  phCoast: { en: 'Earth → Moon', tr: 'Dünya → Ay' },
  phOrbit: { en: 'Lunar orbit', tr: 'Ay yörüngesi' },
  phDescent: { en: 'Descent', tr: 'İniş' },
  phLanded: { en: 'Touchdown', tr: 'Yere değdi' },
  camOverview: { en: 'Overview', tr: 'Genel' },
  camChase: { en: 'Chase', tr: 'Takip' },
  camPilot: { en: 'Pilot', tr: 'Pilot' },
  camSite: { en: 'From the site', tr: 'İniş yerinden' },
  camLabel: { en: 'Camera', tr: 'Kamera' },
  custom: { en: 'Custom settings: change any requirement below.', tr: 'Özel ayarlar: aşağıdaki gereksinimleri değiştirebilirsiniz.' },
  simulate: { en: 'Simulate all scenarios', tr: 'Tüm senaryoları simüle et' },
  simTitle: { en: 'Scenario simulation', tr: 'Senaryo simülasyonu' },
  simSub: { en: 'Every mission scenario, same landing window, same 21,856 points. Click a row to open that scenario.', tr: 'Her görev senaryosu, aynı iniş penceresi, aynı 21.856 nokta. Senaryoyu açmak için satıra tıklayın.' },
  simScenario: { en: 'Scenario', tr: 'Senaryo' },
  simGoSites: { en: 'Sites GO at least once', tr: 'En az bir kez uygun nokta' },
  simBest: { en: 'Best site', tr: 'En iyi nokta' },
  simNone: { en: 'no site passes', tr: 'uygun nokta yok' },
  zoneRadius: { en: 'Landing zone radius', tr: 'İniş alanı yarıçapı' },
  zoneOff: { en: 'Off', tr: 'Kapalı' },
  zoneSlope: { en: '95% of the zone gentler than', tr: 'Alanın %95’i şundan az eğimli' },
  zoneHint: { en: 'LOLA 40 m slopes inside the circle the lander may touch down in. 100 m ≈ precision landing, 1 km ≈ a typical robotic lander.', tr: 'İniş aracının konabileceği daire içindeki LOLA 40 m eğimleri. 100 m ≈ hassas iniş, 1 km ≈ tipik robotik iniş aracı.' },
  colZone: { en: 'Zone slope', tr: 'Alan eğimi' },
  dsn: { en: 'Earth contact needs a NASA DSN dish too', tr: 'Dünya bağlantısı NASA DSN anteni de gerektirsin' },
  relay: { en: 'A relay satellite (ELFO) also counts as contact: needed on the far side and in deep shadow', tr: 'Röle uydusu (ELFO) da bağlantı sayılsın: uzak yüzde ve derin gölgede gerekli' },
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


interface Params { start: string; windowDays: number; days: number; sun: number; earth: number; shadow: number; batt: number; slope: number; zone: number; zslope: number; ice: number; dsn: boolean; relay: boolean; lander: string; rover: string; scope: 'pole' | 'moon'; target: string; landing: 'soft' | 'rough' }

const DEF = SCENARIOS[0]

function readHash(): { ui: 'simple' | 'advanced'; lang: Lang; p: Params } {
  const q = new URLSearchParams(location.hash.slice(1))
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return {
    ui: q.get('ui') === 'advanced' ? 'advanced' as const : 'simple' as const,
    lang: q.get('lang') === 'tr' ? 'tr' : 'en',
    p: { start: [q.get('start') ?? '2027-09-01'].map((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) && s >= FIRST_DATE && s <= LAST_DATE ? s : '2027-09-01'))[0], windowDays: num('window', 30), days: num('days', DEF.days), sun: num('sun', DEF.sun),
      earth: num('earth', DEF.earth), shadow: num('shadow', DEF.shadow), batt: num('batt', DEF.batt), slope: num('slope', 8),
      zone: [num('zone', DEF.zone)].map((z) => ([0, 100, 250, 500, 1000].includes(z) ? z : DEF.zone))[0], zslope: num('zslope', DEF.zslope),
      ice: [num('ice', DEF.ice)].map((v) => ([0, 2, 5, 10].includes(v) ? v : 0))[0], dsn: q.get('dsn') !== '0', relay: q.get('relay') === '1',
      lander: landerById(q.get('lander') ?? 'nova').id, rover: ROVERS.find((r) => r.id === q.get('rover'))?.id ?? 'viper',
      landing: q.get('landing') === 'rough' ? 'rough' : 'soft',
      scope: q.get('scope') === 'moon' ? 'moon' : 'pole', target: targetSites(q.get('target') ?? '').length ? q.get('target')! : '' },
  }
}

export default function App() {
  const init = readHash()
  const [lang, setLang] = useState<Lang>(init.lang)
  const [ui, setUi] = useState<'simple' | 'advanced'>(init.ui)
  const [profile, setProfile] = useState<CardSite | null>(null)
  const [story, setStory] = useState(false)
  const [film, setFilm] = useState(() => /(^|[#&])film=1/.test(location.hash))
  const [workshop, setWorkshop] = useState(false)
  const [lab, setLab] = useState(false)
  const [customName, setCustomName] = useState<string | null>(null)
  const [withRecord, setWithRecord] = useState(true)
  const [rankBy, setRankBy] = useState<'go' | 'prob'>('go')   // include the landing record in the success probability
  const [pendingDrive, setPendingDrive] = useState<DriveMode | null>(null)
  const enterRef = useRef<(m: DriveMode) => void>(() => {})
  const [p, setP] = useState<Params>(init.p)
  const [m, setM] = useState<Manifest | null>(null)
  const [atlasPole, setAtlas] = useState<Atlas | null>(null)
  const [hazardData, setHazard] = useState<Hazard | null>(null)
  const [iceData, setIce] = useState<IceReach | null>(null)
  // the whole-Moon grid is loaded only when that scope is first chosen
  const [atlasMoon, setAtlasMoon] = useState<Atlas | null>(null)
  const moonRef = useRef<Promise<{ atlas: Atlas; runner: EngineRunner }> | null>(null)
  const [results, setResults] = useState<PointResult[] | null>(null)
  const [ran, setRan] = useState<{ q: Params; asked: Params; ms: number; hoursChecked: number } | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [sel, setSelRaw] = useState(0)
  const [pinned, setPinned] = useState<PointResult | null>(null)
  const initSite = useRef<number | null>(Number(new URLSearchParams(location.hash.slice(1)).get('site')) || null)
  const setSel = (k: number) => { setPinned(null); setSelRaw(k) }
  const [copied, setCopied] = useState(false)
  const [mapMode, setMapMode] = useState<'results' | 'sun' | 'route'>('results')
  const [flightView, setFlightView] = useState<FlightView>('overview')
  const [mapH, setMapH] = useState(0)
  const [mapPlay, setMapPlay] = useState(false)
  const siteIndex = pinned?.index ?? null
  const [dsn, setDsn] = useState<boolean[] | null>(null)
  const ephemRef = useRef<ArrayBuffer | null>(null)
  const runner = useRef<EngineRunner | null>(null)
  const [drive, setDrive] = useState<{ mode: DriveMode; start: DriveStart } | null>(null)
  const [cmp, setCmp] = useState<number[]>([])
  const [guide, setGuide] = useState(() => { try { return localStorage.getItem('lunanav-guide') !== 'hidden' } catch { return true } })
  const hideGuide = () => { setGuide(false); try { localStorage.setItem('lunanav-guide', 'hidden') } catch { /* private mode */ } }
  const [sim, setSim] = useState<{ start: string; windowDays: number; out: ScenarioOutcome[] } | null>(null)
  const [feats, setFeats] = useState<Feature[]>([])
  useEffect(() => { fetch(dataUrl('features.json')).then((r) => r.json()).then((j) => setFeats(j.features)).catch(() => {}) }, [])

  useEffect(() => {
    (async () => {
      const man = await loadManifest()
      const [a, e, d] = await Promise.all(['atlas.bin', 'ephem.bin', man.dsn].map((f) => fetch(dataUrl(f)).then((r) => r.arrayBuffer())))
      const [hz, sci] = await Promise.all(['hazard.bin', 'science.bin'].map((f) => fetch(dataUrl(f)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)))
      setIce(sci ? parseIceReach(sci) : null)
      ephemRef.current = e
      setHazard(hz ? parseHazard(hz) : null)
      setDsn(Array.from(new Uint8Array(d), (x) => x === 1))
      setAtlas(parseAtlas(a))
      runner.current = new EngineRunner(a, e, d, man.n, hz, sci)
      setM(man)
    })()
  }, [])
  useEffect(() => {
    history.replaceState(null, '', `#ui=${ui}&lang=${lang}&start=${p.start}&window=${p.windowDays}&days=${p.days}&sun=${p.sun}` +
      `&earth=${p.earth}&shadow=${p.shadow}&batt=${p.batt}&slope=${p.slope}&zone=${p.zone}&zslope=${p.zslope}&ice=${p.ice}&lander=${p.lander}&rover=${p.rover}&scope=${p.scope}&target=${p.target}&landing=${p.landing}&dsn=${p.dsn ? 1 : 0}${p.relay ? '&relay=1' : ''}` +
      (siteIndex !== null ? `&site=${siteIndex}` : ''))
  }, [ui, lang, p, siteIndex])  // eslint-disable-line react-hooks/exhaustive-deps

  const ensureMoon = () => (moonRef.current ??= fetch(dataUrl('global_atlas.bin')).then((r) => r.arrayBuffer()).then((b) => {
    const at = parseGlobalAtlas(b)
    setAtlasMoon(at)
    return { atlas: at, runner: new EngineRunner(b, ephemRef.current!, Uint8Array.from(dsn!, (x) => (x ? 1 : 0)).buffer, m!.n, null, null, 'moon') }
  }))
  // the scope of the results on screen decides which grid (and which polar-only layers) the page reads
  const scope = ran?.q.scope ?? p.scope
  const atlas = scope === 'moon' ? atlasMoon : atlasPole
  const hazard = scope === 'pole' ? hazardData : null
  const ice = scope === 'pole' ? iceData : null

  const constraints = (q: Params): Constraints | null => m && ({ ...m.constraints, duration_days: q.days,
    min_sun_frac: q.sun / 100, min_comm_frac: q.earth / 100, max_dark_hours: q.shadow, battery_wh: q.batt })

  const firstHour = (q: Params) => (m ? Math.round((Date.parse(q.start + 'T00:00:00Z') / 1000 - m.start_unix) / 3600) : 0)

  async function run(q: Params) {
    if (!m || !atlasPole || !runner.current || !dsn) return
    const moon = q.scope === 'moon' ? await ensureMoon() : null
    const at = moon ? moon.atlas : atlasPole
    const rn = moon ? moon.runner : runner.current
    const c = constraints(q)!
    const fh = firstHour(q)
    const nStarts = Math.max(1, Math.min(q.windowDays, Math.floor((m.n - fh - q.days * 24) / 24) + 1))
    if (fh < 0 || nStarts < 1) return
    setProgress(0)
    const t0 = performance.now()
    // the touchdown-zone and ice layers exist on the south-pole grid only
    const res = await rn.run(at.n, { firstHour: fh, nStarts, strideH: 24, durationH: q.days * 24,
      maxSlope: moon ? Math.max(q.slope, 12) : q.slope, needDsn: q.dsn, relay: q.relay, zone: moon ? 0 : q.zone, zoneSlope: q.zslope, iceKm: moon ? 0 : q.ice }, c, setProgress)
    setRan({ q: { ...q, windowDays: nStarts }, asked: q, ms: performance.now() - t0, hoursChecked: res.length * ((nStarts - 1) * 24 + q.days * 24) })
    setResults(res)
    setSel(0)
    if (initSite.current !== null) {
      const hit = res.find((r) => r.index === initSite.current)
      if (hit) setPinned(hit)
      initSite.current = null
    }
    setProgress(null)
  }
  // run every scenario over the current landing window and summarise each one
  async function simulate() {
    if (!m || !atlas || !runner.current) return
    const fh = firstHour(p)
    const out: ScenarioOutcome[] = []
    for (const [k, sc] of SCENARIOS.entries()) {
      const q: Params = { ...p, ...sc }
      const c = constraints(q)!
      const nStarts = Math.max(1, Math.min(q.windowDays, Math.floor((m.n - fh - q.days * 24) / 24) + 1))
      const t0 = performance.now()
      const res = await runner.current.run(atlas.n, { firstHour: fh, nStarts, strideH: 24, durationH: q.days * 24,
        maxSlope: q.slope, needDsn: q.dsn, relay: q.relay, zone: q.zone, zoneSlope: q.zslope, iceKm: q.ice }, c, (f) => setProgress((k + f) / SCENARIOS.length))
      out.push(summarise(sc.id, res, atlas, performance.now() - t0, nStarts))
    }
    setProgress(null)
    setSim({ start: p.start, windowDays: p.windowDays, out })
    setTimeout(() => document.getElementById('scenarios')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }
  useEffect(() => { if (m && atlasPole) run(p) }, [m, atlasPole])  // eslint-disable-line react-hooks/exhaustive-deps

  // ranking: most GO landing dates, then best score; keep picks at least 6 km apart
  // the mission's science target: one place, or every place serving a goal (target "kind:ice")
  const targets = useMemo(() => targetSites(ran?.q.target ?? ''), [ran])
  const targetSite = targets.length === 1 ? targets[0] : null
  const targetRangeKm = scope === 'moon' ? 80 : 20
  const nearestTarget = (r: PointResult) => targets.reduce<{ s: ScienceSite; d: number } | null>((best, s) => {
    const d = gcKm(r.lat, r.lon, s.lat, s.lon)
    return !best || d < best.d ? { s, d } : best
  }, null)
  const targetKm = (r: PointResult) => nearestTarget(r)?.d ?? null
  const top = useMemo(() => {
    if (!results || !atlas) return []
    if (targets.length) {
      // a science target: landing spots within a rover's reach of it (of the nearest one, for a goal), most GO dates
      // first, then the closest; picks kept apart so one place does not fill the list
      const near = [...results].map((r) => ({ r, d: targetKm(r)! })).filter((x) => x.d <= targetRangeKm)
        .sort((a, b) => b.r.goCount - a.r.goCount || a.d - b.d)
      const picks: PointResult[] = []
      for (const x of near) {
        if (picks.length >= 10) break
        if (picks.every((q) => gcKm(q.lat, q.lon, x.r.lat, x.r.lon) >= (atlas.kind === 'moon' ? 25 : 4))) picks.push(x.r)
      }
      return picks
    }
    if (atlas.kind === 'moon') return rankTop(results.filter((r) => Math.abs(r.lat) < 75), atlas)   // ranked apart from the poles
    return rankTop(results, atlas)
  }, [results, atlas, targets, targetRangeKm])  // eslint-disable-line react-hooks/exhaustive-deps
  const polarTop = useMemo(() => (results && atlas?.kind === 'moon' && !targets.length
    ? rankTop(results.filter((r) => Math.abs(r.lat) >= 75), atlas, 4) : []), [results, atlas, targets])

  const overlay: Overlay | null = useMemo(() => {
    if (!results || !atlas || !ran) return null
    const byIndex = new Map(results.map((r) => [r.index, r]))
    return paintOverlay(atlas, (i) => {
      const r = byIndex.get(i)
      if (!r) return null
      const f = r.goCount / ran.q.windowDays
      return f > 0 ? [40, Math.round(200 + 55 * f), 110, Math.round(90 + 150 * Math.min(1, f * 1.5))] : [229, 72, 77, 70]
    })
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

  // Artemis III head-to-head: each region's centre (evaluated directly) vs the best point found inside it
  const artemis = useMemo(() => {
    if (!results || !ran || !atlas || !eph || !dsn || !m?.regions) return null
    const q = { firstHour: firstHour(ran.q), nStarts: ran.q.windowDays, strideH: 24, durationH: ran.q.days * 24, maxSlope: ran.q.slope,
      needDsn: ran.q.dsn, relay: ran.q.relay, zone: ran.q.zone, zoneSlope: ran.q.zslope, iceKm: ran.q.ice }
    const c = constraints(ran.q)!
    return artemisRows(m.regions, atlas, results, (i) => searchPoint(atlas, eph, dsn, i, q, c),
      (i) => (atlas.slope[i] > q.maxSlope ? 'slope' : !passesTerrain(atlas, hazard, i, q) ? 'zone' : !passesIce(ice, i, q) ? 'ice' : null))
  }, [results, ran, atlas, eph, dsn, m, hazard, ice])  // eslint-disable-line react-hooks/exhaustive-deps

  // spacecraft approach at touchdown: along the polar ground track, with the Sun behind the lander where possible
  const approach = useMemo(() => (detail ? chooseApproach(detail.tr.sunAz[detail.a]) : null), [detail])

  // metrics for every ranked site (comparison, CSV, report)
  const rowsFor = (list: PointResult[]): SiteRow[] => {
    if (!atlas || !ran || !m || !dsn || !eph) return []
    const c = constraints(ran.q)!
    return list.map((r, k) => siteRow(atlas, eph, dsn, r, k + 1, ran.q, c, firstHour(ran.q), [region(r), describePlace(r.lat, ((r.lon % 360) + 360) % 360, feats, lang)?.text].filter(Boolean).join(' · ') || null,
      { zoneSlopeDeg: zoneSlopeAt(hazard, ran.q.zone, r.index), iceKm: ice && !Number.isNaN(ice.distKm[r.index]) ? ice.distKm[r.index] : null }))
  }
  const rows: SiteRow[] = useMemo(() => rowsFor(top), [top, atlas, ran, m, dsn, eph, feats, lang, hazard, ice])  // eslint-disable-line react-hooks/exhaustive-deps
  const cmpRows = rows.filter((r) => cmp.includes(r.index))
  const cardsFor = (list: PointResult[], listRows: SiteRow[]): CardSite[] => {
    if (!atlas || !ran || !eph || !listRows.length) return []
    const fh = firstHour(ran.q)
    const tr = lang === 'tr'
    return list.map((r, k) => {
      const reg = region(r) ?? null
      // the place name is the card title (several sites can share a region); the region is the coloured label
      const name = describePlace(r.lat, ((r.lon % 360) + 360) % 360, feats, lang)?.text ?? reg ?? `${r.lat.toFixed(2)}°, ${(((r.lon % 360) + 360) % 360).toFixed(1)}°E`
      const sky = localSky(eph, atlas.xKm[r.index] * 1000, atlas.yKm[r.index] * 1000, fh + r.bestStart * 24 + 12)
      const best = new Date(Date.parse(ran.q.start + 'T00:00:00Z') + r.bestStart * 86400e3)
      const nt = nearestTarget(r)
      const note = farSide(r.lat, r.lon) ? (ran.q.relay ? (tr ? 'Uzak yüz: röle uydusuyla konuşur' : 'Far side: talks via the relay') : (tr ? 'Uzak yüz: Dünya hiç doğmaz' : 'Far side: Earth never rises'))
        : nt ? `${nt.d.toFixed(0)} km ${tr ? '→' : 'to'} ${nt.s.name}` : undefined
      const lim = ran.q.zone > 0 && atlas.kind === 'pole' ? ran.q.zslope : landerById(ran.q.lander).zslope
      const prob = successProbability({ atlas, eph, dsn: dsn!, r, firstHour: fh, days: ran.q.days, windowDays: ran.q.windowDays, needDsn: ran.q.dsn, relay: ran.q.relay,
        c: constraints(ran.q)!, zoneSlopeP95: listRows[k]?.zoneSlopeDeg ?? atlas.slope[r.index] * 1.6,
        slopeLimit: lim - (ran.q.landing === 'rough' ? 3 : 0), zoneM: ran.q.zone || 1000, history: withRecord, trials: 300 })
      return { r, row: listRows[k], rank: k + 1, name, region: reg, colour: regionColour(reg), xKm: atlas.xKm[r.index], yKm: atlas.yKm[r.index],
        sun: { az: sky.sun.az, alt: sky.sun.alt }, note, prob, targetKm: nt?.d,
        ellipse: ellipseCheck(atlas, eph, dsn!, r.index, fh, r.bestStart, ran.q.days, ran.q.dsn, constraints(ran.q)!, 2.1, ran.q.relay),
        bestDate: best.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) }
    }).filter((c) => c.row)
  }
  const cards: CardSite[] = useMemo(() => cardsFor(top, rows), [top, rows, atlas, ran, eph, feats, lang, withRecord])  // eslint-disable-line react-hooks/exhaustive-deps
  const polarCards: CardSite[] = useMemo(() => cardsFor(polarTop, rowsFor(polarTop)), [polarTop, atlas, ran, eph, feats, lang, withRecord])  // eslint-disable-line react-hooks/exhaustive-deps
  const nextWindow: NextWindow | null = useMemo(() => {
    const c = cards.find((x) => x.r.goCount > 0)
    if (!c || !ran) return null
    const run = goRun(c.row.perStart, c.r.bestStart) ?? [c.r.bestStart, c.r.bestStart]
    const d0 = Date.parse(ran.q.start + 'T00:00:00Z')
    return { from: new Date(d0 + run[0] * 86400e3), to: new Date(d0 + run[1] * 86400e3), site: c.name, colour: c.colour, lonDeg: c.r.lon }
  }, [cards, ran])
  // actions from a site profile that need the site's detail first (stand on the lander, drive a rover)
  useEffect(() => {
    if (pendingDrive && detail && pinned && detail.tr) { enterRef.current(pendingDrive); setPendingDrive(null) }
  }, [pendingDrive, detail, pinned])
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
    return paintOverlay(atlas, (i) => (lit[i] >= 0.5 ? [245, 196, 70, Math.round(70 + 80 * lit[i])] : [12, 20, 48, 215]))
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

  if (!m || !atlas || !atlasPole) return <><div className="loading"><Patch size={72} />LunaNav<small>{lang === 'tr' ? 'NASA verisi yükleniyor…' : 'loading NASA data…'}</small></div></>
  const startDate = (s: number) => new Date(Date.parse(ran!.q.start + 'T00:00:00Z') + s * 86400e3)
  const fmtDate = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  const pins: Pin[] = top.map((r, k) => ({ lat: r.lat, lon: r.lon, label: String(k + 1), good: r.goCount > 0 }))
  const sunDir = mapMode === 'sun' && eph ? [eph.sun[0][mapHour], eph.sun[1][mapHour], eph.sun[2][mapHour]] : detail ? detail.tr.sunDir(detail.a) : [1, 0, 0]
  const earthDir = detail ? detail.tr.earthDir(detail.a) : [1, 0, 0]
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((o) => ({ ...o, [k]: v }))
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
  const lunaContext = () => ({
    settings: ran?.q ?? p,
    meaning: 'sun/earth = minimum % of mission hours; shadow = longest tolerated darkness (h); batt = Wh; slope = max degrees over 400 m at the point; zone = landing-zone radius in m (0 = off; 100, 250, 500 or 1000); zslope = 95% of that zone must be gentler than this many degrees (LOLA 40 m slopes); ice = an ice cold trap (permanent shadow with water ice stable within 1 m) must lie within this many km (0 = off; 2, 5 or 10); dsn = Earth contact also needs a NASA DSN dish',
    engine: ran ? { pointsChecked: atlas.n, hourlyChecks: ran.hoursChecked, landingDatesInWindow: ran.q.windowDays, firstDate: ran.q.start } : null,
    results: top.map((r, k) => ({ rank: k + 1, lat: +r.lat.toFixed(3), lon: +r.lon.toFixed(3), artemisRegion: region(r) ?? null, place: place(r) ?? null,
      goLandingDates: r.goCount, bestLanding: startDate(r.bestStart).toISOString().slice(0, 10),
      bestWindow: { sunlightPct: Math.round(r.sunFrac * 100), earthContactPct: Math.round(r.commFrac * 100), longestDarkHours: r.longestDarkH },
      successProbabilityPct: (() => { const cs = cards.find((c) => c.r.index === r.index); return cs?.prob ? Math.round(cs.prob.p * 100) : null })(),
      slopeDeg: atlas.slope[r.index], zoneSlopeP95Deg: zoneSlopeAt(hazard, ran?.q.zone, r.index),
      nearestIceKm: ice && !Number.isNaN(ice.distKm[r.index]) ? ice.distKm[r.index] : null, iceColdTrapKm2Within5km: ice ? ice.areaKm2[r.index] : null, heightM: atlas.height[r.index] })),
    selected: detail && pick ? { rank: sel + 1, verdict: detail.w.go ? 'GO' : 'NO-GO', sunlightPct: Math.round(detail.w.sunFrac * 100),
      earthContactPct: Math.round(detail.w.commFrac * 100), longestDarkHours: detail.w.longestDarkH,
      batterySurvives: detail.w.survived, batteryNeededWh: Math.round(detail.need),
      goOnEachLandingDate: detail.perStart.map((g, s) => `${startDate(s).toISOString().slice(0, 10)}:${g ? 'GO' : 'NO-GO'}`) } : null,
  })
  const onLuna = (a: LunaAction) => {
    if (a.type === 'select') { if (a.rank >= 1 && a.rank <= top.length) setSel(a.rank - 1); return }
    const q = a.params
    const start = typeof q.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.start) && q.start >= FIRST_DATE && q.start <= LAST_DATE ? q.start : p.start
    const next: Params = { lander: p.lander, rover: p.rover, scope: p.scope, target: p.target, landing: p.landing, relay: p.relay, start, windowDays: clamp(q.windowDays, 5, 90, p.windowDays), days: clamp(q.days, 1, 30, p.days),
      sun: clamp(q.sun, 0, 100, p.sun), earth: clamp(q.earth, 0, 100, p.earth), shadow: clamp(q.shadow, 0, 240, p.shadow),
      batt: clamp(q.batt, 500, 20000, p.batt), slope: clamp(q.slope, 2, 20, p.slope),
      zone: [0, 100, 250, 500, 1000].includes(q.zone as number) ? (q.zone as number) : p.zone, zslope: clamp(q.zslope, 2, 30, p.zslope),
      ice: [0, 2, 5, 10].includes(q.ice as number) ? (q.ice as number) : p.ice, dsn: typeof q.dsn === 'boolean' ? q.dsn : p.dsn }
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
      label: `${siteName(pick)} · ${fmtDate(startDate(pick.bestStart))}`, lander: p.lander, rover: p.rover, rough: p.landing === 'rough' } })
  }

  enterRef.current = enter
  const loc = lang === 'tr' ? 'tr-TR' : 'en-US'
  const place = (r: PointResult) => describePlace(r.lat, ((r.lon % 360) + 360) % 360, feats, lang)?.text
  const coords = (r: PointResult) => `${r.lat.toFixed(2)}°, ${(((r.lon % 360) + 360) % 360).toFixed(1)}°E`
  const siteName = (r: PointResult) => region(r) ?? place(r) ?? coords(r)
  const scenario = matchScenario(p)
  const dirty = !!ran && (Object.keys(p) as (keyof Params)[]).some((k) => p[k] !== ran.asked[k])
  // the mission comes from the scenario, the hardware (battery, landing precision, slope limit, longest stay) from the lander
  const withLander = (q: Params, l: Lander): Params => ({ ...q, lander: l.id, batt: l.batt, zone: l.zone, zslope: l.zslope, days: Math.min(q.days, l.maxDays) })
  const watchLanding = () => {
    if (atlas.kind === 'pole') { setPendingDrive('landing'); return }
    setMapMode('route'); setFlightView('pilot')
    setTimeout(() => document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth' }), 60)
  }
  const chooseScope = (s: 'pole' | 'moon') => {
    const t = SCIENCE_SITES.find((x) => x.id === p.target)
    const next: Params = { ...p, scope: s, target: s === 'pole' && t && !inPoleGrid(t) ? '' : p.target }
    setP(next); run(next)
  }
  const chooseTarget = (t: ScienceSite | null) => {
    // a target outside the south-pole grid switches the search to the whole Moon
    // polar targets use the sharper 2 km south-pole grid; anything else needs the whole Moon
    const next: Params = { ...p, target: t?.id ?? '', scope: t ? (inPoleGrid(t) ? 'pole' : 'moon') : p.scope }
    setP(next); run(next)
  }
  const chooseGoal = (k: ScienceKind | null) => {
    const sites = k ? SCIENCE_SITES.filter((s) => s.kind === k) : []
    const next: Params = { ...p, target: k ? `kind:${k}` : '', scope: k ? (sites.every(inPoleGrid) ? 'pole' : 'moon') : p.scope }
    setP(next); run(next)
  }
  const scopeTarget = <ScopeTarget lang={lang} scope={p.scope} target={p.target} onScope={chooseScope} onTarget={chooseTarget} />
  const applyScenario = (sc: (typeof SCENARIOS)[number]): Params =>
    withLander({ ...p, days: sc.days, sun: sc.sun, earth: sc.earth, shadow: sc.shadow, batt: sc.batt, zone: sc.zone, zslope: sc.zslope, ice: sc.ice, dsn: sc.dsn }, landerById(p.lander))

  const globeCard = (
          <section className="card map-card">
            <div className="map">
              <Suspense fallback={null}>
                <Globe poleCap={m.pole_cap} overlay={sunOverlay ?? overlay} pins={pins} earthLabel={lang === 'tr' ? 'Dünya' : 'Earth'}
                       selected={pick ? { lat: pick.lat, lon: pick.lon, label: `#${sel + 1}` } : null}
                       sunDir={sunDir} earthDir={earthDir} onPick={setSel}
                       targets={SCIENCE_SITES.map((s): Target => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, colour: SCIENCE_KIND[s.kind].colour, selected: s.id === p.target }))}
                       onTarget={(id) => chooseTarget(SCIENCE_SITES.find((s) => s.id === id) ?? null)}
                       flight={mapMode === 'route' && pick && approach ? { lat: pick.lat, lon: pick.lon, approach,
                         labels: [S.phCoast[lang], S.phOrbit[lang], S.phDescent[lang], S.phLanded[lang]], view: flightView } : null} />
              {mapMode === 'route' && flightView !== 'overview' && (
                <div className={`flight-hud-wrap ${flightView}`}>
                  {flightView === 'pilot' && <div className="reticle" aria-hidden="true" />}
                  <div id="flight-hud" className="flight-hud" />
                </div>
              )}
              </Suspense>
              <div className="map-tools">
                <div className="seg">
                  <button className={mapMode === 'results' ? 'on' : ''} onClick={() => { setMapMode('results'); setMapPlay(false) }}>{S.navResults[lang]}</button>
                  <button className={mapMode === 'sun' ? 'on' : ''} onClick={() => setMapMode('sun')}>{T.sunlight[lang]}</button>
                  <button className={mapMode === 'route' ? 'on' : ''} onClick={() => { setMapMode('route'); setMapPlay(false) }}><Rocket size={12} /> {S.route[lang]}</button>
                </div>
                {mapMode === 'route' && (
                  <div className="seg cam-seg" role="group" aria-label={S.camLabel[lang]}>
                    {(['overview', 'chase', 'pilot', 'site'] as FlightView[]).map((v) => (
                      <button key={v} className={flightView === v ? 'on' : ''} onClick={() => setFlightView(v)}>
                        {v === 'overview' ? S.camOverview[lang] : v === 'chase' ? S.camChase[lang] : v === 'pilot' ? S.camPilot[lang] : S.camSite[lang]}
                      </button>
                    ))}
                  </div>
                )}
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
                {mapMode === 'route' ? (
                  <>
                    <span><i className="sw l-coast" />{S.phCoast[lang]} · ~{PHASES.coast.days} {S.days[lang]}</span>
                    <span><i className="sw l-orbit" />{S.phOrbit[lang]} · {PHASES.orbitKm} km</span>
                    <span><i className="sw l-descent" />{S.phDescent[lang]} · ~{PHASES.descentMin} min</span>
                    <span className="legend-note">{lang === 'tr' ? 'Şematik, ölçeksiz; yörünge düzlemi ve yaklaşma yönü seçilen noktaya göre hesaplanır.' : 'Schematic, not to scale; the orbit plane and approach direction are computed for the chosen site.'}</span>
                  </>
                ) : mapMode === 'results' ? (
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
  )

  return (
    <>
    <div className={`app ${drive ? 'driving' : ''}`}>
      {drive && eph && dsn && (
        <Suspense fallback={<div className="drive"><div className="drive-loading">…</div></div>}>
          <Drive start={drive.start} eph={eph} dsn={dsn} lang={lang} initialMode={drive.mode} onExit={() => setDrive(null)} />
        </Suspense>
      )}
      <header className="nav">
        <a className="logo" href="#top"><Patch size={34} /><span className="logo-word">Luna<b>Nav</b></span></a>
        <span className={`scope-pill ${scope}`}>{scope === 'moon'
          ? (lang === 'tr' ? `TÜM AY · ${(atlasMoon?.n ?? 41276).toLocaleString(loc)} NOKTA · ~30 KM` : `WHOLE MOON · ${(atlasMoon?.n ?? 41276).toLocaleString(loc)} PTS · ~30 KM`)
          : (lang === 'tr' ? `GÜNEY KUTBU · ${atlasPole.n.toLocaleString(loc)} NOKTA · 2 KM` : `SOUTH POLE · ${atlasPole.n.toLocaleString(loc)} PTS · 2 KM`)}</span>
        <div className="ui-switch" role="group" aria-label={lang === 'tr' ? 'Arayüz' : 'Interface'}>
          <button className={ui === 'simple' ? 'on' : ''} onClick={() => setUi('simple')}>{lang === 'tr' ? 'Basit' : 'Simple'}</button>
          <button className={ui === 'advanced' ? 'on' : ''} onClick={() => setUi('advanced')}>{lang === 'tr' ? 'Gelişmiş' : 'Advanced'}</button>
        </div>
        {ui === 'advanced' && <nav className="nav-links">
          <a href="#results">{S.navResults[lang]}</a>
          <a href="#site">{S.navSite[lang]}</a>
          <a href="#method">{S.navMethod[lang]}</a>
        </nav>}
        {ui === 'advanced' && <button className="nav-ws" onClick={() => setLab(true)}><Scale size={14} /> {lang === 'tr' ? 'Karar' : 'Decide'}</button>}
        {ui === 'advanced' && <button className="nav-ws" onClick={() => setWorkshop(true)}><Wrench size={14} /> {lang === 'tr' ? 'Atölye' : 'Workshop'}</button>}
        <button className="nav-ws nav-qr" onClick={() => { location.hash = `judges&lang=${lang}` }} title={lang === 'tr' ? 'Jüri sayfası ve QR kodu' : 'Judges page and QR code'} aria-label="QR"><QrCode size={15} /></button>
        <button className="nav-story" onClick={() => setFilm(true)}><Sparkles size={14} /> {lang === 'tr' ? 'Görevi anlat' : 'Tell me the mission'}</button>
        <div className="nav-r">
          <div className="seg" role="group" aria-label="Language">
            {(['en', 'tr'] as Lang[]).map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a className="btn gh-btn" href={REPO_URL} target="_blank" rel="noreferrer"><Github size={15} /> <span>GitHub</span></a>
        </div>
      </header>
      {eph && dsn && (
        <>
          <MissionBar next={nextWindow} eph={eph} startUnix={m.start_unix} lang={lang} onOpen={() => cards[0] && setProfile(cards.find((c) => c.r.goCount > 0) ?? cards[0])} />
          <Ticker eph={eph} dsn={dsn} startUnix={m.start_unix} lang={lang} items={[
            `${atlas.n.toLocaleString(loc)} ${lang === 'tr' ? 'NOKTA TARANDI' : 'POINTS SEARCHED'}`,
            ran ? `${(ran.hoursChecked / 1e6).toFixed(1)} M ${lang === 'tr' ? 'SAATLİK KONTROL' : 'HOURLY CHECKS'} · ${(ran.ms / 1000).toFixed(1)} s` : '',
            nextWindow ? `${lang === 'tr' ? 'EN İYİ' : 'BEST'}: ${nextWindow.site.toUpperCase()}` : '',
            'NASA LOLA · JPL DE421 · DSN · LRO DIVINER',
          ].filter(Boolean)} />
        </>
      )}

      {ui === 'simple' ? (
        <div className="shell simple-shell" id="top">
          <main className="main">
            <SimpleView lang={lang} scenarioId={scenario?.id ?? null} start={p.start} minDate={FIRST_DATE} maxDate={LAST_DATE}
              busy={progress !== null} progress={progress} points={atlas.n} rankBy={rankBy} onRankBy={setRankBy}
              cards={rankBy === 'prob' ? [...cards].sort((a, b) => (b.prob?.p ?? 0) - (a.prob?.p ?? 0)).map((c, i) => ({ ...c, rank: i + 1 })) : cards}
              polarCards={rankBy === 'prob' ? [...polarCards].sort((a, b) => (b.prob?.p ?? 0) - (a.prob?.p ?? 0)).map((c, i) => ({ ...c, rank: i + 1 })) : polarCards}
              targetName={targetSite?.name ?? (targets.length ? SCIENCE_KIND[targets[0].kind].label[lang] : null)}
              scope={p.scope} goal={p.target.startsWith('kind:') ? (p.target.slice(5) as ScienceKind) : null} onScope={chooseScope} onGoal={chooseGoal}
              windowLabel={ran ? `${customName ?? matchScenario(ran.asked)?.name[lang] ?? (lang === 'tr' ? 'Özel görev' : 'Custom mission')} · ${fmtDate(new Date(ran.q.start + 'T00:00:00Z'))} + ${ran.q.windowDays} ${S.days[lang]}` : ''}
              lander={p.lander} rover={p.rover}
              onLander={(l) => { const next = withLander(p, l); setP(next); run(next) }}
              onRover={(id) => set('rover', id)}
              onScenario={(sc) => { const next = applyScenario(sc); setCustomName(null); setP(next); run(next) }}
              onStart={(d) => set('start', d)} onRun={() => run(p)} onOpen={setProfile}
              onAdvanced={() => { setUi('advanced'); scrollTo({ top: 0 }) }} onStory={() => setFilm(true)}
              onDecide={() => setLab(true)} onWorkshop={() => setWorkshop(true)} />
            {globeCard}
          </main>
        </div>
      ) : (
      <div className="shell" id="top">
        <aside className="side">
          <div className="side-head">
            <h1>{S.hero[lang]}</h1>
            <p>{S.sub[lang]}</p>
          </div>
          <div className="group">
            <div className="group-label">{lang === 'tr' ? 'Kapsam ve hedef' : 'Scope and target'}</div>
            {scopeTarget}
          </div>
          <div className="group">
            <div className="group-label">{S.mission[lang]}</div>
            <div className="scenarios">
              {SCENARIOS.map((sc) => (
                <button key={sc.id} title={sc.name[lang]} className={scenario?.id === sc.id ? 'on' : ''} onClick={() => setP(applyScenario(sc))}>
                  <b>{sc.short[lang]}</b><span>{sc.days} {S.days[lang]}</span>{SC_ICON[sc.id]}
                </button>
              ))}
            </div>
            <p className="meta scenario-desc">{scenario ? scenario.desc[lang] : S.custom[lang]}</p>
          </div>
          <div className="group">
            <div className="group-label">{S.window[lang]}</div>
            <div className="pair">
              <input className="input" type="date" value={p.start} min={FIRST_DATE} max={LAST_DATE} onChange={(e) => e.target.value && set('start', e.target.value)} />
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
            <label className="checkbox"><input type="checkbox" checked={p.relay} onChange={(e) => set('relay', e.target.checked)} /><span>{S.relay[lang]}</span></label>
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
          {ice && (
            <div className="group">
              <div className="group-label">{S.science[lang]}</div>
              <div className="field">
                <div className="field-top"><label>{S.iceWithin[lang]}</label></div>
                <div className="seg full">
                  {[0, 2, 5, 10].map((v) => (
                    <button key={v} className={p.ice === v ? 'on' : ''} onClick={() => set('ice', v)}>{v === 0 ? S.zoneOff[lang] : `${v} km`}</button>
                  ))}
                </div>
              </div>
              <p className="meta">{S.iceHint[lang]}</p>
            </div>
          )}
          <div className="side-foot">
            <button className={`btn primary block ${dirty && progress === null ? 'dirty' : ''}`} disabled={progress !== null} onClick={() => run(p)}>
              {progress !== null ? `${S.searching[lang]} ${Math.round(progress * 100)}%` : dirty ? S.rerun[lang] : S.search[lang]}
            </button>
            <button className="btn block sim-btn" disabled={progress !== null} onClick={simulate}><FlaskConical size={14} /> {S.simulate[lang]}</button>
            {progress !== null && <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>}
            {ran && progress === null && (
              <p className="meta">{atlas.n.toLocaleString(loc)} {S.stats[lang]} · {(ran.hoursChecked / 1e6).toFixed(1)} M {S.hoursChecked[lang]} · {(ran.ms / 1000).toFixed(1)} {S.seconds[lang]}</p>
            )}
            <a className="meta gh-side" href={REPO_URL} target="_blank" rel="noreferrer"><Github size={12} /> {S.openSource[lang]} ↗</a>
          </div>
        </aside>

        <main className="main">
          {guide && (
            <section className="card guide">
              <div className="guide-head">
                <h2>{S.guideTitle[lang]}</h2>
                <button className="icon-btn" onClick={hideGuide} aria-label="Close"><X size={14} /></button>
              </div>
              <ol>
                <li><b>1</b><span>{S.guide1[lang]}</span></li>
                <li><b>2</b><span>{S.guide2[lang]}</span></li>
                <li><b>3</b><span>{S.guide3[lang]}</span></li>
              </ol>
              <p className="hint">{S.guideTip[lang]}</p>
            </section>
          )}
          {globeCard}

          {sim && (
            <section className="card" id="scenarios">
              <div className="card-head">
                <div>
                  <h2>{S.simTitle[lang]}</h2>
                  <p className="sub">{S.simSub[lang]} {fmtDate(new Date(sim.start + 'T00:00:00Z'))} + {sim.windowDays} {S.days[lang]}.</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>{S.simScenario[lang]}</th><th className="num">{S.simGoSites[lang]}</th><th>{S.simBest[lang]}</th><th>{S.colGo[lang]}</th><th className="num">{T.sunlight[lang]}</th><th className="num">{S.colEarth[lang]}</th></tr>
                  </thead>
                  <tbody>
                    {sim.out.map((o) => {
                      const sc = SCENARIOS.find((x) => x.id === o.id)!
                      const day0 = new Date(sim.start + 'T00:00:00Z')
                      return (
                        <tr key={o.id} className={scenario?.id === o.id ? 'sel' : ''} onClick={() => {
                          const next = applyScenario(sc)
                          setP(next)
                          run(next).then(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }))
                        }}>
                          <td><div className="site">{sc.name[lang]}</div><div className="sub">{sc.desc[lang]}</div></td>
                          <td className="num">{o.goSites.toLocaleString(loc)} <span className="sub">/ {o.searched.toLocaleString(loc)}</span></td>
                          <td>{o.best && o.best.goCount > 0
                            ? <><div className="site">{siteName(o.best)}</div><div className="sub">{fmtDate(new Date(day0.getTime() + o.best.bestStart * 86400e3))}</div></>
                            : <span className="sub">{S.simNone[lang]}</span>}</td>
                          <td>{o.best && (
                            <div className="go-cell">
                              <span className="meter"><i className={o.best.goCount > 0 ? 'go' : 'nogo'} style={{ width: `${Math.max(4, (o.best.goCount / o.windowDays) * 100)}%` }} /></span>
                              <span className="num">{o.best.goCount}/{o.windowDays}</span>
                            </div>)}</td>
                          <td className="num">{o.best ? `${Math.round(o.best.sunFrac * 100)}%` : '–'}</td>
                          <td className="num">{o.best ? `${Math.round(o.best.commFrac * 100)}%` : '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

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
                      {ice && <th className="num" title={S.iceHint[lang]}>{S.colIce[lang]}</th>}
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
                        {ice && <td className="num">{Number.isNaN(ice.distKm[r.index]) ? '–' : `${ice.distKm[r.index].toFixed(1)} km`}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cmpRows.length < 2 && <p className="hint">{S.compareHint[lang]}</p>}
            </section>
          )}

          {results && ran && ice && (
            <Suspense fallback={null}>
              <TradeOff results={results} ice={ice} windowDays={ran.q.windowDays} lang={lang} name={siteName}
                        onPick={(r) => { setPinned(r); document.getElementById('site')?.scrollIntoView({ behavior: 'smooth' }) }} />
            </Suspense>
          )}

          {artemis && ran && (
            <Suspense fallback={null}>
              <ArtemisCompare rows={artemis} windowDays={ran.q.windowDays} lang={lang} name={(r) => place(r) ?? coords(r)}
                              iceKm={(i) => (ice && !Number.isNaN(ice.distKm[i]) ? ice.distKm[i] : null)}
                              onPick={(r) => { setPinned(r); document.getElementById('site')?.scrollIntoView({ behavior: 'smooth' }) }} />
            </Suspense>
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
                    <button className="btn" onClick={() => enter('walk')}><Footprints size={14} /> {lang === 'tr' ? 'Ay’da yürü' : 'Walk on the Moon'}</button>
                    <button className="btn" onClick={() => enter('rover')}><Car size={14} /> {S.driveHere[lang]}</button>
                  </div>
                </div>
                {(() => { const cs = cards.find((c) => c.r.index === pick.index); return cs?.prob ? <ProbabilityPanel prob={cs.prob} lang={lang} history={withRecord} onHistory={setWithRecord} /> : null })()}
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
                {ice && !Number.isNaN(ice.distKm[pick.index]) && (
                  <p className="touchdown"><Droplets size={13} />{' '}
                    {lang === 'tr'
                      ? `Su buzu: en yakın soğuk tuzak ${ice.distKm[pick.index].toFixed(1)} km uzakta; 5 km içinde ${ice.areaKm2[pick.index].toFixed(2)} km² buzlu kalıcı gölge var (LOLA + Diviner).`
                      : `Water ice: the nearest cold trap is ${ice.distKm[pick.index].toFixed(1)} km away; ${ice.areaKm2[pick.index].toFixed(2)} km² of icy permanent shadow lies within 5 km (LOLA + Diviner).`}
                  </p>
                )}
                {approach && (
                  <p className="touchdown"><Rocket size={13} />{' '}
                    {lang === 'tr'
                      ? `Yaklaşma: ${approach.headingDeg === 0 ? 'kuzeye doğru (kutup üzerinden gelerek)' : 'güneye doğru (kutba doğru)'} iner; Güneş ${detail.tr.sunAlt[detail.a].toFixed(1)}° yükseklikte, uçuş yönünden ${Math.round(approach.sunOffDeg)}° ${approach.sunBehind ? 'arkada: tehlike kameraları Güneş’e bakmaz.' : 'açıda: kameralar Güneş’e karşı bakabilir, dikkat.'}`
                      : `Approach: descends heading ${approach.headingDeg === 0 ? 'north (coming over the pole)' : 'south (toward the pole)'}; the Sun is ${detail.tr.sunAlt[detail.a].toFixed(1)}° high and ${Math.round(approach.sunOffDeg)}° off the flight direction, ${approach.sunBehind ? 'behind the lander: the hazard cameras do not look into it.' : 'partly ahead: the hazard cameras may face glare.'}`}
                    {' '}<button className="link-btn" onClick={() => { setMapMode('route'); document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth' }) }}>{lang === 'tr' ? 'Rotayı göster' : 'Show the route'}</button>
                  </p>
                )}
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
                {(() => {
                  const run = goRun(detail.perStart, pick.bestStart)
                  if (!run) return null
                  const n = run[1] - run[0] + 1
                  const slip = run[1] - pick.bestStart
                  return (
                    <p className="launch-window">
                      {lang === 'tr'
                        ? <><b>Fırlatma penceresi: art arda {n} uygun iniş günü</b> ({fmtDate(startDate(run[0]))} – {fmtDate(startDate(run[1]))}). En iyi tarihten sonra {slip} gün gecikme hâlâ UYGUN.</>
                        : <><b>Launch window: {n} GO landing {n === 1 ? 'date' : 'dates'} in a row</b> ({fmtDate(startDate(run[0]))} – {fmtDate(startDate(run[1]))}). A slip of up to {slip} {slip === 1 ? 'day' : 'days'} after the best date is still GO.</>}
                    </p>
                  )
                })()}
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
            <h3 className="valid-title">{S.validTitle[lang]}</h3>
            <ul className="valid">
              {VALIDATION[lang].map(([what, num]) => <li key={what}><CheckCircle2 size={14} /><span>{what}</span><b>{num}</b></li>)}
            </ul>
            <p className="hint">{m.sources.join(' · ')}</p>
            <div className="links">
              <a href={REPO_URL} target="_blank" rel="noreferrer">{T.source[lang]} · GitHub ↗</a>
              <a href={PLANNER_URL} target="_blank" rel="noreferrer">{T.planner[lang]} ↗</a>
            </div>
          </section>
        </main>
      </div>
      )}
      {profile && (
        <SiteProfile s={cards.find((c) => c.r.index === profile.r.index) ?? polarCards.find((c) => c.r.index === profile.r.index) ?? profile}
          history={withRecord} onHistory={setWithRecord} lang={lang} lander={p.lander} onClose={() => setProfile(null)}
          onWatch={() => { setPinned(profile.r); setProfile(null); watchLanding() }}
          onStand={() => { setPinned(profile.r); setPendingDrive('lander'); setProfile(null) }}
          onDrive={() => { setPinned(profile.r); setPendingDrive('rover'); setProfile(null) }}
          onWalk={() => { setPinned(profile.r); setPendingDrive('walk'); setProfile(null) }}
          onAnalysis={() => { setPinned(profile.r); setUi('advanced'); setProfile(null)
            setTimeout(() => document.getElementById('site')?.scrollIntoView({ behavior: 'smooth' }), 120) }} />
      )}
      {story && (
        <MissionStory lang={lang} cards={cards} ranKey={ran} onClose={() => setStory(false)}
          onSearch={(sc, l, start) => { const next = withLander({ ...applyScenario(sc), start }, l); setP(next); run(next) }}
          onWatch={(c) => { setStory(false); setPinned(c.r); watchLanding() }}
          onWalk={(c) => { setStory(false); setPinned(c.r); setPendingDrive('walk') }}
          onOpen={(c) => { setStory(false); setProfile(c) }} />
      )}
      {lab && <DecisionLab cards={cards} lang={lang} onClose={() => setLab(false)} onOpen={(c) => { setLab(false); setProfile(c) }} />}
      {workshop && (
        <Workshop lang={lang} onClose={() => setWorkshop(false)} onLaunch={(d: Design, b: Budget) => {
          // the design's budgets become the search: battery, sunlight, darkness, Earth contact, landing zone and slope
          const snap = (z: number) => [100, 250, 500, 1000].reduce((best, v) => (Math.abs(v - z) < Math.abs(best - z) ? v : best), 1000)
          const goalSites = d.goal ? SCIENCE_SITES.filter((s) => s.kind === d.goal) : []
          const next: Params = { ...p, batt: Math.min(20000, d.batteryWh), days: d.days, sun: b.minSunPct, earth: b.earthPct, shadow: Math.min(240, b.maxDarkH),
            zone: snap(b.zone), zslope: b.zslope, dsn: d.comms === 'dte', relay: d.comms === 'relay', landing: d.landing, rover: d.type === 'rover' ? d.rover : p.rover,
            target: d.goal ? `kind:${d.goal}` : '', scope: d.goal ? (goalSites.every(inPoleGrid) ? 'pole' : 'moon') : p.scope }
          setCustomName(d.name); setP(next); run(next); setWorkshop(false)
          setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 400)
        }} />
      )}
      {film && (() => {
        const c = cards.find((x) => x.r.goCount > 0) ?? cards[0]
        if (!c || !ran || !eph || !dsn) return null
        const l = landerById(p.lander)
        const sc = matchScenario(ran.asked) ?? null
        const landingDay = new Date(Date.parse(c.row.bestLanding + 'T00:00:00Z'))
        const ds = { x: c.xKm * 1000, y: c.yKm * 1000, hour: firstHour(ran.q) + c.r.bestStart * 24, missionH: ran.q.days * 24,
          startMs: landingDay.getTime(), label: `${c.name} · ${fmtDate(landingDay)}`, lander: p.lander, rover: p.rover, rough: p.landing === 'rough' }
        const polar = atlas.kind === 'pole'
        const ap = chooseApproach(localSky(eph, ds.x, ds.y, ds.hour).sun.az)
        return (
          <MissionFilm lang={lang} card={c} lander={l} roverName={ROVERS.find((r) => r.id === p.rover)?.name ?? 'Rover'}
            missionName={customName ?? sc?.name[lang] ?? (lang === 'tr' ? 'Özel görev' : 'Custom mission')}
            chapters={missionStory(c, l, sc, landingDay, lang, ran.q.zslope)} launch={launchDate(landingDay)} landing={landingDay}
            globe={(view, start) => (
              <Suspense fallback={null}>
                <Globe poleCap={m.pole_cap} overlay={null} pins={[]} earthLabel={lang === 'tr' ? 'Dünya' : 'Earth'} selected={null} labels={false}
                       sunDir={eph ? [eph.sun[0][ds.hour], eph.sun[1][ds.hour], eph.sun[2][ds.hour]] : [1, 0, 0]} earthDir={earthDir}
                       flight={{ lat: c.r.lat, lon: c.r.lon, approach: ap, view, start,
                         labels: [S.phCoast[lang], S.phOrbit[lang], S.phDescent[lang], S.phLanded[lang]] }} />
              </Suspense>
            )}
            touchdown={polar ? () => (
              <Suspense fallback={null}><Drive start={ds} eph={eph} dsn={dsn} lang={lang} initialMode="landing" onExit={() => {}} cinematic /></Suspense>
            ) : null}
            rover={polar ? () => (
              <Suspense fallback={null}><Drive start={ds} eph={eph} dsn={dsn} lang={lang} initialMode="rover" onExit={() => {}} cinematic /></Suspense>
            ) : null}
            onClose={() => setFilm(false)}
            onWalk={polar ? () => { setFilm(false); setPinned(c.r); setPendingDrive('walk') } : null} />
        )
      })()}
      <Luna lang={lang} context={lunaContext} onAction={onLuna} onPlan={() => setStory(true)} />
    </div>
    </>
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
    [tr ? 'İniş alanı eğimi (%95)' : 'Landing zone slope (95%)', (r) => (r.zoneSlopeDeg === null ? '–' : `${r.zoneSlopeDeg.toFixed(1)}°`), (r) => r.zoneSlopeDeg ?? 99, false],
    [tr ? 'En yakın buz' : 'Nearest ice', (r) => (r.iceKm === null ? '–' : `${r.iceKm.toFixed(1)} km`), (r) => r.iceKm ?? 999, false],
    [tr ? 'Yaklaşma' : 'Approach', (r) => `${r.approachDeg === 0 ? (tr ? 'kuzeye' : 'heading N') : (tr ? 'güneye' : 'heading S')} · ${tr ? 'Güneş' : 'Sun'} ${r.sunOffDeg}°`, (r) => r.sunOffDeg, true],
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
