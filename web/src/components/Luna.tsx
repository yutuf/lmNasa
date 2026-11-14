// "Ask Luna": describe a mission in your own words or ask about the results. Answers come from Gemini via
// /api/ask and use only the numbers the page sends; actions (a new search, selecting a result) are applied here.
import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { askLocal } from '../lunaLocal'
import { ArrowUp, Sparkles, Volume2, VolumeX } from 'lucide-react'
import VoicePicker from './VoicePicker'
import { useSpeechVoice } from '../speech'

export type LunaAction =
  | { type: 'search'; params: Record<string, number | string | boolean> }
  | { type: 'select'; rank: number }

interface Msg { role: 'user' | 'luna'; text: string; error?: boolean }

const SUGGEST: Record<Lang, string[]> = {
  en: ['A 3-week rover landing in spring 2027 that must always reach Earth', 'Why is #1 better than #2?',
    'Explain this result to a 10-year-old', 'What happens if the launch slips a week?'],
  tr: ["2027 baharında inen, Dünya ile hep konuşabilen 3 haftalık bir gezgin", '#1 neden #2den daha iyi?',
    'Bu sonucu 10 yaşındaki birine anlat', 'Fırlatma bir hafta gecikirse ne olur?'],
}

export default function Luna({ lang, context, onAction, onPlan }: { lang: Lang; context: () => unknown; onAction: (a: LunaAction) => void; onPlan?: () => void }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [voice, setVoice] = useState(false)
  const [offline, setOffline] = useState(false)   // true once the server says it has no AI key
  const speech = useSpeechVoice(lang)
  const speak = (text: string) => {
    if (!voice || typeof speechSynthesis === 'undefined') return
    speech.speak(text, 0.95)
  }
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  async function send(q: string) {
    if (!q.trim() || busy) return
    const history = msgs.filter((m) => !m.error).map(({ role, text }) => ({ role, text }))
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setText('')
    setBusy(true)
    const ctx = context()
    const answer = (reply: string, action: LunaAction | null) => {
      setMsgs((m) => [...m, { role: 'luna', text: reply }])
      speak(reply)
      if (action) onAction(action)
    }
    try {
      if (offline) throw new Error('offline')
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, lang, context: ctx, history }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 503 || r.status === 404) setOffline(true)       // no AI key on this server, or no server at all
        throw new Error(data.error ?? `HTTP ${r.status}`)
      }
      answer(data.reply, data.action ?? null)
    } catch {
      // no AI service (or it failed): the built-in guide answers from the same engine results
      const local = askLocal(q, lang, ctx)
      answer(local.reply, local.action)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className={`luna-fab ${open ? 'on' : ''}`} onClick={() => setOpen(!open)}>
        <Sparkles size={14} /> {lang === 'tr' ? "Luna'ya sor" : 'Ask Luna'}
      </button>
      {open && (
        <div className="luna">
          <div className="luna-head">
            <b>Luna
              {typeof speechSynthesis !== 'undefined' && (
                <button className="luna-voice" onClick={() => { if (voice) speechSynthesis.cancel(); else speech.speak(lang === 'tr' ? 'Görev kontrol dinlemede. Bir Ay iniş planı hazırlıyoruz.' : 'Mission control is listening. We are preparing a lunar landing plan.', 0.96); setVoice(!voice) }}
                        aria-label={voice ? 'Mute' : 'Read answers aloud'} title={lang === 'tr' ? 'Yanıtları sesli oku' : 'Read answers aloud'}>
                  {voice ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
              )}
            </b>
            <span>{lang === 'tr' ? 'Görevinizi anlatın veya sonuçları sorun' : 'Describe your mission or ask about the results'}</span>
            {voice && <VoicePicker lang={lang} voices={speech.voices} selected={speech.selected} onChange={speech.choose}
              onPreview={() => speech.speak(lang === 'tr' ? 'Görev kontrol dinlemede. Bir Ay iniş planı hazırlıyoruz.' : 'Mission control is listening. We are preparing a lunar landing plan.', 0.96)} />}
            <div className="luna-splash" aria-hidden="true">
              <div className="luna-splash-orbit"><i /></div>
              <div className="luna-splash-copy">
                <small>{lang === 'tr' ? 'GÖREV ZEKÂSI · AY YÜZEYİ' : 'MISSION INTELLIGENCE · LUNAR SURFACE'}</small>
                <strong>{lang === 'tr' ? 'UÇUŞ YÖNETMENİN HAZIR' : 'YOUR FLIGHT DIRECTOR'}</strong>
                <span><i className={offline ? 'local' : ''} />{offline
                  ? (lang === 'tr' ? 'YEREL REHBER · MOTOR VERİSİNE BAĞLI' : 'LOCAL GUIDE · ENGINE LINKED')
                  : (lang === 'tr' ? 'LUNA · GÖREV VERİSİNE BAĞLI' : 'LUNA · MISSION DATA LINKED')}</span>
              </div>
            </div>
          </div>
          <div className="luna-msgs">
            {msgs.length === 0 && onPlan && (
              <button className="luna-plan" onClick={() => { setOpen(false); onPlan() }}>{lang === 'tr' ? 'Benimle bir görev planla →' : 'Plan a mission with me →'}</button>
            )}
            {msgs.length === 0 && (
              <div className="luna-suggest">
                {SUGGEST[lang].map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, k) => <div key={k} className={`msg ${m.role} ${m.error ? 'err' : ''}`}>{m.text}</div>)}
            {busy && <div className="msg luna typing"><i /><i /><i /></div>}
            <div ref={end} />
          </div>
          <form className="luna-input" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
                   placeholder={lang === 'tr' ? 'ör. 2028 yazında 10 günlük bir görev…' : 'e.g. a 10-day mission in summer 2028…'} />
            <button disabled={busy || !text.trim()} aria-label="Send"><ArrowUp size={15} /></button>
          </form>
          <p className="luna-note">{offline
            ? (lang === 'tr' ? 'Çevrimdışı rehber: yanıtlar doğrudan LunaNav motorunun sonuçlarından gelir (yapay zekâ anahtarı yok).'
              : 'Offline guide: answers come straight from LunaNav’s engine results (no AI key on this server).')
            : (lang === 'tr' ? "Yanıtlar yapay zekâ (Google Gemini) ile üretilir ve yalnızca LunaNav motorunun sonuçlarını kullanır."
              : 'Answers are generated by AI (Google Gemini) from LunaNav’s engine results only.')}</p>
        </div>
      )}
    </>
  )
}
