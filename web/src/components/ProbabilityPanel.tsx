// Mission success probability: a ring gauge with the 90 % range, what most often goes wrong, and the spread of the
// key numbers across the simulated missions. The landing record can be switched in or out.
import { fmtPercent, landingPeriod, type Lang } from '../i18n'
import { LANDING_RECORD, type Probability } from '../probability'

const CAUSE: Record<string, Record<Lang, string>> = {
  tip: { en: 'Tipping over on the slopes under the feet', tr: 'Ayakların altındaki eğimde devrilme' },
  power: { en: 'Running out of power (darkness, launch slips)', tr: 'Gücün bitmesi (karanlık, fırlatma gecikmesi)' },
  comms: { en: 'Losing contact with Earth', tr: 'Dünya ile bağlantının kopması' },
  landing: { en: 'The landing itself failing (track record)', tr: 'İnişin kendisinin başarısız olması (geçmiş kayıt)' },
}

export default function ProbabilityPanel({ prob, lang, history, onHistory }: { prob: Probability; lang: Lang; history: boolean; onHistory: (v: boolean) => void }) {
  const tr = lang === 'tr'
  const pc = Math.round(prob.p * 100)
  const lo = Math.round(prob.lo * 100)
  const hi = Math.round(prob.hi * 100)
  const R = 52, C = 2 * Math.PI * R
  const tone = pc >= 70 ? 'var(--go)' : pc >= 40 ? 'var(--sun)' : 'var(--nogo)'
  const rngPct = (x: [number, number, number]) => (tr
    ? `%${x[1].toFixed(0)} (%${x[0].toFixed(0)}–%${x[2].toFixed(0)})`
    : `${x[1].toFixed(0)}% (${x[0].toFixed(0)}–${x[2].toFixed(0)})`)
  const rngH = (x: [number, number, number]) => `${x[1].toFixed(0)} ${tr ? 'sa' : 'h'} (${x[0].toFixed(0)}–${x[2].toFixed(0)})`
  const band = tr ? `%${lo}–%${hi}` : `${lo}–${hi}%`
  return (
    <div className="prob">
      <svg viewBox="0 0 130 130" className="prob-ring" role="img" aria-label={fmtPercent(pc, lang)}>
        <circle cx="65" cy="65" r={R} className="prob-track" />
        <circle cx="65" cy="65" r={R} className="prob-arc" style={{ stroke: tone, strokeDasharray: `${(prob.p * C).toFixed(1)} ${C.toFixed(1)}` }} transform="rotate(-90 65 65)" />
        <text x="65" y="66" textAnchor="middle" className="prob-num">{fmtPercent(pc, lang)}</text>
        <text x="65" y="86" textAnchor="middle" className="prob-sub">{band}</text>
      </svg>
      <div className="prob-body">
        <h3>{tr ? 'Görev başarı olasılığı' : 'Mission success probability'}</h3>
        <p className="prob-lead">{tr
          ? `${prob.trials} simüle görevde, fırlatma gecikmesi, ufuk hatası, iniş alanında dağılma, batarya yaşlanması ve ayakların altındaki eğim değişerek.`
          : `Over ${prob.trials} simulated missions, varying the launch slip, horizon error, scatter across the landing zone, battery wear and the slope under the feet.`}</p>
        {prob.main && <p className="prob-risk"><b>{tr ? 'En büyük risk:' : 'Biggest risk:'}</b> {CAUSE[prob.main][lang]}</p>}
        <div className="prob-bars">
          {(Object.keys(prob.causes) as (keyof Probability['causes'])[]).filter((k) => prob.causes[k] > 0).map((k) => (
            <div key={k}><span>{CAUSE[k][lang]}</span><i><b style={{ width: `${prob.causes[k] * 100}%` }} /></i><em>{fmtPercent(prob.causes[k] * 100, lang)}</em></div>
          ))}
        </div>
        <div className="prob-ranges">
          <span>{tr ? 'Güneş' : 'Sunlight'} <b>{rngPct(prob.sunPct)}</b></span>
          <span>{tr ? 'Dünya bağlantısı' : 'Earth contact'} <b>{rngPct(prob.earthPct)}</b></span>
          <span>{tr ? 'En uzun karanlık' : 'Longest dark'} <b>{rngH(prob.darkH)}</b></span>
        </div>
        <label className="prob-hist"><input type="checkbox" checked={history} onChange={(e) => onHistory(e.target.checked)} />
          <span>{tr
            ? `Gerçek kaydı dahil et: ${landingPeriod(lang)} arası ${LANDING_RECORD.attempts} robotik iniş denemesinin ${LANDING_RECORD.reached}’i yüzeye ulaştı`
            : `Include the real record: ${LANDING_RECORD.reached} of ${LANDING_RECORD.attempts} robotic landing attempts reached the surface (${landingPeriod(lang)})`}</span></label>
      </div>
    </div>
  )
}
