// The TypeScript search engine must agree with the Python reference (lunanav/engine.py) on sample atlas points.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Manifest } from './data'
import { parseAtlas, parseEphem, searchPoint } from './engine'

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
