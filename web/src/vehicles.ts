// Landers and rovers you can choose. Figures are approximate public values, rounded, for comparison in a planning
// tool; where a value is a planning assumption rather than a published spec it says so ('assumed'). Choosing a lander
// changes the search (battery, landing precision, touchdown slope, longest stay); choosing a rover changes how it
// drives in the rover view (speed, slope limit, power).
import type { Lang } from './i18n'

type T = Record<Lang, string>

export interface Lander {
  id: string
  name: string
  maker: string
  crew: number
  heightM: number
  massT: number                  // landed / dry mass, rounded
  power: T
  status: T
  pitch: T                       // one line for the briefing
  // what it changes in the search
  batt: number                   // Wh to bridge the dark (model input)
  zone: number                   // landing precision as a zone radius (m)
  zslope: number                 // steepest ground it is designed to touch down on (deg, 95 % of the zone)
  maxDays: number                // longest surface stay it is built for
  solar: boolean
}

export interface Rover {
  id: string
  name: string
  maker: string
  massKg: number
  pitch: T
  // rover-view model (illustrative where marked)
  maxSpeed: number               // m/s
  maxSlope: number               // deg
  batteryWh: number
  panelW: number                 // 0 = no solar panel (battery only)
  driveW: number
  idleW: number
}

export const LANDERS: Lander[] = [
  { id: 'nova', name: 'Nova-C', maker: 'Intuitive Machines', crew: 0, heightM: 4.3, massT: 0.7, solar: true,
    power: { en: 'Solar panels + battery', tr: 'Güneş paneli + batarya' }, status: { en: 'Flew 2024 (IM-1) and 2025 (IM-2)', tr: '2024 (IM-1) ve 2025’te (IM-2) uçtu' },
    pitch: { en: 'A commercial CLPS lander the size of a phone booth: it carries NASA instruments for about a week of sunlight.', tr: 'Telefon kulübesi boyutunda ticari bir CLPS iniş aracı: NASA aletlerini yaklaşık bir haftalık gün ışığı boyunca taşır.' },
    batt: 2000, zone: 1000, zslope: 10, maxDays: 10 },
  { id: 'ghost', name: 'Blue Ghost', maker: 'Firefly Aerospace', crew: 0, heightM: 2.0, massT: 0.5, solar: true,
    power: { en: 'Solar panels + battery', tr: 'Güneş paneli + batarya' }, status: { en: 'Landed 2025 (Mission 1)', tr: '2025’te indi (Görev 1)' },
    pitch: { en: 'Low and wide, so it is hard to tip over: it worked a full lunar day and a few hours into the night.', tr: 'Alçak ve geniş, devrilmesi zor: tam bir Ay günü ve gecenin ilk saatlerinde çalıştı.' },
    batt: 2500, zone: 250, zslope: 12, maxDays: 14 },
  { id: 'vikram', name: 'Vikram', maker: 'ISRO (Chandrayaan-3)', crew: 0, heightM: 2.0, massT: 1.75, solar: true,
    power: { en: 'Solar panels + battery', tr: 'Güneş paneli + batarya' }, status: { en: 'Landed 2023 near 69°S', tr: '2023’te 69°G yakınına indi' },
    pitch: { en: 'India’s lander: the first to touch down near the south pole, with a large landing area to choose from.', tr: 'Hindistan’ın iniş aracı: güney kutbu yakınına ilk inen, geniş bir iniş alanı içinde.' },
    batt: 1500, zone: 1000, zslope: 12, maxDays: 14 },
  { id: 'bluemoon', name: 'Blue Moon MK1', maker: 'Blue Origin', crew: 0, heightM: 8.1, massT: 21, solar: true,
    power: { en: 'Solar panels + battery', tr: 'Güneş paneli + batarya' }, status: { en: 'Cargo lander in development', tr: 'Geliştirilen kargo iniş aracı' },
    pitch: { en: 'A big cargo lander that can put up to 3 tonnes on the surface; precision landing within about 100 m (assumed).', tr: 'Yüzeye 3 tona kadar yük indirebilen büyük kargo aracı; yaklaşık 100 m hassas iniş (varsayım).' },
    batt: 8000, zone: 100, zslope: 10, maxDays: 14 },
  { id: 'hls', name: 'Starship HLS', maker: 'SpaceX', crew: 2, heightM: 50, massT: 100, solar: true,
    power: { en: 'Solar arrays + battery', tr: 'Güneş dizileri + batarya' }, status: { en: 'Human landing system for Artemis III', tr: 'Artemis III için insanlı iniş sistemi' },
    pitch: { en: 'A 50 m tall crew lander: astronauts live in it for about a week, so it needs near-constant sunlight and Earth contact.', tr: '50 m boyunda insanlı iniş aracı: astronotlar yaklaşık bir hafta içinde yaşar; neredeyse sürekli güneş ve Dünya bağlantısı gerekir.' },
    batt: 20000, zone: 100, zslope: 8, maxDays: 7 },
  { id: 'apollo', name: 'Apollo LM', maker: 'Grumman (NASA)', crew: 2, heightM: 7.0, massT: 15, solar: false,
    power: { en: 'Batteries only (no solar)', tr: 'Yalnızca batarya (güneş paneli yok)' }, status: { en: 'Six landings, 1969–1972', tr: 'Altı iniş, 1969–1972' },
    pitch: { en: 'The classic: two astronauts, up to three days on the surface, on batteries alone (modelled here as a large battery).', tr: 'Klasik: iki astronot, yüzeyde üç güne kadar, yalnızca bataryayla (burada büyük bir batarya olarak modellendi).' },
    batt: 20000, zone: 500, zslope: 12, maxDays: 3 },
]

export const ROVERS: Rover[] = [
  { id: 'viper', name: 'VIPER', maker: 'NASA', massKg: 430,
    pitch: { en: 'A golf-cart-sized ice prospector with a 1 m drill, built to dip into permanent shadow (shown with a NASA rover model as a stand-in).', tr: 'Golf arabası boyutunda, 1 m matkaplı buz arayıcısı; kalıcı gölgeye girmek için tasarlandı (temsili NASA gezgin modeliyle).' },
    maxSpeed: 0.2, maxSlope: 15, batteryWh: 3000, panelW: 450, driveW: 220, idleW: 120 },
  { id: 'lrv', name: 'Lunar Roving Vehicle', maker: 'Boeing (Apollo 15–17)', massKg: 210,
    pitch: { en: 'The Apollo moon buggy: fast (about 13 km/h), but on batteries only, so it must be home before they run down.', tr: 'Apollo Ay arabası: hızlı (yaklaşık 13 km/sa) ama yalnızca bataryalı; bitmeden eve dönmeli.' },
    maxSpeed: 3.6, maxSlope: 25, batteryWh: 8700, panelW: 0, driveW: 1000, idleW: 60 },
  { id: 'yutu', name: 'Yutu-2', maker: 'CNSA (Chang’e 4)', massKg: 140,
    pitch: { en: 'China’s far-side rover, the longest-lived on the Moon: slow, careful, and it sleeps through every lunar night.', tr: 'Çin’in uzak yüz gezgini, Ay’daki en uzun ömürlü: yavaş, dikkatli ve her Ay gecesinde uyur.' },
    maxSpeed: 0.055, maxSlope: 20, batteryWh: 400, panelW: 120, driveW: 60, idleW: 25 },
  { id: 'pragyan', name: 'Pragyan', maker: 'ISRO (Chandrayaan-3)', massKg: 26,
    pitch: { en: 'A 26 kg six-wheeler that rolled off Vikram at 1 cm/s and drove about 100 m near the south pole.', tr: 'Vikram’dan saniyede 1 cm hızla inip güney kutbu yakınında yaklaşık 100 m giden 26 kg’lık altı tekerlekli gezgin.' },
    maxSpeed: 0.01, maxSlope: 12, batteryWh: 150, panelW: 50, driveW: 15, idleW: 8 },
]

export const landerById = (id: string | undefined) => LANDERS.find((l) => l.id === id) ?? LANDERS[0]
export const roverById = (id: string | undefined) => ROVERS.find((r) => r.id === id) ?? ROVERS[0]
