// The TypeScript models must give the same answers as the Python ones (lunanav/metrics.py, lunanav/power.py)
// on the exported data. public/data/expected.json is written by scripts/export_web_data.py.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSeries, type Manifest } from './data'
import { evaluateWindow, requiredBatteryWh } from './model'

const root = new URL('../public/data/', import.meta.url)
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const expected: {
  spot: string; start: number; go: boolean; sun_frac: number; comm_frac: number; longest_dark_h: number
  min_soc: number; first_failure: number | null; score: number; need_wh: number
}[] = JSON.parse(readFileSync(new URL('expected.json', root), 'utf-8'))

describe('models match Python on every exported spot', () => {
  const c = manifest.constraints
  const len = Math.round((c.duration_days * 24) / manifest.step_h)
  for (const e of expected) {
    it(`${e.spot} @ ${e.start} h`, () => {
      const spot = manifest.spots.find((s) => s.id === e.spot)!
      const buf = readFileSync(new URL(spot.series, root))
      // the per-site series keep their own length (13 bytes an hour); the search ephemeris is longer
      const s = parseSeries(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, buf.byteLength / 13)
      const sf = s.sunFraction.subarray(e.start, e.start + len)
      const w = evaluateWindow(sf, s.earthVisible.slice(e.start, e.start + len), manifest.step_h, c)
      expect(w.go).toBe(e.go)
      expect(w.sunFrac).toBeCloseTo(e.sun_frac, 9)
      expect(w.commFrac).toBeCloseTo(e.comm_frac, 9)
      expect(w.longestDarkH).toBe(e.longest_dark_h)
      expect(w.minSoc).toBeCloseTo(e.min_soc, 5)
      expect(w.power.firstFailure).toBe(e.first_failure)
      expect(w.score).toBeCloseTo(e.score, 1)
      expect(requiredBatteryWh(sf, manifest.step_h, c)).toBeCloseTo(e.need_wh, 2)
    })
  }
})
