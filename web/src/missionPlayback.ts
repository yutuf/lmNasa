import { createContext, useContext } from 'react'

// A stable ref bridges the film and its memoised R3F children without rebuilding their trees every tick.
export interface MissionPlayback {
  scene: string
  start: number
  duration: number
  paused: boolean
  time: () => number
}
export const MissionPlaybackContext = createContext<{ current: MissionPlayback } | null>(null)
export const useMissionPlayback = () => useContext(MissionPlaybackContext)
export const sceneProgress = (p: MissionPlayback) => Math.max(0, Math.min(1, (p.time() - p.start) / p.duration))
