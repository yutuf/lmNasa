import { describe, expect, it } from 'vitest'
import { filmDescentSeconds, sceneProgress, type MissionPlayback } from './missionPlayback'

function clock(scene: string, start: number, duration: number, now: number): MissionPlayback {
  return { scene, start, duration, paused: false, time: () => now }
}

describe('film landing clock', () => {
  it('finishes the approach before the end of a short shot', () => {
    expect(filmDescentSeconds(0, 26)).toBe(0)
    expect(filmDescentSeconds(0.85, 26)).toBeCloseTo(26)
    expect(filmDescentSeconds(1, 26)).toBeCloseTo(26 / 0.85)
    expect(filmDescentSeconds(-1, 26)).toBe(0)
    expect(filmDescentSeconds(2, 26)).toBeCloseTo(26 / 0.85)
  })

  it('reads progress from the landing scene, not a longer wall clock', () => {
    expect(sceneProgress(clock('landing', 21, 10, 21))).toBe(0)
    expect(sceneProgress(clock('landing', 21, 10, 29.5))).toBeCloseTo(0.85)
    expect(sceneProgress(clock('landing', 21, 10, 40))).toBe(1)
    expect(sceneProgress(clock('descent', 15, 0, 15))).toBe(0)
  })
})
