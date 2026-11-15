// Where landers have already touched down (planetocentric lat, east lon; as published, see data/landed_missions.yaml).
// AdaptLab keeps its recommendations at least KEEP_OUT_KM away: NASA's guidance asks visiting craft to stay clear of
// heritage sites (Apollo), and plumes would sandblast hardware that is still there.
export const KEEP_OUT_KM = 2

export const LANDED: { name: string; lat: number; lon: number }[] = [
  { name: 'Luna 9', lat: 7.08, lon: -64.37 }, { name: 'Surveyor 1', lat: -2.474, lon: -43.339 },
  { name: 'Apollo 11', lat: 0.67408, lon: 23.47297 }, { name: 'Apollo 12', lat: -3.01239, lon: -23.42157 },
  { name: 'Apollo 14', lat: -3.6453, lon: -17.47136 }, { name: 'Apollo 15', lat: 26.13222, lon: 3.63386 },
  { name: 'Apollo 16', lat: -8.97301, lon: 15.50019 }, { name: 'Apollo 17', lat: 20.1908, lon: 30.77168 },
  { name: "Chang'e 3", lat: 44.1214, lon: -19.5116 }, { name: "Chang'e 4", lat: -45.4446, lon: 177.5991 },
  { name: "Chang'e 5", lat: 43.06, lon: -51.92 }, { name: 'Chandrayaan-3', lat: -69.373, lon: 32.319 },
  { name: 'SLIM', lat: -13.316, lon: 25.251 }, { name: 'IM-1 Odysseus', lat: -80.13, lon: 1.44 },
  { name: "Chang'e 6", lat: -41.63, lon: -153.99 }, { name: 'Blue Ghost 1', lat: 18.56, lon: 61.81 },
]

const R = 1737.4, RAD = Math.PI / 180
const gc = (a1: number, o1: number, a2: number, o2: number) =>
  R * Math.acos(Math.min(1, Math.max(-1, Math.sin(a1 * RAD) * Math.sin(a2 * RAD) + Math.cos(a1 * RAD) * Math.cos(a2 * RAD) * Math.cos((o1 - o2) * RAD))))

/** The landed craft within the keep-out distance of a point, if any. */
export function keepOut(lat: number, lon: number, km = KEEP_OUT_KM) {
  return LANDED.find((l) => gc(lat, lon, l.lat, l.lon) < km) ?? null
}
