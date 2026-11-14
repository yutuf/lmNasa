import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { dataUrl, loadManifest, type Manifest, type Series } from './data'
import { insideRing, parseAtlas, parseEphem, pointTrack, type Atlas, type PointResult } from './engine'
import { T, fmtPct, hours, why, type Lang } from './i18n'
import { evaluateWindow, requiredBatteryWh, type Constraints } from './model'
import { EngineRunner } from './runner'
import { download, reportHtml, siteRow, toCsv, type SiteRow } from './report'
import HorizonView from './components/HorizonView'
import Luna, { type LunaAction } from './components/Luna'
import type { Overlay, Pin } from './components/Globe'
import type { DriveMode, DriveStart } from './components/Drive'

const Globe = lazy(() => import('./components/Globe'))
const Drive = lazy(() => import('./components/Drive'))

const PLANNER_URL = 'https://limitlessapps.streamlit.app/'
const REPO_URL = 'https://github.com/yutuf/lmNasa'

type Text = Record<Lang, string>
const S = {
  hero: { en: 'Where can we land on the Moon?', tr: "Ay'da nereye inebiliriz?" },
  sub: {
    en: 'Describe your mission. LunaNav searches 21,856 points near the lunar south pole, hour by hour, over the real terrain, and shows where and when a solar lander survives.',
    tr: "Görevinizi tarif edin. LunaNav Ay'ın güney kutbu çevresindeki 21.856 noktayı, gerçek arazi üzerinde saat saat tarar ve güneş enerjili bir aracın nerede ve ne zaman yaşayabileceğini gösterir.",
  },
  mission: { en: 'Mission', tr: 'Görev' },
  window: { en: 'Landing window', tr: 'İniş penceresi' },
  from: { en: 'from', tr: 'başlangıç' },
  days: { en: 'days', tr: 'gün' },
  stay: { en: 'Stay on the surface', tr: 'Yüzeyde kalış' },
  needSun: { en: 'Sunlight at least', tr: 'En az güneş' },
  needEarth: { en: 'Earth contact at least', tr: 'En az Dünya bağlantısı' },
  maxShadow: { en: 'Longest shadow at most', tr: 'En uzun gölge en çok' },
  battery: { en: 'Battery', tr: 'Batarya' },
  slope: { en: 'Steepest ground', tr: 'En dik zemin' },
  dsn: { en: 'Earth contact needs a NASA DSN dish too', tr: 'Dünya bağlantısı NASA DSN anteni de gerektirsin' },
  search: { en: 'Find landing sites', tr: 'İniş yerlerini bul' },
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
  compareTitle: { en: 'Side by side', tr: 'Yan yana' },
  compareHint: { en: 'Tick ⇄ on two to four results to compare them here.', tr: 'Karşılaştırmak için iki ile dört sonuçta ⇄ işaretleyin.' },
  csv: { en: 'CSV', tr: 'CSV' },
  report: { en: 'Report', tr: 'Rapor' },
  clear: { en: 'Clear', tr: 'Temizle' },
  beThere: { en: 'Be there: see what the lander sees on the best landing date, or drive a rover over the real terrain.', tr: 'Oradaymış gibi: en iyi iniş tarihinde iniş aracının gördüğünü görün ya da gerçek arazide gezgin sürün.' },
} satisfies Record<string, Text>

const PRESETS = [
  { id: 'lander', name: { en: 'Solar lander · 14 days', tr: 'Güneş enerjili iniş aracı · 14 gün' }, days: 14, sun: 70, earth: 50, shadow: 48, batt: 2000 },
  { id: 'long', name: { en: 'Long stay · 28 days', tr: 'Uzun kalış · 28 gün' }, days: 28, sun: 60, earth: 50, shadow: 72, batt: 6000 },
  { id: 'sprint', name: { en: 'Short sprint · 5 days', tr: 'Kısa görev · 5 gün' }, days: 5, sun: 80, earth: 70, shadow: 24, batt: 1000 },
]

interface Params { start: string; windowDays: number; days: number; sun: number; earth: number; shadow: number; batt: number; slope: number; dsn: boolean }

function readHash(): { lang: Lang; p: Params } {
  const q = new URLSearchParams(location.hash.slice(1))
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  return {
    lang: q.get('lang') === 'tr' ? 'tr' : 'en',
    p: { start: q.get('start') ?? '2027-09-01', windowDays: num('window', 30), days: num('days', 14), sun: num('sun', 70),
      earth: num('earth', 50), shadow: num('shadow', 48), batt: num('batt', 2000), slope: num('slope', 8), dsn: q.get('dsn') !== '0' },
  }
}

export default function App() {
  const init = readHash()
  const [lang, setLang] = useState<Lang>(init.lang)
  const [p, setP] = useState<Params>(init.p)
  const [m, setM] = useState<Manifest | null>(null)
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [results, setResults] = useState<PointResult[] | null>(null)
  const [ran, setRan] = useState<{ q: Params; ms: number; hoursChecked: number } | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [sel, setSel] = useState(0)
  const [dsn, setDsn] = useState<boolean[] | null>(null)
  const ephemRef = useRef<ArrayBuffer | null>(null)
  const runner = useRef<EngineRunner | null>(null)
  const [drive, setDrive] = useState<{ mode: DriveMode; start: DriveStart } | null>(null)
  const [cmp, setCmp] = useState<number[]>([])

  useEffect(() => {
    (async () => {
      const man = await loadManifest()
      const [a, e, d] = await Promise.all(['atlas.bin', 'ephem.bin', man.dsn].map((f) => fetch(dataUrl(f)).then((r) => r.arrayBuffer())))
      ephemRef.current = e
      setDsn(Array.from(new Uint8Array(d), (x) => x === 1))
      setAtlas(parseAtlas(a))
      runner.current = new EngineRunner(a, e, d, man.n)
      setM(man)
    })()
  }, [])
  useEffect(() => {
    history.replaceState(null, '', `#lang=${lang}&start=${p.start}&window=${p.windowDays}&days=${p.days}&sun=${p.sun}` +
      `&earth=${p.earth}&shadow=${p.shadow}&batt=${p.batt}&slope=${p.slope}&dsn=${p.dsn ? 1 : 0}`)
  }, [lang, p])

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
      maxSlope: q.slope, needDsn: q.dsn }, c, setProgress)
    setRan({ q: { ...q, windowDays: nStarts }, ms: performance.now() - t0, hoursChecked: res.length * ((nStarts - 1) * 24 + q.days * 24) })
    setResults(res)
    setSel(0)
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

  const pick = top[sel]
  const eph = useMemo(() => (m && ephemRef.current ? parseEphem(ephemRef.current, m.n) : null), [m])
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
    return top.map((r, k) => siteRow(atlas, eph, dsn, r, k + 1, ran.q, c, firstHour(ran.q), region(r) ?? null))
  }, [top, atlas, ran, m, dsn, eph])  // eslint-disable-line react-hooks/exhaustive-deps
  const cmpRows = rows.filter((r) => cmp.includes(r.index))

  if (!m || !atlas) return <div className="loading">LunaNav<small>{lang === 'tr' ? 'NASA verisi yükleniyor…' : 'loading NASA data…'}</small></div>
  const startDate = (s: number) => new Date(Date.parse(ran!.q.start + 'T00:00:00Z') + s * 86400e3)
  const fmtDate = (d: Date) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
  const pins: Pin[] = top.map((r, k) => ({ lat: r.lat, lon: r.lon, label: String(k + 1), good: r.goCount > 0 }))
  const sunDir = detail ? detail.tr.sunDir(detail.a) : [1, 0, 0]
  const earthDir = detail ? detail.tr.earthDir(detail.a) : [1, 0, 0]
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP((o) => ({ ...o, [k]: v }))
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
  const lunaContext = () => ({
    settings: ran?.q ?? p,
    meaning: 'sun/earth = minimum % of mission hours; shadow = longest tolerated darkness (h); batt = Wh; slope = max degrees; dsn = Earth contact also needs a NASA DSN dish',
    engine: ran ? { pointsChecked: atlas.n, hourlyChecks: ran.hoursChecked, landingDatesInWindow: ran.q.windowDays, firstDate: ran.q.start } : null,
    results: top.map((r, k) => ({ rank: k + 1, lat: +r.lat.toFixed(3), lon: +r.lon.toFixed(3), artemisRegion: region(r) ?? null,
      goLandingDates: r.goCount, bestLanding: startDate(r.bestStart).toISOString().slice(0, 10),
      bestWindow: { sunlightPct: Math.round(r.sunFrac * 100), earthContactPct: Math.round(r.commFrac * 100), longestDarkHours: r.longestDarkH },
      slopeDeg: atlas.slope[r.index], heightM: atlas.height[r.index] })),
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
      batt: clamp(q.batt, 500, 20000, p.batt), slope: clamp(q.slope, 2, 20, p.slope), dsn: typeof q.dsn === 'boolean' ? q.dsn : p.dsn }
    setP(next)
    run(next)
  }

  const enter = (mode: DriveMode) => {
    if (!pick || !detail || !ran) return
    setDrive({ mode, start: { x: atlas.xKm[pick.index] * 1000, y: atlas.yKm[pick.index] * 1000, hour: detail.fh + detail.a,
      missionH: detail.len, startMs: startDate(pick.bestStart).getTime(),
      label: `#${sel + 1} · ${region(pick) ?? `${pick.lat.toFixed(2)}°, ${pick.lon.toFixed(2)}°E`} · ${fmtDate(startDate(pick.bestStart))}` } })
  }

  return (
    <div className={`app ${drive ? 'driving' : ''}`}>
      {drive && eph && dsn && (
        <Suspense fallback={<div className="drive"><div className="drive-loading">…</div></div>}>
          <Drive start={drive.start} eph={eph} dsn={dsn} lang={lang} initialMode={drive.mode} onExit={() => setDrive(null)} />
        </Suspense>
      )}
      <section className="hero">
        <div className="globe-wrap">
          <Suspense fallback={null}>
            <Globe poleCap={m.pole_cap} overlay={overlay} pins={pins} earthLabel={lang === 'tr' ? 'Dünya' : 'Earth'}
                   selected={pick ? { lat: pick.lat, lon: pick.lon, label: `#${sel + 1}` } : null}
                   sunDir={sunDir} earthDir={earthDir} onPick={setSel} />
          </Suspense>
          <div className="legend">{S.legend[lang]}</div>
        </div>
        <header className="topbar">
          <div className="brand">Luna<span>Nav</span></div>
          <div className="lang">
            {(['en', 'tr'] as Lang[]).map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l === 'en' ? 'English' : 'Türkçe'}</button>
            ))}
          </div>
        </header>
        <Luna lang={lang} context={lunaContext} onAction={onLuna} />
        <aside className="panel">
          <h1>{S.hero[lang]}</h1>
          <p className="intro">{S.sub[lang]}</p>
          <div className="presets">
            {PRESETS.map((pr) => (
              <button key={pr.id} className={p.days === pr.days && p.sun === pr.sun && p.batt === pr.batt ? 'on' : ''}
                      onClick={() => setP((o) => ({ ...o, days: pr.days, sun: pr.sun, earth: pr.earth, shadow: pr.shadow, batt: pr.batt }))}>
                {pr.name[lang]}
              </button>
            ))}
          </div>
          <div className="form">
            <label>{S.window[lang]}
              <span className="row">
                <input type="date" value={p.start} min="2026-11-01" max="2028-11-30" onChange={(e) => e.target.value && set('start', e.target.value)} />
                <Slider v={p.windowDays} min={5} max={90} step={5} on={(v) => set('windowDays', v)} unit={` ${S.days[lang]}`} />
              </span>
            </label>
            <label>{S.stay[lang]}<Slider v={p.days} min={1} max={30} on={(v) => set('days', v)} unit={` ${S.days[lang]}`} /></label>
            <label>{S.needSun[lang]}<Slider v={p.sun} min={0} max={100} step={5} on={(v) => set('sun', v)} unit="%" /></label>
            <label>{S.needEarth[lang]}<Slider v={p.earth} min={0} max={100} step={5} on={(v) => set('earth', v)} unit="%" /></label>
            <label>{S.maxShadow[lang]}<Slider v={p.shadow} min={0} max={240} step={6} on={(v) => set('shadow', v)} unit=" h" /></label>
            <label>{S.battery[lang]}<Slider v={p.batt} min={500} max={20000} step={500} on={(v) => set('batt', v)} unit=" Wh" /></label>
            <label>{S.slope[lang]}<Slider v={p.slope} min={2} max={20} on={(v) => set('slope', v)} unit="°" /></label>
            <label className="check"><input type="checkbox" checked={p.dsn} onChange={(e) => set('dsn', e.target.checked)} /> {S.dsn[lang]}</label>
          </div>
          <button className="go-btn" disabled={progress !== null} onClick={() => run(p)}>
            {progress !== null ? `${S.searching[lang]} ${Math.round(progress * 100)}%` : S.search[lang]}
            {progress !== null && <i style={{ width: `${progress * 100}%` }} />}
          </button>
          {ran && (
            <p className="stats">{atlas.n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} {S.stats[lang]} ·{' '}
              {(ran.hoursChecked / 1e6).toFixed(1)} M {S.hoursChecked[lang]} · {(ran.ms / 1000).toFixed(1)} {S.seconds[lang]}</p>
          )}
          {results && ran && (
            <div className="results">
              <div className="results-head">
                <h3>{S.results[lang]}</h3>
                <span>
                  <button className="mini" onClick={() => download(`lunanav-${ran.q.start}.csv`, toCsv(rows))}>⬇ {S.csv[lang]}</button>
                  <button className="mini" onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(reportHtml(cmpRows.length >= 2 ? cmpRows : rows, ran.q, constraints(ran.q)!, m.sources, lang)); w.document.close() }
                  }}>🖨 {S.report[lang]}</button>
                </span>
              </div>
              {top.length === 0 || top[0].goCount === 0 ? <p className="note">{S.nothing[lang]}</p> : null}
              <ol>
                {top.map((r, k) => (
                  <li key={r.index} className={k === sel ? 'on' : ''} onClick={() => setSel(k)}>
                    <b className={r.goCount > 0 ? 'g' : 'r'}>{k + 1}</b>
                    <button className={`cmp-tog ${cmp.includes(r.index) ? 'on' : ''}`} title={S.compare[lang]}
                            onClick={(e) => { e.stopPropagation(); setCmp((c) => c.includes(r.index) ? c.filter((x) => x !== r.index) : [...c, r.index].slice(-4)) }}>⇄</button>
                    <span>
                      <em>{r.lat.toFixed(2)}°, {r.lon.toFixed(2)}°E{region(r) ? ` · ${region(r)}` : ''}</em>
                      {S.goDays[lang]} {r.goCount} {S.of[lang]} {ran.q.windowDays} {S.landingDates[lang]} · {S.bestDate[lang]} {fmtDate(startDate(r.bestStart))}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </section>

      {detail && ran && pick && (
        <main className="content">
          <div className="card site-head">
            <div>
              <h3>#{sel + 1} · {pick.lat.toFixed(3)}°, {pick.lon.toFixed(3)}°E {region(pick) ? `· ${S.inRegion[lang]} ${region(pick)}` : ''}</h3>
              <p className="muted">{S.bestDate[lang]}: {fmtDate(startDate(pick.bestStart))} · {ran.q.days} {S.days[lang]} · {lang === 'tr' ? 'eğim' : 'slope'} {atlas.slope[pick.index].toFixed(1)}° · {lang === 'tr' ? 'yükseklik' : 'height'} {atlas.height[pick.index]} m</p>
            </div>
            <div className={`verdict small ${detail.w.go ? 'go' : 'nogo'}`}>
              <div className="word">{detail.w.go ? 'GO' : 'NO-GO'}</div>
              <div className="why">{why(detail.w, 1, detail.c, lang)}</div>
            </div>
            <div className="tiles">
              <Tile icon="☀️" title={T.sunlight[lang]} value={fmtPct(detail.w.sunFrac, lang)} note={T.ofMission[lang]} ok={detail.w.sunFrac >= detail.c.min_sun_frac} />
              <Tile icon="🌍" title={T.earth[lang]} value={fmtPct(detail.w.commFrac, lang)} note={ran.q.dsn ? '📡 + NASA DSN' : T.ofMission[lang]} ok={detail.w.commFrac >= detail.c.min_comm_frac} />
              <Tile icon="🔋" title={T.battery[lang]} ok={detail.w.survived}
                    value={detail.w.survived ? T.lasts[lang] : `✕ ${hours(detail.w.power.firstFailure ?? 0, lang)}`}
                    note={detail.need === 0 ? '—' : `${Math.round(detail.need).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} Wh`} />
            </div>
          </div>
          {cmpRows.length >= 2 ? <Compare rows={cmpRows} lang={lang} onClear={() => setCmp([])} />
            : <p className="note cmp-hint">⇄ {S.compareHint[lang]}</p>}
          <div className="card be-there">
            <p>{S.beThere[lang]}</p>
            <div className="be-btns">
              <button className="big" onClick={() => enter('lander')}>🛬 {S.standHere[lang]}</button>
              <button className="big" onClick={() => enter('rover')}>🚙 {S.driveHere[lang]}</button>
            </div>
          </div>
          <div className="card">
            <h3>{S.otherDates[lang]}</h3>
            <div className="calendar">
              {detail.perStart.map((go, s) => (
                <span key={s} className={`${go ? 'go' : 'nogo'} ${s === pick.bestStart ? 'best' : ''}`} title={fmtDate(startDate(s))}>
                  {startDate(s).getUTCDate()}
                </span>
              ))}
            </div>
            <h3 style={{ marginTop: 16 }}>{T.dayByDay[lang]}</h3>
            <DayStrip sun={Array.from({ length: detail.len }, (_, j) => detail.series.sunFraction[detail.a + j] >= 0.5)}
                      earth={Array.from({ length: detail.len }, (_, j) => detail.series.earthVisible[detail.a + j])}
                      link={Array.from({ length: detail.len }, (_, j) => detail.tr.link[detail.a + j])} lang={lang} />
            <p className="note">📡 {T.dsnNote[lang]}</p>
          </div>
          <HorizonView horizon={detail.tr.horizon} series={detail.series} i0={detail.a} len={detail.len} stepH={1}
                       startMs={startDate(pick.bestStart).getTime()} lang={lang} />
          <footer className="foot">
            <a href={PLANNER_URL} target="_blank" rel="noreferrer">{T.planner[lang]} ↗</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">{T.source[lang]} · GitHub ↗</a>
            <span>{m.sources.join(' · ')}</span>
          </footer>
        </main>
      )}
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
    <div className="card compare">
      <div className="results-head"><h3>⇄ {S.compareTitle[lang]}</h3><button className="mini" onClick={onClear}>{S.clear[lang]}</button></div>
      <table>
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
          <tr><td>☀ {tr ? 'Gün gün güneş' : 'Sun, day by day'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.sunDaily.map((v, d) => <i key={d} style={{ background: `rgba(242,183,5,${0.1 + 0.9 * v})` }} />)}</span></td>)}</tr>
          <tr><td>📡 {tr ? 'Gün gün bağlantı' : 'Link, day by day'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.earthDaily.map((v, d) => <i key={d} style={{ background: `rgba(78,168,222,${0.1 + 0.9 * v})` }} />)}</span></td>)}</tr>
          <tr><td>{tr ? 'Tarih takvimi' : 'Landing dates'}</td>
            {rows.map((r) => <td key={r.index}><span className="spark">{r.perStart.map((g, d) => <i key={d} className={g ? 'g' : 'r'} />)}</span></td>)}</tr>
        </tbody>
      </table>
    </div>
  )
}

function Slider({ v, min, max, step = 1, on, unit }: { v: number; min: number; max: number; step?: number; on: (v: number) => void; unit: string }) {
  return (
    <span className="slider">
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} />
      <output>{v.toLocaleString()}{unit}</output>
    </span>
  )
}

function Tile({ icon, title, value, note, ok }: { icon: string; title: string; value: string; note: string; ok: boolean }) {
  return (
    <div className={`tile ${ok ? 'ok' : 'bad'}`}>
      <div className="t-title">{icon} {title}</div>
      <div className="t-value">{value}</div>
      <div className="t-note">{note}</div>
    </div>
  )
}

function DayStrip({ sun, earth, link, lang }: { sun: boolean[]; earth: boolean[]; link: boolean[]; lang: Lang }) {
  const days = Math.floor(sun.length / 24)
  const share = (a: boolean[], d: number) => a.slice(d * 24, d * 24 + 24).filter(Boolean).length / 24
  const rows: [string, string, boolean[]][] = [[`☀️ ${T.sunUp[lang]}`, '242,183,5', sun], [`🌍 ${T.earthUp[lang]}`, '78,168,222', earth],
    [`📡 ${T.radio[lang]}`, '52,199,89', link]]
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
