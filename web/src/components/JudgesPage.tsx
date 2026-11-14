// The landing page for judges and visitors (open the site with #judges): what LunaNav does in one screen, a QR code
// of this very site so anyone in the room can open it on a phone, and one button into the app. The QR encodes the
// address the page is served from, so it is right on any deployment.
import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { ArrowRight, Clapperboard, Database, Globe2, Percent, Scale, Smartphone } from 'lucide-react'
import HeroMoon from './HeroMoon'
import VehiclePhoto from './VehiclePhoto'

type Lang = 'en' | 'tr'

function QR({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })
  }, [text])
  return <div className="jp-qr" role="img" aria-label={`QR code: ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

const T = {
  en: {
    kicker: 'NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator',
    title: <>Where and when to <em>land</em> on the Moon</>,
    sub: 'LunaNav checks every point around the lunar south pole and across the whole Moon, every landing day, hour by hour, on real NASA data, and tells you where a lander has sunlight, can talk to Earth, stands on safe ground and is near water ice.',
    open: 'Open the app', film: 'Watch the mission film', scan: 'Scan to try it on your phone',
    facts: [
      ['21,856 + 41,276', 'points checked, south pole and whole Moon'],
      ['~7.6 M', 'hour-by-hour checks per search, in seconds, in your browser'],
      ['2026 – 2045', 'every landing date, from NASA JPL ephemerides'],
      ['9', 'Artemis III candidate regions compared'],
    ],
    feats: [
      [Globe2, 'Ranked landing sites', 'GO / NO-GO for every date, with the real 3D terrain of each site.'],
      [Percent, 'Mission success odds', 'Hundreds of simulated missions: launch slips, terrain, battery, tipping over, the real landing record.'],
      [Scale, 'Decision model', 'Weight what matters; the ranking is stress-tested 500 times.'],
      [Database, 'Real data', 'NASA LRO LOLA terrain, JPL DE440, Deep Space Network, Diviner ice.'],
    ] as const,
    honest: 'A planning tool, not a landing certification.',
  },
  tr: {
    kicker: 'NASA Space Apps Challenge 2026 · Ay İniş Yeri Navigatörü',
    title: <>Ay’da <em>nereye</em> ve ne zaman inmeli?</>,
    sub: 'LunaNav, Ay’ın güney kutbundaki ve tüm Ay’daki her noktayı, her iniş gününü saat saat gerçek NASA verisiyle kontrol eder; iniş aracının güneş aldığı, Dünya ile konuşabildiği, güvenli zemine indiği ve su buzuna yakın olduğu yerleri gösterir.',
    open: 'Uygulamayı aç', film: 'Görev filmini izle', scan: 'Telefonda denemek için tara',
    facts: [
      ['21.856 + 41.276', 'nokta, güney kutbu ve tüm Ay'],
      ['~7,6 M', 'saatlik kontrol, saniyeler içinde, tarayıcıda'],
      ['2026 – 2045', 'her iniş tarihi, NASA JPL efemerisiyle'],
      ['9', 'Artemis III aday bölgesi karşılaştırıldı'],
    ],
    feats: [
      [Globe2, 'Sıralı iniş yerleri', 'Her tarih için GO / NO-GO ve her yerin gerçek 3D arazisi.'],
      [Percent, 'Görev başarı şansı', 'Yüzlerce simüle görev: fırlatma gecikmesi, arazi, batarya, devrilme, gerçek iniş geçmişi.'],
      [Scale, 'Karar modeli', 'Neyin önemli olduğunu seç; sıralama 500 kez sınanır.'],
      [Database, 'Gerçek veri', 'NASA LRO LOLA arazisi, JPL DE440, Derin Uzay Ağı, Diviner buz verisi.'],
    ] as const,
    honest: 'Bir planlama aracıdır, iniş sertifikası değildir.',
  },
}

export default function JudgesPage({ onOpen }: { onOpen: (hash: string) => void }) {
  const [lang, setLang] = useState<Lang>(() => (location.hash.includes('lang=tr') ? 'tr' : 'en'))
  const t = T[lang]
  const url = `${location.origin}${location.pathname}`
  return (
    <div className="jp">
      <section className="jp-hero">
        <HeroMoon />
        <div className="jp-top">
          <span className="jp-logo">LUNA<b>NAV</b></span>
          <div className="seg" role="group" aria-label="Language">
            {(['en', 'tr'] as Lang[]).map((l) => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        <div className="jp-main">
          <div className="jp-text">
            <span className="jp-kicker">{t.kicker}</span>
            <h1>{t.title}</h1>
            <p>{t.sub}</p>
            <div className="jp-cta">
              <button className="btn primary jp-open" onClick={() => onOpen(`#ui=simple&lang=${lang}`)}>{t.open} <ArrowRight size={18} /></button>
              <button className="jp-film" onClick={() => onOpen(`#ui=simple&lang=${lang}&film=1`)}><Clapperboard size={17} /> {t.film}</button>
            </div>
          </div>
          <div className="jp-qrbox">
            <QR text={url} />
            <span><Smartphone size={15} /> {t.scan}</span>
            <small>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</small>
          </div>
        </div>
      </section>
      <section className="jp-facts">
        {t.facts.map(([n, d]) => <div key={d}><b>{n}</b><span>{d}</span></div>)}
      </section>
      <section className="jp-feats">
        {t.feats.map(([I, h, d]) => <div key={h}><I size={22} /><b>{h}</b><span>{d}</span></div>)}
      </section>
      <section className="jp-fleet">
        {(['apollo', 'vikram', 'hls'] as const).map((id) => <VehiclePhoto key={id} kind="lander" id={id} alt="" className="jp-veh" />)}
        {(['pragyan', 'yutu'] as const).map((id) => <VehiclePhoto key={id} kind="rover" id={id} alt="" className="jp-veh jp-veh-s" />)}
      </section>
      <p className="jp-honest">{t.honest}</p>
    </div>
  )
}
