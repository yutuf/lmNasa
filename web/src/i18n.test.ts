import { describe, expect, it } from 'vitest'
import { catalogueSources, fmtHoursShort, fmtIsoDate, fmtPercent, landingPeriod, localizeReportHtml, verdictLabel } from './i18n'
import { SCIENCE_SITES, siteLabel } from './scienceSites'

describe('Turkish number and date formats', () => {
  it('puts the percent sign first and uses sa for a short hour count', () => {
    expect(fmtPercent(53, 'tr')).toBe('%53')
    expect(fmtPercent(53.4, 'en')).toBe('53%')
    expect(fmtHoursShort(0, 'tr')).toBe('0 sa')
    expect(fmtHoursShort(12.4, 'en')).toBe('12 h')
  })
  it('reuses UYGUN / UYGUN DEĞİL and writes the screen date', () => {
    expect(verdictLabel(true, 'tr')).toBe('UYGUN')
    expect(verdictLabel(false, 'tr')).toBe('UYGUN DEĞİL')
    expect(verdictLabel(true, 'en')).toBe('GO')
    expect(verdictLabel(false, 'en')).toBe('NO-GO')
    expect(fmtIsoDate('2027-09-10', 'tr')).toBe('10 Eyl 2027')
    expect(fmtIsoDate('2027-09-10', 'en')).toBe('10 Sept 2027')
    expect(landingPeriod('tr')).toBe('2019 – 2025 ortası')
    expect(landingPeriod('en')).toBe('2019 – mid-2025')
  })
  it('names the shipped catalogue JPL DE421', () => {
    expect(catalogueSources(['JPL DE440 ephemeris via Skyfield'])).toEqual(['JPL DE421 ephemeris via Skyfield'])
  })
})

describe('report HTML for Turkish', () => {
  const html = `<style>.go{color:green}.nogo{color:red}table{width:100%}</style>
<td>2027-09-10 <span class="go">GO</span> <span class="nogo">NO-GO</span></td>
<td>100%</td><td>0 h</td><p>from JPL DE440 hour by hour</p><th>GO</th><td>(GO 4)</td>`

  it('leaves English wording and only renames the ephemeris', () => {
    const en = localizeReportHtml(html, 'en')
    expect(en).toContain('>GO<')
    expect(en).toContain('100%')
    expect(en).toContain('0 h')
    expect(en).toContain('2027-09-10')
    expect(en).toContain('JPL DE421')
    expect(en).not.toContain('JPL DE440')
  })
  it('localizes the visible text and keeps the CSS classes', () => {
    const tr = localizeReportHtml(html, 'tr')
    expect(tr).toContain('class="go"')
    expect(tr).toContain('class="nogo"')
    expect(tr).toContain('width:100%')
    expect(tr).toContain('10 Eyl 2027')
    expect(tr).toContain('>UYGUN<')
    expect(tr).toContain('UYGUN DEĞİL')
    expect(tr).not.toContain('>GO<')
    expect(tr).not.toContain('NO-GO')
    expect(tr).toContain('%100')
    expect(tr).toContain('0 sa')
    expect(tr).toContain('JPL DE421')
    expect(tr).toContain('(UYGUN 4)')
  })
})

describe('science site labels', () => {
  it('translates the descriptive word and keeps a pure proper noun', () => {
    const peak = SCIENCE_SITES.find((s) => s.id === 'a3_peak_near_cabeus_b')!
    const haworth = SCIENCE_SITES.find((s) => s.id === 'a3_haworth')!
    expect(siteLabel(peak, 'en')).toBe('Artemis III: Peak near Cabeus B')
    expect(siteLabel(peak, 'tr')).toBe('Artemis III: Cabeus B yakınındaki tepe')
    expect(siteLabel(haworth, 'tr')).toBe('Artemis III: Haworth')
    expect(peak.name).toBe('Artemis III: Peak near Cabeus B')
    const described = /crater|basin|Massif|Plateau|Rim |Plain|Peak |pit|domes|swirls|anomaly|Hills|north pole|impact|central peak|massif/
    for (const s of SCIENCE_SITES) {
      expect(siteLabel(s, 'tr').length).toBeGreaterThan(0)
      if (described.test(s.name)) expect(siteLabel(s, 'tr'), s.id).not.toBe(s.name)
    }
  })
})
