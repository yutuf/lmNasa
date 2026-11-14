// A full-page site profile, like an F1 driver page: a hero in the region's colour with the terrain render, the
// rank and the name, then the numbers that decide the landing, and the ways to go deeper.
import { useEffect } from 'react'
import { ArrowLeft, Car, Footprints, Microscope, PlaneLanding, Rocket } from 'lucide-react'
import type { Lang } from '../i18n'
import { splitName } from '../teams'
import { useSiteImage, type CardSite } from './SiteCard'
import VehiclePhoto from './VehiclePhoto'
import ProbabilityPanel from './ProbabilityPanel'
import { landerById } from '../vehicles'

export default function SiteProfile({ s, lang, lander, onClose, onWatch, onStand, onDrive, onWalk, onAnalysis, history, onHistory }: {
  lander: string; history: boolean; onHistory: (v: boolean) => void
  s: CardSite; lang: Lang; onClose: () => void; onWatch: () => void; onStand: () => void; onDrive: () => void; onWalk: () => void; onAnalysis: () => void
}) {
  const img = useSiteImage(s)
  const tr = lang === 'tr'
  const [light, bold] = splitName(s.name)
  const r = s.row
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    document.body.classList.add('no-scroll')
    return () => { removeEventListener('keydown', k); document.body.classList.remove('no-scroll') }
  }, [onClose])
  const stats: [string, string, string?][] = [
    [tr ? 'Uygun iniş tarihi' : 'GO landing dates', `${r.goDates}/${r.windowDays}`],
    [tr ? 'En iyi iniş' : 'Best landing', s.bestDate],
    [tr ? 'Güneş ışığı' : 'Sunlight', `${r.sunPct}%`, 'sun'],
    [tr ? 'Dünya bağlantısı' : 'Earth contact', `${r.earthPct}%`, 'earth'],
    [tr ? 'En uzun karanlık' : 'Longest darkness', `${r.longestDarkH} h`, 'dark'],
    [tr ? 'Gereken batarya' : 'Battery needed', `${r.batteryNeedWh.toLocaleString(tr ? 'tr-TR' : 'en-US')} Wh`, 'batt'],
    [tr ? 'İniş alanı eğimi (%95)' : 'Landing zone slope (95%)', r.zoneSlopeDeg === null ? '–' : `${r.zoneSlopeDeg.toFixed(1)}°`, 'safe'],
    [tr ? 'En yakın buz' : 'Nearest water ice', r.iceKm === null ? '–' : `${r.iceKm.toFixed(1)} km`, 'ice'],
    [tr ? 'Yaklaşma' : 'Approach', `${r.approachDeg === 0 ? (tr ? 'Kuzeye' : 'Heading N') : (tr ? 'Güneye' : 'Heading S')} · ${tr ? 'Güneş' : 'Sun'} ${r.sunOffDeg}°`, 'route'],
    [tr ? 'Yükseklik' : 'Height', `${r.heightM.toLocaleString(tr ? 'tr-TR' : 'en-US')} m`],
  ]
  return (
    <div className="profile" role="dialog" aria-modal="true" aria-label={s.name} style={{ ['--team' as string]: s.colour }}>
      <div className="profile-hero">
        <button className="profile-back" onClick={onClose}><ArrowLeft size={16} /> {tr ? 'Sonuçlar' : 'Results'}</button>
        <div className="ph-text">
          <span className="ph-rank">{String(s.rank).padStart(2, '0')}</span>
          {light && <span className="ph-first">{light}</span>}
          <span className="ph-last">{bold}</span>
          <span className="ph-region">{s.region ?? (tr ? 'Açık arazi' : 'Open terrain')} · {r.lat.toFixed(3)}°, {r.lon.toFixed(2)}°E</span>
          <span className={`ph-verdict ${r.goDates > 0 ? 'go' : 'nogo'}`}>{r.goDates > 0 ? 'GO' : 'NO-GO'}</span>
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
          {stats.map(([k, v, tone]) => (
            <div key={k} className={`ph-stat ${tone ?? ''}`}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
        <div className="ph-strips">
          <div><span>{tr ? 'Her iniş tarihi' : 'Every landing date in the window'}</span>
            <div className="ph-cal">{r.perStart.map((g, k) => <i key={k} className={g ? 'go' : 'nogo'} />)}</div></div>
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
