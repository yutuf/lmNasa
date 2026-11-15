import { afterEach, describe, expect, it, vi } from 'vitest'
import { latLonAt, localDem, planeScale, setDriveFrame } from './localDem'
import { heightAt, R_M } from './terrain'

const RAD = Math.PI / 180
const point = (lat: number, lon: number) => {
  const r = 2 * R_M * Math.tan((90 + lat) * RAD / 2)
  return [r * Math.sin(lon * RAD), r * Math.cos(lon * RAD)]
}
const distance = (a: number[], b: number[]) => {
  const h = Math.sin((b[0] - a[0]) * RAD / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin((b[1] - a[1]) * RAD / 2) ** 2
  return 2 * R_M * Math.asin(Math.sqrt(h))
}
afterEach(() => { setDriveFrame(null); vi.unstubAllGlobals() })

describe('drive terrain frame', () => {
  it('uses the south-polar stereographic scale in plane metres per true metre', () => {
    expect(planeScale(-90)).toBe(1)
    expect(planeScale(0)).toBeCloseTo(2)
    expect(planeScale(60)).toBeCloseTo(14.92820323)
    expect(planeScale(85)).toBeGreaterThan(500)
  })
  it.each([-89, 0, 45, 85])('keeps 200 m steps in both axes at latitude %s', (lat) => {
    const [xs, ys] = point(lat, 37)
    setDriveFrame({ xs, ys, k: planeScale(lat) })
    const center = latLonAt(xs, ys)
    expect(center[0]).toBeCloseTo(lat, 8)
    expect(center[1]).toBeCloseTo(37, 8)
    expect(distance(center, latLonAt(xs + 200, ys))).toBeCloseTo(200, 0)
    expect(distance(center, latLonAt(xs, ys + 200))).toBeCloseTo(200, 0)
  })
  it('restores unscaled polar coordinates on exit', () => {
    const [xs, ys] = point(0, 0)
    setDriveFrame({ xs, ys, k: 2 })
    setDriveFrame(null)
    expect(distance(latLonAt(xs, ys), latLonAt(xs + 200, ys))).toBeCloseTo(100, 0)
  })
})

describe('localDem', () => {
  it('builds a finite, reproducible 160 km grid with measurable relief around a northern site', async () => {
    const buf = new ArrayBuffer(10 + 180 * 360 * 2), v = new DataView(buf)
    v.setUint16(0, 1, true); v.setUint16(2, 180, true); v.setUint16(4, 360, true); v.setFloat32(6, 1, true)
    const heights = new Int16Array(buf, 10)
    for (let r = 0; r < 180; r++) for (let c = 0; c < 360; c++) heights[r * 360 + c] = r * 20 + c
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => buf })))
    const [xs, ys] = point(45, 20)
    const { dem, k } = await localDem(xs, ys)
    expect(k).toBeCloseTo(planeScale(45))
    expect(dem.rows).toBe(801); expect(dem.cols).toBe(801)
    expect(dem.mPerPx).toBe(200); expect(dem.h.length).toBe(801 * 801)
    setDriveFrame({ xs, ys, k })
    const samples = [-79000, -200, 0, 200, 79000].flatMap(dx => [-79000, 0, 79000].map(dy => heightAt(dem, xs + dx, ys + dy)))
    expect(samples.every(Number.isFinite)).toBe(true)
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(10)
    expect(distance(latLonAt(xs, ys), latLonAt(xs + dem.mPerPx, ys))).toBeCloseTo(200, 0)
    const again = await localDem(xs, ys)
    expect(again.dem.h).toEqual(dem.h)
  }, 20000)
})
