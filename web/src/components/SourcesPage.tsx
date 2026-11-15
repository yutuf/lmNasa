// Sources and limits: where every number comes from, how it is computed, and what LunaNav does not do. Judges ask
// these questions; the answers belong in the app, not only in the README.
import { BookOpen, X } from 'lucide-react'
import type { Lang } from '../i18n'

type Row = [string, string, string]   // what, source, note
type T = Record<Lang, string>

const DATA: Record<Lang, Row[]> = {
  en: [
    ['Terrain, horizons, slopes', 'NASA LRO LOLA laser altimeter', 'South pole: 5–40 m grids (horizon atlas on a 2 km grid, slopes at 40 m). Whole Moon: LDEM global grid, points about 30 km apart.'],
    ['Sun and Earth positions', 'JPL DE421 ephemeris (NASA NAIF SPICE)', 'Every hour from November 2026 to December 2045. The browser catalogue is de421.bsp.'],
    ['Talking to Earth', 'NASA Deep Space Network', 'Goldstone, Madrid, Canberra: whether a 34/70 m dish can see the Moon each hour.'],
    ['Water ice', 'LRO Diviner + permanently shadowed regions', 'Distance to the nearest cold trap where ice is stable (south pole only).'],
    ['Artemis III regions', 'NASA / USGS official outlines', 'The nine candidate landing regions.'],
    ['Place names', 'IAU Gazetteer of Planetary Nomenclature', '4,742 named features.'],
    ['Landing record', 'Public mission outcomes, 2019 – mid-2025', '13 robotic landing attempts: 8 reached the surface, 5 crashed.'],
    ['3D models', 'NASA 3D Resources; Sketchfab (CC BY / CC BY-SA)', 'Credited in public/models/CREDITS.md.'],
  ],
  tr: [
    ['Arazi, ufuklar, eğimler', 'NASA LRO LOLA lazer altimetresi', 'Güney kutbu: 5–40 m ızgaralar (2 km ufuk atlası, 40 m eğim). Tüm Ay: LDEM küresel ızgara, noktalar yaklaşık 30 km arayla.'],
    ['Güneş ve Dünya konumları', 'JPL DE421 efemerisi (NASA NAIF SPICE)', 'Kasım 2026’dan Aralık 2045’e her saat. Tarayıcı kataloğu de421.bsp.'],
    ['Dünya ile iletişim', 'NASA Derin Uzay Ağı (DSN)', 'Goldstone, Madrid, Canberra: 34/70 m antenin her saat Ay’ı görüp görmediği.'],
    ['Su buzu', 'LRO Diviner + kalıcı gölgeli bölgeler', 'Buzun kararlı olduğu en yakın soğuk tuzağa uzaklık (yalnızca güney kutbu).'],
    ['Artemis III bölgeleri', 'NASA / USGS resmi sınırları', 'Dokuz aday iniş bölgesi.'],
    ['Yer adları', 'IAU Gezegen Adlandırma Sözlüğü', '4.742 adlandırılmış yer.'],
    ['İniş geçmişi', 'Kamuya açık görev sonuçları, 2019 – 2025 ortası', '13 robotik iniş denemesi: 8’i yüzeye ulaştı, 5’i düştü.'],
    ['3D modeller', 'NASA 3D Resources; Sketchfab (CC BY / CC BY-SA)', 'public/models/CREDITS.md içinde atıfları var.'],
  ],
}

const METHOD: Record<Lang, string[]> = {
  en: [
    'For every point and every hour, the Sun and Earth are placed in the local sky and compared with the real terrain horizon in that direction. The Sun counts as a disk: partly hidden means partly lit.',
    'A landing date is GO when, over the whole mission, sunlight, Earth contact (with a DSN dish, or a relay satellite if chosen), the longest dark spell and the battery all meet the requirements, and the ground is flat enough.',
    'Success odds: hundreds of simulated missions per site with launch slips, horizon error, scatter across the landing zone, battery wear, the slope under the footpads, and optionally the real landing record (a Beta prior from 8 of 13).',
    'Landing ellipse: the same landing date is checked at every grid point within 2 km of the site; the worst values are reported.',
    'Relay satellite: an elliptical frozen orbit with its high point over the south (Kepler model); it counts as contact when more than 10° above the horizon.',
    'Decision lab: TOPSIS multi-criteria ranking; the weights are shaken 500 times to test how robust the winner is.',
  ],
  tr: [
    'Her nokta ve her saat için Güneş ve Dünya yerel gökyüzüne yerleştirilir ve o yöndeki gerçek arazi ufkuyla karşılaştırılır. Güneş bir disk sayılır: kısmen gizliyse kısmen aydınlıktır.',
    'Bir iniş tarihi, görev boyunca güneş ışığı, Dünya bağlantısı (DSN anteniyle veya seçildiyse röle uydusuyla), en uzun karanlık ve batarya gereksinimleri karşıladığında ve zemin yeterince düz olduğunda UYGUN’dur.',
    'Başarı şansı: her yer için yüzlerce simüle görev; fırlatma gecikmesi, ufuk hatası, iniş alanındaki dağılım, batarya yıpranması, ayakların altındaki eğim ve isteğe bağlı gerçek iniş geçmişi (13’te 8’den Beta önseli).',
    'İniş elipsi: aynı iniş tarihi, yerin 2 km çevresindeki her ızgara noktasında kontrol edilir; en kötü değerler gösterilir.',
    'Röle uydusu: yüksek noktası güneyde olan eliptik donmuş yörünge (Kepler modeli); ufkun 10° üstündeyken bağlantı sayılır.',
    'Karar laboratuvarı: TOPSIS çok ölçütlü sıralama; ağırlıklar 500 kez sarsılarak kazananın sağlamlığı sınanır.',
  ],
}

const LIMITS: Record<Lang, string[]> = {
  en: [
    'LunaNav is a planning tool, not a landing certification. Real missions add their own navigation, hazard detection and margins.',
    'Whole-Moon points are about 30 km apart: good for choosing regions, not individual landing spots. The 40 m slope check, ice data, the landing-ellipse check and walking/driving exist only around the south pole.',
    'Horizons come from LOLA terrain; a boulder or a small ridge closer than the grid spacing can still cast a shadow.',
    'The Sun is treated as a disk (partly hidden = partly lit). Earth contact uses the centre of Earth’s ~1° disk, as in the Python reference the browser engine is tested against hour by hour; using the disk edge would move contact start and end by at most a couple of hours.',
    'Flight scenes (launch, coast, descent) follow a nominal profile for illustration; they are not a trajectory design.',
    'Some vehicles have no public 3D model and are not shown; VIPER is drawn with NASA’s Perseverance model as a stand-in.',
    'Launch dates of planned missions slip; one-click CLPS missions use an illustrative landing window.',
  ],
  tr: [
    'LunaNav bir planlama aracıdır, iniş sertifikası değildir. Gerçek görevler kendi seyrüsefer, tehlike algılama ve paylarını ekler.',
    'Tüm Ay noktaları yaklaşık 30 km arayla: bölge seçmek için iyidir, tek tek iniş noktası için değil. 40 m eğim kontrolü, buz verisi, iniş elipsi kontrolü ve yürüme/sürüş yalnızca güney kutbu çevresinde vardır.',
    'Ufuklar LOLA arazisinden gelir; ızgara aralığından yakın bir kaya ya da küçük sırt yine de gölge düşürebilir.',
    'Güneş bir disk olarak ele alınır (kısmen gizli = kısmen aydınlık). Dünya bağlantısı, tarayıcı motorunun saat saat sınandığı Python referansındaki gibi Dünya’nın ~1° diskinin merkezini kullanır; disk kenarını kullanmak bağlantının başlangıç ve bitişini en fazla birkaç saat kaydırır.',
    'Uçuş sahneleri (fırlatma, yolculuk, iniş) gösterim amaçlı nominal bir profil izler; bir yörünge tasarımı değildir.',
    'Bazı araçların herkese açık 3D modeli yoktur ve gösterilmez; VIPER, NASA’nın Perseverance modeliyle temsil edilir.',
    'Planlanan görevlerin fırlatma tarihleri kayar; tek tıkla CLPS görevleri temsili bir iniş penceresi kullanır.',
  ],
}

const L: Record<string, T> = {
  title: { en: 'Sources & limits', tr: 'Kaynaklar ve sınırlar' },
  sub: { en: 'Where every number comes from, how it is computed, and what LunaNav does not do.', tr: 'Her sayının nereden geldiği, nasıl hesaplandığı ve LunaNav’ın neyi yapmadığı.' },
  data: { en: 'Data', tr: 'Veri' }, method: { en: 'Method', tr: 'Yöntem' }, limits: { en: 'Limits', tr: 'Sınırlar' },
}

export default function SourcesPage({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = (k: string) => L[k][lang]
  return (
    <div className="workshop sources" role="dialog" aria-label={t('title')}>
      <div className="ws-head">
        <div><h1><BookOpen size={24} /> {t('title')}</h1><p>{t('sub')}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label={lang === 'tr' ? 'Kapat' : 'Close'}><X size={20} /></button>
      </div>
      <div className="src-body">
        <section><h2>{t('data')}</h2>
          <table className="src-table"><tbody>
            {DATA[lang].map(([w, s, n]) => <tr key={w}><th>{w}</th><td><b>{s}</b><span>{n}</span></td></tr>)}
          </tbody></table>
        </section>
        <section><h2>{t('method')}</h2><ol className="src-list">{METHOD[lang].map((x) => <li key={x}>{x}</li>)}</ol></section>
        <section><h2>{t('limits')}</h2><ul className="src-list limits">{LIMITS[lang].map((x) => <li key={x}>{x}</li>)}</ul></section>
      </div>
    </div>
  )
}
