// Artemis III head-to-head table: each NASA candidate region's centre vs the best point LunaNav finds inside it.
import type { ArtemisRow } from '../artemis'
import type { PointResult } from '../engine'
import type { Lang } from '../i18n'

const T = {
  title: { en: 'Artemis III regions, head to head', tr: 'Artemis III bölgeleri, karşı karşıya' },
  sub: { en: 'For this mission: the centre of each of NASA’s nine candidate regions (from the official USGS outline) against the best point LunaNav finds inside the same region. Click a row to open the best point.',
    tr: 'Bu görev için: NASA’nın dokuz aday bölgesinin her birinin merkezi (resmi USGS sınırından) ve LunaNav’ın aynı bölge içinde bulduğu en iyi nokta. En iyi noktayı açmak için satıra tıklayın.' },
  region: { en: 'Region', tr: 'Bölge' },
  centre: { en: 'Region centre', tr: 'Bölge merkezi' },
  best: { en: 'Best point inside', tr: 'İçerideki en iyi nokta' },
  away: { en: 'from centre', tr: 'merkezden' },
  ice: { en: 'Nearest ice', tr: 'En yakın buz' },
  outside: { en: 'outside the search area (north of 84.5°S)', tr: 'arama alanının dışında (84,5°G’nin kuzeyi)' },
  fails: {
    slope: { en: 'too steep at the site (400 m)', tr: 'noktada çok dik (400 m)' },
    zone: { en: 'landing zone too steep', tr: 'iniş alanı çok dik' },
    ice: { en: 'no ice within reach', tr: 'yakında buz yok' },
  } as Record<string, Record<Lang, string>>,
  nothing: { en: 'no point passes', tr: 'uygun nokta yok' },
  dates: { en: 'dates', tr: 'tarih' },
}

export default function ArtemisCompare({ rows, windowDays, lang, name, iceKm, onPick }: {
  rows: ArtemisRow[]; windowDays: number; lang: Lang; name: (r: PointResult) => string
  iceKm: (index: number) => number | null; onPick: (r: PointResult) => void
}) {
  const go = (n: number) => (
    <span className="go-cell">
      <span className="meter"><i className={n > 0 ? 'go' : 'nogo'} style={{ width: `${Math.max(4, (n / windowDays) * 100)}%` }} /></span>
      <span className="num">{n}/{windowDays}</span>
    </span>
  )
  return (
    <section className="card" id="artemis">
      <div className="card-head"><div><h2>{T.title[lang]}</h2><p className="sub">{T.sub[lang]}</p></div></div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>{T.region[lang]}</th><th>{T.centre[lang]}</th><th>{T.best[lang]}</th><th className="num">{T.ice[lang]}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (!r.centre) return (
                <tr key={r.name} className="muted-row"><td><div className="site">{r.name}</div></td><td colSpan={3} className="sub">{T.outside[lang]}</td></tr>
              )
              const ice = r.best ? iceKm(r.best.index) : null
              return (
                <tr key={r.name} onClick={() => r.best && onPick(r.best)} style={{ cursor: r.best ? 'pointer' : 'default' }}>
                  <td><div className="site">{r.name}</div></td>
                  <td>{go(r.centre.result.goCount)}{r.centre.fails && <div className="sub warn-text">{T.fails[r.centre.fails]?.[lang] ?? r.centre.fails}</div>}</td>
                  <td>{r.best
                    ? <><div className="go-row">{go(r.best.goCount)}</div><div className="sub">{name(r.best)} · {r.bestKm!.toFixed(1)} km {T.away[lang]}</div></>
                    : <span className="sub">{T.nothing[lang]}</span>}</td>
                  <td className="num">{ice === null ? '–' : `${ice.toFixed(1)} km`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
