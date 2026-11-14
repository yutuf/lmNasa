// The live strip under the header, F1 race-bar style: the next GO landing window and its site, with UTC and
// lunar local time; below it a ticker of live numbers from the same ephemeris the search uses.
import { useEffect, useState } from 'react'
import type { Ephem } from '../engine'
import type { Lang } from '../i18n'
import { localSky } from '../terrain'

export interface NextWindow { from: Date; to: Date; site: string; colour: string; lonDeg: number }

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (h: number) => `${pad(Math.floor(((h % 24) + 24) % 24))}:${pad(Math.floor((((h % 1) + 1) % 1) * 60))}`

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

/** Lunar local solar time (24 "lunar hours" per lunar day) at a longitude, from the subsolar longitude. */
function lunarLocal(eph: Ephem, hr: number, lonDeg: number) {
  const h = Math.max(0, Math.min(eph.n - 1, Math.floor(hr)))
  const sub = Math.atan2(eph.sun[1][h], eph.sun[0][h]) * 180 / Math.PI
  return 12 + (((lonDeg - sub) % 360 + 540) % 360 - 180) / 15
}

export function MissionBar({ next, eph, startUnix, lang, onOpen }: { next: NextWindow | null; eph: Ephem; startUnix: number; lang: Lang; onOpen: () => void }) {
  const now = useNow()
  const d = new Date(now)
  const hr = (now / 1000 - startUnix) / 3600
  const tr = lang === 'tr'
  const fmt = (x: Date) => x.toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase()
  const days = next ? Math.ceil((next.from.getTime() - now) / 86400e3) : null
  return (
    <div className="mission-bar">
      <button className="mb-next" onClick={onOpen} disabled={!next} style={{ ['--team' as string]: next?.colour ?? '#e10600' }}>
        <span className="mb-label">{tr ? 'SONRAKİ UYGUN PENCERE' : 'NEXT GO WINDOW'}</span>
        <span className="mb-dates">{next ? `${fmt(next.from)} – ${fmt(next.to)} ${next.to.getUTCFullYear()}` : '—'}</span>
        <span className="mb-site">{next?.site ?? (tr ? 'arama bekleniyor' : 'waiting for the search')}<i aria-hidden="true">›</i></span>
      </button>
      <div className="mb-clocks">
        {days !== null && days > 0 && <span><em>T−</em><b>{days.toLocaleString(tr ? 'tr-TR' : 'en-US')}</b><small>{tr ? 'GÜN' : 'DAYS'}</small></span>}
        <span><em>UTC</em><b>{pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}:{pad(d.getUTCSeconds())}</b></span>
        {next && hr >= 0 && hr < eph.n && <span><em>{tr ? 'AY YEREL' : 'LUNAR LOCAL'}</em><b>{hhmm(lunarLocal(eph, hr, next.lonDeg))}</b></span>}
      </div>
    </div>
  )
}

export function Ticker({ eph, dsn, startUnix, lang, items }: { eph: Ephem; dsn: boolean[]; startUnix: number; lang: Lang; items: string[] }) {
  const now = useNow(60000)
  const hr = (now / 1000 - startUnix) / 3600
  const tr = lang === 'tr'
  const live: string[] = []
  if (hr >= 0 && hr < eph.n - 1) {
    const pole = localSky(eph, 0, 1, hr)
    const h = Math.floor(hr)
    const sub = Math.asin(eph.sun[2][h]) * 180 / Math.PI
    const dist = Math.hypot(eph.earth[0][h], eph.earth[1][h], eph.earth[2][h])
    const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°`
    live.push(`${tr ? 'GÜNEY KUTBUNDA GÜNEŞ' : 'SUN AT THE SOUTH POLE'} ${sgn(pole.sun.alt)}`,
      `${tr ? 'KUTUPTA DÜNYA' : 'EARTH AT THE POLE'} ${sgn(pole.earth.alt)}`,
      `${tr ? 'GÜNEŞ ALTI ENLEMİ' : 'SUBSOLAR LATITUDE'} ${sgn(sub)}`,
      `${tr ? 'DÜNYA–AY' : 'EARTH–MOON'} ${Math.round(dist).toLocaleString(tr ? 'tr-TR' : 'en-US')} km`,
      `NASA DSN ${dsn[h] ? (tr ? 'AY’I GÖRÜYOR' : 'HAS THE MOON IN VIEW') : (tr ? 'AY’I GÖRMÜYOR' : 'CANNOT SEE THE MOON')}`)
  }
  const all = [...live, ...items]
  const row = all.map((t, k) => <span key={k}>{t}</span>)
  return (
    <div className="ticker" aria-label={tr ? 'Canlı veriler' : 'Live data'}>
      <span className="ticker-tag">LIVE</span>
      <div className="ticker-track"><div className="ticker-run">{row}{row}</div></div>
    </div>
  )
}
