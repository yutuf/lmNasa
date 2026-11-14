// The landing-ellipse worst case on the real south-pole atlas.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Manifest } from './data'
import { parseAtlas, parseEphem } from './engine'
import { ellipseCheck } from './ellipse'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const m: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const atlas = parseAtlas(read('atlas.bin'))
const eph = parseEphem(read('ephem.bin'), m.n)
const dsn = Array.from(new Uint8Array(read('dsn.bin')), (x) => x === 1)
const fh = Math.round((Date.parse('2027-09-01T00:00:00Z') / 1000 - m.start_unix) / 3600)
const c = { ...m.constraints, duration_days: 14, min_sun_frac: 0.7, min_comm_frac: 0.5, max_dark_hours: 48, battery_wh: 2000 }

describe('ellipseCheck', () => {
  const i = Math.floor(atlas.n / 2)
  const e = ellipseCheck(atlas, eph, dsn, i, fh, 3, 14, true, c)!
  it('takes the site and its 2 km neighbours', () => {
    expect(e.points).toBeGreaterThanOrEqual(5)
    expect(e.points).toBeLessThanOrEqual(13)
    expect(e.go).toBeLessThanOrEqual(e.points)
  })
  it('reports worst values in range, and a bigger ellipse is never better', () => {
    expect(e.worstSun).toBeGreaterThanOrEqual(0); expect(e.worstSun).toBeLessThanOrEqual(100)
    expect(e.worstEarth).toBeLessThanOrEqual(100)
    const big = ellipseCheck(atlas, eph, dsn, i, fh, 3, 14, true, c, 4.1)!
    expect(big.points).toBeGreaterThan(e.points)
    expect(big.worstSun).toBeLessThanOrEqual(e.worstSun)
    expect(big.worstDarkH).toBeGreaterThanOrEqual(e.worstDarkH)
  })
})
