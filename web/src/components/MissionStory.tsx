// "Tell me the mission": Luna walks you through a mission like a pitch. She asks what it is for, which lander and
// when; you answer with a tap (or in your own words, read by the offline guide); she runs the real search and tells
// the story of the best site in chapters, then offers to watch the landing or walk on the Moon.
import { useEffect, useRef, useState } from 'react'
import { Footprints, Rocket, Sparkles, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { parseMission } from '../lunaLocal'
import { SCENARIOS, type Scenario } from '../scenarios'
import { missionStory, type Chapter } from '../story'
import { LANDERS, type Lander } from '../vehicles'
import type { CardSite } from './SiteCard'
import VehiclePhoto from './VehiclePhoto'
import { useSpeechVoice } from '../speech'

type Step = 'goal' | 'lander' | 'when' | 'search' | 'story' | 'done'
interface Msg { who: 'luna' | 'you'; text: string; tone?: Chapter['tone']; title?: string }

const WHEN = (lang: Lang) => [
  { label: lang === 'tr' ? 'Eylül 2027' : 'September 2027', start: '2027-09-01' },
  { label: lang === 'tr' ? 'Mart 2028' : 'March 2028', start: '2028-03-01' },
  { label: lang === 'tr' ? 'Ocak 2030' : 'January 2030', start: '2030-01-01' },
  { label: lang === 'tr' ? 'Haziran 2035' : 'June 2035', start: '2035-06-01' },
]

export default function MissionStory({ lang, cards, ranKey, onSearch, onClose, onWatch, onWalk, onOpen }: {
  lang: Lang; cards: CardSite[]; ranKey: unknown
  onSearch: (sc: Scenario, l: Lander, start: string) => void
  onClose: () => void; onWatch: (c: CardSite) => void; onWalk: (c: CardSite) => void; onOpen: (c: CardSite) => void
}) {
  const tr = lang === 'tr'
  const [step, setStep] = useState<Step>('goal')
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'luna', text: tr
    ? 'Merhaba, ben Luna. Bu görevin hikâyesini birlikte yazalım. Önce: Ay’a ne için gidiyoruz?'
    : 'Hi, I’m Luna. Let’s write this mission’s story together. First: what are we going to the Moon for?' }])
  const [sc, setSc] = useState<Scenario | null>(null)
  const [lander, setLander] = useState<Lander | null>(null)
  const [voice, setVoice] = useState(false)
  const speech = useSpeechVoice(lang)
  const [text, setText] = useState('')
  const chapters = useRef<Chapter[]>([])
  const [chap, setChap] = useState(0)
  const startKey = useRef<unknown>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, step])
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }, [])

  const say = (m: Msg) => {
    setMsgs((x) => [...x, m])
    if (voice && m.who === 'luna') speech.speak(`${m.title ? `${m.title}. ` : ''}${m.text}`, 0.92)
  }

  const pickGoal = (s: Scenario) => {
    setSc(s)
    say({ who: 'you', text: s.name[lang] })
    say({ who: 'luna', text: `${s.desc[lang]} ${tr ? 'Peki bizi oraya hangi iniş aracı götürsün?' : 'So which lander takes us there?'}` })
    setStep('lander')
  }
  const pickLander = (l: Lander) => {
    setLander(l)
    say({ who: 'you', text: l.name })
    say({ who: 'luna', text: `${l.pitch[lang]} ${tr ? 'Ne zaman inmek istersin?' : 'When do you want to land?'}` })
    setStep('when')
  }
  const pickWhen = (start: string, label: string) => {
    if (!sc || !lander) return
    say({ who: 'you', text: label })
    say({ who: 'luna', text: tr
      ? `Arama başlıyor: güney kutbunda 21.856 nokta, ${label} itibarıyla 30 iniş tarihi, her biri saat saat NASA arazisi ve JPL efemerisiyle…`
      : `Searching: 21,856 points around the south pole, 30 landing dates from ${label}, each one hour by hour on NASA terrain and the JPL ephemeris…` })
    setStep('search')
    startKey.current = ranKey
    onSearch(sc, lander, start)
  }
  // the search finished: tell the story of the best site
  useEffect(() => {
    if (step !== 'search' || ranKey === startKey.current || !lander) return
    const best = cards.find((c) => c.r.goCount > 0) ?? cards[0]
    if (!best) { say({ who: 'luna', text: tr ? 'Bu pencerede hiç nokta bulunamadı; başka bir tarih deneyelim.' : 'Nothing passes in this window; let’s try another date.' }); setStep('when'); return }
    const landing = new Date(Date.parse(best.row.bestLanding + 'T00:00:00Z'))
    chapters.current = missionStory(best, lander, sc, landing, lang)
    say({ who: 'luna', text: tr ? `Bulduk. Size ${best.name} noktasını anlatayım.` : `Found it. Let me pitch you ${best.name}.` })
    setChap(0)
    setStep('story')
  }, [ranKey, step])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step !== 'story') return
    const c = chapters.current[chap]
    if (!c) { setStep('done'); return }
    say({ who: 'luna', text: c.text, title: c.title, tone: c.tone })
  }, [chap, step])  // eslint-disable-line react-hooks/exhaustive-deps

  // free text: the offline guide reads the mission from your own words
  const free = () => {
    const q = text.trim()
    if (!q) return
    setText('')
    say({ who: 'you', text: q })
    const p = parseMission(q)
    if (step === 'goal') {
      const s = SCENARIOS.find((x) => p.ice && x.id === 'rover') ?? SCENARIOS.find((x) => p.zone === 100 && x.id === 'crew') ??
        SCENARIOS.find((x) => typeof p.days === 'number' && Math.abs(x.days - (p.days as number)) <= 3) ?? SCENARIOS[0]
      pickGoal(s)
    } else if (step === 'lander') {
      const l = LANDERS.find((x) => q.toLowerCase().includes(x.name.toLowerCase().split(' ')[0].toLowerCase())) ?? LANDERS[0]
      pickLander(l)
    } else if (step === 'when') {
      if (typeof p.start === 'string') pickWhen(p.start, q)
      else say({ who: 'luna', text: tr ? 'Bir ay ve yıl söyler misin? Örneğin “Mart 2028”.' : 'Tell me a month and a year, like “March 2028”.' })
    }
  }

  const best = cards.find((c) => c.r.goCount > 0) ?? cards[0]
  return (
    <div className="story" role="dialog" aria-label={tr ? 'Görev hikâyesi' : 'Mission story'}>
      <div className="story-head">
        <span className="story-luna"><Sparkles size={15} /> Luna</span>
        <span className="story-title">{tr ? 'Görevi anlat' : 'Tell me the mission'}</span>
        <button className="icon-btn" onClick={() => { if (voice) speechSynthesis.cancel(); setVoice(!voice) }} aria-label={voice ? 'Mute' : 'Read aloud'}>
          {voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <div className="story-msgs">
        {msgs.map((m, k) => (
          <div key={k} className={`smsg ${m.who} ${m.tone ?? ''}`}>
            {m.who === 'you' ? <UserRound size={13} /> : null}
            <div>{m.title && <b className="smsg-title">{m.title}</b>}<span>{m.text}</span></div>
          </div>
        ))}
        {step === 'search' && <div className="smsg luna typing"><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      <div className="story-choices">
        {step === 'goal' && SCENARIOS.map((s) => <button key={s.id} onClick={() => pickGoal(s)}><b>{s.name[lang]}</b></button>)}
        {step === 'lander' && LANDERS.map((l) => <button key={l.id} className="with-photo" onClick={() => pickLander(l)}><VehiclePhoto kind="lander" id={l.id} alt="" className="story-photo" /><b>{l.name}</b><span>{l.maker}</span></button>)}
        {step === 'when' && WHEN(lang).map((w) => <button key={w.start} onClick={() => pickWhen(w.start, w.label)}><b>{w.label}</b></button>)}
        {step === 'story' && <button className="primary" onClick={() => setChap((c) => c + 1)}><b>{tr ? 'Devam →' : 'Next →'}</b></button>}
        {step === 'done' && best && (
          <>
            <button className="primary" onClick={() => onWatch(best)}><Rocket size={14} /><b>{tr ? 'İnişi izle' : 'Watch the landing'}</b></button>
            <button onClick={() => onWalk(best)}><Footprints size={14} /><b>{tr ? 'Ay’da yürü' : 'Walk on the Moon'}</b></button>
            <button onClick={() => onOpen(best)}><b>{tr ? 'Nokta profili' : 'Site profile'}</b></button>
            <button onClick={() => { setStep('goal'); setMsgs([{ who: 'luna', text: tr ? 'Yeni bir görev: ne için gidiyoruz?' : 'A new mission: what are we going for?' }]) }}><b>{tr ? 'Yeni görev' : 'New mission'}</b></button>
          </>
        )}
      </div>
      {(step === 'goal' || step === 'lander' || step === 'when') && (
        <form className="story-input" onSubmit={(e) => { e.preventDefault(); free() }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
                 placeholder={step === 'goal' ? (tr ? 'ya da kendi sözlerinle: “buza yakın 3 haftalık gezgin”' : 'or in your own words: “a 3-week rover near ice”')
                   : step === 'lander' ? (tr ? 'ya da bir isim yaz: “Blue Ghost”' : 'or type a name: “Blue Ghost”') : (tr ? 'ya da: “Mart 2028”' : 'or: “March 2028”')} />
          <button aria-label="Send">→</button>
        </form>
      )}
      <p className="story-note">{tr ? 'Luna yalnızca LunaNav motorunun hesapladığı sayıları anlatır.' : 'Luna only tells numbers that LunaNav’s engine computed.'}</p>
    </div>
  )
}
