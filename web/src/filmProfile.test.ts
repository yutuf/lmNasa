import { describe, expect, it } from 'vitest'
import { coastReadout, dayIndex, descentReadout, fmtClock, fmtKm, fmtLat, fmtLon, fmtVel, PROFILE, rise, siteReadout } from './filmProfile'

describe('film profile', () => {
  it('starts the coast where the launch card leaves it and hands the clock to the burn', () => {
    const a = coastReadout(0)
    const b = coastReadout(1)
    const burn = descentReadout(0)
    expect(a.altKm).toBe(PROFILE.leoAltKm)
    expect(a.velKms).toBe(PROFILE.tliKms)
    expect(a.rangeKm).toBeCloseTo(PROFILE.moonKm - PROFILE.earthRKm - PROFILE.leoAltKm - PROFILE.moonRKm, 6)
    expect(a.ttlS).toBe(PROFILE.coastS + PROFILE.descentS)
    expect(b.velKms).toBeCloseTo(PROFILE.burnKms, 6)
    expect(b.rangeKm).toBe(PROFILE.lloAltKm)
    expect(b.ttlS).toBe(burn.ttlS)
    expect(burn.altKm).toBe(PROFILE.lloAltKm)
    expect(burn.velKms).toBeCloseTo(PROFILE.burnKms, 6)
    expect(burn.rangeKm).toBe(PROFILE.burnRangeKm)
  })

  it('brings the descent to a stop on the clock', () => {
    const end = descentReadout(1)
    expect(end.altKm).toBe(0)
    expect(end.velKms).toBe(0)
    expect(end.rangeKm).toBe(0)
    expect(end.ttlS).toBe(0)
    const steps = [0, 0.25, 0.5, 0.75, 1]
    for (let i = 0; i < steps.length - 1; i++) {
      const p = descentReadout(steps[i])
      const q = descentReadout(steps[i + 1])
      expect(p.altKm).toBeGreaterThan(q.altKm)
      expect(p.velKms).toBeGreaterThan(q.velKms)
      expect(p.rangeKm).toBeGreaterThan(q.rangeKm)
      expect(p.ttlS).toBeGreaterThan(q.ttlS)
    }
  })

  it('keeps range to the site ahead of altitude through the burn', () => {
    const mid = descentReadout(0.5)
    expect(mid.rangeKm).toBeGreaterThan(mid.altKm)
    expect(mid.kind).toBe('profile')
  })

  it('uses the computed height on the surface and a planned stop', () => {
    const s = siteReadout(1520)
    expect(s.altKm).toBeCloseTo(1.52, 6)
    expect(s.velKms).toBe(0)
    expect(s.rangeKm).toBe(0)
    expect(s.ttlS).toBe(0)
    expect(s.kind).toBe('site')
  })

  it('formats the countdown and the coordinates', () => {
    expect(fmtClock(0, 'en')).toBe('00:00:00')
    expect(fmtClock(PROFILE.descentS, 'en')).toBe('00:12:00')
    expect(fmtClock(PROFILE.coastS + PROFILE.descentS, 'en')).toBe('4d 12:12:00')
    expect(fmtClock(PROFILE.coastS + PROFILE.descentS, 'tr')).toBe('4g 12:12:00')
    expect(fmtLat(-89.5, 'en')).toBe('89.50°S')
    expect(fmtLat(-89.5, 'tr')).toBe('89.50°G')
    expect(fmtLon(222.5, 'en')).toBe('137.5°W')
    expect(fmtLon(20, 'tr')).toBe('20.0°D')
    expect(fmtKm(185, 'en')).toBe('185 km')
    expect(fmtKm(0.25, 'en')).toBe('250 m')
    expect(fmtVel(10.9, 'en')).toBe('10.90 km/s')
    expect(fmtVel(0, 'tr')).toBe('0 m/sn')
  })

  it('scrubs the stagger and the sunlight day', () => {
    expect(rise(0.2, 0.5, 0.1, false)).toBe(0)
    expect(rise(0.55, 0.5, 0.1, false)).toBeCloseTo(0.5, 6)
    expect(rise(0.2, 0.5, 0.1, true)).toBe(1)
    expect(dayIndex(0, 8)).toBe(0)
    expect(dayIndex(0.5, 8)).toBe(4)
    expect(dayIndex(1, 8)).toBe(7)
    expect(dayIndex(0.2, 0)).toBe(0)
  })
})
