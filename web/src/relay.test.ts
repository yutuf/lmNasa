import { describe, expect, it } from 'vitest'
import { relayMask } from './relay'

const frac = (m: Uint8Array) => m.reduce((a, b) => a + b, 0) / m.length

describe('relayMask', () => {
  it('an ELFO with its high point over the south covers the south pole most of the time', () => {
    expect(frac(relayMask(-89, 0, 1000, 24 * 14))).toBeGreaterThan(0.6)
  })
  it('covers the far side near the south pole too (where Earth never rises)', () => {
    expect(frac(relayMask(-70, 180, 1000, 24 * 14))).toBeGreaterThan(0.4)
  })
  it('serves the north much less than the south', () => {
    expect(frac(relayMask(80, 0, 1000, 24 * 14))).toBeLessThan(frac(relayMask(-80, 0, 1000, 24 * 14)))
  })
})
