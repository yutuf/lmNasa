// The judge's phone in the live session (#join=CODE): plan a mission in three taps (goal, length, a spot on the
// south-pole map) and send it to the big screen, which puts the spot against AdaptLab's pick.
import { useEffect, useRef, useState } from 'react'
import type { DataConnection, Peer } from 'peerjs'
import { ChevronLeft, MapPin } from 'lucide-react'
import {
  GOALS, LENGTHS, MAP_EDGE_KM, MAP_LABELS, MAP_R_KM, goalById, goalTargets, latLonToMap, livePeerId, mapToLatLon,
  nearestLabel, parseJoinHash, type GoalId, type Length,
} from '../live'
import { dataUrl } from '../data'
import Patch from './Patch'
import '../live.css'

type Step = 0 | 1 | 2 | 3
const EDGE = (MAP_EDGE_KM / MAP_R_KM) * 50   // the searchable disc on the 0..100 map

export default function LiveJoin() {
  const { code, lang: lang0 } = parseJoinHash(location.hash)
  const [lang, setLang] = useState<'en' | 'tr'>(lang0)
  const tr = lang === 'tr'
  const [status, setStatus] = useState<'connecting' | 'live' | 'error' | 'full'>(code ? 'connecting' : 'error')
  const [step, setStep] = useState<Step>(0)
  const [goal, setGoal] = useState<GoalId | null>(null)
  const [days, setDays] = useState<Length | null>(null)
  const [spot, setSpot] = useState<{ lat: number; lon: number } | null>(null)
  const [outside, setOutside] = useState(false)
  const conn = useRef<DataConnection | null>(null)

  useEffect(() => {
    if (!code) return
    let peer: Peer | null = null
    let live = true
    import('peerjs').then(({ Peer }) => {
      if (!live) return
      peer = new Peer()
      peer.on('open', () => {
        const c = peer!.connect(livePeerId(code), { reliable: true })
        conn.current = c
        c.on('open', () => setStatus('live'))
        c.on('data', (m) => { if ((m as { type?: string })?.type === 'full') setStatus('full') })
        c.on('error', () => setStatus((s) => (s === 'full' ? s : 'error')))
        c.on('close', () => setStatus((s) => (s === 'full' ? s : 'error')))
      })
      peer.on('error', () => setStatus('error'))
    }).catch(() => setStatus('error'))
    return () => { live = false; peer?.destroy() }
  }, [code])

  const g = goal ? goalById(goal) : null
  const send = () => {
    if (!conn.current?.open || !goal || !days || !spot) return
    conn.current.send({ type: 'plan', goal, days, lat: spot.lat, lon: spot.lon })
    setStep(3)
  }
  const tapMap = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const p = mapToLatLon((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    setOutside(!p)
    if (p) setSpot(p)
  }
  const near = spot ? nearestLabel(spot.lat, spot.lon) : null
  const nearText = near ? (near.km < 4 ? (tr ? `${near.name} içinde` : `Inside ${near.name}`) : (tr ? `${near.name} kraterine ${Math.round(near.km)} km` : `${Math.round(near.km)} km from ${near.name}`)) : ''
  const pin = spot ? latLonToMap(spot.lat, spot.lon) : null

  const titles = [
    tr ? 'Görevin ne?' : 'What is your mission?',
    tr ? 'Ne kadar kalacaksın?' : 'How long do you stay?',
    tr ? 'Nereye inersin?' : 'Where would you land?',
    tr ? 'Büyük ekrana bak' : 'Look at the big screen',
  ]

  return (
    <div className="lj">
      <header className="lj-top">
        <p className="lj-brand"><Patch size={24} /> <b className="wordmark">AdaptLab</b></p>
        <div className="lj-right">
          <p className={`lj-status ${status === 'live' ? 'ok' : status === 'full' ? 'error' : status}`}>
            {status === 'live' ? (tr ? 'Bağlandı' : 'Connected') : status === 'connecting' ? (tr ? 'Bağlanıyor…' : 'Connecting…') : status === 'full' ? (tr ? 'Oda dolu' : 'Room full') : (tr ? 'Bağlanamadı' : 'Not connected')}
          </p>
          <div className="lj-lang" role="radiogroup" aria-label={tr ? 'Dil' : 'Language'}>
            <button role="radio" aria-checked={tr} className={tr ? 'on' : ''} onClick={() => setLang('tr')}>TR</button>
            <button role="radio" aria-checked={!tr} className={!tr ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </header>
      {status === 'full' && <p className="lj-full">{tr ? 'Bu oturumda 8 hakem yeri doldu. Büyük ekrandan izleyebilirsin.' : 'All 8 judge seats in this session are taken. Follow along on the big screen.'}</p>}

      <div className="lj-step">
        {step > 0 && step < 3 && <button className="lj-back" onClick={() => setStep((step - 1) as Step)} aria-label={tr ? 'Geri' : 'Back'}><ChevronLeft size={22} /></button>}
        <span className="lj-num">{String(Math.min(step + 1, 3)).padStart(2, '0')}</span>
        <div>
          <p className="lj-of">{step < 3 ? (tr ? `Adım ${step + 1} / 3` : `Step ${step + 1} of 3`) : (tr ? 'Gönderildi ✓' : 'Sent ✓')}</p>
          <h1>{titles[step]}</h1>
        </div>
      </div>

      {g && step > 0 && step < 3 && (
        <div className="lj-chips">
          <button onClick={() => setStep(0)} style={{ background: g.colour }}>{tr ? g.tr : g.en}</button>
          {days && step > 1 && <button onClick={() => setStep(1)}>{days} {tr ? 'gün' : 'days'}</button>}
        </div>
      )}

      {step === 0 && (
        <div className="lj-goals">
          {GOALS.map((x, i) => (
            <button key={x.id} style={{ background: x.colour }} className={goal === x.id ? 'on' : ''} onClick={() => { setGoal(x.id); setStep(1) }}>
              <span className="lj-gn">{String(i + 1).padStart(2, '0')}</span>
              <b>{tr ? x.tr : x.en}</b><span>{tr ? x.hintTr : x.hintEn}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="lj-lengths">
          {LENGTHS.map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => { setDays(d); setStep(2) }}>
              <b>{d}</b>
              <span><i>{tr ? 'gün' : 'days'}</i>{d === 7 ? (tr ? 'Kısa iniş, hızlı bilim' : 'Short stay, quick science') : d === 14 ? (tr ? 'Bir Ay günü' : 'One lunar day') : (tr ? 'Ay gecesini atlat' : 'Survive a lunar night')}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <>
          <div className="lj-map" onPointerDown={tapMap}>
            <img src={dataUrl('live_map.jpg')} alt={tr ? 'Güney kutbu haritası' : 'South pole map'} draggable={false} />
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path d={`M0 0H100V100H0Z M50 ${50 - EDGE}A${EDGE} ${EDGE} 0 1 0 50 ${50 + EDGE}A${EDGE} ${EDGE} 0 1 0 50 ${50 - EDGE}Z`} fillRule="evenodd" fill="#000" fillOpacity=".72" />
              <circle cx="50" cy="50" r={EDGE} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".35" strokeDasharray="1.2 1" />
              {goal && goalTargets(goal).map((t) => { const p = latLonToMap(t.lat, t.lon); return <circle key={t.id} cx={p.fx * 100} cy={p.fy * 100} r="1.8" className={`lj-t lj-t-${goal}`} /> })}
              {MAP_LABELS.map((l) => { const p = latLonToMap(l.lat, l.lon); return <text key={l.name} x={p.fx * 100} y={p.fy * 100 - 2.6} className="lj-lbl">{l.name}</text> })}
              {pin && <g transform={`translate(${pin.fx * 100} ${pin.fy * 100})`}><circle r="3.6" className="lj-pin-halo" /><circle r="1.7" className="lj-pin" /></g>}
            </svg>
          </div>
          <p className="lj-hint">
            {outside ? (tr ? 'Orası aranan bölgenin dışında. Dairenin içine dokun.' : 'That is outside the searched area. Tap inside the circle.')
              : spot ? <><MapPin size={15} /> <b>{nearText}</b> · {Math.abs(spot.lat).toFixed(2)}°{tr ? 'G' : 'S'} {spot.lon.toFixed(1)}°{tr ? 'D' : 'E'}</>
              : goal === 'ice' ? (tr ? 'Mavi noktalar buz hedefleri. Haritaya dokun.' : 'Blue dots are ice targets. Tap the map.')
              : goal === 'artemis' ? (tr ? 'Sarı noktalar Artemis III bölgeleri. Haritaya dokun.' : 'Yellow dots are Artemis III regions. Tap the map.')
              : (tr ? 'Güney kutbu, 85°G’den kutba kadar. Haritaya dokun.' : 'The south pole, from 85°S to the pole. Tap the map.')}
          </p>
          <button className="lj-send" disabled={!spot || status !== 'live'} onClick={send}>{tr ? 'Büyük ekrana gönder' : 'Send to the big screen'}</button>
        </>
      )}

      {step === 3 && g && (
        <div className="lj-done">
          <div className="lj-card" style={{ background: g.colour }}>
            <span className="lj-gn">{days}<small>{tr ? 'GÜN' : 'DAYS'}</small></span>
            <b>{tr ? g.tr : g.en}</b>
            <span><MapPin size={14} /> {nearText}</span>
          </div>
          <p>{tr ? 'AdaptLab senin yerini kendi seçtiği yerle karşılaştırıyor.' : 'AdaptLab is putting your spot against its own pick.'}</p>
          <button className="lj-again" onClick={() => setStep(2)}>{tr ? 'Yerimi değiştir' : 'Move my spot'}</button>
          <button className="lj-again" onClick={() => { setSpot(null); setStep(0) }}>{tr ? 'Yeni görev' : 'New mission'}</button>
        </div>
      )}
    </div>
  )
}
