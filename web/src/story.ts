// Luna's mission story: the pitch for a landing site, told in short chapters, built only from computed numbers
// (the site row from the engine, the chosen lander, the scenario). Used by the guided "Tell me the mission" flow.
import type { CardSite } from './components/SiteCard'
import type { Lang } from './i18n'
import type { Scenario } from './scenarios'
import type { Lander } from './vehicles'

export interface Chapter { title: string; text: string; tone: 'place' | 'sun' | 'earth' | 'land' | 'launch' | 'verdict' }

const fmt = (d: Date, lang: Lang) => d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Launch from Kennedy about 4.5 days of coast plus half a day in lunar orbit before touchdown. */
export function launchDate(landing: Date) { return new Date(landing.getTime() - 5 * 86400e3) }

export function missionStory(c: CardSite, l: Lander, sc: Scenario | null, landing: Date, lang: Lang): Chapter[] {
  const r = c.row
  const tr = lang === 'tr'
  const go = r.goDates > 0
  const ice = r.iceKm
  const launch = launchDate(landing)
  const region = c.region ?? (tr ? 'bir Artemis bölgesinin dışında, açık arazide' : 'in open terrain, outside the Artemis regions')
  const ch: Chapter[] = []
  ch.push({ tone: 'place', title: tr ? 'Yer' : 'The place', text: tr
    ? `${c.name}: ${region}, güney kutbundan ${(90 + r.lat).toFixed(1)}° uzakta, ${r.heightM.toLocaleString('tr-TR')} m yükseklikte. ${ice !== null ? `En yakın buz tuzağı ${ice.toFixed(1)} km ötede — bir gezgin bir günde gidip dönebilir.` : 'Buz verisinin dışında.'}`
    : `${c.name}: ${region}, ${(90 + r.lat).toFixed(1)}° from the south pole, ${r.heightM.toLocaleString('en-US')} m high. ${ice !== null ? `The nearest ice cold trap is ${ice.toFixed(1)} km away — a rover’s day trip.` : 'It lies outside the ice data.'}` })
  ch.push({ tone: 'sun', title: tr ? 'Işık' : 'The light', text: tr
    ? `Burada Güneş ufku sıyırarak dolaşır. En iyi iniş tarihinde lander zamanın %${r.sunPct}'inde güneş görüyor; en uzun karanlık ${r.longestDarkH} saat. ${r.batteryNeedWh === 0 ? 'Köprülemesi gereken bir gece yok.' : `Bunu atlatmak için ${r.batteryNeedWh.toLocaleString('tr-TR')} Wh gerekiyor; ${l.name} ${l.batt.toLocaleString('tr-TR')} Wh taşıyor.`}`
    : `Here the Sun circles along the horizon. From the best landing date the lander sees it ${r.sunPct}% of the time; the longest dark spell is ${r.longestDarkH} hours. ${r.batteryNeedWh === 0 ? 'There is no night to bridge.' : `Getting through it takes ${r.batteryNeedWh.toLocaleString('en-US')} Wh; ${l.name} carries ${l.batt.toLocaleString('en-US')} Wh.`}` })
  ch.push({ tone: 'earth', title: tr ? 'Eve ses' : 'The voice home', text: tr
    ? `Dünya ufkun üzerinde ve NASA'nın Derin Uzay Ağı anteni boşta: zamanın %${r.earthPct}'inde doğrudan konuşabiliriz.`
    : `Earth above the horizon and a NASA Deep Space Network dish free: we can talk home directly ${r.earthPct}% of the time.` })
  ch.push({ tone: 'land', title: tr ? 'İniş' : 'The landing', text: tr
    ? `${l.name}, ${l.zone >= 1000 ? `${l.zone / 1000} km` : `${l.zone} m`} yarıçaplı bir alana iner. ${r.zoneSlopeDeg !== null ? `O alanın %95'i ${r.zoneSlopeDeg.toFixed(1)}°'den düz (sınır ${l.zslope}°).` : ''} Kutup yörüngesinden ${r.approachDeg === 0 ? 'kuzeye' : 'güneye'} doğru alçalırız; Güneş uçuş yönünden ${r.sunOffDeg}° ${r.sunOffDeg >= 90 ? 'arkada kalır, kameralar kamaşmaz' : 'açıda, kameralar Güneş’e karşı bakabilir'}.`
    : `${l.name} touches down inside a zone of ${l.zone >= 1000 ? `${l.zone / 1000} km` : `${l.zone} m`} radius. ${r.zoneSlopeDeg !== null ? `95% of it is gentler than ${r.zoneSlopeDeg.toFixed(1)}° (limit ${l.zslope}°).` : ''} We come down from a polar orbit heading ${r.approachDeg === 0 ? 'north' : 'south'}, with the Sun ${r.sunOffDeg}° off our track${r.sunOffDeg >= 90 ? ', behind us: the hazard cameras are not blinded' : ': the cameras may face glare'}.` })
  ch.push({ tone: 'launch', title: tr ? 'Fırlatma' : 'The launch', text: tr
    ? `${fmt(launch, lang)}: Kennedy Uzay Merkezi'nden fırlatma. Dünya yörüngesinde bir buçuk tur, Ay'a transfer ateşlemesi, yaklaşık 4,5 gün yol, kutup yörüngesine giriş ve ${fmt(landing, lang)} iniş.`
    : `${fmt(launch, lang)}: launch from Kennedy Space Center. One and a half turns around Earth, the burn toward the Moon, about 4.5 days of coasting, capture into a polar orbit, and touchdown on ${fmt(landing, lang)}.` })
  ch.push({ tone: 'verdict', title: tr ? 'Karar' : 'The verdict', text: go
    ? (tr ? `UYGUN. ${sc ? `${sc.name.tr} görevi için ` : ''}penceredeki ${r.windowDays} iniş tarihinin ${r.goDates} tanesinde güneş, Dünya bağlantısı, karanlık ve batarya hepsi yetiyor. Hadi gidelim.`
          : `GO. ${sc ? `For the ${sc.name.en} mission, ` : ''}sunlight, Earth contact, darkness and battery all hold on ${r.goDates} of ${r.windowDays} landing dates in the window. Let’s go.`)
    : (tr ? 'UYGUN DEĞİL bu pencerede: gereksinimlerin hepsini aynı anda karşılayan bir iniş tarihi yok. Başka bir ay ya da daha büyük batarya deneyin.'
          : 'NO-GO in this window: no landing date meets every requirement at once. Try another month or a bigger battery.') })
  return ch
}
