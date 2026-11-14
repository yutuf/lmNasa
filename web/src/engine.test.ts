// The TypeScript search engine must agree with the Python reference (lunanav/engine.py) on sample atlas points.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Manifest } from './data'
import { parseAtlas, parseEphem, parseHazard, passesTerrain, searchPoint, zoneSlopeAt } from './engine'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const atlas = parseAtlas(read('atlas.bin'))
const ephem = parseEphem(read('ephem.bin'), manifest.n)
const dsn = Array.from(new Uint8Array(read('dsn.bin')), (x) => x === 1)
const cases: {
  firstHour: number; nStarts: number; needDsn: boolean; index: number; lat: number; lon: number; goCount: number
  bestScore: number; bestStart: number; bestGo: boolean; sunFrac: number; commFrac: number; longestDarkH: number
}[] = JSON.parse(readFileSync(new URL('engine_expected.json', root), 'utf-8'))

describe('engine matches the Python reference', () => {
  for (const e of cases) {
    it(`point ${e.index} from hour ${e.firstHour}${e.needDsn ? ' with DSN' : ''}`, () => {
      const r = searchPoint(atlas, ephem, dsn, e.index, { firstHour: e.firstHour, nStarts: e.nStarts, strideH: 24,
        durationH: 336, maxSlope: 90, needDsn: e.needDsn }, manifest.constraints)
      expect(r.lat).toBeCloseTo(e.lat, 9)
      expect(r.lon).toBeCloseTo(e.lon, 9)
      expect(r.goCount).toBe(e.goCount)
      expect(r.bestStart).toBe(e.bestStart)
      expect(r.bestGo).toBe(e.bestGo)
      expect(r.bestScore).toBeCloseTo(e.bestScore, 1)
      expect(r.sunFrac).toBeCloseTo(e.sunFrac, 9)
      expect(r.commFrac).toBeCloseTo(e.commFrac, 9)
      expect(r.longestDarkH).toBe(e.longestDarkH)
    })
  }
})

describe('sunlight map', () => {
  it('matches the per-point sky at that hour', async () => {
    const { sunlitMap, pointSky } = await import('./engine')
    const m = sunlitMap(atlas, ephem, 100)
    expect(m.length).toBe(atlas.n)
    for (const i of [0, 500, 12345]) expect(m[i]).toBeCloseTo(pointSky(atlas, ephem, [], i, 100, 1, false).sunFraction[0], 6)
    const lit = m.filter((v) => v >= 0.5).length / m.length
    expect(lit).toBeGreaterThan(0.05)
    expect(lit).toBeLessThan(0.95)
  })
})

describe('touchdown hazard', () => {
  const hz = parseHazard(read('hazard.bin'))

  it('has one value per atlas point for each zone radius', () => {
    expect(hz.radii).toEqual([100, 250, 500, 1000])
    for (const p of hz.p95) expect(p.length).toBe(atlas.n)
  })

  it('a bigger zone is never gentler than a smaller one, on average', () => {
    const med = (a: Float32Array) => [...a].sort((x, y) => x - y)[a.length >> 1]
    for (let k = 1; k < hz.radii.length; k++) expect(med(hz.p95[k])).toBeGreaterThanOrEqual(med(hz.p95[k - 1]))
  })

  it('the zone check filters points, and no zone means no filtering', () => {
    const q = { firstHour: 0, nStarts: 1, strideH: 24, durationH: 24, maxSlope: 90, needDsn: false }
    const all = Array.from({ length: atlas.n }, (_, i) => i)
    expect(all.filter((i) => passesTerrain(atlas, hz, i, q)).length).toBe(atlas.n)
    const strict = all.filter((i) => passesTerrain(atlas, hz, i, { ...q, zone: 1000, zoneSlope: 8 })).length
    const loose = all.filter((i) => passesTerrain(atlas, hz, i, { ...q, zone: 100, zoneSlope: 15 })).length
    expect(strict).toBeGreaterThan(0)
    expect(strict).toBeLessThan(loose)
    expect(zoneSlopeAt(hz, 0, 0)).toBeNull()
    expect(zoneSlopeAt(null, 100, 0)).toBeNull()
  })
})
