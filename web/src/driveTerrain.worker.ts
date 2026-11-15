import { setDriveFrame, type DriveFrame } from './localDem'
import { makeGround, type Dem, type Patch } from './terrain'
import { buildSurfaceMesh, type MeshSpec } from './surfaceMesh'

self.onmessage = (e: MessageEvent<{ frame: DriveFrame; dem: Dem; patches: Patch[]; near: MeshSpec; far: MeshSpec }>) => {
  setDriveFrame(e.data.frame)
  const ground = makeGround(e.data.dem, e.data.patches)
  const near = buildSurfaceMesh(ground.height, e.data.near), far = buildSurfaceMesh(ground.height, e.data.far)
  const buffers = [near, far].flatMap(g => [g.position.buffer, g.normal.buffer, g.uv.buffer, g.color.buffer, g.sunlit.buffer, g.index.buffer])
  self.postMessage({ near, far }, { transfer: buffers as ArrayBuffer[] })
  if (e.data.near.half > 1200) {
    const nearSpec = { ...e.data.near, half: 1200, step: 10, sub: 8, reach: 60000 }
    const farSpec = { ...e.data.far, hole: { cx: nearSpec.cx, cy: nearSpec.cy, half: 1200 } }
    const roverNear = buildSurfaceMesh(ground.height, nearSpec), roverFar = buildSurfaceMesh(ground.height, farSpec)
    const transferred = [roverNear, roverFar].flatMap(g => [g.position.buffer, g.normal.buffer, g.uv.buffer, g.color.buffer, g.sunlit.buffer, g.index.buffer])
    self.postMessage({ roverNear, roverFar }, { transfer: transferred as ArrayBuffer[] })
  }
}
