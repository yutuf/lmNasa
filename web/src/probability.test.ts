// Success probability: behaves sensibly on the real atlas and ephemeris.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Manifest } from './data'
import { parseAtlas, parseEphem, searchPoint } from './engine'
import { LANDING_RECORD, drawSlip, successProbability } from './probability'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const m: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const atlas = parseAtlas(read('atlas.bin'))
const eph = parseEphem(read('ephem.bin'), m.n)
const dsn = Array.from(new Uint8Array(read('dsn.bin')), (x) => x === 1)
const fh = Math.round((Date.parse('2027-09-01T00:00:00Z') / 1000 - m.start_unix) / 3600)
const c = { ...m.constraints, duration_days: 14, min_sun_frac: 0.7, min_comm_frac: 0.5, max_dark_hours: 48, battery_wh: 2000 }
const q = { firstHour: fh, nStarts: 30, strideH: 24, durationH: 336, maxSlope: 90, needDsn: true }

// the best GO point among a sample of the atlas
const best = Array.from({ length: 400 }, (_, k) => searchPoint(atlas, eph, dsn, (k * 53) % atlas.n, q, c)).sort((a, b) => b.goCount - a.goCount)[0]
const base = { atlas, eph, dsn, r: best, firstHour: fh, days: 14, windowDays: 30, needDsn: true, c, zoneM: 1000, zoneSlopeP95: 6, slopeLimit: 12, history: false, trials: 300 }

describe('successProbability', () => {
  it('is a probability with an interval around it, and repeatable', () => {
    const a = successProbability(base), b = successProbability(base)
    expect(a.p).toBeGreaterThanOrEqual(0); expect(a.p).toBeLessThanOrEqual(1)
    expect(a.lo).toBeLessThanOrEqual(a.p + 0.02); expect(a.hi).toBeGreaterThanOrEqual(a.p - 0.02)
    expect(b.p).toBe(a.p)
  })
  it('steeper ground than the legs can take makes tipping over the main risk', () => {
    const r = successProbability({ ...base, zoneSlopeP95: 20, slopeLimit: 8 })
    expect(r.main).toBe('tip')
    expect(r.p).toBeLessThan(successProbability(base).p)
  })
  it('the landing record lowers the odds by about its failure rate', () => {
    const without = successProbability(base).p, withHist = successProbability({ ...base, history: true }).p
    expect(withHist).toBeLessThan(without)
    expect(withHist).toBeLessThan(without * 0.85)
    expect(LANDING_RECORD.reached + LANDING_RECORD.crashed).toBe(LANDING_RECORD.attempts)
  })
})

describe('drawSlip', () => {
  it('about half of launches go on time; slips are capped', () => {
    let s = 1
    const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const xs = Array.from({ length: 4000 }, () => drawSlip(u))
    const onTime = xs.filter((x) => x === 0).length / xs.length
    expect(onTime).toBeGreaterThan(0.4); expect(onTime).toBeLessThan(0.6)
    expect(Math.max(...xs)).toBeLessThanOrEqual(10)
  })
})
