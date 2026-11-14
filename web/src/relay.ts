// A relay satellite for talking home where Earth is low, blocked by terrain, or never rises (the far side). Modelled
// as an elliptical frozen lunar orbit (ELFO) with its high point over the south (like ESA's Moonlight and China's
// Queqiao-2 class), two-body Kepler motion, the Moon turning beneath it. A site is "in contact" while the relay stands
// more than 10 degrees above its horizon. Terrain is not checked for the relay (it is usually high in the sky).
export const RELAY_ORBIT = { periKm: 200, apoKm: 16000, incDeg: 55 }
const MU = 4902.8, RM = 1737.4, SIDEREAL_S = 27.3217 * 86400

let memo: { key: string; x: Float64Array; y: Float64Array; z: Float64Array } | null = null

/** The relay's position (km, Moon-centred inertial) at each hour `firstHour .. firstHour + hours - 1`. */
function path(firstHour: number, hours: number) {
  const key = `${firstHour}:${hours}`
  if (memo?.key === key) return memo
  const { periKm, apoKm, incDeg } = RELAY_ORBIT
  const rp = RM + periKm, ra = RM + apoKm
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp)
  const T = 2 * Math.PI * Math.sqrt(a ** 3 / MU)
  const inc = (incDeg * Math.PI) / 180, w = Math.PI / 2           // periapsis north, so apolune (slow, high) is over the south
  const x = new Float64Array(hours), y = new Float64Array(hours), z = new Float64Array(hours)
  for (let k = 0; k < hours; k++) {
    const t = (firstHour + k) * 3600
    const M = ((2 * Math.PI * t) / T) % (2 * Math.PI)
    let E = M
    for (let it = 0; it < 8; it++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
    const r = a * (1 - e * Math.cos(E)), u = nu + w
    x[k] = r * Math.cos(u); y[k] = r * Math.sin(u) * Math.cos(inc); z[k] = r * Math.sin(u) * Math.sin(inc)
  }
  memo = { key, x, y, z }
  return memo
}

/** For each hour, is the relay more than `maskDeg` above the horizon of the site at (lat, lon)? */
export function relayMask(lat: number, lon: number, firstHour: number, hours: number, maskDeg = 10): Uint8Array {
  const p = path(firstHour, hours)
  const la = (lat * Math.PI) / 180, sinMask = Math.sin((maskDeg * Math.PI) / 180)
  const out = new Uint8Array(hours)
  for (let k = 0; k < hours; k++) {
    const lo = (lon * Math.PI) / 180 + (2 * Math.PI * (firstHour + k) * 3600) / SIDEREAL_S
    const s0 = Math.cos(la) * Math.cos(lo), s1 = Math.cos(la) * Math.sin(lo), s2 = Math.sin(la)
    const d0 = p.x[k] - RM * s0, d1 = p.y[k] - RM * s1, d2 = p.z[k] - RM * s2
    out[k] = (d0 * s0 + d1 * s1 + d2 * s2) / Math.hypot(d0, d1, d2) > sinMask ? 1 : 0
  }
  return out
}
