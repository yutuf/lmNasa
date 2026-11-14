// A landing site as an F1-style card: region "team colour", the name in two weights, the rank as a big outlined
// number, and a 3D render of the site's real terrain lit by the Sun of its best landing date.
import { useEffect, useState } from 'react'
import type { PointResult } from '../engine'
import type { Lang } from '../i18n'
import type { SiteRow } from '../report'
import { renderSite } from '../siteRender'
import { splitName } from '../teams'

export interface CardSite {
  r: PointResult
  row: SiteRow
  rank: number
  name: string
  region: string | null
  colour: string
  xKm: number
  yKm: number
  sun: { az: number; alt: number }
  bestDate: string
  note?: string          // far side, or the distance to the science target
}

export function useSiteImage(s: CardSite) {
  const [img, setImg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    // keyed by position, not index: the two grids number their points differently
    renderSite(`${s.xKm.toFixed(2)},${s.yKm.toFixed(2)}:${Math.round(s.sun.az)}`, s.xKm, s.yKm, s.r.lon, s.sun.az, s.sun.alt).then((u) => { if (live) setImg(u) }).catch(() => {})
    return () => { live = false }
  }, [s.r.index, s.xKm, s.yKm, s.r.lon, s.sun.az, s.sun.alt])
  return img
}

export default function SiteCard({ s, lang, onOpen }: { s: CardSite; lang: Lang; onOpen: () => void }) {
  const img = useSiteImage(s)
  const [light, bold] = splitName(s.name)
  const go = s.r.goCount > 0
  return (
    <button className="site-card" style={{ ['--team' as string]: s.colour }} onClick={onOpen}
            aria-label={`${s.rank}. ${s.name}`}>
      <span className="sc-text">
        {light && <span className="sc-first">{light}</span>}
        <span className="sc-last">{bold}</span>
        <span className="sc-region">{s.region ?? (lang === 'tr' ? 'Açık arazi' : 'Open terrain')}</span>
        <span className="sc-rank">{String(s.rank).padStart(2, '0')}</span>
      </span>
      {img ? <img className="sc-img" src={img} alt="" /> : <span className="sc-img sc-img-wait" />}
      <span className="sc-foot">
        <span className={`sc-go ${go ? 'go' : 'nogo'}`}>{go ? 'GO' : 'NO-GO'} {s.r.goCount}/{s.row.windowDays}</span>
        <span>{s.bestDate}</span>
      </span>
      {s.note && <span className="sc-note">{s.note}</span>}
    </button>
  )
}
