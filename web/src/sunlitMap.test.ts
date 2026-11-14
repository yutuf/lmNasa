// The whole-Moon sunlight map: the lit points must be the hemisphere facing the Sun, about half of the Moon.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Manifest } from './data'
import { parseEphem, parseGlobalAtlas, sunlitMap } from './engine'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const manifest: Manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf-8'))
const atlas = parseGlobalAtlas(read('global_atlas.bin'))
const ephem = parseEphem(read('ephem.bin'), manifest.n)

describe('sunlitMap on the whole-Moon grid', () => {
  for (const hour of [0, 173, 2000]) {
    it(`hour ${hour}: lit side faces the Sun`, () => {
      const lit = sunlitMap(atlas, ephem, hour)
      const s = [ephem.sun[0][hour], ephem.sun[1][hour], ephem.sun[2][hour]]
      const sl = Math.hypot(s[0], s[1], s[2])
      let litN = 0, wrong = 0, sum = 0
      for (let i = 0; i < atlas.n; i++) {
        const la = (atlas.lat[i] * Math.PI) / 180, lo = (atlas.lon[i] * Math.PI) / 180
        const d = (Math.cos(la) * Math.cos(lo) * s[0] + Math.cos(la) * Math.sin(lo) * s[1] + Math.sin(la) * s[2]) / sl
        const w = Math.cos(la)   // area weight: the grid is denser in longitude near the poles
        sum += w
        if (lit[i] > 0.5) litN += w
        if ((lit[i] > 0.5 && d < -0.05) || (lit[i] < 0.5 && d > 0.15)) wrong++   // lit on the night side, or dark at midday
      }
      expect(litN / sum).toBeGreaterThan(0.4)
      expect(litN / sum).toBeLessThan(0.55)
      expect(wrong / atlas.n).toBeLessThan(0.01)
    })
  }
})
