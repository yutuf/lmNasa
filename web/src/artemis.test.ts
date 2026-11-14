// Artemis III head-to-head on the real atlas and regions, with a stand-in evaluator.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { artemisRows, goRun, nearestIndex, ringCentroid } from './artemis'
import type { Manifest } from './data'
import { insideRing, parseAtlas, type PointResult } from './engine'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const atlas = parseAtlas(read('atlas.bin'))
const fake = (index: number, goCount: number): PointResult =>
  ({ index, lat: 0, lon: 0, goCount, bestScore: goCount, bestStart: 0, bestGo: goCount > 0, sunFrac: 0, commFrac: 0, longestDarkH: 0 })

describe('ringCentroid', () => {
  it('is the centre of a square either way round', () => {
    expect(ringCentroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([1, 1])
    expect(ringCentroid([[0, 2], [2, 2], [2, 0], [0, 0]])).toEqual([1, 1])
  })
})

describe('artemisRows', () => {
  const regions = manifest.regions!
  // every point "passes" with goCount = its index mod 7, so the best in each region is well defined
  const results = Array.from({ length: atlas.n }, (_, i) => fake(i, i % 7))
  const rows = artemisRows(regions, atlas, results, (i) => fake(i, i % 7), () => null)

  it('has one row per NASA region; regions north of the grid are marked, the rest have their centre inside', () => {
    expect(rows).toHaveLength(9)
    expect(rows.filter((r) => !r.centre).map((r) => r.name).sort()).toEqual(['Nobile Rim 2', 'Peak Near Cabeus B'])
    expect(rows.slice(-2).every((r) => !r.centre)).toBe(true)
    for (const r of rows.filter((x) => x.centre)) {
      const g = regions.find((x) => x.name.replace(/_/g, ' ') === r.name)!
      const c = r.centre!.index
      expect(g.rings.some((ring) => insideRing(atlas.xKm[c], atlas.yKm[c], ring))).toBe(true)
      expect(r.inside).toBeGreaterThan(10)
    }
  })

  it('the best point is inside the region and at least as good as the centre', () => {
    for (const r of rows.filter((x) => x.centre)) {
      expect(r.best).not.toBeNull()
      expect(r.best!.goCount).toBeGreaterThanOrEqual(r.centre!.result.goCount)
      const g = regions.find((x) => x.name.replace(/_/g, ' ') === r.name)!
      expect(g.rings.some((ring) => insideRing(atlas.xKm[r.best!.index], atlas.yKm[r.best!.index], ring))).toBe(true)
      expect(r.bestKm!).toBeGreaterThanOrEqual(0)
    }
  })

  it('a region with nothing passing has no best point', () => {
    const none = artemisRows(regions, atlas, [], (i) => fake(i, 0), () => 'slope')
    expect(none.every((r) => r.best === null && r.searched === 0 && (!r.centre || r.centre.fails === 'slope'))).toBe(true)
  })

  it('nearestIndex finds an atlas point exactly', () => {
    expect(nearestIndex(atlas, atlas.xKm[1234], atlas.yKm[1234])).toBe(1234)
  })
})

describe('goRun', () => {
  it('finds the run of GO dates around a date', () => {
    const p = [false, true, true, true, false, true]
    expect(goRun(p, 2)).toEqual([1, 3])
    expect(goRun(p, 5)).toEqual([5, 5])
    expect(goRun(p, 0)).toBeNull()
  })
})
