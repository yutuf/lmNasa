// Launch and orbit scenarios as a panel: which of the searched sites each lunar parking orbit can reach, the best
// reachable site, and the fuel (delta-v) a plane change would cost to reach the overall best one. Plus the PDF report.
import { useMemo } from 'react'
import { FileDown, Orbit, X } from 'lucide-react'
import type { Lang } from '../i18n'
import type { PointResult } from '../engine'
import { scenarioRows, V_LLO } from '../orbitScenarios'

export function scenarioHtml(results: PointResult[], name: (r: PointResult) => string, lang: Lang): string {
  const tr = lang === 'tr'
  const rows = scenarioRows(results)
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  return `<h2>${tr ? 'Fırlatma ve yörünge senaryoları' : 'Launch and orbit scenarios'}</h2>
<p>${tr ? 'İniş aracı park yörüngesinin düzleminden iner: eğimine kadar olan enlemlere ulaşır. Daha ötesi düzlem değişikliği ister: Δv = 2·v·sin(Δi/2), v ≈ ' : 'A lander descends from its parking orbit’s plane: it reaches latitudes up to the inclination. Further needs a plane change: Δv = 2·v·sin(Δi/2), v ≈ '}${V_LLO.toFixed(2)} km/s.</p>
<table><thead><tr><th>${tr ? 'Yörünge' : 'Orbit'}</th><th>${tr ? 'Ulaşılan nokta' : 'Points reached'}</th><th>GO</th><th>${tr ? 'En iyi ulaşılan yer' : 'Best reachable site'}</th><th>${tr ? 'Genel en iyiye Δv' : 'Δv to the overall best'}</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.s.name[lang])}</td><td>${r.reachable.toLocaleString()}</td><td>${r.go.toLocaleString()}</td><td>${r.best ? esc(name(r.best)) + ` (GO ${r.best.goCount})` : '–'}</td><td>${r.dvToBest ? r.dvToBest.toFixed(2) + ' km/s' : '0'}</td></tr>`).join('\n')}
</tbody></table>`
}

export default function OrbitPanel({ results, name, lang, onClose, onPdf }: {
  results: PointResult[]; name: (r: PointResult) => string; lang: Lang; onClose: () => void; onPdf: () => void
}) {
  const tr = lang === 'tr'
  const rows = useMemo(() => scenarioRows(results), [results])
  const maxReach = Math.max(1, ...rows.map((r) => r.reachable))
  return (
    <div className="workshop orbitp" role="dialog" aria-label={tr ? 'Yörünge senaryoları' : 'Orbit scenarios'}>
      <div className="ws-head">
        <div><h1><Orbit size={24} /> {tr ? 'Fırlatma ve yörünge' : 'Launch & orbit'}</h1>
          <p>{tr ? 'İniş aracı park yörüngesinin düzleminden iner: yalnızca yörünge eğimine kadar olan enlemlere ulaşabilir. Kutuplar için kutup yörüngesi gerekir.' : 'A lander descends from its parking orbit’s plane, so it can only reach latitudes up to the orbit’s inclination. The poles need a polar orbit.'}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="op-body">
        <div className="op-rows">
          {rows.map((r) => (
            <div key={r.s.id} className="op-row">
              <svg viewBox="-60 -60 120 120" className="op-globe" aria-hidden="true">
                <defs><clipPath id={`op-clip-${r.s.id}`}><circle r="44" /></clipPath></defs>
                <circle r="44" className="op-moon" />
                {/* the reachable band |lat| <= i, drawn on the Moon's disc seen edge-on */}
                <rect x="-44" y={-44 * Math.sin((r.s.inc * Math.PI) / 180)} width="88" height={88 * Math.sin((r.s.inc * Math.PI) / 180)} className="op-band" clipPath={`url(#op-clip-${r.s.id})`} />
                <ellipse rx="56" ry="10" transform={`rotate(${-r.s.inc})`} className="op-orbit" />
              </svg>
              <div className="op-info">
                <b>{r.s.name[lang]}</b>
                <span>{r.s.why[lang]}</span>
                <div className="op-bar"><i style={{ width: `${(r.reachable / maxReach) * 100}%` }} /></div>
                <small>{tr ? `${r.reachable.toLocaleString('tr-TR')} noktaya ulaşır, ${r.go.toLocaleString('tr-TR')} tanesi GO` : `Reaches ${r.reachable.toLocaleString('en-US')} points, ${r.go.toLocaleString('en-US')} of them GO`}</small>
              </div>
              <div className="op-best">
                <span>{tr ? 'En iyi ulaşılan' : 'Best reachable'}</span>
                <b>{r.best ? name(r.best) : '–'}</b>
                <small>{r.dvToBest > 0 ? (tr ? `Genel en iyiye: +${r.dvToBest.toFixed(2)} km/s düzlem değişikliği` : `To reach the overall best: +${r.dvToBest.toFixed(2)} km/s plane change`) : (tr ? 'Genel en iyiye doğrudan ulaşır' : 'Reaches the overall best directly')}</small>
              </div>
            </div>
          ))}
        </div>
        <p className="op-note">{tr ? `Düzlem değişikliği: Δv = 2·v·sin(Δi/2), 100 km yörüngede v ≈ ${V_LLO.toFixed(2)} km/sn. Karşılaştırma için: Ay yörüngesinden inişin tamamı yaklaşık 1,9 km/sn.` : `Plane change: Δv = 2·v·sin(Δi/2), with v ≈ ${V_LLO.toFixed(2)} km/s in a 100 km orbit. For scale: the whole descent from lunar orbit is about 1.9 km/s.`}</p>
        <button className="btn primary op-pdf" onClick={onPdf}><FileDown size={17} /> {tr ? 'PDF rapor indir' : 'Download the PDF report'}</button>
      </div>
    </div>
  )
}
