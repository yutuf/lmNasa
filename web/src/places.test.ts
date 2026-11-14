import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describePlace, splitPlaceTitle, type Feature } from './places'

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

describe('place title split', () => {
  it('bolds the feature name and keeps the words before and after it', () => {
    expect(splitPlaceTitle('on Mons Mouton', 'Mons Mouton')).toEqual({ before: 'on', name: 'Mons Mouton', after: '' })
    expect(splitPlaceTitle('39.4 km NE of Slater rim', 'Slater')).toEqual({ before: '39.4 km NE of', name: 'Slater', after: 'rim' })
    expect(splitPlaceTitle('Mons Mouton üzerinde', 'Mons Mouton')).toEqual({ before: '', name: 'Mons Mouton', after: 'üzerinde' })
    expect(splitPlaceTitle('inside Shackleton crater', 'Shackleton')).toEqual({ before: 'inside', name: 'Shackleton', after: 'crater' })
    expect(splitPlaceTitle('NE rim of Shackleton', 'Shackleton')).toEqual({ before: 'NE rim of', name: 'Shackleton', after: '' })
  })
  it('bolds the whole title when there is no separate place name', () => {
    expect(splitPlaceTitle('Mons Mouton Plateau', '')).toEqual({ before: '', name: 'Mons Mouton Plateau', after: '' })
    expect(splitPlaceTitle('Mons Mouton Plateau', 'Mons Mouton Plateau')).toEqual({ before: '', name: 'Mons Mouton Plateau', after: '' })
    expect(splitPlaceTitle('-89.40°, 12.0°E', 'Missing')).toEqual({ before: '', name: '-89.40°, 12.0°E', after: '' })
  })
})

