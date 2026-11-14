import * as THREE from 'three'

export interface RoverMotion { travel: number; heading: number; wheelSteer: number }
export interface Wheel { pivot: THREE.Group; spin: THREE.Group; radius: number; x: number; z: number }

// Pragyan's source combines a decorative starfield and the rover in one mesh. Those tiny disconnected
// triangles corrupt its bounding box and make the wheels float. Filter once, retaining the vehicle parts.
const cleaned = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
export function cleanPragyan(geometry: THREE.BufferGeometry) {
  const cached = cleaned.get(geometry)
  if (cached) return cached
  const pos = geometry.getAttribute('position'), idx = geometry.index
  const parent = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i++) parent[i] = i
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const join = (a: number, b: number) => { parent[find(a)] = find(b) }
  const vertices = new Map<string, number>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`
    const other = vertices.get(key)
    if (other !== undefined) join(i, other)
    else vertices.set(key, i)
  }
  const count = idx ? idx.count : pos.count
  const at = (i: number) => idx ? idx.getX(i) : i
  for (let i = 0; i < count; i += 3) { join(at(i), at(i + 1)); join(at(i), at(i + 2)) }
  const boxes = new Map<number, THREE.Box3>(), v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const key = find(i)
    let box = boxes.get(key)
    if (!box) { box = new THREE.Box3(); boxes.set(key, box) }
    box.expandByPoint(v.fromBufferAttribute(pos, i))
  }
  const keep = new Set<number>()
  boxes.forEach((box, key) => { box.getSize(v); if (Math.max(v.x, v.y, v.z) > .012) keep.add(key) })
  const indices: number[] = []
  for (let i = 0; i < count; i += 3) if (keep.has(find(at(i)))) indices.push(at(i), at(i + 1), at(i + 2))
  const out = geometry.clone()
  out.setIndex(indices)
  // computeBoundingBox sees unused vertices too: compact before fitting the physical model.
  const compact = out.toNonIndexed()
  out.dispose()
  compact.computeBoundingBox(); compact.computeBoundingSphere()
  cleaned.set(geometry, compact)
  return compact
}

/** Split fused wheels into pivots once. Existing GLB textures/triangles are retained; no replacement toy wheels. */
export function rigWheels(root: THREE.Group, file: string, wheels: Wheel[]) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3())
  const length = size.x
  // Surveyed against the checked-in GLBs. Fractions of the normalised vehicle length, forward +X.
  const spec = file === 'lrv.glb' ? { xs: [-.365, .28], y: .12, r: .121, z: .255, width: .075 }
    : file === 'pragyan.glb' ? { xs: [-.39, .015, .39], y: .104, r: .104, z: .32, width: .09 }
    : file === 'yutu.glb' ? { xs: [-.275, -.02, .26], y: .083, r: .083, z: .29, width: .09 }
    : { xs: [-.315, .03, .405], y: .084, r: .084, z: .39, width: .07 }
  for (const x of spec.xs) for (const side of [-1, 1]) {
    const pivot = new THREE.Group(), spin = new THREE.Group()
    pivot.name = `wheel-pivot-${wheels.length}`; spin.name = 'wheel-spin'
    pivot.position.set(x * length, spec.y * length, side * spec.z * length)
    pivot.add(spin)
    wheels.push({ pivot, spin, x: pivot.position.x, z: pivot.position.z, radius: spec.r * length })
    spin.userData.radius = spec.r * length
  }
  const flat = new THREE.Group(), meshes: THREE.Mesh[] = []
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  const p = new THREE.Vector3()
  for (const source of meshes) {
    const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld)
    const pos = geometry.getAttribute('position'), idx = geometry.index
    const buckets = Array.from({ length: wheels.length + 1 }, () => [] as number[])
    const count = idx ? idx.count : pos.count
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2
      p.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3)
      let bucket = 0
      for (let w = 0; w < wheels.length; w++) {
        const wheel = wheels[w], centre = wheel.pivot.position
        if (Math.abs(p.z - centre.z) < spec.width * length && Math.hypot(p.x - centre.x, p.y - centre.y) <= wheel.radius * 1.08) { bucket = w + 1; break }
      }
      buckets[bucket].push(a, b, c)
    }
    // Keep material groups when splitting a multi-material primitive.
    for (let i = 0; i < buckets.length; i++) {
      if (!buckets[i].length) continue
      const indexed = geometry.clone().setIndex(buckets[i])
      indexed.clearGroups()
      if (Array.isArray(source.material) && geometry.groups.length) {
        // GLTFLoader normally provides one mesh per primitive. Preserve the unusual multi-material case.
        indexed.addGroup(0, buckets[i].length, 0)
      }
      const part = indexed.toNonIndexed()
      indexed.dispose()
      if (i > 0) part.translate(-wheels[i - 1].pivot.position.x, -wheels[i - 1].pivot.position.y, -wheels[i - 1].pivot.position.z)
      part.computeBoundingBox(); part.computeBoundingSphere()
      const mesh = new THREE.Mesh(part, source.material)
      mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow
      if (i) wheels[i - 1].spin.add(mesh)
      else flat.add(mesh)
    }
    geometry.dispose()
  }
  wheels.forEach(w => flat.add(w.pivot))
  return flat
}

export function rollWheels(wheels: readonly Wheel[], motion: RoverMotion) {
  for (const w of wheels) {
    w.spin.rotation.z = -(motion.travel + motion.heading * w.z) / w.radius
    w.pivot.rotation.y = w.x > 0 ? motion.wheelSteer : w.x < -.1 ? -motion.wheelSteer : 0
  }
}
