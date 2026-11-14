import { describe, expect, it } from 'vitest'
import { order, reasons, robustness, standing, topsis, type Dir } from './decision'

// three sites: sun %, slope deg (less is better)
const rows = [[90, 10], [60, 2], [86, 2.6]]
const dirs: Dir[] = [1, -1]

describe('topsis', () => {
  it('a site best on everything scores 1, worst on everything 0', () => {
    const s = topsis([[100, 1], [50, 9]], [1, 1], dirs)
    expect(s[0]).toBeCloseTo(1); expect(s[1]).toBeCloseTo(0)
  })
  it('weights decide between trade-offs', () => {
    expect(order(topsis(rows, [1, 0], dirs))[0]).toBe(0)     // only sunlight counts
    expect(order(topsis(rows, [0, 1], dirs))[0]).toBe(1)     // only slope counts
    expect(order(topsis(rows, [1, 1], dirs))[0]).toBe(2)     // balanced: the compromise wins
  })
  it('a missing value counts as the worst', () => {
    const s = topsis([[90, null], [90, 5], [90, 3]], [1, 1], dirs)
    expect(s[0]).toBeCloseTo(s[1]); expect(order(s)[0]).toBe(2)
  })
})

describe('standing and reasons', () => {
  it('scales each criterion 0..1 with the direction applied', () => {
    const st = standing(rows, dirs)
    expect(st[0][0]).toBe(1); expect(st[1][0]).toBe(0)
    expect(st[1][1]).toBe(1); expect(st[0][1]).toBe(0)
  })
  it('names what lifts a site', () => {
    expect(reasons(standing(rows, dirs), [1, 1], 1)[0]).toBe(1)   // the flat site wins on slope
  })
})

describe('robustness', () => {
  it('a dominant site wins every shake; shares add up', () => {
    const r = robustness([[100, 1], [50, 9], [60, 8]], [1, 1], dirs, 200)
    expect(r.wins[0]).toBe(1)
    expect(r.wins.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(r.meanRank[0]).toBe(1)
  })
  it('a close call splits the wins', () => {
    const r = robustness([[80, 4], [79, 3.9], [20, 12]], [1, 1], dirs, 400)
    expect(r.wins[0]).toBeGreaterThan(0.05); expect(r.wins[1]).toBeGreaterThan(0.05)
    expect(r.wins[2]).toBe(0)
  })
})
