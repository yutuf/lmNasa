// "For judges" spotlight tour. Each step scrolls a live element into view, dims the rest, and
// shows a short callout. A selector that is not on the page is skipped.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lang } from '../i18n'
import { DEFAULT_TOUR, placeCallout, spotlightBox, stepFrom, stepsPresent, type TourStep } from '../tourModel'
import '../tour.css'
import '../tour-fix.css'

export { DEFAULT_TOUR }
export type { TourStep }

const PAD = 8

function exists(selector: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    const el = document.querySelector(selector)
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 || r.height > 0
  } catch {
    return false
  }
}

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
}

export default function GuidedTour({ lang, onClose, steps = DEFAULT_TOUR }: {
  lang: Lang
  onClose: () => void
  steps?: TourStep[]
}) {
  const tr = lang === 'tr'
  const maskId = `tour-${useId().replace(/:/g, '')}`
  const titleId = useId()
  const [cursor, setCursor] = useState(0)
  const [shown, setShown] = useState(false)
  const stepsRef = useRef(steps)
  const onCloseRef = useRef(onClose)
  const shownRef = useRef(false)
  const goRef = useRef<(dir: 1 | -1) => void>(() => {})
  const cardRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const holeRef = useRef<SVGRectElement>(null)
  stepsRef.current = steps
  onCloseRef.current = onClose
  const sig = steps.map((s) => s.selector).join('\0')
  const sigRef = useRef(sig)
  if (sigRef.current !== sig) {
    sigRef.current = sig
    setCursor(0)
  }

  const present = stepsPresent(steps, exists)
  const at = present.indexOf(cursor)
  const pos = at >= 0 ? at + 1 : 1
  const total = Math.max(present.length, 1)
  const step = steps[cursor] ?? steps[0]
  const atStart = at <= 0
  const atEnd = at >= 0 && at === present.length - 1

  const go = (dir: 1 | -1) => {
    const list = stepsPresent(stepsRef.current, exists)
    const n = stepFrom(list, cursor, dir)
    if (n == null) {
      if (dir > 0) onCloseRef.current()
      return
    }
    setCursor(n)
  }
  goRef.current = go

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingTarget(e.target)) return
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current() }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goRef.current(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goRef.current(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useLayoutEffect(() => {
    const list = stepsRef.current
    const live = stepsPresent(list, exists)
    if (live.length === 0) {
      onCloseRef.current()
      return
    }
    if (!live.includes(cursor)) {
      setCursor(stepFrom(live, cursor, 1) ?? live[live.length - 1])
      return
    }
    const el = document.querySelector(list[cursor].selector)
    const card = cardRef.current
    const ring = ringRef.current
    const hole = holeRef.current
    if (!el || !card || !ring || !hole) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })

    let raf = 0
    let frames = 0
    const place = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 && r.height <= 0) return
      const view = { width: window.innerWidth, height: window.innerHeight }
      const box = spotlightBox({ top: r.top, left: r.left, width: r.width, height: r.height }, PAD, view)
      hole.setAttribute('x', String(box.left))
      hole.setAttribute('y', String(box.top))
      hole.setAttribute('width', String(box.width))
      hole.setAttribute('height', String(box.height))
      ring.style.top = `${box.top}px`
      ring.style.left = `${box.left}px`
      ring.style.width = `${box.width}px`
      ring.style.height = `${box.height}px`
      ring.classList.add('is-on')
      const spot = placeCallout(box, view, { width: card.offsetWidth, height: card.offsetHeight })
      card.style.top = `${Math.max(12, Math.min(spot.top, view.height - card.offsetHeight - 12))}px`
      card.style.left = `${Math.max(12, Math.min(spot.left, view.width - card.offsetWidth - 12))}px`
      card.dataset.place = spot.placement
      if (!shownRef.current) {
        shownRef.current = true
        setShown(true)
      }
    }
    place()
    card.focus({ preventScroll: true })
    const ro = new ResizeObserver(place)
    ro.observe(el)
    ro.observe(card)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, { capture: true, passive: true })
    const follow = () => {
      place()
      if (++frames < 40) raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [cursor, sig, lang])

  if (!step) return null
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <svg className="tour-dim" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            <rect ref={holeRef} fill="#000" rx="12" x="0" y="0" width="0" height="0" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(8, 8, 12, .78)" mask={`url(#${maskId})`} />
      </svg>
      <div ref={ringRef} className="tour-ring" />
      <div ref={cardRef} className={`tour-card${shown ? ' is-on' : ''}`} tabIndex={-1}>
        <div className="tour-copy" aria-live="polite">
          <p className="sr-only">{tr ? `Adım ${pos} / ${total}` : `Step ${pos} of ${total}`}</p>
          <p className="tour-kicker">{tr ? 'Jüri turu' : 'For judges'}</p>
          <h2 id={titleId}>{step.title[lang]}</h2>
          <p className="tour-body">{step.body[lang]}</p>
        </div>
        <div className="tour-row">
          <span className="tour-count" aria-hidden="true">{pos} / {total}</span>
          <button type="button" className="tour-btn" onClick={() => go(-1)} disabled={atStart}>
            <ChevronLeft size={15} />{tr ? 'Geri' : 'Back'}
          </button>
          <button type="button" className="tour-btn primary" onClick={() => go(1)}>
            {atEnd ? (tr ? 'Bitti' : 'Done') : (tr ? 'İleri' : 'Next')}<ChevronRight size={15} />
          </button>
          <button type="button" className="tour-btn ghost" onClick={onClose}>{tr ? 'Geç' : 'Skip'}</button>
        </div>
        <p className="tour-hint">{tr ? '← → gezer · Esc geçer' : '← → move · Esc skips'}</p>
      </div>
    </div>
  )
}
