// Presentation assist (the Present button, or #present=1). The main presentation is the team's Canva deck (Çırpan);
// the site only steps in for three live moments, in one browser tab: the judges' room (QR), the live demo, and the proof
// (real landings, then the judges' duels with the Judges button). presentation-kit/SUNUM_AKISI.md says when to switch.
// The judges' room stays mounted the whole time (App), so phones stay connected. PageDown / PageUp move between screens.
import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, QrCode, X } from 'lucide-react'
import type { Lang } from '../i18n'
import '../present.css'

export type SectionId = 'room' | 'demo' | 'proof'
export const SECTIONS: { id: SectionId; en: string; tr: string }[] = [
  { id: 'room', en: 'Judges join', tr: 'Hakemler katılır' },
  { id: 'demo', en: 'Live demo', tr: 'Canlı demo' },
  { id: 'proof', en: 'Proof', tr: 'Kanıt' },
]

function typing(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export default function Present({ lang, step, onStep, roomOn, onRoom, onExit, joined, planned }: {
  lang: Lang; step: number; onStep: (i: number) => void; roomOn: boolean; onRoom: (on: boolean) => void; onExit: () => void
  joined: number; planned: number
}) {
  const tr = lang === 'tr'
  const s = SECTIONS[step]
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || (e.key !== 'PageDown' && e.key !== 'PageUp')) return
      e.preventDefault(); e.stopImmediatePropagation()
      const n = stepRef.current + (e.key === 'PageDown' ? 1 : -1)
      if (n >= 0 && n < SECTIONS.length) onStep(n)
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [onStep])

  return (
    <>
      <nav className="pr-pill" aria-label={tr ? 'Sunum' : 'Presentation'}>
        <button className="pr-x" onClick={() => onStep(step - 1)} disabled={step === 0} aria-label={tr ? 'Geri' : 'Back'}><ChevronLeft size={17} /></button>
        <span className="pr-pos"><b>{step + 1}</b>/{SECTIONS.length} · {tr ? s.tr : s.en}</span>
        <button className="pr-x" onClick={() => onStep(step + 1)} disabled={step === SECTIONS.length - 1} aria-label={tr ? 'İleri' : 'Next'}><ChevronRight size={17} /></button>
        <button className={roomOn ? 'on' : ''} onClick={() => onRoom(!roomOn)} aria-pressed={roomOn} title={tr ? 'Hakem odası ve düellolar' : 'Judges’ room and duels'}>
          <QrCode size={15} /><span>{tr ? `Hakemler ${joined}/8` : `Judges ${joined}/8`}</span>
        </button>
        {!roomOn && planned > 0 && <span className="pr-sent">{planned} {tr ? 'plan' : planned === 1 ? 'plan' : 'plans'}</span>}
        <button className="pr-x" onClick={onExit} aria-label={tr ? 'Sunumdan çık' : 'Exit the presentation'}><X size={15} /></button>
      </nav>
    </>
  )
}
