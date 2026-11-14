import { describe, expect, it } from 'vitest'
import type { PointResult } from './engine'
import { paretoFront } from './tradeoff'

const pt = (index: number, d: number, f: number) => ({ r: { index } as PointResult, d, area: 0, f })

describe('paretoFront', () => {
  it('keeps the sites nothing beats on both distance to ice and GO share', () => {
    const pts = [pt(1, 0.5, 0.2), pt(2, 1, 0.1), pt(3, 2, 0.6), pt(4, 3, 0.5), pt(5, 6, 0.9), pt(6, 0.5, 0.1)]
    expect(paretoFront(pts).map((p) => p.r.index)).toEqual([1, 3, 5])
  })
  it('is empty for no points', () => expect(paretoFront([])).toEqual([]))
})
