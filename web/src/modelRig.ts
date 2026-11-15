import * as THREE from 'three'

export interface RoverMotion { travel: number; heading: number; wheelSteer: number; wheelYaw?: number }
export interface Wheel { pivot: THREE.Group; spin: THREE.Group; radius: number; x: number; z: number }

function compact(geometry: THREE.BufferGeometry, indices: readonly number[]) {
  const remap = new Int32Array(geometry.getAttribute('position').count).fill(-1)
  const used: number[] = [], mapped = new Uint32Array(indices.length)
  for (let i = 0; i < indices.length; i++) {
    const old = indices[i]
    if (remap[old] < 0) { remap[old] = used.length; used.push(old) }
    mapped[i] = remap[old]
  }
  const out = new THREE.BufferGeometry()
  for (const key of Object.keys(geometry.attributes)) {
    const old = geometry.getAttribute(key) as THREE.BufferAttribute
    const values = old.array.slice(0, used.length * old.itemSize)
    for (let i = 0; i < used.length; i++) for (let j = 0; j < old.itemSize; j++) values[i * old.itemSize + j] = old.array[used[i] * old.itemSize + j]
    out.setAttribute(key, new THREE.BufferAttribute(values, old.itemSize, old.normalized))
  }
  out.setIndex(new THREE.BufferAttribute(mapped, 1))
  return out
}

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
  const box = new THREE.Box3().setFromObject(root, true), size = box.getSize(new THREE.Vector3())
  const length = size.x
  // Surveyed against the checked-in GLBs. Fractions of the normalised vehicle length, forward +X.
  const spec = file === 'lrv.glb' ? { xs: [-.364, .271], y: .123, r: .123, zs: [.251, .251], width: .048 }
    : file === 'pragyan.glb' ? { xs: [-.403, .0151, .4033], y: .0963, r: .0963, zs: [.395, .395, .395], width: .055 }
    : file === 'yutu.glb' ? { xs: [-.4095, -.1276, .2375], y: .09048, r: .09049, zs: [.214, .214, .214], width: .038 }
    : { xs: [-.3162, .0297, .4109], y: .0845, r: .08455, zs: [.342, .381, .342], width: .045 }
  for (let axle = 0; axle < spec.xs.length; axle++) for (const side of [-1, 1]) {
    const pivot = new THREE.Group(), spin = new THREE.Group()
    pivot.name = `wheel-pivot-${wheels.length}`; spin.name = 'wheel-spin'
    pivot.position.set(spec.xs[axle] * length, spec.y * length, side * spec.zs[axle] * length)
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
    const materialIds = Array.from({ length: wheels.length + 1 }, () => [] as number[])
    const count = idx ? idx.count : pos.count
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2
      p.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3)
      let bucket = 0
      for (let w = 0; w < wheels.length; w++) {
        const wheel = wheels[w], centre = wheel.pivot.position
        if (Math.abs(p.z - centre.z) > spec.width * length || Math.hypot(p.x - centre.x, p.y - centre.y) > wheel.radius * 1.03) continue
        // Test all vertices: a large suspension/fender triangle can have its centroid inside a wheel.
        let inside = true
        for (const v of [a, b, c]) {
          if (Math.abs(pos.getZ(v) - centre.z) > spec.width * length || Math.hypot(pos.getX(v) - centre.x, pos.getY(v) - centre.y) > wheel.radius * 1.03) { inside = false; break }
        }
        if (inside) { bucket = w + 1; break }
      }
      buckets[bucket].push(a, b, c)
      let material = 0
      for (const group of geometry.groups) if (i >= group.start && i < group.start + group.count) { material = group.materialIndex ?? 0; break }
      materialIds[bucket].push(material)
    }
    // Keep material groups when splitting a multi-material primitive.
    for (let i = 0; i < buckets.length; i++) {
      if (!buckets[i].length) continue
      const part = compact(geometry, buckets[i])
      if (Array.isArray(source.material)) {
        let start = 0
        const ids = materialIds[i]
        for (let t = 1; t <= ids.length; t++) if (t === ids.length || ids[t] !== ids[start]) { part.addGroup(start * 3, (t - start) * 3, ids[start]); start = t }
      }
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
    w.spin.rotation.z = -(motion.travel + (motion.wheelYaw ?? motion.heading) * w.z) / w.radius
    w.pivot.rotation.y = w.x > 0 ? motion.wheelSteer : w.x < -.1 ? -motion.wheelSteer : 0
  }
}
