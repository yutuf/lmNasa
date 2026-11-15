import { createContext, useContext } from 'react'

// A stable ref bridges the film and its memoised R3F children without rebuilding their trees every tick.
export interface MissionPlayback {
  scene: string
  start: number
  duration: number
  paused: boolean
  time: () => number
  handoff?: boolean
  lander?: string
  visit?: number
  surface?: { altitude: number; range: number; seconds: number; landed: boolean }
  onSurfaceReady?: (mode: 'landing' | 'rover') => void
}
export const MissionPlaybackContext = createContext<{ current: MissionPlayback } | null>(null)
export const useMissionPlayback = () => useContext(MissionPlaybackContext)
export const sceneProgress = (p: MissionPlayback) => {
  if (!(p.duration > 0)) return 0
  return Math.max(0, Math.min(1, (p.time() - p.start) / p.duration))
}

/** Film landing shot → Drive approach seconds. Touchdown (`approachSecs`) lands at
 *  `settleAt` of the shot so contact is on screen before the cut. Interactive Drive
 *  does not use this; it advances in real time. */
export function filmDescentSeconds(progress: number, approachSecs: number, settleAt = 0.85) {
  const u = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  const end = Number.isFinite(settleAt) && settleAt > 0 && settleAt < 1 ? settleAt : 1
  const secs = Number.isFinite(approachSecs) && approachSecs > 0 ? approachSecs : 0
  return u * (secs / end)
}
