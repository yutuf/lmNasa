import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describePlace, type Feature } from './places'

const feats: Feature[] = JSON.parse(readFileSync('public/data/features.json', 'utf8')).features

describe('place names', () => {
  it('names the Shackleton rim and the crater floor', () => {
    expect(describePlace(-89.69, 198.05, feats, 'en')!.text).toMatch(/rim of Shackleton/)
    expect(describePlace(-89.67, 129.78, feats, 'en')!.text).toBe('inside Shackleton crater')
  })
  it('puts Mons Mouton points on Mons Mouton', () => {
    expect(describePlace(-84.6, 31, feats, 'en')!.text).toBe('on Mons Mouton')
  })
  it('gives distance and direction away from a feature, in Turkish too', () => {
    const p = describePlace(-89.95, 0, feats, 'en')!
    expect(p.kind).not.toBe('inside')
    expect(p.text).toMatch(/km|rim/)
    expect(describePlace(-89.95, 0, feats, 'tr')!.text).toMatch(/km|kenar/)
  })
})
