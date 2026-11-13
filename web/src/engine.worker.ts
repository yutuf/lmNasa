// Runs the search engine off the main thread. Several workers split the candidate points between them.
import { parseAtlas, parseEphem, searchPoint, type PointResult, type Search } from './engine'
import type { Constraints } from './model'

let atlas: ReturnType<typeof parseAtlas> | null = null
let ephem: ReturnType<typeof parseEphem> | null = null
let dsn: Uint8Array | null = null

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data
  if (msg.type === 'init') {
    atlas = parseAtlas(msg.atlas)
    ephem = parseEphem(msg.ephem, msg.n)
    dsn = new Uint8Array(msg.dsn)
    self.postMessage({ type: 'ready' })
    return
  }
  if (msg.type === 'search' && atlas && ephem && dsn) {
    const { from, to, q, c, job } = msg as { from: number; to: number; q: Search; c: Constraints; job: number }
    const dsnBool = Array.from(dsn, (x) => x === 1)
    const out: PointResult[] = []
    for (let i = from; i < to; i++) {
      if (atlas.slope[i] > q.maxSlope) continue
      out.push(searchPoint(atlas, ephem, dsnBool, i, q, c))
      if ((i - from) % 400 === 0) self.postMessage({ type: 'progress', job, done: i - from, total: to - from })
    }
    self.postMessage({ type: 'result', job, out })
  }
}
