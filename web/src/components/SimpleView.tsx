// The simple interface: three plain questions (what for, how long, when), one button, and the best landing sites as
// cards. Vehicles and the search area sit behind "More options"; every requirement, table and chart is in the
// advanced interface.
import { useEffect, useState } from 'react'
import { Box, CalendarCheck, CalendarDays, Car, ChevronDown, Clapperboard, Eye, Flag, Flame, Globe2, Hourglass, Info, Magnet, MoonStar, Percent, Rocket, Scale, ShieldCheck, SlidersHorizontal, Snowflake, Target, Telescope, Tent, Timer, Users, Wrench, Zap, type LucideIcon } from 'lucide-react'
import type { Lang } from '../i18n'
import { SCENARIOS, type Scenario } from '../scenarios'
import { LANDERS, ROVERS, type Lander } from '../vehicles'
import { GOALS, SCIENCE_KIND, SCIENCE_SITES, type ScienceKind } from '../scienceSites'
import { polarXY } from '../places'
import { renderSite } from '../siteRender'
import HeroMoon from './HeroMoon'
import SiteCard, { type CardSite } from './SiteCard'
import VehiclePhoto from './VehiclePhoto'
import VehicleShowroom from './VehicleShowroom'

type T = Record<Lang, string>
const GOAL_ICON: Record<ScienceKind | 'safe', LucideIcon> = { safe: ShieldCheck, ice: Snowflake, volcanic: Flame, impact: Target, magnetic: Magnet, pit: Tent, history: Flag }
const SCENARIO_ICON: Record<string, LucideIcon> = { lander: Rocket, crew: Users, rover: Car, long: Hourglass, sprint: Zap, night: MoonStar }
// one line on why each goal matters, shown under the chips
const GOAL_WHY: Record<ScienceKind | 'safe', T> = {
  safe: { en: 'No science target: just the safest places to land and survive, with sunlight and a link to Earth.', tr: 'Bilim hedefi yok: güneş ışığı ve Dünya bağlantısıyla, inip hayatta kalmak için en güvenli yerler.' },
  ice: { en: 'Water ice hides in craters that never see the Sun. It means drinking water, oxygen and rocket fuel.', tr: 'Su buzu hiç güneş görmeyen kraterlerde saklanır. İçme suyu, oksijen ve roket yakıtı demek.' },
  volcanic: { en: 'Old lava flows and domes tell how the Moon cooled down.', tr: 'Eski lav akıntıları ve kubbeler Ay’ın nasıl soğuduğunu anlatır.' },
  impact: { en: 'Giant impact basins dug up rock from deep inside the Moon.', tr: 'Dev çarpma havzaları Ay’ın derinlerinden kaya çıkardı.' },
  magnetic: { en: 'Swirls of bright soil sit where the Moon still has patches of magnetism. Nobody knows why.', tr: 'Parlak toprak girdapları Ay’ın hâlâ manyetik olduğu yerlerde. Nedeni bilinmiyor.' },
  pit: { en: 'Lava-tube pits are natural shelters from radiation and temperature swings.', tr: 'Lav tüpü çukurları radyasyona ve sıcaklık farkına karşı doğal sığınaklar.' },
  history: { en: 'Land near Apollo and other historic landing sites.', tr: 'Apollo ve diğer tarihi iniş yerlerinin yakınına in.' },
}

// an example place for each goal, rendered from the real terrain next to the goal's explanation
const GOAL_EXAMPLE: Record<ScienceKind | 'safe', string> = { safe: 'shackleton', ice: 'shackleton', volcanic: 'aristarchus', impact: 'tycho', magnetic: '', pit: '', history: '' }

function GoalRender({ goal, lang }: { goal: ScienceKind | null; lang: Lang }) {
  const site = SCIENCE_SITES.find((s) => s.id === GOAL_EXAMPLE[goal ?? 'safe']) ?? SCIENCE_SITES.find((s) => s.kind === goal)
  const [img, setImg] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!site) return
    let live = true
    const polar = site.lat < -84.6
    const [x0, y0] = polar ? polarXY(site.lat, site.lon) : [0, 0]
    const [x, y] = [x0 + (polar ? 9 : 0), y0]
    renderSite(`goal:${site.id}`, x, y, site.lon, polar ? 60 : 110, polar ? 4 : 18, site.lat, polar ? 22 : 60).then((url) => { if (live) setImg({ id: site.id, url }) }).catch(() => {})
    return () => { live = false }
  }, [site])
  if (!site) return null
  const tr = lang === 'tr'
  return (
    <figure className="s-goal-render">
      {img?.id === site.id ? <img src={img.url} alt="" /> : <span className="s-goal-wait" />}
      <figcaption>
        <b>{site.name}</b>
        <span>{site.lat < -84.6 ? (tr ? 'Gerçek LOLA arazisi · 44 km' : 'Real LOLA terrain · 44 km across') : (tr ? 'Gerçek LOLA arazisi · 120 km' : 'Real LOLA terrain · 120 km across')}</span>
      </figcaption>
    </figure>
  )
}

export default function SimpleView({ lang, scenarioId, start, minDate, maxDate, busy, progress, cards, windowLabel, onScenario, onStart, onRun, onOpen, onAdvanced, lander, rover, onLander, onRover, onStory, onDecide, onWorkshop, polarCards, points, targetName, scope, goal, onScope, onGoal, rankBy, onRankBy }: {
  rankBy: 'go' | 'prob'; onRankBy: (v: 'go' | 'prob') => void
  polarCards: CardSite[]; points: number; targetName: string | null
  scope: 'pole' | 'moon'; goal: ScienceKind | null; onScope: (s: 'pole' | 'moon') => void; onGoal: (k: ScienceKind | null) => void
  onStory: () => void; onDecide: () => void; onWorkshop: () => void
  lander: string; rover: string; onLander: (l: Lander) => void; onRover: (id: string) => void
  lang: Lang; scenarioId: string | null; start: string; minDate: string; maxDate: string; busy: boolean; progress: number | null
  cards: CardSite[]; windowLabel: string; onScenario: (s: Scenario) => void; onStart: (d: string) => void; onRun: () => void
  onOpen: (s: CardSite) => void; onAdvanced: () => void
}) {
  const tr = lang === 'tr'
  const [more, setMore] = useState(false)
  const [showModelBay, setShowModelBay] = useState(false)
  const sc = SCENARIOS.find((s) => s.id === scenarioId)
  const landerName = LANDERS.find((l) => l.id === lander)?.name
  const roverName = ROVERS.find((r) => r.id === rover)?.name
  return (
    <div className="simple">
      <section className="s-hero">
        <HeroMoon />
        <div className="s-hero-text">
        <h1>{tr ? <>Ay’da <em>nereye</em> ve <em>ne zaman</em> inmeli?</> : <>Where and when to <em>land</em> on the Moon</>}</h1>
        <p>{tr
          ? `Üç soruyu cevapla. LunaNav ${points.toLocaleString('tr-TR')} noktayı her gün ve her saat için NASA verisiyle kontrol eder ve en iyi iniş yerlerini gösterir.`
          : `Answer three questions. LunaNav checks ${points.toLocaleString('en-US')} points for every day and hour on NASA data and shows you the best places to land.`}</p>
        </div>
      </section>
      <section className="s-build">

        <ol className="s-steps">
          <li className="s-step s-step-goal" style={{ ['--acc' as string]: '#22d3ee' }}>
            <div className="s-step-h"><span className="s-num">1</span><Telescope className="s-step-ic" size={22} /><b>{tr ? 'Ne için gidiyoruz?' : 'What is the mission for?'}</b></div>
            <GoalRender goal={goal} lang={lang} />
            <div className="s-goals">
              <button className={!goal ? 'on' : ''} onClick={() => onGoal(null)}><ShieldCheck size={16} strokeWidth={2.2} />{tr ? 'Sadece güvenli iniş' : 'Just a safe landing'}</button>
              {(Object.keys(GOALS) as ScienceKind[]).map((k) => (
                <button key={k} className={goal === k ? 'on' : ''} style={{ ['--k' as string]: SCIENCE_KIND[k].colour }} onClick={() => onGoal(k)}>
                  {(() => { const I = GOAL_ICON[k]; return <I size={16} strokeWidth={2.2} /> })()}{GOALS[k][lang]}
                </button>
              ))}
            </div>
            <p className="s-help"><Info size={15} />{GOAL_WHY[goal ?? 'safe'][lang]}</p>
          </li>

          <li className="s-step" style={{ ['--acc' as string]: '#ff4fa3' }}>
            <div className="s-step-h"><span className="s-num">2</span><Timer className="s-step-ic" size={22} /><b>{tr ? 'Yüzeyde ne kadar kalacak?' : 'How long does it stay on the surface?'}</b></div>
            <div className="s-scenarios" role="radiogroup" aria-label={tr ? 'Görev' : 'Mission'}>
              {SCENARIOS.map((s) => (
                <button key={s.id} role="radio" aria-checked={scenarioId === s.id} className={scenarioId === s.id ? 'on' : ''} onClick={() => onScenario(s)}>
                  {(() => { const I = SCENARIO_ICON[s.id] ?? Rocket; return <I className="s-sc-ic" size={18} strokeWidth={2.2} /> })()}
                  <b>{s.short[lang]}</b><span>{s.days} {tr ? 'gün' : 'days'}</span>
                </button>
              ))}
            </div>
            {sc && <p className="s-help"><Info size={15} />{sc.desc[lang]}</p>}
          </li>

          <li className="s-step" style={{ ['--acc' as string]: '#ffb020' }}>
            <div className="s-step-h"><span className="s-num">3</span><CalendarDays className="s-step-ic" size={22} /><b>{tr ? 'Ne zaman inmek istiyorsun?' : 'When do you want to land?'}</b></div>
            <div className="s-pick">
              <label className="s-date"><span><CalendarDays size={13} /> {tr ? 'Şu tarihten itibaren' : 'From'}</span>
                <input type="date" value={start} min={minDate} max={maxDate} onChange={(e) => e.target.value && onStart(e.target.value)} /></label>
              <button className="btn primary s-run" onClick={onRun} disabled={busy}>
                {busy ? `${tr ? 'Aranıyor' : 'Searching'} ${Math.round((progress ?? 0) * 100)}%` : <><Rocket size={17} /> {tr ? 'İniş yerlerini bul' : 'Find landing sites'}</>}
              </button>
            </div>
            <p className="s-help"><Info size={15} />{tr ? 'Sonraki birkaç hafta içindeki her iniş günü denenir.' : 'Every landing day in the following weeks is tried.'}</p>
          </li>
        </ol>

        <button className={`s-more${more ? ' open' : ''}`} onClick={() => setMore(!more)} aria-expanded={more}>
          <SlidersHorizontal size={15} />
          {tr ? 'Diğer seçenekler' : 'More options'}
          <ChevronDown className="s-more-chev" size={16} />
          <small>{scope === 'moon' ? (tr ? 'Tüm Ay' : 'Whole Moon') : (tr ? 'Güney kutbu' : 'South pole')} · {landerName}{roverName ? ` + ${roverName}` : ''}</small>
        </button>
        {more && (
          <div className="s-vehicles">
            <div className="s-vrow">
              <span className="s-vlabel"><Globe2 size={13} /> {tr ? 'Nerede' : 'Where'}</span>
              <div className="ui-switch st-scope" role="radiogroup" aria-label={tr ? 'Kapsam' : 'Scope'}>
                <button role="radio" aria-checked={scope === 'pole'} className={scope === 'pole' ? 'on' : ''} onClick={() => onScope('pole')}>{tr ? 'Güney kutbu' : 'South pole'}</button>
                <button role="radio" aria-checked={scope === 'moon'} className={scope === 'moon' ? 'on' : ''} onClick={() => onScope('moon')}>{tr ? 'Tüm Ay' : 'Whole Moon'}</button>
              </div>
              <span className="s-vnote">{tr ? 'Güney kutbu: Artemis bölgesi, 2 km ayrıntı. Tüm Ay: her yer, 30 km ayrıntı.' : 'South pole: the Artemis region in 2 km detail. Whole Moon: everywhere, 30 km apart.'}</span>
            </div>
            <div className="s-vrow">
              <span className="s-vlabel"><Rocket size={13} /> {tr ? 'İniş aracı' : 'Lander'}</span>
              <div className="s-vchips" role="radiogroup" aria-label={tr ? 'İniş aracı' : 'Lander'}>
                {LANDERS.map((l) => (
                  <button key={l.id} role="radio" aria-checked={lander === l.id} className={lander === l.id ? 'on' : ''} onClick={() => onLander(l)} title={l.pitch[lang]}>
                    <VehiclePhoto kind="lander" id={l.id} alt="" className="vchip-img" />
                    <b>{l.name}</b><span>{l.maker} · {l.heightM} m{l.crew ? ` · ${l.crew} ${tr ? 'kişi' : 'crew'}` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="s-vpitch">{LANDERS.find((l) => l.id === lander)?.pitch[lang]}</p>
            <div className="s-vrow">
              <span className="s-vlabel"><Car size={13} /> {tr ? 'Gezgin' : 'Rover'}</span>
              <div className="s-vchips" role="radiogroup" aria-label={tr ? 'Gezgin' : 'Rover'}>
                {ROVERS.map((r) => (
                  <button key={r.id} role="radio" aria-checked={rover === r.id} className={rover === r.id ? 'on' : ''} onClick={() => onRover(r.id)} title={r.pitch[lang]}>
                    <VehiclePhoto kind="rover" id={r.id} alt="" className="vchip-img" />
                    <b>{r.name}</b><span>{r.maker} · {r.maxSpeed >= 1 ? `${(r.maxSpeed * 3.6).toFixed(0)} km/h` : `${Math.round(r.maxSpeed * 100)} cm/s`}</span>
                  </button>
                ))}
              </div>
            </div>
            <button className="s-model-bay" onClick={() => setShowModelBay(true)}>
              <span className="s-model-bay-icon"><Box size={17} /></span>
              <span><b>{tr ? '3D model galerisi' : 'Open the 3D model gallery'}<small>{tr ? 'Apollo LM · Vikram · Starship · Pragyan · Yutu-2 · LRO' : 'Apollo LM · Vikram · Starship · Pragyan · Yutu-2 · LRO'}</small></b></span>
              <Eye size={17} />
            </button>
          </div>
        )}
      </section>

      {showModelBay && <VehicleShowroom lang={lang} onClose={() => setShowModelBay(false)} />}

      <section className="s-results" id="results">
        <div className="s-head">
          <h2>{targetName ? (tr ? `${targetName} için en iyi iniş yerleri` : `Best landing sites for ${targetName}`) : polarCards.length ? (tr ? 'En iyi iniş yerleri · kutuplar dışında' : 'Top landing sites · away from the poles') : (tr ? 'En iyi iniş yerleri' : 'Top landing sites')}</h2>
          <span>{windowLabel}</span>
          <div className="ui-switch rank-switch" role="radiogroup" aria-label={tr ? 'Sıralama' : 'Rank by'}>
            <button role="radio" aria-checked={rankBy === 'go'} className={rankBy === 'go' ? 'on' : ''} onClick={() => onRankBy('go')}><CalendarCheck size={14} /> {tr ? 'En çok uygun gün' : 'Most good days'}</button>
            <button role="radio" aria-checked={rankBy === 'prob'} className={rankBy === 'prob' ? 'on' : ''} onClick={() => onRankBy('prob')}><Percent size={14} /> {tr ? 'En yüksek başarı' : 'Best odds'}</button>
          </div>
        </div>
        {cards.length > 0 && <p className="s-help s-legend"><Info size={15} />{tr
          ? 'Her kart gerçek araziyi gösterir. “GO 4/30”: 30 günün 4’ünde iniş işe yarar. Yüzde: binlerce simülasyonda görevin başarılı olma şansı. Ayrıntı için karta tıkla.'
          : 'Each card shows the real terrain. “GO 4/30”: landing works on 4 of the 30 days. The percentage: the chance the mission succeeds over thousands of simulations. Click a card for details.'}</p>}
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

        {cards.length > 0 && (
          <div className="s-next">
            <h3>{tr ? 'Sonra ne yapabilirsin?' : 'What next?'}</h3>
            <div className="s-next-grid">
              <button onClick={onStory}><Clapperboard size={22} /><b>{tr ? 'Görevi izle' : 'Watch the mission'}</b><span>{tr ? 'Fırlatmadan inişe, en iyi yerde kısa bir film.' : 'A short film from launch to landing at the best site.'}</span></button>
              <button onClick={onDecide}><Scale size={22} /><b>{tr ? 'Yerleri karşılaştır' : 'Compare the sites'}</b><span>{tr ? 'Neyin önemli olduğunu seç; model en iyisini bulsun.' : 'Choose what matters; the model picks the best one.'}</span></button>
              <button onClick={onWorkshop}><Wrench size={22} /><b>{tr ? 'Kendi aracını yap' : 'Build your own lander'}</b><span>{tr ? 'Panel, batarya, bacaklar: tasarımın nereye inebileceğini belirler.' : 'Panels, battery, legs: your design decides where it can land.'}</span></button>
            </div>
          </div>
        )}
        <button className="s-adv" onClick={onAdvanced}>{tr ? 'Gelişmiş arayüz: tüm gereksinimler, grafikler, Artemis karşılaştırması, dışa aktarma →' : 'Advanced interface: every requirement, charts, the Artemis comparison, exports →'}</button>
      </section>
    </div>
  )
}
