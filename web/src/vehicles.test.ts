import { describe, expect, it } from 'vitest'
import { compatibleRover, roverFitsLander } from './vehicles'

describe('mission vehicle pairings', () => {
  it('rejects a VIPER on Vikram and chooses its actual rover', () => {
    expect(roverFitsLander('vikram', 'viper')).toBe(false)
    expect(compatibleRover('vikram', 'viper')).toBe('pragyan')
  })
  it('preserves Apollo LRV and rejects unrelated rover hardware', () => {
    expect(compatibleRover('apollo', 'lrv')).toBe('lrv')
    expect(compatibleRover('apollo', 'yutu')).toBe('lrv')
  })
  it('allows conceptual HLS pairings but rejects unknown vehicle IDs', () => {
    expect(roverFitsLander('hls', 'viper')).toBe(true)
    expect(roverFitsLander('hls', 'unknown')).toBe(false)
    expect(roverFitsLander('unknown', 'pragyan')).toBe(false)
  })
})
