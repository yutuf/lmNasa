// "Our model vs real landings": five recent landings replayed through LunaNav's engine, next to what really happened.
import { useEffect, useState } from 'react'
import { History, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { dataUrl } from '../data'
import { parseGlobalAtlas, type Atlas } from '../engine'
import { replay, type Landing, type Replay } from '../history'

function Strip({ r }: { r: Replay }) {
  const k0 = Math.round((r.l.landingUnix - r.l.firstUnix) / 3600)
  const hours = r.l.hours - k0, W = 720, x = (k: number) => (k / hours) * W
  const days = Array.from({ length: Math.floor(hours / 24) + 1 }, (_, d) => d)
  return (
    <svg viewBox={`0 0 ${W} 46`} className="hp-strip" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: hours }, (_, k) => (
        <rect key={`s${k}`} x={x(k)} y={0} width={W / hours + 0.5} height={18} fill={`rgba(255, 200, 61, ${0.08 + 0.92 * r.sun[k0 + k]})`} />
      ))}
      {Array.from({ length: hours }, (_, k) => (r.earth[k0 + k] ? <rect key={`e${k}`} x={x(k)} y={22} width={W / hours + 0.5} height={10} fill="#4ea4ff" /> : null))}
      {days.map((d) => <line key={d} x1={x(d * 24)} x2={x(d * 24)} y1={34} y2={d % 7 === 0 ? 46 : 40} stroke="rgba(255,255,255,.35)" />)}
      {r.opsDays !== null && <line x1={x(r.opsDays * 24)} x2={x(r.opsDays * 24)} y1={0} y2={34} stroke="#ff5050" strokeWidth={3} />}
      <line x1={x(r.realDays * 24)} x2={x(r.realDays * 24)} y1={0} y2={34} stroke="#fff" strokeWidth={3} />
    </svg>
  )
}

export default function HistoryPanel({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const tr = lang === 'tr'
  const [rows, setRows] = useState<Replay[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all([
      fetch(dataUrl('history.json')).then((r) => r.json() as Promise<{ landings: Landing[] }>),
      fetch(dataUrl('global_atlas.bin')).then((r) => r.arrayBuffer()).then((b): Atlas => parseGlobalAtlas(b)),
    ]).then(([h, atlas]) => { if (live) setRows(h.landings.map((l) => replay(atlas, l))) }).catch(() => { if (live) setErr(true) })
    return () => { live = false }
  }, [])
  const fmt = new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return (
    <div className="workshop histp" role="dialog" aria-label={tr ? 'Gerçek inişler' : 'Real landings'}>
      <div className="ws-head">
        <div><h1><History size={24} /> {tr ? 'Modelimiz ve gerçek inişler' : 'Our model vs real landings'}</h1>
          <p>{tr ? 'Beş gerçek iniş, aramanın kullandığı aynı motorla yeniden oynatıldı: Güneş ne kadar süre kaldı, Dünya ne kadar göründü. Kırmızı çizgi: modelin öngördüğü görev sonu (panel + batarya); beyaz çizgi: görevin gerçekte bittiği an.' : 'Five real landings replayed through the same engine the search uses: how long the Sun stayed up, how much Earth was in view. Red line: where our model says operations end (panels + battery); white line: when each mission really ended.'}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="hp-body">
        {err && <p className="hp-note">{tr ? 'Veri yüklenemedi.' : 'Could not load the data.'}</p>}
        {!rows && !err && <p className="hp-note">{tr ? 'Hesaplanıyor…' : 'Computing…'}</p>}
        {rows?.map((r) => (
          <div key={r.l.name} className="hp-row">
            <div className="hp-h">
              <b>{r.l.name}</b>
              <span>{fmt.format(new Date(r.l.landingUnix * 1000))} · {Math.abs(r.l.lat).toFixed(2)}°{r.l.lat < 0 ? 'S' : 'N'} {Math.abs(r.l.lon).toFixed(2)}°{r.l.lon < 0 ? 'W' : 'E'}</span>
            </div>
            <Strip r={r} />
            <div className="hp-cols">
              <div><span>{tr ? 'Modelimiz' : 'Our model'}</span>
                <p>{tr
                  ? `İnişte Güneş %${Math.round(r.sunAtLanding * 100)} görünür; ${r.litDays.toFixed(1).replace('.', ',')} gün sonra batar. Batarya geceye taşır: görev ${r.opsDays === null ? '18 günden sonra' : `${r.opsDays.toFixed(1).replace('.', ',')}. günde`} biter (gerçekte ${r.realDays.toFixed(1).replace('.', ',')}). Çalıştığı günlerde Dünya %${r.earthPct} görünür.`
                  : `At touchdown ${Math.round(r.sunAtLanding * 100)}% of the Sun is up; it sets after ${r.litDays.toFixed(1)} days. The battery carries it into the night: operations end after ${r.opsDays === null ? 'more than 18' : r.opsDays.toFixed(1)} days (really ${r.realDays.toFixed(1)}). Earth in view ${r.earthPct}% of the days it worked.`}</p></div>
              <div><span>{tr ? 'Gerçekte' : 'What happened'}</span><p>{r.l.outcome[lang]}</p></div>
            </div>
          </div>
        ))}
        <p className="hp-note">{tr
          ? 'Yöntem: inişten 1 gün önce ile 18 gün sonrası arası saatlik Güneş ve Dünya (JPL DE421), en yakın tüm-Ay ızgara noktasının LOLA ufkuyla (yaklaşık 30 km). Sarı: güneşli; mavi: Dünya ufkun üstünde. Aracın yönü (SLIM, IM-1) ve röle (Chang’e 6) modelin dışındadır; yazıda açıklanır.'
          : 'Method: hourly Sun and Earth (JPL DE421) from 1 day before to 18 days after touchdown, against the LOLA horizon of the nearest whole-Moon grid point (about 30 km). Yellow: sunlit; blue: Earth above the horizon. The lander’s attitude (SLIM, IM-1) and relays (Chang’e 6) are outside the model; the text explains them.'}</p>
      </div>
    </div>
  )
}
