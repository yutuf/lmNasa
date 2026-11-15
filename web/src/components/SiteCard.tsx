// A landing site as an F1-style card: region "team colour", the name in two weights, the rank as a big outlined
// number, and a 3D render of the site's real terrain lit by the Sun of its best landing date.
import type { EllipseCheck } from '../ellipse'
import { useEffect, useState } from 'react'
import type { PointResult } from '../engine'
import { fmtPercent, verdictLabel, type Lang } from '../i18n'
import type { SiteRow } from '../report'
import { renderSite } from '../siteRender'
import { splitName } from '../teams'
import type { Probability } from '../probability'

export interface CardSite {
  r: PointResult
  row: SiteRow
  rank: number
  name: string
  placeName?: string      // the feature inside `name`; the bold line is this, not the last word
  region: string | null
  colour: string
  xKm: number
  yKm: number
  sun: { az: number; alt: number }
  bestDate: string
  note?: string          // far side, or the distance to the science target
  prob?: Probability     // Monte Carlo mission success
  targetKm?: number      // distance to the nearest science target
  ellipse?: EllipseCheck | null   // worst case across the landing ellipse (south pole only)
}

/** The card and site-page title: light words, then the last word in the large face (as on the live site). */
export function PlaceTitle({ text, light, bold }: { text: string; placeName?: string; light: string; bold: string }) {
  const [l, b] = splitName(text)
  return (
    <>
      {l && <span className={light}>{l}</span>}
      <span className={bold}>{b}</span>
    </>
  )
}

export function useSiteImage(s: CardSite) {
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    // keyed by position, not index: the two grids number their points differently
    renderSite(`${s.xKm.toFixed(2)},${s.yKm.toFixed(2)}:${Math.round(s.sun.az)}`, s.xKm, s.yKm, s.r.lon, s.sun.az, s.sun.alt, s.r.lat).then((u) => { if (live) setImg(u) }).catch(() => {})
    return () => { live = false }
  }, [s.r.index, s.xKm, s.yKm, s.r.lon, s.sun.az, s.sun.alt])
  return img
}

export default function SiteCard({ s, lang, onOpen }: { s: CardSite; lang: Lang; onOpen: () => void }) {
  const img = useSiteImage(s)
  const go = s.r.goCount > 0
  return (
    <button className="site-card" style={{ ['--team' as string]: s.colour }} onClick={onOpen}
            aria-label={`${s.rank}. ${s.name}`}>
      <span className="sc-text">
        <PlaceTitle text={s.name} placeName={s.placeName} light="sc-first" bold="sc-last" />
        <span className="sc-region">{s.region ?? (lang === 'tr' ? 'Açık arazi' : 'Open terrain')}</span>
        <span className="sc-rank">{String(s.rank).padStart(2, '0')}</span>
      </span>
      {img ? <img className="sc-img" src={img} alt="" /> : <span className="sc-img sc-img-wait" />}
      <span className="sc-foot">
        <span className={`sc-go ${go ? 'go' : 'nogo'}`}>{verdictLabel(go, lang)} {s.r.goCount}/{s.row.windowDays}</span>
        <span>{s.bestDate}</span>
        {s.prob && <span className="sc-prob" title={lang === 'tr' ? 'Görev başarı olasılığı' : 'Mission success probability'}>{fmtPercent(s.prob.p * 100, lang)}</span>}
      </span>
      {s.note && <span className="sc-note">{s.note}</span>}
    </button>
  )
}
