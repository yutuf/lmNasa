// Step-by-step mission brief. The first answer is a sentence; later questions appear only for gaps.
// Parsing lives in interview.ts and works with the network off. /api/ask may fill a missing date, length, or ice goal.
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Pencil, Rocket, Sparkles, X } from 'lucide-react'
import '../interview.css'
import {
  acknowledge,
  applyAnswer,
  changeLine,
  commit,
  examples,
  followUpAfterEdit,
  mergeAskParams,
  nextQuestion,
  openingLine,
  parseBrief,
  questionFor,
  readyLine,
  retryLine,
  shouldAskModel,
  summaryCopy,
  type InterviewResult,
  type MissionDraft,
  type MissionSummary,
  type QuestionId,
} from '../interview'

export type { InterviewResult }

const ASK_MS = 4500

type Bubble = { who: 'luna' | 'you'; text: string; card?: MissionSummary }
type Step = 'brief' | 'ask' | 'summary' | 'change'

function searchParams(data: unknown): Record<string, number | string | boolean> | undefined {
  if (!data || typeof data !== 'object') return undefined
  const action = (data as { action?: unknown }).action
  if (!action || typeof action !== 'object') return undefined
  const typed = action as { type?: unknown; params?: unknown }
  if (typed.type !== 'search' || !typed.params || typeof typed.params !== 'object') return undefined
  return typed.params as Record<string, number | string | boolean>
}

export default function MissionInterview({ lang, onRun, onClose }: {
  lang: 'en' | 'tr'
  onRun: (m: InterviewResult) => void
  onClose: () => void
}) {
  const tr = lang === 'tr'
  const [bubbles, setBubbles] = useState<Bubble[]>(() => [{ who: 'luna', text: openingLine(lang) }])
  const [draft, setDraft] = useState<MissionDraft>({ brief: '' })
  const [asked, setAsked] = useState<QuestionId[]>([])
  const [step, setStep] = useState<Step>('brief')
  const [current, setCurrent] = useState<QuestionId | null>(null)
  const [revising, setRevising] = useState(false)
  const [following, setFollowing] = useState(false)
  const [summary, setSummary] = useState<MissionSummary | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const lock = useRef(false)
  const snapshot = useRef<MissionDraft | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [bubbles, busy])

  useEffect(() => {
    if (step === 'brief' || step === 'ask') inputRef.current?.focus()
  }, [step, current])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function enrich(base: MissionDraft, question: string, history: { role: 'user' | 'luna'; text: string }[]): Promise<MissionDraft> {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const timer = window.setTimeout(() => ctrl.abort(), ASK_MS)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          question,
          lang,
          context: { source: 'mission-interview', brief: question },
          history,
        }),
      })
      if (!response.ok) return base
      const data: unknown = await response.json().catch(() => null)
      return mergeAskParams(base, searchParams(data))
    } catch {
      return base
    } finally {
      window.clearTimeout(timer)
    }
  }

  function showSummary(next: MissionDraft, language: 'en' | 'tr') {
    const committed = commit(next)
    const card = summaryCopy(committed, language)
    snapshot.current = null
    setDraft(committed)
    setSummary(card)
    setStep('summary')
    setCurrent(null)
    setRevising(false)
    setFollowing(false)
    setBubbles((b) => [...b, { who: 'luna', text: readyLine(language), card }])
  }

  async function sendBrief(raw: string) {
    const sentence = raw.trim()
    if (!sentence || lock.current) return
    lock.current = true
    const language = lang
    const history = bubbles
      .filter((b) => !b.card)
      .map((b) => ({ role: (b.who === 'you' ? 'user' : 'luna') as 'user' | 'luna', text: b.text }))
    setText('')
    setBubbles((b) => [...b, { who: 'you', text: sentence }])
    let next = parseBrief(sentence)
    try {
      if (shouldAskModel(next)) {
        setBusy(true)
        next = await enrich(next, sentence, history)
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
    if (!alive.current) return
    const q = nextQuestion(next, [])
    setBubbles((b) => [...b, { who: 'luna', text: acknowledge(next, language, q === null) }])
    if (!q) {
      showSummary(next, language)
      return
    }
    const question = questionFor(q, next, language)
    setDraft(next)
    setAsked([])
    setCurrent(q)
    setStep('ask')
    setBubbles((b) => [...b, { who: 'luna', text: question.prompt }])
  }

  function sendAnswer(raw: string, label?: string) {
    if (!current || lock.current) return
    const shown = (label ?? raw).trim()
    const answer = raw.trim()
    if (!shown || !answer) return
    const next = applyAnswer(draft, current, answer)
    setText('')
    if (next === draft) {
      setBubbles((b) => [...b, { who: 'you', text: shown }, { who: 'luna', text: retryLine(lang) }])
      return
    }
    setBubbles((b) => [...b, { who: 'you', text: shown }])
    if (revising) {
      if (!following) {
        const extra = followUpAfterEdit(next)
        if (extra && extra !== current) {
          const question = questionFor(extra, next, lang)
          setDraft(next)
          setCurrent(extra)
          setFollowing(true)
          setStep('ask')
          setBubbles((b) => [...b, { who: 'luna', text: question.prompt }])
          return
        }
      }
      showSummary(next, lang)
      return
    }
    const askedNow = [...asked, current]
    const q = nextQuestion(next, askedNow)
    setAsked(askedNow)
    if (!q) {
      showSummary(next, lang)
      return
    }
    const question = questionFor(q, next, lang)
    setDraft(next)
    setCurrent(q)
    setStep('ask')
    setBubbles((b) => [...b, { who: 'luna', text: question.prompt }])
  }

  function openChange() {
    snapshot.current = draft
    setRevising(true)
    setFollowing(false)
    setCurrent(null)
    setStep('change')
    setBubbles((b) => [...b, { who: 'luna', text: changeLine(lang) }])
  }

  function pickField(id: QuestionId) {
    const question = questionFor(id, draft, lang)
    setCurrent(id)
    setStep('ask')
    setRevising(true)
    setFollowing(false)
    setBubbles((b) => [...b, { who: 'you', text: fieldLabel(id) }, { who: 'luna', text: question.prompt }])
  }

  function backToSummary() {
    if (snapshot.current) setDraft(snapshot.current)
    snapshot.current = null
    setStep('summary')
    setCurrent(null)
    setRevising(false)
    setFollowing(false)
  }

  function fieldLabel(id: QuestionId): string {
    const labels: Record<QuestionId, string> = tr
      ? { goal: 'Amaç', crew: 'Mürettebat', lander: 'İniş aracı', rover: 'Gezgin', days: 'Süre', when: 'Tarih', scope: 'Arama alanı', relay: 'Röle' }
      : { goal: 'Goal', crew: 'Crew', lander: 'Lander', rover: 'Rover', days: 'Length', when: 'Date', scope: 'Search area', relay: 'Relay' }
    return labels[id]
  }

  const question = step === 'ask' && current ? questionFor(current, draft, lang) : null
  const fields: QuestionId[] = ['goal', 'crew', draft.crewed ? 'lander' : 'rover', 'days', 'when', 'scope', 'relay']

  return (
    <div className="mi-root">
      <div className="mi-scrim" onClick={onClose} />
      <div className="mi-panel" role="dialog" aria-modal="true" aria-labelledby="mi-title">
        <header className="mi-head">
          <span className="mi-badge"><Sparkles size={14} /> {tr ? 'Görev' : 'Mission'}</span>
          <div className="mi-title" id="mi-title">
            <b>LunaNav</b>
            <small>{tr ? 'Görev planı' : 'Mission plan'}</small>
          </div>
          <button type="button" className="mi-x" onClick={onClose} aria-label={tr ? 'Kapat' : 'Close'}>
            <X size={16} />
          </button>
        </header>

        <div className="mi-log" ref={logRef}>
          {bubbles.map((bubble, index) => (
            <div className="mi-turn" key={`${index}-${bubble.who}`}>
              {bubble.text && (
                <div className={`mi-bubble mi-${bubble.who}`}>
                  <p>{bubble.text}</p>
                </div>
              )}
              {bubble.card && (
                <article className="mi-card">
                  <h3>{bubble.card.title}</h3>
                  <p className="mi-body">{bubble.card.body}</p>
                  <div className="mi-rows">
                    {bubble.card.rows.map((row) => (
                      <div key={row.key}>
                        <small>{row.label}</small>
                        <b>{row.value}</b>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          ))}
          {busy && (
            <div className="mi-bubble mi-luna mi-typing" aria-hidden="true">
              <p><i /><i /><i /></p>
            </div>
          )}
        </div>

        <footer className="mi-foot">
          {step === 'brief' && (
            <div className="mi-chips">
              {examples(lang).map((sentence) => (
                <button key={sentence} type="button" className="mi-chip" disabled={busy} onClick={() => void sendBrief(sentence)}>
                  <b>{sentence}</b>
                </button>
              ))}
            </div>
          )}
          {question && (
            <div className="mi-chips">
              {question.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={choice.recommended ? 'mi-chip rec' : 'mi-chip'}
                  disabled={busy}
                  onClick={() => sendAnswer(choice.id, choice.label)}
                >
                  <b>{choice.label}</b>
                  {choice.hint && <small>{choice.hint}</small>}
                </button>
              ))}
            </div>
          )}
          {step === 'change' && (
            <div className="mi-chips">
              {fields.map((id) => (
                <button key={id} type="button" className="mi-chip" onClick={() => pickField(id)}>
                  <b>{fieldLabel(id)}</b>
                </button>
              ))}
            </div>
          )}
          {(step === 'brief' || step === 'ask') && (
            <form className="mi-form" onSubmit={(event) => {
              event.preventDefault()
              if (step === 'brief') void sendBrief(text)
              else sendAnswer(text)
            }}>
              <input
                ref={inputRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={step === 'brief' ? (tr ? 'Görevin, bir cümle' : 'Your mission, in one sentence') : (tr ? 'Yanıtını yaz' : 'Type an answer')}
                aria-label={step === 'brief' ? (tr ? 'Görev cümlesi' : 'Mission sentence') : (tr ? 'Yanıt' : 'Answer')}
                disabled={busy}
                autoComplete="off"
              />
              <button type="submit" disabled={busy || text.trim().length === 0} aria-label={tr ? 'Gönder' : 'Send'}>
                <ArrowUp size={16} />
              </button>
            </form>
          )}
          {step === 'summary' && summary && (
            <>
              <button type="button" className="mi-go" onClick={() => onRun(summary.result)}>
                <Rocket size={16} /> {tr ? 'İniş yerlerini bul' : 'Find landing sites'}
              </button>
              <button type="button" className="mi-ghost" onClick={openChange}>
                <Pencil size={16} /> {tr ? 'Bir şeyi değiştir' : 'Change something'}
              </button>
            </>
          )}
          {revising && step !== 'summary' && (
            <button type="button" className="mi-back" onClick={backToSummary}>
              {tr ? 'Özete dön' : 'Back to summary'}
            </button>
          )}
          <p className="mi-note">
            {tr
              ? 'Çevrimdışı da çalışır. Sunucu asistanı yalnızca açıksa boşlukları doldurur.'
              : 'Works offline. A server assistant fills gaps only when it is available.'}
          </p>
        </footer>
      </div>
    </div>
  )
}
