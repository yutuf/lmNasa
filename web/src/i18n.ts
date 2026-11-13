export type Lang = 'en' | 'tr'

const pct = (x: number, lang: Lang) => (lang === 'tr' ? `%${Math.round(x * 100)}` : `${Math.round(x * 100)}%`)

export function hours(h: number, lang: Lang): string {
  if (lang === 'tr') return h < 48 ? `${Math.round(h)} saat` : `${(h / 24).toFixed(1).replace('.', ',')} gün`
  return h < 48 ? `${Math.round(h)} hours` : `${(h / 24).toFixed(1)} days`
}

export const fmtPct = pct

export const T = {
  title: { en: 'Where and when should we land on the Moon?', tr: "Ay'a nereye ve ne zaman inmeli?" },
  question: { en: 'Can a solar lander survive here?', tr: 'Güneş enerjili bir iniş aracı burada yaşayabilir mi?' },
  intro: {
    en: "A lander needs sunlight for power and Earth in the sky to call home. Near the poles the Sun never climbs high: it circles the horizon, so a hill a few hundred metres away can hide it for days. Pick a spot on the Moon and a landing date.",
    tr: "Bir iniş aracı güç için Güneş'e, eve haber vermek için gökyüzünde Dünya'ya ihtiyaç duyar. Kutuplarda Güneş hiç yükselmez, ufkun etrafında döner; birkaç yüz metre ötedeki bir tepe onu günlerce gizleyebilir. Ay'da bir nokta ve iniş tarihi seçin.",
  },
  pole: { en: 'South pole', tr: 'Güney kutbu' },
  artemis: { en: 'Artemis III regions', tr: 'Artemis III bölgeleri' },
  missions: { en: 'Landed missions', tr: 'İniş yapılmış görevler' },
  date: { en: 'Landing date', tr: 'İniş tarihi' },
  sunlight: { en: 'Sunlight', tr: 'Güneş ışığı' },
  earth: { en: 'Earth in the sky', tr: 'Gökyüzünde Dünya' },
  battery: { en: 'Battery', tr: 'Batarya' },
  ofMission: { en: 'of the mission', tr: 'görev süresinin' },
  lasts: { en: 'Lasts', tr: 'Dayanıyor' },
  dayByDay: { en: 'Day by day', tr: 'Gün gün' },
  sunUp: { en: 'Sun up', tr: 'Güneş var' },
  earthUp: { en: 'Earth up', tr: 'Dünya görünüyor' },
  radio: { en: 'Radio link', tr: 'Radyo bağlantısı' },
  day: { en: 'day', tr: 'gün' },
  slips: { en: 'If the launch slips', tr: 'Fırlatma gecikirse' },
  otherSpots: { en: 'Same date, other spots', tr: 'Aynı tarih, diğer noktalar' },
  onTime: { en: 'On time', tr: 'Zamanında' },
  late1d: { en: '1 day late', tr: '1 gün gecikme' },
  late1w: { en: '1 week late', tr: '1 hafta gecikme' },
  late2w: { en: '2 weeks late', tr: '2 hafta gecikme' },
  late1m: { en: '1 month late', tr: '1 ay gecikme' },
  noData: { en: 'no data', tr: 'veri yok' },
  sees: { en: 'What the lander sees', tr: 'Aracın gördüğü' },
  play: { en: 'Play the mission', tr: 'Görevi oynat' },
  pause: { en: 'Pause', tr: 'Durdur' },
  ground3d: { en: 'The ground around the lander in 3D', tr: 'Aracın çevresindeki arazi, 3B' },
  hour: { en: 'Hour of the mission', tr: 'Görevin saati' },
  dragTurn: { en: 'Drag to turn · scroll to zoom', tr: 'Çevirmek için sürükleyin · yakınlaştırmak için kaydırın' },
  hidden: { en: 'HIDDEN behind the terrain', tr: 'arazinin ARKASINDA' },
  sunWord: { en: 'Sun', tr: 'Güneş' },
  earthWord: { en: 'Earth', tr: 'Dünya' },
  inView: { en: 'in view', tr: 'görünüyor' },
  dsnNote: {
    en: "A radio link needs Earth above the lander's horizon and one of NASA's Deep Space Network dishes (Goldstone, Madrid, Canberra) seeing the Moon at least 10° up.",
    tr: "Radyo bağlantısı için Dünya'nın aracın ufkunun üstünde olması ve NASA'nın Derin Uzay Ağı antenlerinden birinin (Goldstone, Madrid, Canberra) Ay'ı en az 10° yukarıda görmesi gerekir.",
  },
  planner: { en: 'Engineering planner', tr: 'Mühendislik planlayıcısı' },
  source: { en: 'Open source', tr: 'Açık kaynak' },
  terrainNote: {
    en: 'Real LOLA heights, exaggerated ×3. Shadows come from the terrain shown; ridges further away can also hide the Sun, which the verdict already includes.',
    tr: 'Gerçek LOLA yükseklikleri, ×3 abartılı. Gölgeler gösterilen araziden düşer; daha uzak sırtlar da Güneşi gizleyebilir, karar bunu zaten hesaba katar.',
  },
  horizonNote: {
    en: 'Grey: the real terrain around the lander in every direction. When the Sun drops into the grey it is behind a hill and the panels make no power.',
    tr: 'Gri: aracın çevresindeki gerçek arazi. Güneş griye girdiğinde bir tepenin arkasındadır ve paneller güç üretmez.',
  },
} satisfies Record<string, Record<Lang, string>>

export function why(w: { go: boolean; sunFrac: number; commFrac: number; longestDarkH: number; survived: boolean;
  power: { firstFailure: number | null } }, stepH: number, c: { min_sun_frac: number; min_comm_frac: number;
  max_dark_hours: number }, lang: Lang): string {
  if (w.go) {
    return lang === 'tr'
      ? `Güneşli süre ${pct(w.sunFrac, lang)}, Dünya ile konuşabildiği süre ${pct(w.commFrac, lang)}. Bataryası hiç azalmıyor.`
      : `The lander has sunlight ${pct(w.sunFrac, lang)} of the time and can talk to Earth ${pct(w.commFrac, lang)} of the time. Its battery never runs low.`
  }
  const parts: string[] = []
  if (!w.survived) {
    const h = (w.power.firstFailure ?? 0) * stepH
    parts.push(lang === 'tr'
      ? `Batarya ${hours(h, lang)} sonra bitiyor: art arda ${hours(w.longestDarkH, lang)} boyunca güneş yok.`
      : `The battery runs flat after ${hours(h, lang)}: there is no sunlight for up to ${hours(w.longestDarkH, lang)} in a row.`)
  } else if (w.longestDarkH > c.max_dark_hours) {
    parts.push(lang === 'tr' ? `Art arda ${hours(w.longestDarkH, lang)} boyunca güneş yok.`
      : `There is no sunlight for ${hours(w.longestDarkH, lang)} in a row.`)
  }
  if (w.sunFrac < c.min_sun_frac) {
    parts.push(lang === 'tr' ? `Güneşli süre yalnızca ${pct(w.sunFrac, lang)}.` : `Sunlight only ${pct(w.sunFrac, lang)} of the time.`)
  }
  if (w.commFrac < c.min_comm_frac) {
    parts.push(lang === 'tr'
      ? `Dünya'nın ufkun altında olduğu süre ${pct(1 - w.commFrac, lang)}: o sırada doğrudan radyo bağlantısı yok.`
      : `Earth is below the horizon ${pct(1 - w.commFrac, lang)} of the time, so no direct radio link then.`)
  }
  return parts.join(' ')
}
