// Spotlight tour geometry and the default "for judges" script. Pure: no DOM.

export type LangText = { en: string; tr: string }

export type TourStep = {
  selector: string
  title: LangText
  body: LangText
}

/** Simple view, in the order a judge walks the page. Missing selectors are skipped at runtime. */
export const DEFAULT_TOUR: TourStep[] = [
  {
    selector: '.s-hero h1',
    title: { en: 'What LunaNav is', tr: 'LunaNav nedir' },
    body: {
      en: 'LunaNav searches the Moon for a place and a date where a lander has sunlight and a radio link home. It plans. It does not certify a landing.',
      tr: 'LunaNav, iniş aracının güneş ışığı ve Dünya’ya telsiz bağı bulacağı yeri ve tarihi arar. Planlar. Bir inişi onaylamaz.',
    },
  },
  {
    selector: '.s-step-goal',
    title: { en: 'Pick a goal', tr: 'Bir hedef seç' },
    body: {
      en: 'A safe landing, water ice, or NASA’s Artemis III regions. The goal changes which sites rank first.',
      tr: 'Güvenli iniş, su buzu ya da NASA’nın Artemis III bölgeleri. Hedef, hangi yerlerin öne geçeceğini değiştirir.',
    },
  },
  {
    selector: '.s-steps .s-step:nth-child(2)',
    title: { en: 'Mission length', tr: 'Görev süresi' },
    body: {
      en: 'Five days to a month on the surface. A longer stay needs more sun and a battery that can ride out the dark.',
      tr: 'Yüzeyde beş gün ile bir ay arası. Uzun kalış daha çok güneş ve karanlığı atlatacak bir batarya ister.',
    },
  },
  {
    selector: '.s-run',
    title: { en: 'One click', tr: 'Tek tık' },
    body: {
      en: 'One click runs thousands of hourly checks: Sun over the real horizon, Earth in view, the longest night, the battery and the slope.',
      tr: 'Tek tık binlerce saatlik kontrol çalıştırır: gerçek ufkun üstünde Güneş, görünen Dünya, en uzun gece, batarya ve eğim.',
    },
  },
  {
    selector: '.card-grid .site-card',
    title: { en: 'A site card', tr: 'Yer kartı' },
    body: {
      en: 'Each card is real terrain. GO days are dates that pass. The percentage is the chance the mission succeeds.',
      tr: 'Her kart gerçek arazidir. GO günleri geçen tarihlerdir. Yüzde, görevin başarı şansıdır.',
    },
  },
  {
    selector: '.s-clps',
    title: { en: 'Real NASA missions', tr: 'Gerçek NASA görevleri' },
    body: {
      en: 'IM-3, Griffin Mission 1, CP-12 and Blue Ghost Mission 3. One click loads the real target and year.',
      tr: 'IM-3, Griffin Mission 1, CP-12 ve Blue Ghost Mission 3. Tek tık gerçek hedefi ve yılı yükler.',
    },
  },
  {
    selector: '.s-next',
    title: { en: 'Film, lab, workshop', tr: 'Film, karar, atölye' },
    body: {
      en: 'Watch the film, weigh the sites in the decision lab, or design a lander in the workshop.',
      tr: 'Filmi izle, yerleri karar laboratuvarında tart ya da atölyede bir iniş aracı tasarla.',
    },
  },
  {
    selector: '.map-card',
    title: { en: 'The 3D globe', tr: '3B küre' },
    body: {
      en: 'The same sites on the 3D globe. Open one to see the terrain and drive the lander.',
      tr: 'Aynı yerler 3B kürededir. Birini açınca araziyi görür ve iniş aracını sürersin.',
    },
  },
]

/** Indexes of steps whose selector currently exists, in script order. */
export function stepsPresent<T extends { selector: string }>(steps: readonly T[], present: (selector: string) => boolean): number[] {
  const out: number[] = []
  for (let i = 0; i < steps.length; i++) if (present(steps[i].selector)) out.push(i)
  return out
}

/** Next or previous index in `indices`. Null at the ends. A current index that was skipped jumps to the neighbour. */
export function stepFrom(indices: readonly number[], current: number, dir: 1 | -1): number | null {
  const at = indices.indexOf(current)
  if (at < 0) {
    if (dir > 0) return indices.find((i) => i >= current) ?? null
    for (let i = indices.length - 1; i >= 0; i--) if (indices[i] <= current) return indices[i]
    return null
  }
  return indices[at + dir] ?? null
}

export type Box = { top: number; left: number; width: number; height: number }
export type Placement = 'top' | 'bottom' | 'left' | 'right'

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  if (w <= 0 || h <= 0) return 0
  return w * h
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Put the callout beside the target, in the viewport.
 * Prefer below, then above, then right, then left. Nudge to stay on screen before flipping side.
 */
export function placeCallout(
  target: Box,
  view: { width: number; height: number },
  card: { width: number; height: number },
  gap = 16,
  margin = 12,
): { top: number; left: number; placement: Placement } {
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  const prefs: { placement: Placement; top: number; left: number }[] = [
    { placement: 'bottom', top: target.top + target.height + gap, left: cx - card.width / 2 },
    { placement: 'top', top: target.top - card.height - gap, left: cx - card.width / 2 },
    { placement: 'right', top: cy - card.height / 2, left: target.left + target.width + gap },
    { placement: 'left', top: cy - card.height / 2, left: target.left - card.width - gap },
  ]
  const maxL = view.width - margin - card.width
  const maxT = view.height - margin - card.height
  let best = { top: margin, left: margin, placement: 'bottom' as Placement, score: Infinity }
  prefs.forEach((p, i) => {
    const top = clamp(p.top, margin, maxT)
    const left = clamp(p.left, margin, maxL)
    const nudged = (Math.abs(p.top - top) > 0.5 ? 1 : 0) + (Math.abs(p.left - left) > 0.5 ? 1 : 0)
    const overlap = overlapArea({ top, left, width: card.width, height: card.height }, target)
    const score = overlap * 10000 + i * 100 + nudged
    if (score < best.score) best = { top, left, placement: p.placement, score }
  })
  return { top: best.top, left: best.left, placement: best.placement }
}

/** Pad a target and keep the hole inside the viewport. */
export function spotlightBox(target: Box, pad: number, view: { width: number; height: number }): Box {
  const left = Math.max(0, target.left - pad)
  const top = Math.max(0, target.top - pad)
  const right = Math.min(view.width, target.left + target.width + pad)
  const bottom = Math.min(view.height, target.top + target.height + pad)
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}
