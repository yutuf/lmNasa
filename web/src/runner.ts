// Splits a search across Web Workers (one per CPU core, up to 8) and gathers the results.
import type { PointResult, Search } from './engine'
import type { Constraints } from './model'

export class EngineRunner {
  private workers: Worker[] = []
  private ready: Promise<void>

  constructor(atlas: ArrayBuffer, ephem: ArrayBuffer, dsn: ArrayBuffer, n: number) {
    const count = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1))
    const ready: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
      ready.push(new Promise((res) => {
        const h = (e: MessageEvent) => { if (e.data.type === 'ready') { w.removeEventListener('message', h); res() } }
        w.addEventListener('message', h)
      }))
      w.postMessage({ type: 'init', atlas: atlas.slice(0), ephem: ephem.slice(0), dsn: dsn.slice(0), n })
      this.workers.push(w)
    }
    this.ready = Promise.all(ready).then(() => undefined)
  }

  private job = 0

  async run(nPoints: number, q: Search, c: Constraints, onProgress: (f: number) => void): Promise<PointResult[]> {
    await this.ready
    const job = ++this.job
    const per = Math.ceil(nPoints / this.workers.length)
    const done = new Array(this.workers.length).fill(0)
    const parts = await Promise.all(this.workers.map((w, k) => new Promise<PointResult[]>((res) => {
      const h = (e: MessageEvent) => {
        if (e.data.job !== job) return
        if (e.data.type === 'progress') {
          done[k] = e.data.done
          onProgress(done.reduce((a, b) => a + b, 0) / nPoints)
        } else if (e.data.type === 'result') {
          w.removeEventListener('message', h)
          res(e.data.out)
        }
      }
      w.addEventListener('message', h)
      w.postMessage({ type: 'search', job, from: k * per, to: Math.min(nPoints, (k + 1) * per), q, c })
    })))
    onProgress(1)
    return parts.flat()
  }
}
