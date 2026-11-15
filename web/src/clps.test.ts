import { describe, expect, it } from 'vitest'
import { CLPS, clpsChipWhen } from './clps'

const by = (id: string) => CLPS.find((m) => m.id === id)!

describe('CLPS chip year', () => {
  it('names the year that is searched, and says when the data starts if the plan is earlier', () => {
    expect(clpsChipWhen(by('griffin1'), 'en')).toBe('2026 (searched from Feb 2027: the data starts Nov 2026)')
    expect(clpsChipWhen(by('griffin1'), 'tr')).toBe('2026 (Şubat 2027’den aranır: veri Kasım 2026’da başlar)')
    expect(clpsChipWhen(by('cp12'), 'en')).toBe('2026 (searched from Jun 2027: the data starts Nov 2026)')
    expect(clpsChipWhen(by('cp12'), 'tr')).toBe('2026 (Haziran 2027’den aranır: veri Kasım 2026’da başlar)')
  })
  it('prints only the year when the search window is in the planned year', () => {
    expect(clpsChipWhen(by('im3'), 'en')).toBe('2026')
    expect(clpsChipWhen(by('im3'), 'tr')).toBe('2026')
    expect(clpsChipWhen(by('bg3'), 'en')).toBe('2028')
    expect(clpsChipWhen(by('bg3'), 'tr')).toBe('2028')
  })
  it('uses the ephemeris start it is given', () => {
    expect(clpsChipWhen(by('griffin1'), 'en', '2026-11-01')).toContain('Nov 2026')
  })
})
