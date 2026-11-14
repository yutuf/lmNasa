// Decision lab: the ranked sites re-ranked by a multi-criteria decision model (TOPSIS) with weights the team sets,
// a heat map of where each site is strong or weak, and a robustness test that shakes the weights 500 times.
import { useMemo, useState } from 'react'
import { Scale, Shuffle, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { order, reasons, robustness, standing, topsis, type Dir } from '../decision'
import type { CardSite } from './SiteCard'

type T = Record<Lang, string>
interface Crit { id: string; label: T; short: T; dir: Dir; get: (c: CardSite) => number | null; fmt: (v: number) => string }

const CRITERIA: Crit[] = [
  { id: 'prob', label: { en: 'Mission success', tr: 'Görev başarısı' }, short: { en: 'Success', tr: 'Başarı' }, dir: 1, get: (c) => (c.prob ? c.prob.p * 100 : null), fmt: (v) => `${v.toFixed(0)} %` },
  { id: 'go', label: { en: 'Landing dates that work', tr: 'Uygun iniş günleri' }, short: { en: 'GO days', tr: 'GO gün' }, dir: 1, get: (c) => c.r.goCount, fmt: (v) => `${v.toFixed(0)}` },
  { id: 'sun', label: { en: 'Sunlight', tr: 'Güneş ışığı' }, short: { en: 'Sun', tr: 'Güneş' }, dir: 1, get: (c) => c.row.sunPct, fmt: (v) => `${v.toFixed(0)} %` },
  { id: 'earth', label: { en: 'Talking to Earth', tr: 'Dünya ile iletişim' }, short: { en: 'Earth', tr: 'Dünya' }, dir: 1, get: (c) => c.row.earthPct, fmt: (v) => `${v.toFixed(0)} %` },
  { id: 'dark', label: { en: 'Longest dark spell', tr: 'En uzun karanlık' }, short: { en: 'Dark', tr: 'Karanlık' }, dir: -1, get: (c) => c.row.longestDarkH, fmt: (v) => `${v.toFixed(0)} h` },
  { id: 'slope', label: { en: 'Flat ground', tr: 'Düz zemin' }, short: { en: 'Slope', tr: 'Eğim' }, dir: -1, get: (c) => c.row.zoneSlopeDeg ?? c.row.slopeDeg, fmt: (v) => `${v.toFixed(1)}°` },
  { id: 'target', label: { en: 'Close to the science', tr: 'Bilime yakınlık' }, short: { en: 'Science', tr: 'Bilim' }, dir: -1, get: (c) => c.targetKm ?? null, fmt: (v) => `${v.toFixed(0)} km` },
  { id: 'ice', label: { en: 'Close to ice', tr: 'Buza yakınlık' }, short: { en: 'Ice', tr: 'Buz' }, dir: -1, get: (c) => c.row.iceKm, fmt: (v) => `${v.toFixed(1)} km` },
]

const PRESETS: { id: string; label: T; w: Record<string, number> }[] = [
  { id: 'balanced', label: { en: 'Balanced', tr: 'Dengeli' }, w: { prob: 5, go: 5, sun: 5, earth: 5, dark: 5, slope: 5, target: 5, ice: 5 } },
  { id: 'safety', label: { en: 'Safety first', tr: 'Önce güvenlik' }, w: { prob: 9, go: 6, sun: 4, earth: 4, dark: 6, slope: 10, target: 1, ice: 1 } },
  { id: 'science', label: { en: 'Science first', tr: 'Önce bilim' }, w: { prob: 4, go: 3, sun: 3, earth: 3, dark: 3, slope: 3, target: 10, ice: 10 } },
  { id: 'power', label: { en: 'Power and comms', tr: 'Güç ve iletişim' }, w: { prob: 4, go: 6, sun: 10, earth: 9, dark: 9, slope: 3, target: 2, ice: 2 } },
]

const L: Record<string, T> = {
  title: { en: 'Decision lab', tr: 'Karar laboratuvarı' },
  sub: { en: 'Every site trades one thing for another. Tell the model what matters to your team; it finds the site closest to the ideal and tests how sure that choice is.',
    tr: 'Her yer bir şeyi başka bir şeye değişir. Ekibin için neyin önemli olduğunu söyle; model ideale en yakın yeri bulur ve bu seçimin ne kadar sağlam olduğunu sınar.' },
  weights: { en: 'What matters', tr: 'Ne önemli' }, ranking: { en: 'Ranking', tr: 'Sıralama' },
  wins: { en: 'wins', tr: 'kazanır' }, top3: { en: 'top 3', tr: 'ilk 3' },
  robust: { en: 'Robust choice', tr: 'Sağlam seçim' }, edge: { en: 'Close call', tr: 'Kıl payı' },
  why: { en: 'Why it leads', tr: 'Neden önde' },
  shake: { en: 'Robustness: the ranking redone 500 times with every weight shaken by about ±35 %.', tr: 'Sağlamlık: sıralama, her ağırlık yaklaşık ±%35 sarsılarak 500 kez yeniden yapıldı.' },
  method: { en: 'Model: TOPSIS (Hwang & Yoon, 1981), ranks by closeness to the ideal site and distance from the worst. Inputs are the search results on NASA data; missing values count as the worst.',
    tr: 'Model: TOPSIS (Hwang ve Yoon, 1981), ideal yere yakınlık ve en kötüden uzaklığa göre sıralar. Girdiler NASA verisi üzerindeki arama sonuçlarıdır; eksik değerler en kötü sayılır.' },
  was: { en: 'was', tr: 'önce' }, none: { en: 'Run a search first.', tr: 'Önce bir arama yap.' },
}

export default function DecisionLab({ cards, lang, onOpen, onClose }: { cards: CardSite[]; lang: Lang; onOpen: (c: CardSite) => void; onClose: () => void }) {
  const t = (k: string) => L[k][lang]
  // only criteria that tell these sites apart
  const crits = useMemo(() => CRITERIA.filter((c) => {
    const v = cards.map(c.get).filter((x): x is number => x !== null && Number.isFinite(x))
    return v.length >= 2 && Math.max(...v) - Math.min(...v) > 1e-6
  }), [cards])
  const [w, setW] = useState<Record<string, number>>(PRESETS[0].w)
  const [preset, setPreset] = useState('balanced')
  const weights = crits.map((c) => w[c.id] ?? 5)
  const dirs = crits.map((c) => c.dir)
  const rows = useMemo(() => cards.map((s) => crits.map((c) => c.get(s))), [cards, crits])
  const scores = useMemo(() => topsis(rows, weights, dirs), [rows, weights.join()])        // eslint-disable-line react-hooks/exhaustive-deps
  const stand = useMemo(() => standing(rows, dirs), [rows, crits])                          // eslint-disable-line react-hooks/exhaustive-deps
  const rob = useMemo(() => robustness(rows, weights, dirs, 500), [rows, weights.join()])  // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = order(scores)

  return (
    <div className="workshop dlab" role="dialog" aria-label={t('title')}>
      <div className="ws-head">
        <div><h1><Scale size={26} /> {t('title')}</h1><p>{t('sub')}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      {!cards.length ? <p className="dl-empty">{t('none')}</p> : (
        <div className="dl-body">
          <div className="dl-weights">
            <div className="ws-label">{t('weights')}</div>
            <div className="dl-presets">{PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => { setPreset(p.id); setW(p.w) }}>{p.label[lang]}</button>
            ))}</div>
            {crits.map((c, j) => (
              <label key={c.id} className="ws-slider dl-w">
                <span>{c.label[lang]} <b>{weights[j]}</b></span>
                <input type="range" min={0} max={10} step={1} value={weights[j]} onChange={(e) => { setPreset(''); setW({ ...w, [c.id]: +e.target.value }) }} />
              </label>
            ))}
            <p className="dl-note"><Shuffle size={13} /> {t('shake')}</p>
            <p className="dl-note">{t('method')}</p>
          </div>
          <div className="dl-table" role="table">
            <div className="dl-row dl-hrow" role="row" style={{ gridTemplateColumns: `34px minmax(150px, 1.4fr) 1fr repeat(${crits.length}, 46px) 112px` }}>
              <span>#</span><span>{t('ranking')}</span><span>TOPSIS</span>
              {crits.map((c) => <span key={c.id} className="dl-ch" title={c.label[lang]}>{c.short[lang]}</span>)}
              <span>{lang === 'tr' ? '500 sarsıntı' : '500 shakes'}</span>
            </div>
            {ranked.map((i, k) => {
              const s = cards[i]
              const moved = s.rank - (k + 1)
              const why = k === 0 ? reasons(stand, weights, i).map((j) => crits[j].label[lang].toLowerCase()) : []
              return (
                <div key={s.r.index} className={`dl-row${k === 0 ? ' lead' : ''}`} role="row" onClick={() => onOpen(s)}
                  style={{ gridTemplateColumns: `34px minmax(150px, 1.4fr) 1fr repeat(${crits.length}, 46px) 112px`, ['--team' as string]: s.colour }}>
                  <span className="dl-rank">{String(k + 1).padStart(2, '0')}</span>
                  <span className="dl-name">
                    <b>{s.name}</b>
                    <small>{s.region ?? ''}{moved !== 0 && <em className={moved > 0 ? 'up' : 'down'}>{moved > 0 ? '▲' : '▼'} {Math.abs(moved)} · {t('was')} #{s.rank}</em>}</small>
                    {k === 0 && why.length > 0 && <small className="dl-why">{t('why')}: {why.join(', ')}</small>}
                  </span>
                  <span className="dl-bar"><i style={{ width: `${(scores[i] * 100).toFixed(1)}%` }} /><b>{scores[i].toFixed(2)}</b></span>
                  {crits.map((c, j) => {
                    const v = rows[i][j]
                    return <span key={c.id} className="dl-cell" style={{ ['--a' as string]: (0.12 + 0.88 * stand[i][j]).toFixed(2) }}
                      title={`${c.label[lang]}: ${v === null ? '–' : c.fmt(v)}`}>{v === null ? '–' : c.fmt(v).replace(/ (%|km|h)$/, '')}</span>
                  })}
                  <span className="dl-rob">
                    <b>{Math.round(rob.wins[i] * 100)}%</b> {t('wins')}
                    <small>{Math.round(rob.top3[i] * 100)}% {t('top3')}</small>
                    {k === 0 && <em className={rob.wins[i] >= 0.6 ? 'ok' : 'edge'}>{rob.wins[i] >= 0.6 ? t('robust') : t('edge')}</em>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
