import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { diskCover, listEclipses } from './eclipse'
import { parseEphem } from './engine'

const man = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'))
const buf = readFileSync('public/data/ephem.bin')
const eph = parseEphem(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), man.n)
const at = (h: number) => new Date((man.start_unix + h * 3600) * 1000).toISOString()

describe('eclipses seen from the Moon', () => {
  it('computes disk overlap', () => {
    expect(diskCover(5, 0.27, 0.95)).toBe(0)
    expect(diskCover(0, 0.27, 0.95)).toBe(1)
    expect(diskCover(0.95 + 0.27, 0.27, 0.95)).toBeCloseTo(0, 3)
    const half = diskCover(0.95, 0.27, 0.95)
    expect(half).toBeGreaterThan(0.3)
    expect(half).toBeLessThan(0.6)
  })

  it('finds the known lunar eclipses of 2027-2028 (NASA eclipse catalogue)', () => {
    const ev = listEclipses(eph)
    const days = ev.map((e) => at(e.peakH).slice(0, 10))
    // total lunar eclipse 31 Dec 2028 (greatest ~16:52 UTC): the Sun is completely hidden for over an hour
    const total = ev.find((e) => at(e.peakH).startsWith('2028-12-31'))!
    expect(total.peak).toBe(1)
    expect(total.totalH).toBeGreaterThan(1)
    expect(Math.abs(Date.parse(at(total.peakH)) - Date.parse('2028-12-31T16:52Z'))).toBeLessThan(45 * 60e3)
    // partial lunar eclipses 12 Jan 2028 and 6 Jul 2028
    expect(days).toContain('2028-01-12')
    expect(days).toContain('2028-07-06')
    for (const e of ev) expect(e.endH - e.startH).toBeLessThan(7)
  })
})
