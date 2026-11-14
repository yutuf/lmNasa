// Scientific targets on the Moon: places a mission would go *for*. Picking one makes it the mission's goal: the search
// keeps landing spots within reach of it (a rover's range) and ranks them by how often they are GO, then by distance.
// Coordinates are approximate feature centres (IAU Gazetteer of Planetary Nomenclature / mission publications).
import type { Lang } from './i18n'

type T = Record<Lang, string>
export type ScienceKind = 'ice' | 'volcanic' | 'impact' | 'magnetic' | 'pit' | 'history'

export interface ScienceSite { id: string; name: string; lat: number; lon: number; kind: ScienceKind; why: T }

/** Plain goals for the simple interface: what the mission is for, not where. */
export const GOALS: Record<ScienceKind, T> = {
  ice: { en: 'Find water ice', tr: 'Su buzu bul' },
  volcanic: { en: 'Study volcanoes', tr: 'Volkanları incele' },
  impact: { en: 'Look deep inside the Moon', tr: 'Ay’ın derinliklerine bak' },
  magnetic: { en: 'Solve a magnetic mystery', tr: 'Manyetik gizemi çöz' },
  pit: { en: 'Find caves for a base', tr: 'Üs için mağara bul' },
  history: { en: 'Visit history', tr: 'Tarihi ziyaret et' },
}

/** The target a search goes for: one site, or every site serving a goal ("kind:ice"). */
export function targetSites(target: string): ScienceSite[] {
  if (!target) return []
  if (target.startsWith('kind:')) return SCIENCE_SITES.filter((s) => s.kind === target.slice(5))
  return SCIENCE_SITES.filter((s) => s.id === target)
}

export const SCIENCE_KIND: Record<ScienceKind, { colour: string; label: T }> = {
  ice: { colour: '#22d3ee', label: { en: 'Water ice', tr: 'Su buzu' } },
  volcanic: { colour: '#ff7a45', label: { en: 'Volcanism', tr: 'Volkanizma' } },
  impact: { colour: '#c9a7ff', label: { en: 'Deep crust', tr: 'Derin kabuk' } },
  magnetic: { colour: '#7cf29a', label: { en: 'Magnetic', tr: 'Manyetik' } },
  pit: { colour: '#ffd23f', label: { en: 'Lava tubes', tr: 'Lav tüpleri' } },
  history: { colour: '#e2e2ea', label: { en: 'History', tr: 'Tarih' } },
}

export const SCIENCE_SITES: ScienceSite[] = [
  { id: 'shackleton', name: 'Shackleton crater', lat: -89.66, lon: 129.2, kind: 'ice',
    why: { en: 'A crater at the very pole whose floor has not seen sunlight in billions of years: a cold trap for water ice.', tr: 'Tam kutupta, tabanı milyarlarca yıldır güneş görmeyen bir krater: su buzu için soğuk tuzak.' } },
  { id: 'faustini', name: 'Faustini crater', lat: -87.3, lon: 77.0, kind: 'ice',
    why: { en: 'One of the coldest, darkest places in the Solar System; Diviner finds ice stable just below its surface.', tr: 'Güneş Sistemi’nin en soğuk ve karanlık yerlerinden; Diviner yüzeyin hemen altında kararlı buz buluyor.' } },
  { id: 'haworth', name: 'Haworth crater', lat: -87.45, lon: -4.0, kind: 'ice',
    why: { en: 'A large permanently shadowed crater next to Artemis III candidate ground.', tr: 'Artemis III aday alanlarının yanında büyük, kalıcı gölgeli bir krater.' } },
  { id: 'cabeus', name: 'Cabeus (LCROSS impact)', lat: -84.68, lon: -48.7, kind: 'ice',
    why: { en: 'In 2009 NASA’s LCROSS crashed here and the plume showed about 5% water by mass.', tr: '2009’da NASA’nın LCROSS’u buraya çarptı; oluşan bulutta kütlece yaklaşık %5 su çıktı.' } },
  { id: 'degerlache', name: 'de Gerlache crater', lat: -88.5, lon: -87.1, kind: 'ice',
    why: { en: 'A shadowed crater on the Earth-facing side of the pole, close to the best-lit ridges.', tr: 'Kutbun Dünya’ya bakan yüzünde, en iyi aydınlanan sırtlara yakın gölgeli bir krater.' } },
  { id: 'schrodinger', name: 'Schrödinger basin', lat: -75.0, lon: 132.4, kind: 'impact',
    why: { en: 'A young, well-preserved impact basin on the far side, with volcanic vents on its floor: a top science target.', tr: 'Uzak yüzde genç ve iyi korunmuş bir çarpma havzası; tabanında volkanik bacalar var: öncelikli bilim hedefi.' } },
  { id: 'spa', name: 'South Pole–Aitken basin', lat: -53.0, lon: -169.0, kind: 'impact',
    why: { en: 'The largest, oldest impact basin on the Moon: it may expose the lunar mantle. Chang’e 4 and 6 landed inside.', tr: 'Ay’daki en büyük ve en eski çarpma havzası; Ay mantosunu açığa çıkarmış olabilir. Chang’e 4 ve 6 içine indi.' } },
  { id: 'tycho', name: 'Tycho central peak', lat: -43.3, lon: -11.2, kind: 'impact',
    why: { en: 'A young crater with bright rays; its central peak brings up rock from kilometres deep.', tr: 'Parlak ışınlı genç bir krater; merkezi tepesi kilometrelerce derinden kaya taşıyor.' } },
  { id: 'aristarchus', name: 'Aristarchus plateau', lat: 24.0, lon: -48.0, kind: 'volcanic',
    why: { en: 'The brightest spot on the near side, with volcanic glass and a giant sinuous rille.', tr: 'Yakın yüzün en parlak yeri; volkanik cam ve dev bir kıvrımlı oluk.' } },
  { id: 'gruithuisen', name: 'Gruithuisen domes', lat: 36.3, lon: -40.5, kind: 'volcanic',
    why: { en: 'Rare silica-rich volcanic domes, a mystery on a Moon of basalt; a CLPS target.', tr: 'Bazalt bir Ay’da gizemli, nadir silisyumca zengin volkanik kubbeler; bir CLPS hedefi.' } },
  { id: 'ina', name: 'Ina', lat: 18.65, lon: 5.3, kind: 'volcanic',
    why: { en: 'A strange D-shaped depression that may be one of the youngest volcanic features on the Moon.', tr: 'Ay’daki en genç volkanik yapılardan biri olabilecek, D biçimli tuhaf bir çukur.' } },
  { id: 'compton', name: 'Compton–Belkovich', lat: 61.1, lon: 99.5, kind: 'volcanic',
    why: { en: 'A thorium hot spot on the far side, possibly a buried granite-like volcanic centre.', tr: 'Uzak yüzde bir toryum sıcak noktası; gömülü, granit benzeri bir volkanik merkez olabilir.' } },
  { id: 'reinergamma', name: 'Reiner Gamma', lat: 7.5, lon: -59.0, kind: 'magnetic',
    why: { en: 'A bright swirl where a local magnetic field shields the surface from the solar wind.', tr: 'Yerel bir manyetik alanın yüzeyi güneş rüzgârından koruduğu parlak bir girdap.' } },
  { id: 'marius', name: 'Marius Hills pit', lat: 14.09, lon: -56.81, kind: 'pit',
    why: { en: 'A skylight into what may be a lava tube: shelter from radiation and temperature swings for a future base.', tr: 'Lav tüpüne açılan bir tavan penceresi olabilir: gelecekteki bir üs için radyasyon ve sıcaklık değişimlerinden korunak.' } },
  { id: 'tranquillitatis', name: 'Mare Tranquillitatis pit', lat: 8.33, lon: 33.22, kind: 'pit',
    why: { en: 'A 100 m pit with an overhang; caves like this keep a steady temperature around 17 °C.', tr: 'Sarkan kenarlı 100 m’lik bir çukur; böyle mağaralar yaklaşık 17 °C’de sabit kalıyor.' } },
  { id: 'apollo11', name: 'Apollo 11', lat: 0.674, lon: 23.47, kind: 'history',
    why: { en: 'Tranquility Base, July 1969: the first human footprints, still there.', tr: 'Huzur Üssü, Temmuz 1969: ilk insan ayak izleri hâlâ orada.' } },
  { id: 'apollo17', name: 'Apollo 17', lat: 20.19, lon: 30.77, kind: 'history',
    why: { en: 'Taurus–Littrow valley, 1972: the last time humans walked on the Moon (so far).', tr: 'Taurus–Littrow vadisi, 1972: insanların Ay’da son yürüdüğü yer (şimdilik).' } },
  { id: 'change4', name: 'Chang’e 4', lat: -45.44, lon: 177.6, kind: 'history',
    why: { en: 'The first landing on the far side (2019), inside Von Kármán crater; Earth never rises here.', tr: 'Uzak yüze ilk iniş (2019), Von Kármán kraterinin içinde; burada Dünya hiç doğmaz.' } },
  { id: 'sverdrup', name: 'Sverdrup crater', lat: -88.5, lon: -152.0, kind: 'ice',
    why: { en: 'A permanently shadowed crater near the pole, one of the cold traps that could hold ice.', tr: 'Kutba yakın, buz tutabilecek soğuk tuzaklardan kalıcı gölgeli bir krater.' } },
  { id: 'nobile', name: 'Nobile crater', lat: -85.2, lon: 53.5, kind: 'ice',
    why: { en: 'VIPER’s planned destination: shadowed ground where the rover was to drill for ice.', tr: 'VIPER’ın planlanan hedefi: gezginin buz için delik açacağı gölgeli zemin.' } },
  { id: 'amundsen', name: 'Amundsen crater', lat: -84.5, lon: 82.8, kind: 'ice',
    why: { en: 'A big crater whose shadowed floor is a cold trap, with sunlit rims next to it.', tr: 'Gölgeli tabanı soğuk tuzak olan, yanında güneşli kenarları bulunan büyük bir krater.' } },
  { id: 'hermite', name: 'Hermite crater (north pole)', lat: 86.0, lon: -89.9, kind: 'ice',
    why: { en: 'Measured by LRO as one of the coldest places in the Solar System, about −250 °C: a northern ice trap.', tr: 'LRO’nun ölçtüğü Güneş Sistemi’nin en soğuk yerlerinden, yaklaşık −250 °C: kuzeyde bir buz tuzağı.' } },
  { id: 'rumker', name: 'Mons Rümker', lat: 40.8, lon: -58.1, kind: 'volcanic',
    why: { en: 'A volcanic plateau next to where Chang’e 5 brought back the youngest Moon rocks (about 2 billion years).', tr: 'Chang’e 5’in en genç Ay kayalarını (yaklaşık 2 milyar yıl) getirdiği yerin yanındaki volkanik plato.' } },
  { id: 'mariusdomes', name: 'Marius Hills domes', lat: 13.4, lon: -55.6, kind: 'volcanic',
    why: { en: 'A field of volcanic domes and cones, the densest on the Moon.', tr: 'Ay’daki en yoğun volkanik kubbe ve koni alanı.' } },
  { id: 'lassell', name: 'Lassell massif', lat: 14.7, lon: -10.3, kind: 'volcanic',
    why: { en: 'Silica-rich volcanic rock in a basalt sea: a sign of unusual, explosive volcanism.', tr: 'Bazalt bir denizde silisyumca zengin volkanik kaya: olağandışı, patlayıcı volkanizmanın işareti.' } },
  { id: 'orientale', name: 'Orientale basin', lat: -19.4, lon: -94.7, kind: 'impact',
    why: { en: 'The youngest giant basin, a perfect bull’s-eye of rings: a natural cross-section of the crust.', tr: 'En genç dev havza, kusursuz halkalarıyla bir hedef tahtası: kabuğun doğal bir kesiti.' } },
  { id: 'copernicus', name: 'Copernicus crater', lat: 9.6, lon: -20.1, kind: 'impact',
    why: { en: 'A 93 km young crater whose central peaks bring up deep crust and mantle-like rock.', tr: 'Merkezi tepeleri derin kabuk ve manto benzeri kaya taşıyan 93 km’lik genç bir krater.' } },
  { id: 'moscoviense', name: 'Mare Moscoviense', lat: 27.3, lon: 147.9, kind: 'impact',
    why: { en: 'One of the few dark lava seas on the far side, where the crust is thickest.', tr: 'Kabuğun en kalın olduğu uzak yüzdeki birkaç koyu lav denizinden biri.' } },
  { id: 'ingenii', name: 'Mare Ingenii swirls', lat: -33.7, lon: 163.5, kind: 'magnetic',
    why: { en: 'Bright swirls on the far side, opposite the giant Imbrium impact: a magnetic puzzle.', tr: 'Uzak yüzde, dev Imbrium çarpmasının tam karşısında parlak girdaplar: manyetik bir bilmece.' } },
  { id: 'descartes', name: 'Descartes anomaly', lat: -7.7, lon: 15.5, kind: 'magnetic',
    why: { en: 'One of the strongest magnetic anomalies on the near side, next to Apollo 16’s landing site.', tr: 'Apollo 16 iniş yerinin yanında, yakın yüzdeki en güçlü manyetik anomalilerden biri.' } },
  { id: 'ingeniipit', name: 'Mare Ingenii pit', lat: -35.9, lon: 166.0, kind: 'pit',
    why: { en: 'A 130 m wide skylight on the far side that may open into a lava cave.', tr: 'Uzak yüzde bir lav mağarasına açılıyor olabilecek 130 m genişliğinde bir tavan penceresi.' } },
  { id: 'mortis', name: 'Lacus Mortis pit', lat: 44.96, lon: 25.61, kind: 'pit',
    why: { en: 'A pit with a gentle ramp of rubble: a way down that a rover might actually drive.', tr: 'Moloz rampalı bir çukur: bir gezginin gerçekten inebileceği bir yol.' } },
  { id: 'apollo15', name: 'Apollo 15 (Hadley)', lat: 26.13, lon: 3.63, kind: 'history',
    why: { en: 'Hadley Rille, 1971: the first lunar rover drive, beside a canyon carved by lava.', tr: 'Hadley Oluğu, 1971: lavın oyduğu bir kanyonun yanında ilk Ay arabası sürüşü.' } },
  { id: 'lunokhod1', name: 'Lunokhod 1', lat: 38.24, lon: -35.0, kind: 'history',
    why: { en: 'The first robot rover on another world (1970); its reflector still bounces lasers from Earth.', tr: 'Başka bir dünyadaki ilk robot gezgin (1970); reflektörü hâlâ Dünya’dan gelen lazerleri yansıtıyor.' } },
  { id: 'chandrayaan3', name: 'Chandrayaan-3 (Shiv Shakti)', lat: -69.37, lon: 32.32, kind: 'history',
    why: { en: 'India’s 2023 landing, the closest to the south pole at the time.', tr: 'Hindistan’ın 2023 inişi; o zamana kadar güney kutbuna en yakın iniş.' } },
]

/** A site is inside the south-pole grid when it lies south of 84.5 S. */
export const inPoleGrid = (s: { lat: number }) => s.lat < -84.5

/** Earth never rises at points more than ~98 deg from the Earth-facing centre of the Moon (90 deg plus libration). */
export const farSide = (lat: number, lon: number) => Math.acos(Math.cos((lat * Math.PI) / 180) * Math.cos((lon * Math.PI) / 180)) * 180 / Math.PI > 98
