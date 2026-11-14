import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

test('holds decorative loads until results exist and have had a paint opportunity', async () => {
  let results = false
  let changed = () => {}
  const frames: FrameRequestCallback[] = []
  const disconnect = vi.fn()
  vi.stubGlobal('document', { body: {}, querySelector: () => results ? {} : null })
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { changed = callback }
    observe() {}
    disconnect = disconnect
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  const { afterResultsPaint } = await import('./resultsPaint')
  const done = vi.fn()
  const pending = afterResultsPaint().then(done)
  expect(frames).toHaveLength(0)
  changed()
  expect(done).not.toHaveBeenCalled()
  results = true
  changed()
  expect(disconnect).toHaveBeenCalledOnce()
  frames.shift()!(0)
  expect(done).not.toHaveBeenCalled()
  frames.shift()!(16)
  await pending
  expect(done).toHaveBeenCalledOnce()
})

test('already rendered results reuse a single paint gate', async () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('document', { querySelector: () => ({}) })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  const { afterResultsPaint } = await import('./resultsPaint')
  const pending = afterResultsPaint()
  expect(afterResultsPaint()).toBe(pending)
  frames.shift()!(0)
  frames.shift()!(16)
  await pending
})
