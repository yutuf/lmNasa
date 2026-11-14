// Offline Luna: mission descriptions become search settings, and questions are answered from the page context.
import { describe, expect, it } from 'vitest'
import { askLocal, parseMission } from './lunaLocal'

const ctx = {
  settings: { days: 14 },
  engine: { landingDatesInWindow: 30, pointsChecked: 21856 },
  results: [
    { rank: 1, goLandingDates: 10, bestLanding: '2027-09-07', artemisRegion: 'Mons Mouton Plateau', place: 'on Mons Mouton',
      bestWindow: { sunlightPct: 100, earthContactPct: 98, longestDarkHours: 0 }, slopeDeg: 1.3, zoneSlopeP95Deg: 6 },
    { rank: 2, goLandingDates: 9, bestLanding: '2027-09-12', artemisRegion: null, place: 'on Mons Mouton',
      bestWindow: { sunlightPct: 100, earthContactPct: 99, longestDarkHours: 0 }, slopeDeg: 6.8, zoneSlopeP95Deg: 9.5 },
  ],
  selected: { rank: 1, verdict: 'GO', sunlightPct: 100, earthContactPct: 98, longestDarkHours: 0, batterySurvives: true, batteryNeededWh: 0,
    goOnEachLandingDate: Array.from({ length: 30 }, (_, k) => `2027-09-${String(k + 1).padStart(2, '0')}:${k === 6 || k === 20 ? 'GO' : 'NO-GO'}`) },
}

describe('parseMission', () => {
  it('reads duration, season, year and Earth contact (English)', () => {
    expect(parseMission('A 3-week rover landing in spring 2027 that must always reach Earth'))
      .toMatchObject({ days: 21, start: '2027-03-01', earth: 80, dsn: true, zone: 250 })
  })
  it('reads Turkish', () => {
    expect(parseMission("2027 baharında inen, Dünya ile hep konuşabilen 3 haftalık bir gezgin")).toMatchObject({ days: 21, start: '2027-03-01', earth: 80 })
    expect(parseMission('2027 sonbaharında 5 günlük görev')).toMatchObject({ days: 5, start: '2027-09-01' })
    expect(parseMission('mart 2028 için 10 günlük hassas iniş')).toMatchObject({ days: 10, start: '2028-03-01', zone: 100 })
  })
  it('near water ice', () => {
    expect(parseMission('a 2-week lander near water ice')).toMatchObject({ days: 14, ice: 2 })
    expect(parseMission('buza yakın 10 günlük görev')).toMatchObject({ days: 10, ice: 2 })
  })
  it('battery and night survival', () => {
    expect(parseMission('a 6 kWh lander that can survive the night')).toMatchObject({ batt: 6000, shadow: 120 })
  })
  it('does not see months in ordinary words', () => {
    expect(parseMission('a smart rover that may drive far').start).toBeUndefined()
  })
  it('clamps the window to the data, which runs to 2045', () => {
    expect(parseMission('a mission in October 2026').start).toBe('2026-11-01')
    expect(parseMission('a 2-week mission in March 2040').start).toBe('2040-03-01')
    expect(parseMission('landing in 2050').start).toBeUndefined()
  })
})

describe('askLocal', () => {
  it('compares two ranks with context numbers', () => {
    const r = askLocal('Why is #1 better than #2?', 'en', ctx)
    expect(r.reply).toContain('10 landing dates')
    expect(r.reply).toContain('9')
    expect(r.action).toBeNull()
  })
  it('selects a result', () => {
    expect(askLocal('show #2', 'en', ctx).action).toEqual({ type: 'select', rank: 2 })
    expect(askLocal("#2'yi göster", 'tr', ctx).action).toEqual({ type: 'select', rank: 2 })
  })
  it('answers a launch slip from the per-date verdicts', () => {
    const r = askLocal('What happens if the launch slips a week?', 'en', ctx)
    expect(r.reply).toContain('2027-09-14')
    expect(r.reply).toContain('NO-GO')
    expect(r.reply).toContain('2027-09-21')
  })
  it('explains the selected result, also for a child', () => {
    expect(askLocal('Explain this result', 'en', ctx).reply).toContain('GO')
    expect(askLocal('Bu sonucu 10 yaşındaki birine anlat', 'tr', ctx).reply).toContain('güneş')
  })
  it('turns a description into a search', () => {
    const r = askLocal('a 10-day mission in summer 2028', 'en', ctx)
    expect(r.action).toEqual({ type: 'search', params: { days: 10, start: '2028-06-01' } })
  })
  it('gives help when it does not understand', () => {
    expect(askLocal('hello', 'en', {}).reply).toMatch(/Try describing/)
  })
})
