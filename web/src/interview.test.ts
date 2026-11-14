// Mission interview: a sentence becomes a partial plan, follow-ups stay under five, English and Turkish.
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from './scenarios'
import { LANDERS } from './vehicles'
import {
  acknowledge, applyAnswer, commit, examples, finalize, followUpAfterEdit, mergeAskParams, nextQuestion,
  openingLine, parseBrief, questionFor, shouldAskModel, summaryCopy, FOLLOW_UP_LIMIT, type MissionDraft, type QuestionId,
} from './interview'

const preset = (id: string) => SCENARIOS.find((s) => s.id === id)!
const hlsDays = LANDERS.find((l) => l.id === 'hls')!.maxDays
const apolloDays = LANDERS.find((l) => l.id === 'apollo')!.maxDays

function complete(brief: string): { asked: QuestionId[]; result: ReturnType<typeof finalize> } {
  let draft = parseBrief(brief)
  const asked: QuestionId[] = []
  while (asked.length <= FOLLOW_UP_LIMIT) {
    const q = nextQuestion(draft, asked)
    if (!q) break
    const choice = questionFor(q, draft, 'en').choices[0]
    expect(choice).toBeTruthy()
    const next = applyAnswer(draft, q, choice.id)
    expect(next).not.toBe(draft)
    draft = next
    asked.push(q)
  }
  expect(asked.length).toBeLessThanOrEqual(FOLLOW_UP_LIMIT)
  const result = finalize(draft, 'en')
  expect(result.days).toBeGreaterThan(0)
  expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(result.lander.length).toBeGreaterThan(0)
  expect(result.scope === 'pole' || result.scope === 'moon').toBe(true)
  return { asked, result }
}

describe('parseBrief', () => {
  it('reads an English brief into a partial mission', () => {
    const d = parseBrief('Astronauts on Starship HLS for 2 weeks at Shackleton to find water ice')
    expect(d).toMatchObject({
      goal: 'ice', target: 'shackleton', days: 14, crewed: true, lander: 'hls', scope: 'pole', farSide: false,
    })
    expect(d.start).toBeUndefined()
  })

  it('reads durations in weeks, days and Turkish gün', () => {
    expect(parseBrief('2 weeks on the Moon').days).toBe(14)
    expect(parseBrief('14 days on the Moon').days).toBe(14)
    expect(parseBrief('10 gün süren görev').days).toBe(10)
    expect(parseBrief('2 hafta').days).toBe(14)
    expect(parseBrief('iki haftalık robotik görev').days).toBe(14)
  })

  it('reads a Turkish ice brief', () => {
    expect(parseBrief("2028 martında Shackleton'da su buzu arayan 10 günlük robotik görev")).toMatchObject({
      goal: 'ice', target: 'shackleton', days: 10, crewed: false, start: '2028-03-01', scope: 'pole',
    })
  })

  it('reads goals in English and Turkish', () => {
    expect(parseBrief('Study the volcanoes at the Gruithuisen domes')).toMatchObject({ goal: 'volcanic', target: 'gruithuisen', scope: 'moon' })
    expect(parseBrief('Gruithuisen volkanlarını incele').goal).toBe('volcanic')
    expect(parseBrief('Solve the magnetic mystery at Reiner Gamma')).toMatchObject({ goal: 'magnetic', target: 'reinergamma' })
    expect(parseBrief('Reiner Gamma’daki manyetik sır').goal).toBe('magnetic')
    expect(parseBrief('Look for a lava tube').goal).toBe('pit')
    expect(parseBrief('Bir lav tüpü veya mağara ara').goal).toBe('pit')
    expect(parseBrief('Look for a lava tube').goal).not.toBe('volcanic')
    expect(parseBrief('Visit Apollo 17 and the history there')).toMatchObject({ goal: 'history', target: 'apollo17' })
    expect(parseBrief('Apollo 17 tarihini ziyaret').goal).toBe('history')
    expect(parseBrief('Crewed Artemis landing').goal).toBe('artemis')
    expect(parseBrief('Su buzu bul').goal).toBe('ice')
  })

  it('keeps Apollo LM as a lander and Apollo 17 as a place', () => {
    expect(parseBrief('the Apollo LM for 3 days')).toMatchObject({ lander: 'apollo', crewed: true, days: 3 })
    expect(parseBrief('the Apollo LM for 3 days').goal).toBeUndefined()
    expect(parseBrief('the Apollo LM for 3 days at Apollo 17')).toMatchObject({ lander: 'apollo', target: 'apollo17', goal: 'history' })
  })

  it('reads vehicles, crew and the far side', () => {
    expect(parseBrief('Vikram and Pragyan for 14 days')).toMatchObject({ lander: 'vikram', rover: 'pragyan', days: 14, crewed: false })
    expect(parseBrief('Starship HLS astronauts')).toMatchObject({ lander: 'hls', crewed: true })
    expect(parseBrief('Send Yutu-2 to the far side')).toMatchObject({ rover: 'yutu', farSide: true, crewed: false, scope: 'moon' })
    expect(parseBrief('A rover to Schrödinger basin on the far side').target).toBe('schrodinger')
    expect(parseBrief('Uzak yüzde bir gezgin')).toMatchObject({ farSide: true, crewed: false, wantsRover: true, scope: 'moon' })
    expect(parseBrief('an uncrewed lander for 14 days').crewed).toBe(false)
    expect(parseBrief('a crewed robotic mission to find ice').crewed).toBeUndefined()
    expect(parseBrief('A robotic precursor to an Artemis region')).toMatchObject({ goal: 'artemis', crewed: false })
  })

  it('clamps the window to the ephemeris', () => {
    expect(parseBrief('a mission in October 2026').start).toBe('2026-11-01')
    expect(parseBrief('a 2-week mission in March 2040').start).toBe('2040-03-01')
    expect(parseBrief('landing in 2050').start).toBeUndefined()
  })

  it('sends Haworth with Artemis to the candidate region, and the crater to the ice', () => {
    expect(parseBrief('Artemis landing at Haworth').target).toBe('a3_haworth')
    expect(parseBrief('Haworth crater ice').target).toBe('haworth')
    expect(parseBrief('Artemis Mons Mouton Plateau').scope).toBe('moon')
  })
})

describe('next question', () => {
  it('asks only what the brief left open', () => {
    expect(nextQuestion(parseBrief('Find water ice'))).toBe('crew')
    expect(nextQuestion(parseBrief('Su buzu bul'))).toBe('crew')
    expect(nextQuestion(parseBrief('A robotic mission to find water ice'))).toBe('days')
    expect(nextQuestion(parseBrief('Robotik bir su buzu görevi'))).toBe('days')
    expect(nextQuestion(parseBrief('Study volcanoes'))).toBe('crew')
    expect(nextQuestion(parseBrief('Crewed Artemis landing on Starship HLS for 5 days in March 2028'))).toBeNull()
    expect(nextQuestion(parseBrief("Mart 2028'de Starship HLS ile 5 günlük insanlı Artemis inişi"))).toBeNull()

    const far = parseBrief('A rover to Schrödinger on the far side for 21 days in June 2029')
    expect(far).toMatchObject({ target: 'schrodinger', days: 21, start: '2029-06-01', crewed: false, farSide: true })
    expect(nextQuestion(far)).toBe('relay')
    const relayed = applyAnswer(far, 'relay', 'yes')
    expect(nextQuestion(relayed, ['relay'])).toBe('rover')

    const ice = parseBrief('A robotic mission to find water ice at the south pole')
    expect(nextQuestion(ice)).toBe('days')
    const dated = applyAnswer(ice, 'days', '14')
    expect(nextQuestion(dated, ['days'])).toBe('rover')
    const walked = applyAnswer(dated, 'rover', 'none')
    expect(nextQuestion(walked, ['days', 'rover'])).toBe('when')
  })

  it('asks a crew to shorten a two-week stay, and suggests the south pole for ice', () => {
    const d = parseBrief('Astronauts on Starship HLS for 2 weeks at Shackleton to find water ice')
    expect(nextQuestion(d)).toBe('days')
    const q = questionFor('days', d, 'en')
    expect(q.prompt).toContain(String(hlsDays))
    expect(q.choices.every((c) => Number(c.id) <= hlsDays)).toBe(true)

    const ice = parseBrief('Find water ice')
    const crew = applyAnswer(ice, 'crew', 'robot')
    const days = applyAnswer(crew, 'days', '14')
    const rover = applyAnswer(days, 'rover', 'none')
    expect(nextQuestion(rover, ['crew', 'days', 'rover'])).toBe('scope')
    expect(questionFor('scope', rover, 'en').prompt.toLowerCase()).toContain('south pole')
    expect(questionFor('scope', rover, 'tr').prompt).toContain('kutbu')
    expect(questionFor('scope', rover, 'en').choices.find((c) => c.id === 'pole')?.recommended).toBe(true)
  })

  it('stops after five follow-ups even when a date is still open', () => {
    expect(nextQuestion({ brief: 'x' }, ['crew', 'goal', 'relay', 'lander', 'days'])).toBeNull()
    expect(FOLLOW_UP_LIMIT).toBe(5)
  })

  it('never asks more than five questions, in English or Turkish', () => {
    const briefs = [
      '',
      'hello',
      'Find water ice',
      'Su buzu bul',
      'Study the volcanoes',
      'Volkanları incele',
      'A cave on the far side',
      'Uzak yüzde bir mağara',
      ...examples('en'),
      ...examples('tr'),
    ]
    for (const brief of briefs) {
      const { asked, result } = complete(brief)
      expect(asked.length).toBeLessThanOrEqual(5)
      expect(result.sun).toBeGreaterThan(0)
      expect(result.batt).toBeGreaterThan(0)
    }
  })

  it('sends a far-side rover to the relay question and recommends Yutu-2', () => {
    const d = parseBrief('Uzak yüzde Schrödinger havzasına bir gezgin')
    expect(d.target).toBe('schrodinger')
    expect(nextQuestion(d)).toBe('relay')
    expect(questionFor('relay', d, 'en').prompt.toLowerCase()).toContain('relay')
    expect(questionFor('relay', d, 'tr').prompt).toContain('röle')
    const after = applyAnswer(d, 'relay', 'yes')
    expect(questionFor('rover', after, 'en').choices[0].id).toBe('yutu')
  })

  it('rejects a crew stay the lander cannot fly', () => {
    const apollo: MissionDraft = { brief: '', crewed: true, lander: 'apollo' }
    expect(applyAnswer(apollo, 'days', 'hello')).toBe(apollo)
    expect(applyAnswer(apollo, 'days', '9')).toBe(apollo)
    expect(applyAnswer(apollo, 'days', '2').days).toBe(2)
    const swapped = applyAnswer({ brief: '', crewed: true, days: 7, lander: 'hls', start: '2028-03-01', goal: 'artemis' }, 'lander', 'apollo')
    expect(swapped.days).toBeUndefined()
    expect(followUpAfterEdit(swapped)).toBe('days')
  })
})

describe('language', () => {
  const ids: QuestionId[] = ['crew', 'goal', 'relay', 'lander', 'days', 'rover', 'scope', 'when']
  const bases: Record<QuestionId, MissionDraft> = {
    crew: { brief: '' },
    goal: { brief: '', crewed: false },
    relay: { brief: '', farSide: true, target: 'schrodinger' },
    lander: { brief: '', crewed: true },
    days: { brief: '', crewed: true, lander: 'hls' },
    rover: { brief: '', crewed: false, goal: 'ice' },
    scope: { brief: '', goal: 'ice' },
    when: { brief: '', crewed: false, goal: 'volcanic' },
  }

  it('asks every question in English and Turkish, with the same chips', () => {
    expect(openingLine('en')).toContain('Tell me about your mission in a sentence')
    expect(openingLine('tr')).toContain('bir cümleyle')
    for (const id of ids) {
      const en = questionFor(id, bases[id], 'en')
      const tr = questionFor(id, bases[id], 'tr')
      expect(en.prompt.length).toBeGreaterThan(8)
      expect(tr.prompt.length).toBeGreaterThan(8)
      expect(en.prompt).not.toBe(tr.prompt)
      expect(en.choices.map((c) => c.id)).toEqual(tr.choices.map((c) => c.id))
      expect(en.choices.length).toBeGreaterThan(0)
    }
    expect(questionFor('days', { brief: '', crewed: true, lander: 'apollo' }, 'en').choices.map((c) => c.id)).toEqual(['3', '2', '1'])
    expect(questionFor('rover', { brief: '', crewed: false, goal: 'volcanic' }, 'en').choices[0].id).toBe('none')
    expect(questionFor('rover', { brief: '', crewed: false, goal: 'ice' }, 'en').choices[0].id).toBe('viper')
  })

  it('acknowledges the brief in both languages', () => {
    const d = parseBrief('Find water ice at Shackleton')
    expect(acknowledge(d, 'en', false)).toContain('Shackleton')
    expect(acknowledge(d, 'en', false)).toContain('still missing')
    expect(acknowledge(d, 'en', true)).not.toContain('still missing')
    expect(acknowledge(d, 'tr', false)).toContain('Shackleton')
    expect(acknowledge(d, 'tr', false)).toContain('eksik')
  })
})

describe('presets and summary', () => {
  it('copies sun, Earth, darkness and battery from the matching preset', () => {
    const crew = finalize(parseBrief('Crewed Artemis landing on Starship HLS for 5 days in March 2028'))
    expect(crew).toMatchObject({
      sun: preset('crew').sun, earth: preset('crew').earth, shadow: preset('crew').shadow, batt: preset('crew').batt,
      days: 5, lander: 'hls', crewed: true, scope: 'pole', goal: 'artemis', rover: '', relay: false, start: '2028-03-01',
    })

    const robotic = finalize({ brief: 'land', crewed: false, goal: 'volcanic', days: 14, start: '2028-06-01', scope: 'moon', rover: null })
    expect(robotic).toMatchObject({
      sun: preset('lander').sun, earth: preset('lander').earth, shadow: preset('lander').shadow, batt: preset('lander').batt,
      lander: 'vikram', rover: '', scope: 'moon',
    })

    const rover = finalize({ brief: 'r', crewed: false, goal: 'ice', days: 21, rover: 'viper', scope: 'pole', start: '2027-06-01' })
    expect(rover).toMatchObject({
      sun: preset('rover').sun, earth: preset('rover').earth, shadow: preset('rover').shadow, batt: preset('rover').batt, rover: 'viper',
    })

    const long = finalize({ brief: 'l', crewed: false, days: 28, longStay: true, rover: null, scope: 'moon', goal: 'history' })
    expect(long).toMatchObject({
      sun: preset('long').sun, earth: preset('long').earth, shadow: preset('long').shadow, batt: preset('long').batt, days: 28,
    })
  })

  it('caps a crew stay at the lander, and a rover still uses the rover preset', () => {
    expect(finalize({ brief: '', crewed: true, lander: 'apollo', days: 6 }).days).toBe(apolloDays)
    expect(finalize({ brief: '', crewed: true, lander: 'hls', days: 20 }).days).toBe(hlsDays)
    const both = finalize({ brief: '', crewed: false, days: 28, rover: 'viper', longStay: true })
    expect(both.sun).toBe(preset('rover').sun)
    expect(both.batt).toBe(preset('rover').batt)
  })

  it('describes the search in plain words', () => {
    const early = summaryCopy(parseBrief('Astronauts on Starship HLS for 2 weeks at Shackleton to find water ice'), 'en')
    expect(early.result.days).toBe(hlsDays)
    expect(early.body).toContain(String(preset('crew').sun))
    expect(early.body.toLowerCase()).toContain('south pole')
    expect(early.body).toContain('14')

    let d = parseBrief('Güney kutbunda su buzu arayan iki haftalık robotik görev')
    expect(nextQuestion(d)).toBe('rover')
    d = applyAnswer(d, 'rover', 'viper')
    d = applyAnswer(d, 'when', '2027-03-01')
    const card = summaryCopy(d, 'tr')
    expect(card.result.batt).toBe(preset('rover').batt)
    expect(card.body).toContain('VIPER')
    expect(card.body).toContain('Güneş')
    expect(card.result.scope).toBe('pole')
    expect(card.result.days).toBe(14)
  })

  it('is stable once the defaults are written back', () => {
    const d = parseBrief('Find water ice')
    expect(finalize(commit(d))).toEqual(finalize(d))
  })
})

describe('model gaps', () => {
  it('asks the model only when a day count, a date or a goal is missing', () => {
    expect(shouldAskModel(parseBrief('Crewed Artemis landing on Starship HLS for 5 days in March 2028'))).toBe(false)
    expect(shouldAskModel(parseBrief('Find water ice'))).toBe(true)
    expect(shouldAskModel({ brief: 'hello' })).toBe(true)
  })

  it('fills only the gaps and ignores invented limits', () => {
    const base = parseBrief('study volcanoes for 9 days')
    const merged = mergeAskParams(base, { days: 20, start: '2030-05-01', sun: 1, ice: 10, batt: 999, shadow: 1, earth: 1 })
    expect(merged.days).toBe(9)
    expect(merged.start).toBe('2030-05-01')
    expect(merged.goal).toBe('volcanic')
    expect(finalize(merged).sun).toBe(preset('lander').sun)

    expect(mergeAskParams({ brief: '' }, { start: '1999-01-01' }).start).toBeUndefined()
    expect(mergeAskParams({ brief: '' }, { start: '2030-13-01' }).start).toBeUndefined()
    expect(mergeAskParams({ brief: '' }, { days: 12, ice: 2 })).toMatchObject({ days: 12, goal: 'ice' })
    expect(mergeAskParams({ brief: '' }, null)).toEqual({ brief: '' })
  })
})
