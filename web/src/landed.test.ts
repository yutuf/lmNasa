import { describe, expect, it } from 'vitest'
import { keepOut } from './landed'

describe('keepOut', () => {
  it('flags points next to a landed craft, not ones far away', () => {
    expect(keepOut(0.674, 23.47)?.name).toBe('Apollo 11')
    expect(keepOut(0.674 + 0.1, 23.47)).toBeNull()          // ~3 km north
    expect(keepOut(-89.5, 0)).toBeNull()
  })
})
