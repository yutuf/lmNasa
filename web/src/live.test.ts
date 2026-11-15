import { describe, expect, it } from 'vitest'
import {
  compareSpots, goalById, latLonToMap, liveCode, livePeerId, mapToLatLon, parseJoinHash, parsePlan, pickForGoal,
  spotScore, suggestNear, targetKm, type ApiSite, type Spot,
} from './live'

const site = (o: Partial<ApiSite>): ApiSite => ({ rank: 1, lat: -89.5, lon: 200, go_dates: 5, best_date: '2027-09-03', sun_pct: 80, earth_pct: 60, longest_dark_h: 10, go: true, ...o })
const spot = (o: Partial<Spot>): Spot => ({ lat: -89, lon: 0, goDays: 3, date: '2027-09-03', sun: 80, earth: 60, dark: 10, go: true, targetKm: null, ...o })

describe('live session', () => {
  it('makes 4-character room codes without look-alike letters', () => {
    for (let i = 0; i < 50; i++) expect(liveCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}$/)
  })
  it('names the host peer from the code', () => { expect(livePeerId('ab3k')).toBe('adaptlab-live-AB3K') })
  it('reads the join hash', () => {
    expect(parseJoinHash('#join=ab3k&lang=tr')).toEqual({ code: 'AB3K', lang: 'tr' })
    expect(parseJoinHash('#join=nope!')).toEqual({ code: null, lang: 'en' })
  })
  it('accepts only well-formed plans', () => {
    expect(parsePlan({ type: 'plan', goal: 'ice', days: 14, lat: -89, lon: 10 })).toEqual({ type: 'plan', goal: 'ice', days: 14, lat: -89, lon: 10 })
    expect(parsePlan({ type: 'plan', goal: 'ice', days: 10, lat: -89, lon: 10 })).toBeNull()
    expect(parsePlan({ type: 'plan', goal: 'nope', days: 14, lat: -89, lon: 10 })).toBeNull()
    expect(parsePlan({ type: 'plan', goal: 'ice', days: 14, lat: 10, lon: 10 })).toBeNull()
    expect(parsePlan('plan')).toBeNull()
    expect(goalById('sun')?.en).toBe('Most sunlight')
  })
  it('maps a tap to lat/lon and back', () => {
    expect(mapToLatLon(0.5, 0.5)!.lat).toBeCloseTo(-90, 5)
    const top = mapToLatLon(0.5, 0.1)!                    // straight up the map is 0 E
    expect(top.lon).toBeCloseTo(0, 5)
    const right = mapToLatLon(0.8, 0.5)!                  // right is 90 E
    expect(right.lon).toBeCloseTo(90, 5)
    const back = latLonToMap(right.lat, right.lon)
    expect(back.fx).toBeCloseTo(0.8, 6)
    expect(back.fy).toBeCloseTo(0.5, 6)
    expect(mapToLatLon(0.01, 0.01)).toBeNull()            // the corners are outside the 2 km grid
  })
  it('measures the distance to the goal only for ice and Artemis', () => {
    expect(targetKm('safe', -89, 0)).toBeNull()
    expect(targetKm('ice', -89, 0)).toBeGreaterThan(0)
  })
  it('compares spots: able to land first, then goal distance, then good days, then light', () => {
    expect(compareSpots('ice', spot({ targetKm: 4, goDays: 0 }), spot({ targetKm: 40, goDays: 1 }))).toEqual({ winner: 'pick', why: 'days' })
    expect(compareSpots('ice', spot({ targetKm: 40, goDays: 9 }), spot({ targetKm: 5, goDays: 1 }))).toEqual({ winner: 'pick', why: 'far' })
    expect(compareSpots('safe', spot({ goDays: 6 }), spot({ goDays: 2 }))).toEqual({ winner: 'judge', why: 'days' })
    expect(compareSpots('safe', spot({ sun: 60 }), spot({ sun: 90 }))).toEqual({ winner: 'pick', why: 'light' })
    expect(compareSpots('safe', spot({}), spot({ sun: 81 }))).toEqual({ winner: 'tie', why: 'same' })
    expect(spotScore('ice', spot({ targetKm: 3 }))).toBeGreaterThan(spotScore('ice', spot({ targetKm: 30, goDays: 9 })))
  })
  it('picks AdaptLab spots per goal', () => {
    const sites = [site({ rank: 1, sun_pct: 70 }), site({ rank: 2, sun_pct: 95, lat: -88 }), site({ rank: 3, sun_pct: 99, go: false })]
    expect(pickForGoal('safe', sites)!.sun).toBe(70)
    expect(pickForGoal('sun', sites)!.sun).toBe(95)
    expect(pickForGoal('safe', [])).toBeNull()
    const ice = pickForGoal('ice', sites)!
    expect(ice.targetKm).not.toBeNull()
    expect(ice.go).toBe(true)                             // a GO site wins over a closer one that cannot land
  })
  it('suggests the closest GO spot that meets the goal', () => {
    const sites = [site({ lat: -88, lon: 0 }), site({ lat: -89.9, lon: 0 }), site({ lat: -89.95, lon: 0, go: false })]
    const s = suggestNear('safe', -90, 0, sites)!
    expect(s.spot.lat).toBe(-89.9)
    expect(s.km).toBeLessThan(5)
    expect(suggestNear('safe', -90, 0, [site({ go: false })])).toBeNull()
  })
})
