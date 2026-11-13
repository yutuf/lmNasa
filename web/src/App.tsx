import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { loadDsn, loadManifest, loadPatch, loadSeries, type Manifest, type Series, type Spot } from './data'
import { directionMoonFixed } from './geometry'
import { T, fmtPct, hours, why, type Lang } from './i18n'
import { evaluateWindow, requiredBatteryWh } from './model'
import HorizonView from './components/HorizonView'

const Globe = lazy(() => import('./components/Globe'))
const Terrain = lazy(() => import('./components/Terrain'))

const PLANNER_URL = 'https://limitlessapps.streamlit.app/'
const REPO_URL = 'https://github.com/yutuf/lmNasa'
const COMPARE = ['malapert_massif', 'malapert_massif_derived', 'malapert_massif_region_best', 'shackleton_ridge',
  'mission_apollo_11_1969']

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1))
  return { spot: p.get('spot') ?? 'malapert_massif', date: p.get('date') ?? '2027-09-09', lang: (p.get('lang') ?? 'en') as Lang }
}

export default function App() {
  const init = readHash()
  const [m, setM] = useState<Manifest | null>(null)
  const [dsn, setDsn] = useState<boolean[] | null>(null)
  const [lang, setLang] = useState<Lang>(init.lang === 'tr' ? 'tr' : 'en')
  const [spotId, setSpotId] = useState(init.spot)
  const [date, setDate] = useState(init.date)
  const [series, setSeries] = useState<Record<string, Series>>({})
  const [patch, setPatch] = useState<Int16Array | null>(null)
  const [hour, setHour] = useState(0)

  useEffect(() => { loadManifest().then(setM) }, [])
  useEffect(() => { if (m) loadDsn(m.dsn).then(setDsn) }, [m])
  const spot: Spot | undefined = m?.spots.find((s) => s.id === spotId) ?? m?.spots[0]
  useEffect(() => {
    if (!m || !spot) return
    const want = new Set([spot.id, ...COMPARE])
    want.forEach((id) => {
      const s = m.spots.find((x) => x.id === id)
      if (s && !series[id]) loadSeries(s, m.n).then((v) => setSeries((old) => ({ ...old, [id]: v })))
    })
    setPatch(null)
    loadPatch(spot).then(setPatch)
    setHour(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, spot?.id])
  useEffect(() => { history.replaceState(null, '', `#spot=${spotId}&date=${date}&lang=${lang}`) }, [spotId, date, lang])

  const c = m?.constraints
  const len = m && c ? Math.round((c.duration_days * 24) / m.step_h) : 0
  const startMs = Date.parse(date + 'T00:00:00Z')
  const i0 = m ? Math.round((startMs / 1000 - m.start_unix) / 3600 / m.step_h) : 0
  const v = spot ? series[spot.id] : undefined
  const valid = m && i0 >= 0 && i0 + len <= m.n

  const verdict = useMemo(() => {
    if (!m || !c || !v || !valid) return null
    const sf = v.sunFraction.subarray(i0, i0 + len)
    const w = evaluateWindow(sf, v.earthVisible.slice(i0, i0 + len), m.step_h, c)
    return { w, need: requiredBatteryWh(sf, m.step_h, c) }
  }, [m, c, v, i0, len, valid])

  const verdictAt = (id: string, start: number) => {
    const s = series[id]
    if (!m || !c || !s || start < 0 || start + len > m.n) return null
    return evaluateWindow(s.sunFraction.subarray(start, start + len), s.earthVisible.slice(start, start + len), m.step_h, c).go
  }

  if (!m || !c || !spot) return <div className="loading">LunaNav…</div>
  const minDate = new Date(m.start_unix * 1000).toISOString().slice(0, 10)
  const maxDate = new Date((m.start_unix + (m.n - len) * 3600 * m.step_h) * 1000).toISOString().slice(0, 10)
  const k = Math.min(hour, len - 1)
  const sunDir = v && valid ? directionMoonFixed(v.sunAlt[i0], v.sunAz[i0], spot.lat, spot.lon) : [1, 0, 0]
  const earthDir = v && valid ? directionMoonFixed(v.earthAlt[i0], v.earthAz[i0], spot.lat, spot.lon) : [1, 0, 0]
  const link = v && dsn && valid ? Array.from({ length: len }, (_, j) => v.earthVisible[i0 + j] && dsn[i0 + j]) : null
  const groups: [Spot['group'], string][] = [['pole', T.pole[lang]], ['artemis', T.artemis[lang]], ['mission', T.missions[lang]]]

  return (
    <div className="app">
      <section className="hero">
        <div className="globe-wrap">
          <Suspense fallback={null}>
            <Globe poleCap={m.pole_cap} spots={m.spots} selected={spot} sunDir={sunDir} earthDir={earthDir} lang={lang} onSelect={setSpotId} />
          </Suspense>
        </div>
        <header className="topbar">
          <div className="brand">Luna<span>Nav</span></div>
          <div className="lang">
            {(['en', 'tr'] as Lang[]).map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l === 'en' ? 'English' : 'Türkçe'}</button>
            ))}
          </div>
        </header>
        <aside className="panel">
          <h1>{T.title[lang]}</h1>
          <h2>{T.question[lang]}</h2>
          <p className="intro">{T.intro[lang]}</p>
          <div className="pickers">
            <select value={spot.id} onChange={(e) => setSpotId(e.target.value)} aria-label="spot">
              {groups.map(([g, label]) => (
                <optgroup key={g} label={label}>
                  {m.spots.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
                </optgroup>
              ))}
            </select>
            <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)}
                   aria-label={T.date[lang]} />
          </div>
          <p className="desc">{spot.desc[lang]} <span className="coords">{spot.lat.toFixed(3)}°, {spot.lon.toFixed(3)}°E</span></p>
          {verdict ? (
            <>
              <div className={`verdict ${verdict.w.go ? 'go' : 'nogo'}`}>
                <div className="word">{verdict.w.go ? 'GO' : 'NO-GO'}</div>
                <div className="why">{why(verdict.w, m.step_h, c, lang)}</div>
              </div>
              <div className="tiles">
                <Tile icon="☀️" title={T.sunlight[lang]} value={fmtPct(verdict.w.sunFrac, lang)} note={T.ofMission[lang]} ok={verdict.w.sunFrac >= c.min_sun_frac} />
                <Tile icon="🌍" title={T.earth[lang]} value={fmtPct(verdict.w.commFrac, lang)}
                      note={link ? `📡 ${fmtPct(link.filter(Boolean).length / len, lang)}` : T.ofMission[lang]} ok={verdict.w.commFrac >= c.min_comm_frac} />
                <Tile icon="🔋" title={T.battery[lang]} ok={verdict.w.survived}
                      value={verdict.w.survived ? T.lasts[lang] : `✕ ${hours((verdict.w.power.firstFailure ?? 0) * m.step_h, lang)}`}
                      note={verdict.need === 0 ? '—' : `${Math.round(verdict.need).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} Wh`} />
              </div>
            </>
          ) : <div className="verdict wait">…</div>}
        </aside>
      </section>

      {verdict && v && (
        <main className="content">
          <div className="card">
            <h3>{T.dayByDay[lang]}</h3>
            <DayStrip v={v} i0={i0} len={len} perDay={Math.round(24 / m.step_h)} link={link} lang={lang} />
            <p className="note">📡 {T.dsnNote[lang]}</p>
          </div>
          <div className="card">
            <h3>{T.slips[lang]}</h3>
            <div className="chips">
              {([[T.onTime, 0], [T.late1d, 1], [T.late1w, 7], [T.late2w, 14], [T.late1m, 30]] as const).map(([label, d]) => (
                <Chip key={d} label={label[lang]} go={verdictAt(spot.id, i0 + Math.round((d * 24) / m.step_h))} lang={lang} />
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>{T.otherSpots[lang]}</h3>
            <div className="chips">
              {COMPARE.map((id) => {
                const s = m.spots.find((x) => x.id === id)!
                return <Chip key={id} label={s.name[lang]} go={verdictAt(id, i0)} lang={lang} onClick={() => setSpotId(id)} />
              })}
            </div>
          </div>
          <HorizonView horizon={spot.horizon} series={v} i0={i0} len={len} stepH={m.step_h} startMs={startMs} lang={lang} />
          {spot.patch && patch && (
            <div className="card">
              <div className="card-head">
                <h3>{T.ground3d[lang]}</h3>
                <span className="muted">{((spot.patch.n - 1) * spot.patch.spacing_m / 1000).toFixed(0)} × {((spot.patch.n - 1) * spot.patch.spacing_m / 1000).toFixed(0)} km · NASA LOLA</span>
              </div>
              <div className="terrain-wrap">
                <Suspense fallback={null}>
                  <Terrain spot={spot} heights={patch} sunAz={v.sunAz[i0 + k]} sunAlt={v.sunAlt[i0 + k]}
                           earthAz={v.earthAz[i0 + k]} earthAlt={v.earthAlt[i0 + k]} />
                </Suspense>
              </div>
              <label className="hour">
                {T.hour[lang]}: <b>{T.day[lang]} {Math.floor((k * m.step_h) / 24) + 1}, {String((k * m.step_h) % 24).padStart(2, '0')}:00</b> ·
                ☀ {v.sunAlt[i0 + k].toFixed(1)}° · {v.sunFraction[i0 + k] >= 0.5 ? '✅' : '🌑'}
                <input className="range" type="range" min={0} max={len - 1} value={k} onChange={(e) => setHour(+e.target.value)} />
              </label>
              <p className="note">{T.dragTurn[lang]}. {T.terrainNote[lang]}</p>
            </div>
          )}
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

function Tile({ icon, title, value, note, ok }: { icon: string; title: string; value: string; note: string; ok: boolean }) {
  return (
    <div className={`tile ${ok ? 'ok' : 'bad'}`}>
      <div className="t-title">{icon} {title}</div>
      <div className="t-value">{value}</div>
      <div className="t-note">{note}</div>
    </div>
  )
}

function Chip({ label, go, lang, onClick }: { label: string; go: boolean | null; lang: Lang; onClick?: () => void }) {
  const cls = go === null ? 'none' : go ? 'go' : 'nogo'
  return (
    <button className={`chip ${cls}`} onClick={onClick} disabled={!onClick}>
      <span>{label}</span>
      <b>{go === null ? T.noData[lang] : go ? 'GO' : 'NO-GO'}</b>
    </button>
  )
}

function DayStrip({ v, i0, len, perDay, link, lang }: { v: Series; i0: number; len: number; perDay: number; link: boolean[] | null; lang: Lang }) {
  const days = Math.floor(len / perDay)
  const share = (f: (j: number) => boolean, d: number) => {
    let n = 0
    for (let j = d * perDay; j < (d + 1) * perDay; j++) if (f(j)) n++
    return n / perDay
  }
  const rows: [string, string, (j: number) => boolean][] = [
    [`☀️ ${T.sunUp[lang]}`, '242,183,5', (j) => v.sunFraction[i0 + j] >= 0.5],
    [`🌍 ${T.earthUp[lang]}`, '78,168,222', (j) => v.earthVisible[i0 + j]],
  ]
  if (link) rows.push([`📡 ${T.radio[lang]}`, '52,199,89', (j) => link[j]])
  return (
    <div className="strip">
      {rows.map(([label, rgb, f]) => (
        <div className="strip-row" key={label}>
          <span>{label}</span>
          {Array.from({ length: days }, (_, d) => {
            const s = share(f, d)
            return <i key={d} title={`${T.day[lang]} ${d + 1}: ${fmtPct(s, lang)}`} style={{ background: `rgba(${rgb},${0.08 + 0.92 * s})` }} />
          })}
        </div>
      ))}
      <div className="strip-row days"><span>{T.day[lang]}</span>{Array.from({ length: days }, (_, d) => <em key={d}>{d + 1}</em>)}</div>
    </div>
  )
}
