// The mission workshop: build your own lander (with or without a rover) or a satellite, part by part, and see the
// engineering consequences live: a blueprint drawing, the mass and power budgets, and the landing-site requirements
// the design implies. "Launch this mission" runs the real search with them.
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Rocket, X, XCircle } from 'lucide-react'
import type { Lang } from '../i18n'
import { GOALS, SCIENCE_KIND, type ScienceKind } from '../scienceSites'
import { ROVERS } from '../vehicles'
import { DEFAULT_DESIGN, ORBIT_PRESETS, budget, orbitStats, type Budget, type Design } from '../workshop'

type T = Record<Lang, string>
const L: Record<string, T> = {
  title: { en: 'Workshop', tr: 'Atölye' },
  sub: { en: 'Engineer your own mission. Every part changes the budgets, and the budgets decide where it can land.', tr: 'Kendi görevini tasarla. Her parça bütçeleri, bütçeler de nereye inebileceğini değiştirir.' },
  lander: { en: 'Lander', tr: 'İniş aracı' }, rover: { en: 'Lander + rover', tr: 'İniş aracı + gezgin' }, orbiter: { en: 'Satellite', tr: 'Uydu' },
  name: { en: 'Mission name', tr: 'Görev adı' }, solar: { en: 'Solar array', tr: 'Güneş paneli' }, battery: { en: 'Battery', tr: 'Batarya' },
  landing: { en: 'Landing', tr: 'İniş' }, soft: { en: 'Soft · powered to 1 m/s', tr: 'Yumuşak · 1 m/sn’ye kadar motorlu' },
  rough: { en: 'Rough · airbags, 5 m/s', tr: 'Sert · hava yastığı, 5 m/sn' }, nav: { en: 'Navigation', tr: 'Seyrüsefer' },
  std: { en: 'Standard · ±1 km', tr: 'Standart · ±1 km' }, prec: { en: 'Precision lidar · ±100 m', tr: 'Hassas lidar · ±100 m' },
  legs: { en: 'Legs', tr: 'Bacaklar' }, narrow: { en: 'Narrow', tr: 'Dar' }, wide: { en: 'Wide stance', tr: 'Geniş duruş' },
  comms: { en: 'Talking home', tr: 'Eve iletişim' }, dte: { en: 'Direct to Earth', tr: 'Doğrudan Dünya' }, relay: { en: 'Via relay satellite', tr: 'Röle uydusuyla' },
  days: { en: 'Days on the surface', tr: 'Yüzeyde gün' }, goal: { en: 'Science', tr: 'Bilim' }, none: { en: 'None', tr: 'Yok' },
  carried: { en: 'Rover', tr: 'Gezgin' }, orbit: { en: 'Orbit', tr: 'Yörünge' }, peri: { en: 'Lowest point', tr: 'En alçak nokta' },
  apo: { en: 'Highest point', tr: 'En yüksek nokta' }, inc: { en: 'Inclination', tr: 'Eğim' },
  mass: { en: 'Mass budget', tr: 'Kütle bütçesi' }, power: { en: 'Power budget', tr: 'Güç bütçesi' }, needs: { en: 'What it needs from a landing site', tr: 'İniş yerinden ne istiyor' },
  checks: { en: 'Engineering checks', tr: 'Mühendislik kontrolleri' }, launch: { en: 'Launch this mission', tr: 'Bu görevi başlat' },
  prop: { en: 'Propellant (rocket equation)', tr: 'Yakıt (roket denklemi)' }, wet: { en: 'Total at lunar orbit', tr: 'Ay yörüngesinde toplam' },
  coverage: { en: 'Seen from the south pole', tr: 'Güney kutbundan görünürlük' }, period: { en: 'Period', tr: 'Periyot' },
  inview: { en: 'In view (above 10°)', tr: 'Görünür (10° üstü)' }, gap: { en: 'Longest gap', tr: 'En uzun boşluk' }, passes: { en: 'Passes per day', tr: 'Günlük geçiş' },
  model: { en: 'Planning model: rocket equation (Isp 320 s, 1.9 km/s from orbit), 100 W/kg arrays, 150 Wh/kg batteries, 80 % depth of discharge; two-body orbits.',
    tr: 'Planlama modeli: roket denklemi (Isp 320 sn, yörüngeden 1,9 km/sn), 100 W/kg panel, 150 Wh/kg batarya, %80 deşarj; iki cisim yörüngeleri.' },
}

function Seg<V extends string>({ v, opts, on }: { v: V; opts: [V, string][]; on: (v: V) => void }) {
  return <div className="seg full ws-seg">{opts.map(([k, label]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => on(k)}>{label}</button>)}</div>
}

function Slider({ label, v, min, max, step, unit, on, fmt }: { label: string; v: number; min: number; max: number; step: number; unit: string; on: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="ws-slider">
      <span>{label}<b>{fmt ? fmt(v) : v.toLocaleString('en-US')} {unit}</b></span>
      <input className="rng" type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)}
             style={{ ['--p' as string]: `${((v - min) / (max - min)) * 100}%` }} />
    </label>
  )
}

/** The engineering drawing: proportions follow the design (array span, battery, leg stance, airbags, lidar, antenna). */
function Blueprint({ d, b, lang }: { d: Design; b: Budget; lang: Lang }) {
  const tr = lang === 'tr'
  if (d.type === 'orbiter') {
    const rp = 1737 + Math.min(d.orbit.periKm, d.orbit.apoKm), ra = 1737 + Math.max(d.orbit.periKm, d.orbit.apoKm)
    const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp)
    // linear scale that fits the whole orbit; the Moon sits at the focus (true geometry), at least a few pixels wide
    const sc = 360 / (rp + ra)
    const A = a * sc, B = A * Math.sqrt(1 - e * e), F = a * e * sc
    const R = Math.max(6, 1737 * sc)
    const tilt = 90 - d.orbit.incDeg
    return (
      <svg viewBox="0 0 600 440" className="blueprint" role="img" aria-label="Orbit drawing">
        <g transform="translate(300 220)">
          <g transform={`rotate(${tilt} 0 ${-F})`}>
            <ellipse cx={0} cy={0} rx={B} ry={A} className="bp-line" />
            <circle cx={0} cy={A} r={5} className="bp-dot" />
            <text x={10} y={A - 4} className="bp-t">{tr ? 'en yüksek' : 'apolune'} {Math.round(ra - 1737).toLocaleString('en-US')} km</text>
            <circle cx={0} cy={-A} r={4} className="bp-dot" />
            <text x={10} y={-A + 4} className="bp-t">{tr ? 'en alçak' : 'perilune'} {Math.round(rp - 1737).toLocaleString('en-US')} km</text>
          </g>
          <circle cx={0} cy={-F} r={R} className="bp-moon" />
          <text x={R + 6} y={-F + 4} className="bp-t">{tr ? 'AY' : 'MOON'}</text>
          <text x={-R - 6} y={-F + R + 16} textAnchor="end" className="bp-small">{tr ? 'güney ↓' : 'south ↓'}</text>
        </g>
        <text x={16} y={22} className="bp-t">{d.name.toUpperCase()}</text>
        <text x={16} y={38} className="bp-small">{tr ? `eğim ${d.orbit.incDeg}° · ölçekli` : `inclination ${d.orbit.incDeg}° · to scale`}</text>
        <text x={16} y={426} className="bp-small">{tr ? 'İki cisim yörüngesi; NRHO bir elipsle yaklaştırıldı.' : 'Two-body orbit; NRHO approximated by an ellipse.'}</text>
      </svg>
    )
  }
  const ground = 380
  const bodyW = Math.min(190, 80 + b.dryKg / 9), bodyH = 105
  const legH = 66, stance = (d.legs === 'wide' ? 78 : 40) + bodyW / 2
  const top = ground - legH - bodyH, cx = 300
  const span = Math.min(210, 30 + Math.sqrt(d.solarW) * 3.2)
  const battH = Math.min(bodyH - 20, 14 + d.batteryWh / 260)
  return (
    <svg viewBox="0 0 600 440" className="blueprint" role="img" aria-label="Vehicle drawing">
      <line x1={20} y1={ground} x2={580} y2={ground} className="bp-ground" />
      {/* legs and feet (airbags when rough) */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <line x1={cx + s * bodyW * 0.42} y1={top + bodyH} x2={cx + s * stance} y2={ground - 4} className="bp-line" />
          <line x1={cx + s * bodyW * 0.2} y1={top + bodyH} x2={cx + s * (stance - 24)} y2={ground - 4} className="bp-line thin" />
          {d.landing === 'rough'
            ? <circle cx={cx + s * stance} cy={ground - 14} r={14} className="bp-bag" />
            : <rect x={cx + s * stance - 14} y={ground - 5} width={28} height={5} className="bp-fill" />}
        </g>
      ))}
      {/* body, battery inside, engine bell below */}
      <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bodyH} className="bp-body" />
      <rect x={cx - bodyW / 2 + 10} y={top + bodyH - 10 - battH} width={46} height={battH} className="bp-batt" />
      <text x={cx - bodyW / 2 + 33} y={top + bodyH - 14} textAnchor="middle" className="bp-t small">{(d.batteryWh / 1000).toFixed(1)} kWh</text>
      <path d={`M${cx - 14} ${top + bodyH} L${cx - 22} ${top + bodyH + 24} L${cx + 22} ${top + bodyH + 24} L${cx + 14} ${top + bodyH} Z`} className="bp-line" />
      {/* solar wings */}
      {[-1, 1].map((s) => (
        <g key={`w${s}`}>
          <line x1={cx + (s * bodyW) / 2} y1={top + 26} x2={cx + s * (bodyW / 2 + 12)} y2={top + 26} className="bp-line" />
          <rect x={s > 0 ? cx + bodyW / 2 + 12 : cx - bodyW / 2 - 12 - span} y={top + 6} width={span} height={40} className="bp-panel" />
          {Array.from({ length: Math.max(2, Math.round(span / 22)) }, (_, k) => {
            const x0 = s > 0 ? cx + bodyW / 2 + 12 : cx - bodyW / 2 - 12 - span
            const xx = x0 + ((k + 1) * span) / (Math.max(2, Math.round(span / 22)) + 1)
            return <line key={k} x1={xx} y1={top + 6} x2={xx} y2={top + 46} className="bp-line thin" />
          })}
        </g>
      ))}
      {/* antenna */}
      {d.comms === 'dte'
        ? <g><line x1={cx + 20} y1={top} x2={cx + 30} y2={top - 30} className="bp-line" /><path d={`M${cx + 10} ${top - 46} Q${cx + 34} ${top - 22} ${cx + 52} ${top - 52}`} className="bp-line" /></g>
        : <line x1={cx + 20} y1={top} x2={cx + 20} y2={top - 56} className="bp-line" />}
      {/* precision navigation lidar */}
      {d.nav === 'precision' && (
        <g>
          <rect x={cx + bodyW / 2 - 26} y={top + bodyH - 2} width={16} height={10} className="bp-fill" />
          <line x1={cx + bodyW / 2 - 18} y1={top + bodyH + 8} x2={cx + bodyW / 2 - 50} y2={ground} className="bp-beam" />
          <line x1={cx + bodyW / 2 - 18} y1={top + bodyH + 8} x2={cx + bodyW / 2 + 14} y2={ground} className="bp-beam" />
        </g>
      )}
      {/* rover beside the lander */}
      {d.type === 'rover' && (
        <g transform={`translate(${cx + stance + 40} ${ground})`}>
          <rect x={0} y={-30} width={60} height={18} className="bp-body" />
          {[8, 30, 52].map((x) => <circle key={x} cx={x} cy={-8} r={8} className="bp-line" />)}
          <line x1={46} y1={-30} x2={46} y2={-48} className="bp-line" /><rect x={38} y={-56} width={16} height={8} className="bp-fill" />
          <text x={30} y={18} textAnchor="middle" className="bp-t">{ROVERS.find((r) => r.id === d.rover)?.name}</text>
        </g>
      )}
      {/* dimensions and callouts */}
      <line x1={cx - stance} y1={ground + 22} x2={cx + stance} y2={ground + 22} className="bp-dim" />
      <text x={cx} y={ground + 38} textAnchor="middle" className="bp-t">{tr ? 'duruş' : 'stance'} · {tr ? 'en çok' : 'max'} {b.zslope}° {tr ? 'eğim' : 'slope'}</text>
      <text x={cx - bodyW / 2 - 12 - span} y={top - 6} className="bp-t">{d.solarW.toLocaleString('en-US')} W</text>
      <text x={cx} y={top + 50} textAnchor="middle" className="bp-t big">{Math.round(b.dryKg).toLocaleString('en-US')} kg</text>
      <text x={cx} y={top + 66} textAnchor="middle" className="bp-t small">{tr ? 'kuru kütle' : 'dry mass'}</text>
      <text x={16} y={22} className="bp-t">{d.name.toUpperCase()}</text>
      <text x={16} y={38} className="bp-small">{d.landing === 'rough' ? (tr ? 'sert iniş · 5 m/sn' : 'rough landing · 5 m/s') : (tr ? 'yumuşak iniş · 1 m/sn' : 'soft landing · 1 m/s')} · {d.nav === 'precision' ? '±100 m' : `±${b.zone >= 1000 ? '1 km' : `${b.zone} m`}`}</text>
    </svg>
  )
}

export default function Workshop({ lang, onClose, onLaunch }: { lang: Lang; onClose: () => void; onLaunch: (d: Design, b: Budget) => void }) {
  const tr = lang === 'tr'
  const t = (k: string) => L[k][lang]
  const [d, setD] = useState<Design>(DEFAULT_DESIGN)
  const set = <K extends keyof Design>(k: K, v: Design[K]) => setD((x) => ({ ...x, [k]: v }))
  const b = useMemo(() => budget(d), [d])
  const orbit = useMemo(() => (d.type === 'orbiter' ? orbitStats(d.orbit, -89.5, 0, 14) : null), [d])
  const icon = (l: 'ok' | 'warn' | 'bad') => (l === 'ok' ? <CheckCircle2 size={14} /> : l === 'warn' ? <AlertTriangle size={14} /> : <XCircle size={14} />)
  return (
    <div className="workshop" role="dialog" aria-label={t('title')}>
      <div className="ws-head">
        <div><h1>{t('title')}</h1><p>{t('sub')}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="ws-body">
        <div className="ws-controls">
          <Seg v={d.type} opts={[['lander', t('lander')], ['rover', t('rover')], ['orbiter', t('orbiter')]]}
               on={(v) => setD((x) => ({ ...x, type: v, name: v === 'orbiter' ? (tr ? 'Benim uydum' : 'My satellite') : x.name === (tr ? 'Benim uydum' : 'My satellite') ? DEFAULT_DESIGN.name : x.name }))} />
          <label className="ws-field"><span>{t('name')}</span><input value={d.name} maxLength={40} onChange={(e) => set('name', e.target.value)} /></label>
          {d.type === 'orbiter' ? (
            <>
              <div className="ws-presets">{ORBIT_PRESETS.map((o) => (
                <button key={o.id} onClick={() => set('orbit', { periKm: o.periKm, apoKm: o.apoKm, incDeg: o.incDeg })}>{o.name}</button>
              ))}</div>
              <Slider label={t('peri')} v={d.orbit.periKm} min={20} max={5000} step={10} unit="km" on={(v) => set('orbit', { ...d.orbit, periKm: v })} />
              <Slider label={t('apo')} v={d.orbit.apoKm} min={20} max={80000} step={10} unit="km" on={(v) => set('orbit', { ...d.orbit, apoKm: v })} />
              <Slider label={t('inc')} v={d.orbit.incDeg} min={0} max={90} step={1} unit="°" on={(v) => set('orbit', { ...d.orbit, incDeg: v })} />
              <Slider label={t('solar')} v={d.solarW} min={200} max={5000} step={50} unit="W" on={(v) => set('solarW', v)} />
            </>
          ) : (
            <>
              <Slider label={t('solar')} v={d.solarW} min={200} max={5000} step={50} unit="W" on={(v) => set('solarW', v)} />
              <Slider label={t('battery')} v={d.batteryWh} min={500} max={20000} step={250} unit="Wh" on={(v) => set('batteryWh', v)} />
              <Slider label={t('days')} v={d.days} min={1} max={30} step={1} unit={tr ? 'gün' : 'days'} on={(v) => set('days', v)} />
              <div className="ws-label">{t('landing')}</div>
              <Seg v={d.landing} opts={[['soft', t('soft')], ['rough', t('rough')]]} on={(v) => set('landing', v)} />
              <div className="ws-label">{t('nav')}</div>
              <Seg v={d.nav} opts={[['standard', t('std')], ['precision', t('prec')]]} on={(v) => set('nav', v)} />
              <div className="ws-label">{t('legs')}</div>
              <Seg v={d.legs} opts={[['narrow', t('narrow')], ['wide', t('wide')]]} on={(v) => set('legs', v)} />
              <div className="ws-label">{t('comms')}</div>
              <Seg v={d.comms} opts={[['dte', t('dte')], ['relay', t('relay')]]} on={(v) => set('comms', v)} />
              {d.type === 'rover' && (
                <>
                  <div className="ws-label">{t('carried')}</div>
                  <Seg v={d.rover} opts={ROVERS.map((r) => [r.id, r.name] as [string, string])} on={(v) => set('rover', v)} />
                </>
              )}
              <div className="ws-label">{t('goal')}</div>
              <div className="s-goals ws-goals">
                <button className={!d.goal ? 'on' : ''} onClick={() => set('goal', '')}>{t('none')}</button>
                {(Object.keys(GOALS) as ScienceKind[]).map((k) => (
                  <button key={k} className={d.goal === k ? 'on' : ''} style={{ ['--k' as string]: SCIENCE_KIND[k].colour }} onClick={() => set('goal', k)}><i />{GOALS[k][lang]}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ws-draw"><Blueprint d={d} b={b} lang={lang} /></div>
        <div className="ws-sheet">
          <h3>{t('mass')}</h3>
          <table className="ws-table"><tbody>
            {b.parts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{Math.round(p.kg).toLocaleString('en-US')} kg</td></tr>)}
            <tr><td>{t('prop')}</td><td>{Math.round(b.propKg).toLocaleString('en-US')} kg</td></tr>
            <tr className="sum"><td>{t('wet')}</td><td>{Math.round(b.wetKg).toLocaleString('en-US')} kg</td></tr>
          </tbody></table>
          <h3>{t('power')}</h3>
          <table className="ws-table"><tbody>
            <tr><td>{tr ? 'Gündüz tüketim' : 'Day load'}</td><td>{Math.round(b.dayW)} W</td></tr>
            <tr><td>{tr ? 'Gece tüketim (ısıtıcılar)' : 'Night load (heaters)'}</td><td>{Math.round(b.nightW)} W</td></tr>
          </tbody></table>
          {d.type === 'orbiter' && orbit ? (
            <>
              <h3>{t('coverage')}</h3>
              <div className="ws-needs">
                <div><span>{t('period')}</span><b>{orbit.periodH < 48 ? `${orbit.periodH.toFixed(1)} h` : `${(orbit.periodH / 24).toFixed(1)} d`}</b></div>
                <div><span>{t('inview')}</span><b>{orbit.visiblePct}%</b></div>
                <div><span>{t('gap')}</span><b>{orbit.maxGapH < 48 ? `${orbit.maxGapH.toFixed(1)} h` : `${(orbit.maxGapH / 24).toFixed(1)} d`}</b></div>
                <div><span>{t('passes')}</span><b>{orbit.passesPerDay.toFixed(1)}</b></div>
              </div>
              <p className="ws-model">{tr ? 'Bir röle olarak kutuptaki bir iniş aracı, Dünya görünmese de bu sürede eve ulaşabilir.' : 'As a relay, a lander at the pole could reach home this much of the time, even when Earth is below its horizon.'}</p>
            </>
          ) : (
            <>
              <h3>{t('needs')}</h3>
              <div className="ws-needs">
                <div><span>{tr ? 'Güneş en az' : 'Sunlight at least'}</span><b>{b.minSunPct}%</b></div>
                <div><span>{tr ? 'Karanlık en çok' : 'Darkness at most'}</span><b>{b.maxDarkH} h</b></div>
                <div><span>{tr ? 'Dünya bağlantısı' : 'Earth contact'}</span><b>{b.earthPct ? `≥ ${b.earthPct}%` : (tr ? 'röle' : 'relay')}</b></div>
                <div><span>{tr ? 'İniş alanı' : 'Landing zone'}</span><b>±{b.zone >= 1000 ? '1 km' : `${b.zone} m`} · {b.zslope}°</b></div>
              </div>
              <h3>{t('checks')}</h3>
              <ul className="ws-checks">{b.warnings.map((w) => <li key={w.text} className={w.level}>{icon(w.level)}<span>{w.text}</span></li>)}</ul>
              <button className="btn primary ws-launch" onClick={() => onLaunch(d, b)}><Rocket size={16} /> {t('launch')}</button>
            </>
          )}
          <p className="ws-model">{t('model')}</p>
        </div>
      </div>
    </div>
  )
}
