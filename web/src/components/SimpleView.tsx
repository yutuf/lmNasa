// The simple interface: pick a kind of mission and a month, get the best landing sites as cards. Everything else
// (every requirement, tables, charts, exports) is in the advanced interface.
import type { Lang } from '../i18n'
import { SCENARIOS, type Scenario } from '../scenarios'
import { LANDERS, ROVERS, type Lander } from '../vehicles'
import SiteCard, { type CardSite } from './SiteCard'
import { Sparkles } from 'lucide-react'
import VehiclePhoto from './VehiclePhoto'
import { GOALS, SCIENCE_KIND, type ScienceKind } from '../scienceSites'

export default function SimpleView({ lang, scenarioId, start, minDate, maxDate, busy, progress, cards, windowLabel, onScenario, onStart, onRun, onOpen, onAdvanced, lander, rover, onLander, onRover, onStory, polarCards, points, targetName, scope, goal, onScope, onGoal }: {
  polarCards: CardSite[]; points: number; targetName: string | null
  scope: 'pole' | 'moon'; goal: ScienceKind | null; onScope: (s: 'pole' | 'moon') => void; onGoal: (k: ScienceKind | null) => void
  onStory: () => void
  lander: string; rover: string; onLander: (l: Lander) => void; onRover: (id: string) => void
  lang: Lang; scenarioId: string | null; start: string; minDate: string; maxDate: string; busy: boolean; progress: number | null
  cards: CardSite[]; windowLabel: string; onScenario: (s: Scenario) => void; onStart: (d: string) => void; onRun: () => void
  onOpen: (s: CardSite) => void; onAdvanced: () => void
}) {
  const tr = lang === 'tr'
  return (
    <div className="simple">
      <section className="s-hero">
        <h1>{tr ? <>Ay’da <em>nereye</em> ve <em>ne zaman</em> inmeli?</> : <>Where and when to <em>land</em> on the Moon</>}</h1>
        <p>{tr
          ? `Görevinizi seçin. LunaNav ${points.toLocaleString('tr-TR')} noktayı her iniş tarihi için saat saat NASA verisiyle tarar ve en iyi iniş yerlerini sıralar.`
          : `Pick your mission. LunaNav checks ${points.toLocaleString('en-US')} points, every landing date, hour by hour, on NASA data, and ranks where you should land.`}</p>
        <button className="s-story" onClick={onStory}><Sparkles size={16} /> {tr ? 'Görevi anlat — Luna ile' : 'Tell me the mission — with Luna'}</button>
        <div className="s-goal">
          <span className="s-vlabel">{tr ? 'Ne için gidiyoruz?' : 'What do you want to work for?'}</span>
          <div className="s-goals">
            <button className={!goal ? 'on' : ''} onClick={() => onGoal(null)}>{tr ? 'Sadece güvenli iniş' : 'Just a safe landing'}</button>
            {(Object.keys(GOALS) as ScienceKind[]).map((k) => (
              <button key={k} className={goal === k ? 'on' : ''} style={{ ['--k' as string]: SCIENCE_KIND[k].colour }} onClick={() => onGoal(k)}>
                <i />{GOALS[k][lang]}
              </button>
            ))}
          </div>
          <div className="ui-switch st-scope" role="radiogroup" aria-label={tr ? 'Kapsam' : 'Scope'}>
            <button role="radio" aria-checked={scope === 'pole'} className={scope === 'pole' ? 'on' : ''} onClick={() => onScope('pole')}>{tr ? 'Güney kutbu' : 'South pole'}</button>
            <button role="radio" aria-checked={scope === 'moon'} className={scope === 'moon' ? 'on' : ''} onClick={() => onScope('moon')}>{tr ? 'Tüm Ay' : 'Whole Moon'}</button>
          </div>
        </div>
        <div className="s-pick">
          <div className="s-scenarios" role="radiogroup" aria-label={tr ? 'Görev' : 'Mission'}>
            {SCENARIOS.map((sc) => (
              <button key={sc.id} role="radio" aria-checked={scenarioId === sc.id} className={scenarioId === sc.id ? 'on' : ''} onClick={() => onScenario(sc)}>
                <b>{sc.short[lang]}</b><span>{sc.days} {tr ? 'gün' : 'days'}</span>
              </button>
            ))}
          </div>
          <label className="s-date"><span>{tr ? 'İniş penceresi başı' : 'Landing window from'}</span>
            <input type="date" value={start} min={minDate} max={maxDate} onChange={(e) => e.target.value && onStart(e.target.value)} /></label>
          <button className="btn primary s-run" onClick={onRun} disabled={busy}>
            {busy ? `${tr ? 'Aranıyor' : 'Searching'} ${Math.round((progress ?? 0) * 100)}%` : (tr ? 'İniş yerlerini bul' : 'Find landing sites')}
          </button>
        </div>
        {scenarioId && <p className="s-desc">{SCENARIOS.find((s) => s.id === scenarioId)?.desc[lang]}</p>}
        <div className="s-vehicles">
          <div className="s-vrow">
            <span className="s-vlabel">{tr ? 'İniş aracı' : 'Lander'}</span>
            <div className="s-vchips" role="radiogroup" aria-label={tr ? 'İniş aracı' : 'Lander'}>
              {LANDERS.map((l) => (
                <button key={l.id} role="radio" aria-checked={lander === l.id} className={lander === l.id ? 'on' : ''} onClick={() => onLander(l)}
                        title={l.pitch[lang]}>
                  <VehiclePhoto kind="lander" id={l.id} alt="" className="vchip-img" />
                  <b>{l.name}</b><span>{l.maker} · {l.heightM} m{l.crew ? ` · ${l.crew} ${tr ? 'kişi' : 'crew'}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="s-vpitch">{LANDERS.find((l) => l.id === lander)?.pitch[lang]}</p>
          <div className="s-vrow">
            <span className="s-vlabel">{tr ? 'Gezgin' : 'Rover'}</span>
            <div className="s-vchips" role="radiogroup" aria-label={tr ? 'Gezgin' : 'Rover'}>
              {ROVERS.map((r) => (
                <button key={r.id} role="radio" aria-checked={rover === r.id} className={rover === r.id ? 'on' : ''} onClick={() => onRover(r.id)} title={r.pitch[lang]}>
                  <VehiclePhoto kind="rover" id={r.id} alt="" className="vchip-img" />
                  <b>{r.name}</b><span>{r.maker} · {r.maxSpeed >= 1 ? `${(r.maxSpeed * 3.6).toFixed(0)} km/h` : `${Math.round(r.maxSpeed * 100)} cm/s`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="s-results" id="results">
        <div className="s-head">
          <h2>{targetName ? (tr ? `${targetName} için en iyi iniş yerleri` : `Best landing sites for ${targetName}`) : polarCards.length ? (tr ? 'En iyi iniş yerleri · kutuplar dışında' : 'Top landing sites · away from the poles') : (tr ? 'En iyi iniş yerleri' : 'Top landing sites')}</h2>
          <span>{windowLabel}</span>
        </div>
        {cards.length === 0 ? <p className="s-empty">{tr ? 'Bu pencerede uygun nokta yok; başka bir ay veya görev deneyin.' : 'No site passes in this window; try another month or mission.'}</p> : (
          <div className="card-grid">
            {cards.map((s) => <SiteCard key={s.r.index} s={s} lang={lang} onOpen={() => onOpen(s)} />)}
          </div>
        )}
        {polarCards.length > 0 && (
          <>
            <div className="s-head s-head-2">
              <h2>{tr ? 'Kutup bölgeleri' : 'Polar regions'}</h2>
              <span>{tr ? 'Ayrı sıralanır: ekvatorda Güneş zamanın yarısı görünür, kutuplarda ufku sıyırır' : 'Ranked apart: near the equator the Sun is up half the time, at the poles it skims the horizon'}</span>
            </div>
            <div className="card-grid">{polarCards.map((s) => <SiteCard key={s.r.index} s={s} lang={lang} onOpen={() => onOpen(s)} />)}</div>
          </>
        )}
        <button className="s-adv" onClick={onAdvanced}>{tr ? 'Gelişmiş arayüz: tüm gereksinimler, grafikler, Artemis karşılaştırması, dışa aktarma →' : 'Advanced interface: every requirement, charts, the Artemis comparison, exports →'}</button>
      </section>
    </div>
  )
}
