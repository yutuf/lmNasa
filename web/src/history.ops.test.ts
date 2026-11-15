// The operations prediction on the five real landings: the battery carries a lander past sunset, but not by days.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGlobalAtlas } from './engine'
import { replay, type Landing } from './history'

const root = new URL('../public/data/', import.meta.url)
const read = (f: string) => { const b = readFileSync(new URL(f, root)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
const atlas = parseGlobalAtlas(read('global_atlas.bin'))
const landings = (JSON.parse(readFileSync(new URL('history.json', root), 'utf-8')) as { landings: Landing[] }).landings

describe('predicted end of operations', () => {
  const rows = landings.map((l) => replay(atlas, l))
  it('prints model vs real', () => {
    for (const r of rows) console.log(`${r.l.name}: sun sets ${r.litDays.toFixed(1)} d, operations end ${r.opsDays?.toFixed(1) ?? '-'} d, really ended ${r.realDays.toFixed(1)} d`)
  })
  it('operations end after sunset, within a day of it', () => {
    for (const r of rows) {
      if (r.opsDays === null) continue
      expect(r.opsDays).toBeGreaterThanOrEqual(r.litDays - 0.05)
      expect(r.opsDays - r.litDays).toBeLessThan(1)
    }
  })
  it('the upright landers end where the real ones did (within a day)', () => {
    for (const name of ['Chandrayaan-3', 'Blue Ghost 1']) {
      const r = rows.find((x) => x.l.name === name)!
      expect(r.opsDays).not.toBeNull()
      expect(Math.abs(r.opsDays! - r.realDays)).toBeLessThan(1)
    }
  })
})
