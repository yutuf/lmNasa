import { describe, expect, it } from 'vitest'
import { launchChapter, launchDate } from './story'

describe('launch chapter', () => {
  const landing = new Date('2027-09-08T00:00:00Z')
  const launch = launchDate(landing)

  it('is a planning offset five days before touchdown', () => {
    expect(launch.toISOString()).toBe('2027-09-03T00:00:00.000Z')
  })

  it('does not claim this lander leaves Kennedy', () => {
    const en = launchChapter(launch, landing, 'en')
    const tr = launchChapter(launch, landing, 'tr')
    expect(en).not.toMatch(/Kennedy/)
    expect(tr).not.toMatch(/Kennedy/)
    expect(en).toMatch(/planning date/i)
    expect(en).toMatch(/not a published launch/)
    expect(en).toMatch(/not this lander's pad/)
    expect(en).toMatch(/8 September 2027/)
    expect(tr).toMatch(/planlama tarihi/)
    expect(tr).toMatch(/bu aracın rampası değildir/)
  })
})
