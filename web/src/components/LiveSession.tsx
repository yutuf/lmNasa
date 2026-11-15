// The presenter's screen for the live session (#live): a QR for the judges, then one duel per phone: the spot the
// judge tapped against AdaptLab's pick for the same goal and stay, the verdict and its reason, and a better spot near
// theirs. Works over any internet (PeerJS relay); "Test phone" adds a plan from this screen so the demo never stalls.
import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import type { DataConnection, Peer } from 'peerjs'
import { MapPin, Plus, X } from 'lucide-react'
import {
  GOALS, LENGTHS, WINDOW, compareSpots, goalById, liveCode, livePeerId, mapToLatLon, parsePlan, pickForGoal, polarXYKm,
  spotScore, suggestNear, targetKm, type ApiSite, type PlanMsg, type Spot, type Verdict,
} from '../live'
import { describePlace, type Feature } from '../places'
import { dataUrl } from '../data'
import { shareOrigin } from '../publicOrigin'
import { renderSite } from '../siteRender'
import Patch from './Patch'
import '../live.css'

interface Player { n: number; label: string; plan: PlanMsg | null; ver: number }
interface Duel { ver: number; state: 'loading' | 'done' | 'error'; judge?: Spot; pick?: Spot; verdict?: Verdict; suggest?: { spot: Spot; km: number } | null }

const sitesFor = new Map<number, Promise<ApiSite[]>>()
function fetchSites(days: number): Promise<ApiSite[]> {
  if (!sitesFor.has(days)) {
    sitesFor.set(days, fetch(`/api/v1/search?start=${WINDOW.start}&window=${WINDOW.days}&days=${days}&top=50`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ sites: ApiSite[] }> })
      .then((j) => j.sites)
      .catch((e) => { sitesFor.delete(days); throw e }))
  }
  return sitesFor.get(days)!
}

interface SiteJson { point: { lat: number; lon_360: number }; go_dates: number; best: { date: string; sun_pct: number; earth_pct: number; longest_dark_h: number; go: boolean } }
async function fetchSpot(p: PlanMsg): Promise<Spot> {
  const r = await fetch(`/api/v1/site?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(3)}&start=${WINDOW.start}&window=${WINDOW.days}&days=${p.days}`)
  if (!r.ok) throw new Error(String(r.status))
  const j = (await r.json()) as SiteJson
  const lat = j.point.lat, lon = j.point.lon_360
  return { lat, lon, goDays: j.go_dates, date: j.best.date, sun: j.best.sun_pct, earth: j.best.earth_pct, dark: j.best.longest_dark_h, go: j.best.go, targetKm: targetKm(p.goal, lat, lon) }
}

/** The spot's real terrain, lit by the Sun at noon on its best landing day (the same render as the site cards). */
function SpotArt({ spot }: { spot: Spot }) {
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/v1/sky?lat=${spot.lat.toFixed(4)}&lon=${spot.lon.toFixed(3)}&from=${spot.date}T12:00Z&hours=1`)
      .then((r) => r.json())
      .then((j: { hourly: { sun_az: number; sun_alt: number }[] }) => {
        const h = j.hourly[0]
        const { x, y } = polarXYKm(spot.lat, spot.lon)
        return renderSite(`live:${x.toFixed(2)},${y.toFixed(2)}:${Math.round(h.sun_az)}`, x, y, spot.lon, h.sun_az, h.sun_alt, spot.lat)
      })
      .then((u) => { if (live) setImg(u) })
      .catch(() => {})
    return () => { live = false }
  }, [spot.lat, spot.lon, spot.date])
  return img ? <img className="ds-img" src={img} alt="" /> : <span className="ds-img ds-img-wait" />
}

export default function LiveSession() {
  const lang: 'en' | 'tr' = /lang=tr/.test(location.hash) ? 'tr' : 'en'
  const tr = lang === 'tr'
  const [code] = useState(liveCode)
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [players, setPlayers] = useState<Player[]>([])
  const [duels, setDuels] = useState<Record<number, Duel>>({})
  const [feats, setFeats] = useState<Feature[] | null>(null)
  const count = useRef(0)
  const joinUrl = `${shareOrigin(location.origin)}/#join=${code}${tr ? '&lang=tr' : ''}`
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(joinUrl); q.make(); return q.createDataURL(8, 2) }, [joinUrl])

  useEffect(() => { fetch(dataUrl('features.json')).then((r) => r.json()).then((j) => setFeats(j.features)).catch(() => setFeats([])) }, [])

  const setPlan = (n: number, plan: PlanMsg) => setPlayers((p) => p.map((x) => (x.n === n ? { ...x, plan, ver: x.ver + 1 } : x)))

  // the room: every phone that connects becomes "Phone N"; a phone may send a new plan at any time
  useEffect(() => {
    let peer: Peer | null = null
    let live = true
    import('peerjs').then(({ Peer }) => {
      if (!live) return
      peer = new Peer(livePeerId(code))
      peer.on('open', () => setStatus('ready'))
      peer.on('error', () => setStatus('error'))
      peer.on('connection', (conn: DataConnection) => {
        const n = ++count.current
        setPlayers((p) => [...p, { n, label: (tr ? 'Telefon ' : 'Phone ') + n, plan: null, ver: 0 }])
        conn.on('data', (raw) => { const m = parsePlan(raw); if (m) setPlan(n, m) })
      })
    }).catch(() => setStatus('error'))
    return () => { live = false; peer?.destroy() }
  }, [code, tr])

  // one duel per plan: the judge's spot from /site, AdaptLab's from /search, then the verdict
  useEffect(() => {
    for (const p of players) {
      if (!p.plan || duels[p.n]?.ver === p.ver) continue
      const { n, ver, plan } = p
      setDuels((d) => ({ ...d, [n]: { ver, state: 'loading' } }))
      Promise.all([fetchSpot(plan), fetchSites(plan.days)])
        .then(([judge, sites]) => {
          const pick = pickForGoal(plan.goal, sites)
          if (!pick) throw new Error('no sites')
          const verdict = compareSpots(plan.goal, judge, pick)
          const suggest = verdict.winner === 'judge' ? null : suggestNear(plan.goal, judge.lat, judge.lon, sites)
          setDuels((d) => (d[n]?.ver === ver ? { ...d, [n]: { ver, state: 'done', judge, pick, verdict, suggest } } : d))
        })
        .catch(() => setDuels((d) => (d[n]?.ver === ver ? { ...d, [n]: { ver, state: 'error' } } : d)))
    }
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  const placeOf = (s: Spot) => (feats && describePlace(s.lat, s.lon, feats, lang)?.text) || `${Math.abs(s.lat).toFixed(2)}°${tr ? 'G' : 'S'} ${s.lon.toFixed(1)}°${tr ? 'D' : 'E'}`
  const fmtDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const addTest = () => {
    const n = ++count.current
    let spot = null
    while (!spot) spot = mapToLatLon(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6)
    const plan: PlanMsg = { type: 'plan', goal: GOALS[n % GOALS.length].id, days: LENGTHS[n % LENGTHS.length], lat: spot.lat, lon: spot.lon }
    setPlayers((p) => [...p, { n, label: (tr ? 'Test ' : 'Test ') + n, plan, ver: 1 }])
  }

  // leaderboard: judges ranked by how good their spot is for their own goal
  const ranked = players.filter((p) => p.plan && duels[p.n]?.state === 'done')
    .map((p) => ({ p, score: spotScore(p.plan!.goal, duels[p.n].judge!) }))
    .sort((a, b) => b.score - a.score)
  const rankOf = (n: number) => ranked.findIndex((r) => r.p.n === n) + 1
  const planned = players.filter((p) => p.plan)
  const shown = planned.slice(-4)
  const waiting = players.length - planned.length

  const say = (p: PlanMsg, d: Duel) => {
    const v = d.verdict!, j = d.judge!, k = d.pick!
    const jn = tr ? 'Hakemin yeri' : 'The judge’s spot', kn = 'AdaptLab'
    const [wn, ln] = v.winner === 'judge' ? [jn, tr ? 'AdaptLab' : 'AdaptLab’s'] : [kn, tr ? 'hakeminki' : 'the judge’s']
    const win = v.winner === 'judge' ? j : k, lose = v.winner === 'judge' ? k : j
    const what = p.goal === 'ice' ? (tr ? 'buza' : 'ice') : (tr ? 'Artemis bölgesine' : 'an Artemis region')
    if (j.goDays === 0 && k.goDays === 0 && p.days === 28) return tr
      ? `28 gün kalan hiçbir yer 48 saatten uzun bir Ay gecesinden kaçamıyor. ${v.winner === 'tie' ? 'İkisi denk.' : `${wn} daha çok Güneş alıyor (%${Math.round(win.sun)} / %${Math.round(lose.sun)}).`}`
      : `No spot survives 28 days without a lunar night over 48 h. ${v.winner === 'tie' ? 'The two are even.' : `${wn} gets more Sun (${Math.round(win.sun)}% vs ${Math.round(lose.sun)}%).`}`
    if (v.why === 'far') return tr ? `${wn} ${what} ${Math.round(win.targetKm!)} km, ${ln} ${Math.round(lose.targetKm!)} km uzakta.` : `${wn} is ${Math.round(win.targetKm!)} km from ${what}; ${ln} is ${Math.round(lose.targetKm!)} km away.`
    if (v.why === 'days') return lose.goDays === 0
      ? (tr ? `${wn} ${WINDOW.days} günün ${win.goDays}'inde inebilir; ${ln} hiçbir günde inemiyor (Güneş %${Math.round(lose.sun)}, Dünya %${Math.round(lose.earth)}).` : `${wn} can land on ${win.goDays} of ${WINDOW.days} days; ${ln} on none (Sun ${Math.round(lose.sun)}%, Earth ${Math.round(lose.earth)}%).`)
      : (tr ? `${wn} ${WINDOW.days} günün ${win.goDays}'inde inebilir, ${ln} ${lose.goDays}'inde.` : `${wn} can land on ${win.goDays} of ${WINDOW.days} days, ${ln} on ${lose.goDays}.`)
    if (v.why === 'light') return tr ? `İkisi de ${win.goDays} gün; ${wn} daha çok Güneş ve Dünya görüyor (Güneş %${Math.round(win.sun)} / %${Math.round(lose.sun)}).` : `Both land on ${win.goDays} days; ${wn} gets more Sun and Earth (Sun ${Math.round(win.sun)}% vs ${Math.round(lose.sun)}%).`
    return tr ? 'Berabere: aynı iniş günleri, neredeyse aynı ışık.' : 'A draw: the same landing days and nearly the same light.'
  }
  const tip = (d: Duel) => {
    if (d.verdict!.winner === 'judge') return tr ? 'AdaptLab’ın ilk seçimini geçtin.' : 'You beat AdaptLab’s top pick.'
    if (!d.suggest) return tr ? 'Bu görev için uygun nokta yok; daha kısa bir kalış dene.' : 'No GO spot for this mission in the window; try a shorter stay.'
    if (d.suggest.km < 3) return tr ? 'Yerin zaten iyi bir noktanın dibinde.' : 'Your spot is right next to a GO site.'
    return tr ? `Daha iyisi yakında: ${placeOf(d.suggest.spot)}, ${Math.round(d.suggest.km)} km ötede, ${d.suggest.spot.goDays}/${WINDOW.days} gün uygun.`
      : `Better near you: ${placeOf(d.suggest.spot)}, ${Math.round(d.suggest.km)} km away, GO on ${d.suggest.spot.goDays} of ${WINDOW.days} days.`
  }

  const tile = (s: Spot, who: string, win: boolean, goal: PlanMsg['goal']) => (
    <div className={`ds ${win ? 'win' : ''}`}>
      <p className="ds-who">{who}{win && <b>{tr ? 'KAZANAN' : 'WINNER'}</b>}</p>
      <p className="ds-place">{placeOf(s)}</p>
      <SpotArt spot={s} />
      <p className="ds-line">
        <span className={`sc-go ${s.goDays > 0 ? 'go' : 'nogo'}`}>{s.goDays > 0 ? (tr ? 'UYGUN' : 'GO') : (tr ? 'UYGUN DEĞİL' : 'NO-GO')} {s.goDays}/{WINDOW.days}</span>
        <span>{fmtDate(s.date)}</span>
      </p>
      <div className="ds-stats">
        <span><b>{Math.round(s.sun)}%</b>{tr ? 'Güneş' : 'Sun'}</span>
        <span><b>{Math.round(s.earth)}%</b>{tr ? 'Dünya' : 'Earth'}</span>
        {(goal === 'ice' || goal === 'artemis') && s.targetKm !== null
          ? <span><b>{Math.round(s.targetKm)} km</b>{goal === 'ice' ? (tr ? 'buza' : 'to ice') : (tr ? 'hedefe' : 'to target')}</span>
          : <span><b>{Math.round(s.dark)} {tr ? 'sa' : 'h'}</b>{tr ? 'en uzun gece' : 'longest dark'}</span>}
      </div>
    </div>
  )

  return (
    <div className="live">
      <header className="live-head">
        <span className="live-brand"><Patch size={30} /> <b className="wordmark">AdaptLab</b> <span>· {tr ? 'Canlı oturum' : 'Live session'}</span></span>
        <span className="live-window">{tr ? 'İniş penceresi' : 'Landing window'} · {fmtDate(WINDOW.start)}–{fmtDate('2027-09-12')} 2027 · {tr ? 'Güney kutbu, 21.856 nokta' : 'South pole, 21,856 points'}</span>
        <button className="live-x" onClick={() => { location.hash = '' }} aria-label={tr ? 'Kapat' : 'Close'}><X size={20} /></button>
      </header>
      <div className="live-body">
        <aside className="live-join">
          <img src={qr} alt={tr ? 'Katılmak için QR kodu' : 'QR code to join'} />
          <p className="live-url">{shareOrigin(location.origin).replace(/^https?:\/\//, '')} · <b>{code}</b></p>
          <ol className="live-steps">
            <li>{tr ? 'Görevini seç' : 'Pick your mission'}</li>
            <li>{tr ? 'Kalış süresini seç' : 'Pick how long you stay'}</li>
            <li>{tr ? 'Haritada iniş yerine dokun' : 'Tap your landing spot'}</li>
          </ol>
          <p className={`live-status ${status}`}>{status === 'ready'
            ? (tr ? `Hazır · ${players.length} katılımcı${waiting ? ` · ${waiting} planlıyor` : ''}` : `Ready · ${players.length} joined${waiting ? ` · ${waiting} planning` : ''}`)
            : status === 'connecting' ? (tr ? 'Bağlanıyor…' : 'Connecting…') : (tr ? 'Telefon bağlantısı yok: test telefonu ekle' : 'No phone link: add a test phone')}</p>
          {ranked.length > 1 && (
            <ol className="live-board">
              {ranked.slice(0, 5).map((r, i) => { const g = goalById(r.p.plan!.goal)!; return (
                <li key={r.p.n} style={{ ['--team' as string]: g.colour }}><span className="lb-n">{String(i + 1).padStart(2, '0')}</span><b>{r.p.label}</b><span>{tr ? g.tr : g.en}</span></li>
              ) })}
            </ol>
          )}
          <button className="live-test" onClick={addTest}><Plus size={16} /> {tr ? 'Test telefonu' : 'Test phone'}</button>
        </aside>
        <main className={`live-grid n${Math.max(1, shown.length)}`}>
          {shown.length === 0 && <p className="live-empty">{waiting ? (tr ? 'Hakemler planlıyor…' : 'Judges are planning…') : (tr ? 'Telefonlar bekleniyor…' : 'Waiting for phones…')}</p>}
          {shown.map((p) => {
            const plan = p.plan!, g = goalById(plan.goal)!, d = duels[p.n]
            const rank = rankOf(p.n)
            return (
              <section key={p.n} className="duel" style={{ ['--team' as string]: g.colour }}>
                <header className="duel-head">
                  <span className="duel-rank">{rank ? String(rank).padStart(2, '0') : '··'}</span>
                  <div>
                    <p className="duel-who">{p.label}</p>
                    <p className="duel-goal">{tr ? g.tr : g.en} <span>· {plan.days} {tr ? 'gün' : 'days'}</span></p>
                  </div>
                  {d?.state === 'done' && <span className={`duel-result ${d.verdict!.winner}`}>{d.verdict!.winner === 'judge' ? (tr ? 'HAKEM KAZANDI' : 'JUDGE WINS') : d.verdict!.winner === 'pick' ? (tr ? 'ADAPTLAB KAZANDI' : 'ADAPTLAB WINS') : (tr ? 'BERABERE' : 'DRAW')}</span>}
                </header>
                {(!d || d.state === 'loading') && <p className="duel-wait">{tr ? `${plan.days} günlük görev için 21.856 nokta aranıyor…` : `Searching 21,856 points for a ${plan.days}-day stay…`}</p>}
                {d?.state === 'error' && <p className="duel-wait">{tr ? 'Bu sefer sonuç alınamadı. Yerini değiştirip tekrar gönder.' : 'No answer this time. Move the spot and send again.'}</p>}
                {d?.state === 'done' && (
                  <>
                    <div className="duel-sides">
                      {tile(d.judge!, tr ? 'Hakemin yeri' : 'Judge’s spot', d.verdict!.winner === 'judge', plan.goal)}
                      <span className="duel-vs">VS</span>
                      {tile(d.pick!, tr ? 'AdaptLab’ın seçimi' : 'AdaptLab’s pick', d.verdict!.winner === 'pick', plan.goal)}
                    </div>
                    <p className="duel-say">{say(plan, d)}</p>
                    <p className="duel-tip"><MapPin size={15} /> {tip(d)}</p>
                  </>
                )}
              </section>
            )
          })}
        </main>
      </div>
    </div>
  )
}
