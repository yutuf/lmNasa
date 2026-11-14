import { describe, expect, it } from 'vitest'
import { gcKm, type Atlas } from './engine'
import { surfacePoint } from './geometry'
import { inPoleGrid } from './scienceSites'
import {
  PIN_EXAMPLES, formatCoords, gridNote, latLonFromThree, nearestPoint, normLon, parseCoords, pickAtlas, resolvePin,
} from './pinSite'

function atlas(kind: Atlas['kind'], pts: ReadonlyArray<readonly [number, number]>): Atlas {
  const n = pts.length
  return {
    n, nAz: 1, spacingM: kind === 'pole' ? 2000 : 30000, rMaxM: kind === 'pole' ? 250000 : Number.NaN,
    xKm: new Float64Array(n), yKm: new Float64Array(n), height: new Int16Array(n), slope: new Float32Array(n),
    horizon: new Uint8Array(n), lat: Float64Array.from(pts, (p) => p[0]), lon: Float64Array.from(pts, (p) => p[1]), kind,
  }
}

function expectCoord(text: string, lat: number, lon: number) {
  const p = parseCoords(text)
  expect(p, text).not.toBeNull()
  expect(p!.lat).toBeCloseTo(lat, 6)
  expect(Math.abs(normLon(p!.lon - lon))).toBeLessThan(1e-6)
}

describe('parseCoords', () => {
  const ok: ReadonlyArray<readonly [string, number, number]> = [
    ['-89.5, 120', -89.5, 120],
    ['89.5S 120E', -89.5, 120],
    ["89°30'S 120°E", -89.5, 120],
    ['lat -85.4 lon 31.6', -85.4, 31.6],
    ['89.5G 120D', -89.5, 120],
    ['89.5K 120B', 89.5, -120],
    ['89,5G 120,5D', -89.5, 120.5],
    ['lon 31.6 lat -85.4', -85.4, 31.6],
    ['enlem -85.4 boylam 31.6', -85.4, 31.6],
    ['latitude: -85.4, longitude: 31.6', -85.4, 31.6],
    ['10, 200', 10, -160],
    ['0, 360', 0, 0],
    ['0N 180W', 0, -180],
    ['0N 180E', 0, 180],
    ['90S, 0', -90, 0],
    ['90N 0', 90, 0],
    ['89.5 s 120 e', -89.5, 120],
    ['S 89.5, E 120', -89.5, 120],
    ['10 N, 20 W', 10, -20],
    ['120E 89.5S', -89.5, 120],
    ['−89.5, 120', -89.5, 120],
    ["89°30′S 120°E", -89.5, 120],
    ['89° 30\' S, 120° E', -89.5, 120],
    ["0°0'30\"N 0E", 30 / 3600, 0],
    ["89°30'15\"S 120°15'30\"W", -(89 + 30 / 60 + 15 / 3600), -(120 + 15 / 60 + 30 / 3600)],
    ["89°30.5'S 10°E", -(89 + 30.5 / 60), 10],
    ['-89,5, 120', -89.5, 120],
    ['+10S 20E', -10, 20],
    ['-10S 20E', -10, 20],
  ]

  it.each(ok)('reads %s', (text, lat, lon) => expectCoord(text, lat, lon))

  const bad = [
    '', '   ', 'hello', '89.5S', '100, 20', '91S 10E', "89°60'S 10E", "89°0'60\"S 10E",
    'lat 10', 'lat 95 lon 10', 'lon 400 lat 10', '10 20 30', '10N 20N', '-10N 20E',
    'near 10, 20', 'lat 10E lon 20', 'enlem 85.4D boylam 10', '89.5S 120E please',
    '89°30.5\'60"S 0E',
  ]
  it.each(bad)('rejects %s', (text) => expect(parseCoords(text)).toBeNull())

  it('wraps longitude and keeps both antimeridians', () => {
    expect(normLon(190)).toBeCloseTo(-170, 8)
    expect(normLon(-190)).toBeCloseTo(170, 8)
    expect(normLon(360)).toBe(0)
    expect(normLon(-360)).toBe(0)
    expect(normLon(180)).toBe(180)
    expect(normLon(-180)).toBe(-180)
    expect(normLon(198.05)).toBeCloseTo(-161.95, 8)
  })
})

describe('formatCoords', () => {
  it('round-trips the examples', () => {
    for (const ex of PIN_EXAMPLES) {
      const back = parseCoords(formatCoords(ex.lat, ex.lon))
      expect(back!.lat).toBeCloseTo(ex.lat, 5)
      expect(back!.lon).toBeCloseTo(ex.lon, 5)
    }
  })
})

describe('published points', () => {
  it('uses the landed-mission coordinates and the Shackleton rim', () => {
    expect(PIN_EXAMPLES.map((e) => [e.id, e.lat, e.lon])).toEqual([
      ['shackleton-rim', -89.69, -161.95],
      ['apollo11', 0.67408, 23.47297],
      ['change4', -45.4446, 177.5991],
      ['chandrayaan3', -69.373, 32.319],
    ])
    for (const ex of PIN_EXAMPLES) expect(pickAtlas(ex.lat) === 'pole').toBe(inPoleGrid(ex))
  })
})

describe('pickAtlas and the distance note', () => {
  it('uses the south-pole grid only south of 84.5°S', () => {
    expect(pickAtlas(-89.5)).toBe('pole')
    expect(pickAtlas(-90)).toBe('pole')
    expect(pickAtlas(-84.5001)).toBe('pole')
    expect(pickAtlas(-84.5)).toBe('moon')
    expect(pickAtlas(0)).toBe('moon')
    expect(pickAtlas(86)).toBe('moon')
  })

  it('says how far the snap is, and stays quiet inside a polar cell', () => {
    expect(gridNote(1.4, 'en')).toBeNull()
    expect(gridNote(1.9, 'tr')).toBeNull()
    expect(gridNote(2, 'en')).toBe('nearest grid point is 2 km away')
    expect(gridNote(12, 'en')).toBe('nearest grid point is 12 km away')
    expect(gridNote(12.4, 'en')).toBe('nearest grid point is 12 km away')
    expect(gridNote(11.6, 'en')).toBe('nearest grid point is 12 km away')
    expect(gridNote(12, 'tr')).toBe('en yakın ızgara noktası 12 km uzakta')
    expect(gridNote(Infinity, 'en')).toBeNull()
  })
})

describe('nearestPoint', () => {
  it('returns the closer point and the great-circle distance', () => {
    const a = atlas('pole', [[-89, 0], [-88, 0], [-89, 90]])
    const hit = nearestPoint(a, -89.1, 0)
    expect(hit.index).toBe(0)
    expect(hit.distKm).toBeCloseTo(gcKm(-89.1, 0, -89, 0), 6)
    expect(hit.distKm).toBeLessThan(gcKm(-89.1, 0, -88, 0))
  })

  it('crosses the date line and keeps the earlier index on a tie', () => {
    const wrap = atlas('moon', [[0, 179], [0, 0]])
    const hit = nearestPoint(wrap, 0, -179.5)
    expect(hit.index).toBe(0)
    expect(hit.distKm).toBeCloseTo(gcKm(0, -179.5, 0, 179), 5)
    expect(nearestPoint(atlas('moon', [[0, 10], [0, -10]]), 0, 0).index).toBe(0)
  })

  it('is empty when the atlas has no points', () => {
    expect(nearestPoint(atlas('moon', []), 0, 0)).toEqual({ index: -1, distKm: Infinity })
  })

  it('snaps a polar point onto the pole grid and a landing onto the whole Moon', () => {
    const pole = atlas('pole', [[-89.69, -161.95], [-88, 0]])
    const moon = atlas('moon', [[0.67408, 23.47297], [-45.4446, 177.5991], [-69.373, 32.319]])
    const rim = resolvePin(pole, moon, -89.69, 198.05, 'en')
    expect(rim.grid).toBe('pole')
    expect(rim.index).toBe(0)
    expect(rim.lon).toBeCloseTo(-161.95, 6)
    expect(rim.distKm).toBeLessThan(1e-6)
    expect(rim.note).toBeNull()
    const apollo = resolvePin(pole, moon, 0.7, 24, 'tr')
    expect(apollo.grid).toBe('moon')
    expect(apollo.index).toBe(0)
    expect(apollo.note).toMatch(/^en yakın ızgara noktası \d+ km uzakta$/)
  })
})

describe('latLonFromThree', () => {
  it('inverts a globe hit, including a point that is not on the unit sphere', () => {
    expect(latLonFromThree(0, 0, 0)).toBeNull()
    expect(latLonFromThree(2, 0, 0)).toEqual({ lat: 0, lon: 0 })
    const samples: ReadonlyArray<readonly [number, number]> = [
      [-89.5, 120], [0.67408, 23.47297], [-45.4446, 177.5991], [-69.373, 32.319],
      [86, -89.9], [0, 180], [0, -180], [-90, 40], [90, -20],
    ]
    for (const [lat, lon] of samples) {
      const p = surfacePoint(lat, lon, 1.004)
      const back = latLonFromThree(p.x, p.y, p.z)
      expect(back).not.toBeNull()
      expect(back!.lat).toBeCloseTo(lat, 5)
      if (Math.abs(lat) < 89.9) expect(Math.abs(normLon(back!.lon - lon))).toBeLessThan(1e-4)
    }
  })
})
