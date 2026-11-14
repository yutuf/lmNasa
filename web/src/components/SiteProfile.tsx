// A full-page site profile, like an F1 driver page: a hero in the region's colour with the terrain render, the
// rank and the name, then the numbers that decide the landing, and the ways to go deeper.
import { useEffect } from 'react'
import { ArrowLeft, Car, Footprints, Microscope, PlaneLanding, Rocket } from 'lucide-react'
import { fmtHoursShort, fmtPercent, verdictLabel, type Lang } from '../i18n'
import { PlaceTitle, useSiteImage, type CardSite } from './SiteCard'
import VehiclePhoto from './VehiclePhoto'
import ProbabilityPanel from './ProbabilityPanel'
import { landerById } from '../vehicles'
import SiteExtras, { type SiteCtx } from './SiteExtras'

export default function SiteProfile({ s, lang, lander, onClose, onWatch, onStand, onDrive, onWalk, onAnalysis, history, onHistory, ctx }: {
  lander: string; history: boolean; onHistory: (v: boolean) => void; ctx?: SiteCtx | null
  s: CardSite; lang: Lang; onClose: () => void; onWatch: () => void; onStand: () => void; onDrive: () => void; onWalk: () => void; onAnalysis: () => void
}) {
  const img = useSiteImage(s)
  const tr = lang === 'tr'
  const r = s.row
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    document.body.classList.add('no-scroll')
    return () => { removeEventListener('keydown', k); document.body.classList.remove('no-scroll') }
  }, [onClose])
  // uncertainty: the 5th-95th percentile across the success simulation's missions (launch slip, horizon error, scatter
  // across the landing zone, battery wear); for map values, where the number comes from
  const pr = s.prob
  const rangePct = (x: [number, number, number] | undefined) => (x ? (tr ? `simülasyonlarda %${Math.round(x[0])}–%${Math.round(x[2])}` : `across simulations ${Math.round(x[0])}–${Math.round(x[2])}%`) : undefined)
  const rangeH = (x: [number, number, number] | undefined) => (x ? (tr ? `simülasyonlarda ${Math.round(x[0])}–${Math.round(x[2])} sa` : `across simulations ${Math.round(x[0])}–${Math.round(x[2])} h`) : undefined)
  const stats: [string, string, string?, string?][] = [
    [tr ? 'Uygun iniş tarihi' : 'GO landing dates', `${r.goDates}/${r.windowDays}`],
    [tr ? 'En iyi iniş' : 'Best landing', s.bestDate],
    [tr ? 'Güneş ışığı' : 'Sunlight', fmtPercent(r.sunPct, lang), 'sun', rangePct(pr?.sunPct)],
    [tr ? 'Dünya bağlantısı' : 'Earth contact', fmtPercent(r.earthPct, lang), 'earth', rangePct(pr?.earthPct)],
    [tr ? 'En uzun karanlık' : 'Longest darkness', fmtHoursShort(r.longestDarkH, lang), 'dark', rangeH(pr?.darkH)],
    [tr ? 'Gereken batarya' : 'Battery needed', `${r.batteryNeedWh.toLocaleString(tr ? 'tr-TR' : 'en-US')} Wh`, 'batt'],
    [tr ? 'İniş alanı eğimi (%95)' : 'Landing zone slope (95%)', r.zoneSlopeDeg === null ? '–' : `${r.zoneSlopeDeg.toFixed(1)}°`, 'safe', r.zoneSlopeDeg === null ? undefined : (tr ? 'LOLA 40 m eğim haritası' : 'LOLA 40 m slope map')],
    [tr ? 'En yakın buz' : 'Nearest water ice', r.iceKm === null ? '–' : `${r.iceKm.toFixed(1)} km`, 'ice', r.iceKm === null ? undefined : (tr ? 'Diviner + kalıcı gölge haritası' : 'Diviner + shadow map')],
    [tr ? 'Yaklaşma' : 'Approach', `${r.approachDeg === 0 ? (tr ? 'Kuzeye' : 'Heading N') : (tr ? 'Güneye' : 'Heading S')} · ${tr ? 'Güneş' : 'Sun'} ${r.sunOffDeg}°`, 'route'],
    [tr ? 'Yükseklik' : 'Height', `${r.heightM.toLocaleString(tr ? 'tr-TR' : 'en-US')} m`],
  ]
  return (
    <div className="profile" role="dialog" aria-modal="true" aria-label={s.name} style={{ ['--team' as string]: s.colour }}>
      <div className="profile-hero">
        <button className="profile-back" onClick={onClose}><ArrowLeft size={16} /> {tr ? 'Sonuçlar' : 'Results'}</button>
        <div className="ph-text">
          <span className="ph-rank">{String(s.rank).padStart(2, '0')}</span>
          <PlaceTitle text={s.name} placeName={s.placeName} light="ph-first" bold="ph-last" />
          <span className="ph-region">{s.region ?? (tr ? 'Açık arazi' : 'Open terrain')} · {r.lat.toFixed(3)}°, {r.lon.toFixed(2)}°E</span>
          <span className={`ph-verdict ${r.goDates > 0 ? 'go' : 'nogo'}`}>{verdictLabel(r.goDates > 0, lang)}</span>
          {s.note && <span className="ph-note-chip">{s.note}</span>}
        </div>
        <div className="ph-visual">
          {img ? <img className="ph-img" src={img} alt={tr ? 'Noktanın arazisi' : 'Terrain around the site'} /> : <span className="ph-img" />}
          <VehiclePhoto kind="lander" id={lander} alt={landerById(lander).name} className="ph-lander" />
          <span className="ph-lander-name">{landerById(lander).name}</span>
        </div>
      </div>
      <div className="profile-body">
        {s.prob && <ProbabilityPanel prob={s.prob} lang={lang} history={history} onHistory={onHistory} />}
        <div className="ph-stats">
          {stats.map(([k, v, tone, note]) => (
            <div key={k} className={`ph-stat ${tone ?? ''}`}><span>{k}</span><b>{v}</b>{note && <small className="ph-range">{note}</small>}</div>
          ))}
        </div>
        {s.ellipse && s.ellipse.points > 1 && (
          <div className="ph-ellipse">
            <div className="ph-ellipse-h">
              <b>{tr ? 'İniş elipsinin içinde en kötü durum' : 'Worst case inside the landing ellipse'}</b>
              <span>{tr ? `${s.ellipse.radiusKm.toFixed(0)} km içindeki ${s.ellipse.points} noktada, aynı iniş tarihinde` : `${s.ellipse.points} points within ${s.ellipse.radiusKm.toFixed(0)} km, same landing date`}</span>
            </div>
            <div className="ph-ellipse-grid">
              <div className={s.ellipse.go === s.ellipse.points ? 'ok' : s.ellipse.go > 0 ? 'warn' : 'bad'}><span>{tr ? 'Geçen noktalar' : 'Points that pass'}</span><b>{s.ellipse.go}/{s.ellipse.points}</b></div>
              <div><span>{tr ? 'En az güneş' : 'Least sunlight'}</span><b>{fmtPercent(s.ellipse.worstSun, lang)}</b></div>
              <div><span>{tr ? 'En az Dünya bağlantısı' : 'Least Earth contact'}</span><b>{fmtPercent(s.ellipse.worstEarth, lang)}</b></div>
              <div><span>{tr ? 'En uzun karanlık' : 'Longest darkness'}</span><b>{fmtHoursShort(s.ellipse.worstDarkH, lang)}</b></div>
              <div><span>{tr ? 'En dik nokta (400 m ölçekli)' : 'Steepest point (400 m scale)'}</span><b>{s.ellipse.worstSlope.toFixed(1)}°</b></div>
            </div>
          </div>
        )}
        {ctx && <SiteExtras ctx={ctx} s={s} lang={lang} />}
        {pr && <p className="ph-stats-note">{tr
          ? `Aralıklar: ${pr.trials} simüle görevin %90’ı. Fırlatma gecikmesi iniş tarihini de kaydırır; yani bu, tek bir tarihin hata payı değil, görevin olası sonuçlarıdır (ufuk hatası, iniş alanında dağılım, batarya yıpranması dahil).`
          : `Ranges: 90 % of ${pr.trials} simulated missions. A launch slip also moves the landing date, so this is the spread of outcomes for the mission, not an error bar on one date (it includes horizon error, scatter across the landing zone and battery wear).`}</p>}
        <div className="ph-strips">
          <div><span>{tr ? 'Her iniş tarihi' : 'Every landing date in the window'}</span>
            <div className="ph-cal marks" role="list">{r.perStart.map((g, k) => <i key={k} role="listitem" className={g ? 'go' : 'nogo'} title={`${tr ? 'Gün' : 'Day'} ${k + 1}: ${verdictLabel(g, lang)}`} aria-label={`${tr ? 'Gün' : 'Day'} ${k + 1}: ${verdictLabel(g, lang)}`} />)}</div></div>
          <div><span>{tr ? 'Gün gün güneş' : 'Sun, day by day'}</span>
            <div className="ph-cal">{r.sunDaily.map((v, k) => <i key={k} style={{ background: `rgba(255,200,61,${0.12 + 0.88 * v})` }} />)}</div></div>
          <div><span>{tr ? 'Gün gün Dünya bağlantısı' : 'Earth link, day by day'}</span>
            <div className="ph-cal">{r.earthDaily.map((v, k) => <i key={k} style={{ background: `rgba(96,165,250,${0.12 + 0.88 * v})` }} />)}</div></div>
        </div>
        <div className="ph-actions">
          <button className="btn primary" onClick={onWatch}><Rocket size={15} /> {tr ? 'İnişi izle' : 'Watch the landing'}</button>
          <button className="btn" onClick={onStand}><PlaneLanding size={15} /> {tr ? 'İniş aracında dur' : 'Stand on the lander'}</button>
          <button className="btn" onClick={onWalk}><Footprints size={15} /> {tr ? 'Ay’da yürü' : 'Walk on the Moon'}</button>
          <button className="btn" onClick={onDrive}><Car size={15} /> {tr ? 'Gezgin sür' : 'Drive a rover'}</button>
          <button className="btn" onClick={onAnalysis}><Microscope size={15} /> {tr ? 'Tam analiz' : 'Full analysis'}</button>
        </div>
        <p className="ph-note">{tr
          ? 'Arazi görüntüsü: NASA LOLA 200 m kutup haritası, en iyi iniş tarihindeki Güneş ile aydınlatılmış (yükseklik 2,2× abartılı); kırmızı direk iniş noktası.'
          : 'Terrain render: NASA LOLA 200 m polar map, lit by the Sun of the best landing date (height exaggerated 2.2×); the red mast is the landing point.'}</p>
      </div>
    </div>
  )
}
