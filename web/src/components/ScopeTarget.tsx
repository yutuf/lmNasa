// Where the search looks (the south-pole grid or the whole Moon) and what the mission goes for (a science target).
import type { Lang } from '../i18n'
import { SCIENCE_KIND, SCIENCE_SITES, inPoleGrid, siteLabel, type ScienceSite } from '../scienceSites'

export default function ScopeTarget({ lang, scope, target, onScope, onTarget }: {
  lang: Lang; scope: 'pole' | 'moon'; target: string; onScope: (s: 'pole' | 'moon') => void; onTarget: (t: ScienceSite | null) => void
}) {
  const tr = lang === 'tr'
  const sel = SCIENCE_SITES.find((s) => s.id === target) ?? null
  return (
    <div className="scope-target">
      <div className="st-row">
        <span className="st-label">{tr ? 'Kapsam' : 'Scope'}</span>
        <div className="ui-switch st-scope" role="radiogroup" aria-label={tr ? 'Kapsam' : 'Scope'}>
          <button role="radio" aria-checked={scope === 'pole'} className={scope === 'pole' ? 'on' : ''} onClick={() => onScope('pole')}>
            {tr ? 'Güney kutbu' : 'South pole'}</button>
          <button role="radio" aria-checked={scope === 'moon'} className={scope === 'moon' ? 'on' : ''} onClick={() => onScope('moon')}>
            {tr ? 'Tüm Ay' : 'Whole Moon'}</button>
        </div>
        <p className="st-res">{tr ? 'Güney kutbu 2 km ızgara · Tüm Ay 30 km ızgara' : 'South pole: 2 km grid · Whole Moon: 30 km grid'}</p>
      </div>
      <div className="st-row">
        <span className="st-label">{tr ? 'Bilim hedefi' : 'Science target'}</span>
        <div className="st-targets">
          <button className={!sel ? 'on' : ''} onClick={() => onTarget(null)}>{tr ? 'Yok' : 'None'}</button>
          {SCIENCE_SITES.map((s) => (
            <button key={s.id} className={sel?.id === s.id ? 'on' : ''} style={{ ['--k' as string]: SCIENCE_KIND[s.kind].colour }}
                    onClick={() => onTarget(s)} title={s.why[lang]}>
              <i />{(() => { const l = siteLabel(s, lang); const k = l.indexOf(': '); return k > 0 ? <><span className="st-pre">{l.slice(0, k)}</span>{l.slice(k + 2)}</> : l })()}{!inPoleGrid(s) && scope === 'pole' ? ' ↗' : ''}
            </button>
          ))}
        </div>
      </div>
      {sel && <p className="st-why"><b style={{ color: SCIENCE_KIND[sel.kind].colour }}>{SCIENCE_KIND[sel.kind].label[lang]}</b> · {sel.why[lang]}</p>}
    </div>
  )
}
