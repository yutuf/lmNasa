import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dataUrl } from '../data'
import { surfacePoint, toThree } from '../geometry'
import { NasaModel } from './Models'
import { flightPath, type Approach } from '../flight'

export interface PoleCapInfo { albedo: string; normal: string; r_max_m: number; edge_lat: number }
export interface Overlay { texture: THREE.Texture; rMaxM: number; edgeLat: number; sphere?: boolean }
export interface Target { id: string; name: string; lat: number; lon: number; colour: string; selected: boolean }
export interface Pin { lat: number; lon: number; label: string; good: boolean }

interface Props {
  poleCap?: PoleCapInfo
  overlay?: Overlay | null
  pins: Pin[]
  selected: { lat: number; lon: number; label: string } | null
  sunDir: number[]      // Moon-fixed unit vector toward the Sun
  earthDir: number[]    // Moon-fixed unit vector toward Earth
  earthLabel: string
  onPick?: (k: number) => void
  flight?: { lat: number; lon: number; approach: Approach; labels: [string, string, string, string]; view: FlightView; start?: number } | null
  targets?: Target[]
  onTarget?: (id: string) => void
  labels?: boolean        // floating HTML labels (off in the film)
}

function Moon() {
  const [albedo, normal] = useTexture([dataUrl('moon_albedo.jpg'), dataUrl('moon_normal.jpg')])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  return (
    <mesh>
      <sphereGeometry args={[1, 192, 96]} />
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1.2, 1.2)}
                            roughness={1} metalness={0} />
    </mesh>
  )
}

/** A spherical cap from the south pole to `edgeLat`, textured in the south-polar stereographic plane. */
function capGeometry(edgeLat: number, rMaxM: number, radius: number) {
  const nLat = 64
  const nLon = 256
  const R = 1737400
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= nLat; i++) {
    const lat = -90 + (i / nLat) * (edgeLat + 90)
    for (let j = 0; j <= nLon; j++) {
      const lon = -180 + (j / nLon) * 360
      const v = surfacePoint(lat, lon, radius)
      pos.push(v.x, v.y, v.z)
      const r = 2 * R * Math.tan(((90 + lat) * Math.PI) / 360)
      uv.push(0.5 + (r * Math.sin((lon * Math.PI) / 180)) / (2 * rMaxM), 0.5 + (r * Math.cos((lon * Math.PI) / 180)) / (2 * rMaxM))
    }
  }
  const idx: number[] = []
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const a = i * (nLon + 1) + j
      idx.push(a, a + 1, a + nLon + 1, a + 1, a + nLon + 2, a + nLon + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function PoleCap({ cap }: { cap: PoleCapInfo }) {
  const [albedo, normal] = useTexture([dataUrl(cap.albedo), dataUrl(cap.normal)])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  const geometry = useMemo(() => capGeometry(cap.edge_lat, cap.r_max_m, 1.0006), [cap])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial map={albedo} normalMap={normal} roughness={1} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

function OverlayCap({ overlay }: { overlay: Overlay }) {
  if (overlay.sphere) return (
    <mesh><sphereGeometry args={[1.0014, 192, 96]} /><meshBasicMaterial map={overlay.texture} transparent depthWrite={false} /></mesh>
  )
  return <CapMesh overlay={overlay} />
}

function CapMesh({ overlay }: { overlay: Overlay }) {
  const geometry = useMemo(() => capGeometry(overlay.edgeLat, overlay.rMaxM, 1.0014), [overlay])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={overlay.texture} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function CameraFlight({ target, wide }: { target: THREE.Vector3 | null; wide: { earth: THREE.Vector3; normal: THREE.Vector3 } | null }) {
  const { camera } = useThree()
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => {
    if (wide) {
      // the whole Earth-Moon route: look at the middle of it from the side
      // look down onto the orbit plane (so the polar orbit is a ring, not a line), a little tilted, framing Earth too
      const mid = wide.earth.clone().multiplyScalar(0.42)
      const toward = wide.normal.clone().multiplyScalar(Math.sign(wide.normal.dot(new THREE.Vector3(0.3, 0.5, 1))) || 1)
      goal.current = { pos: mid.clone().add(toward.multiplyScalar(6.2)).add(new THREE.Vector3(0, -1.6, 0)), look: mid }
      return
    }
    if (!target) return
    // fly to a point above the chosen spot, slightly to the side, and look at the spot itself
    const up = target.clone().normalize()
    const side = new THREE.Vector3(0, 0, 1).cross(up).normalize()
    goal.current = { pos: up.clone().multiplyScalar(1.3).add(side.multiplyScalar(0.22)), look: up.clone().multiplyScalar(0.99) }
  }, [target, wide, controls])
  useFrame(() => {
    if (!goal.current) return
    camera.position.lerp(goal.current.pos, 0.06)
    if (controls) {
      controls.target.lerp(goal.current.look, 0.06)
      controls.update()
    }
    if (camera.position.distanceTo(goal.current.pos) < 0.003) goal.current = null
  })
  return null
}

/** NASA's Lunar Reconnaissance Orbiter in a polar orbit (size and altitude not to scale). */
function Orbiter() {
  const g = useRef<THREE.Group>(null)
  const ring = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, k) => {
      const a = (k / 128) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * 1.16 * Math.cos(0.5), Math.sin(a) * 1.16, Math.cos(a) * 1.16 * Math.sin(0.5))
    })
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#a1a1aa', transparent: true, opacity: 0.25 }))
  }, [])
  useFrame(({ clock }) => {
    if (!g.current) return
    const a = clock.elapsedTime * 0.12
    const p = new THREE.Vector3(Math.cos(a) * 1.16 * Math.cos(0.5), Math.sin(a) * 1.16, Math.cos(a) * 1.16 * Math.sin(0.5))
    const v = new THREE.Vector3(-Math.sin(a) * Math.cos(0.5), Math.cos(a), -Math.sin(a) * Math.sin(0.5))
    g.current.position.copy(p)
    g.current.lookAt(p.clone().add(v))
  })
  return (
    <>
      <primitive object={ring} />
      <group ref={g}>
        <Suspense fallback={null}><NasaModel file="lro.glb" size={0.06} shadows={false} /></Suspense>
        <Html center className="tag" style={{ transform: 'translateY(-18px)' }}>LRO</Html>
      </group>
    </>
  )
}

/** A radial-gradient sprite texture (for glows). */
function glowTexture(stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  for (const [o, col] of stops) g.addColorStop(o, col)
  x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

/** The Sun where the ephemeris puts it: a bright core and a wide warm glow (far away, not to scale). */
function SunGlow({ dir }: { dir: THREE.Vector3 }) {
  const [core, halo] = useMemo(() => [
    glowTexture([[0, 'rgba(255,255,245,1)'], [0.18, 'rgba(255,240,200,0.95)'], [0.4, 'rgba(255,200,90,0.35)'], [1, 'rgba(255,160,40,0)']]),
    glowTexture([[0, 'rgba(255,190,90,0.35)'], [0.5, 'rgba(255,140,60,0.08)'], [1, 'rgba(0,0,0,0)']]),
  ], [])
  const pos = dir.clone().multiplyScalar(40)
  return (
    <group position={pos}>
      <sprite scale={[7, 7, 1]}><spriteMaterial map={core} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[22, 22, 1]}><spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
    </group>
  )
}

/** Earth's thin blue atmosphere: a slightly larger back-facing sphere, brightest at the limb. */
function Atmosphere({ radius }: { radius: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(max(0.0, 0.75 - abs(dot(vN, vV))) / 0.75, 3.0); gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * f * 0.9; }',
  }), [])
  return <mesh scale={radius * 1.07} material={mat}><sphereGeometry args={[1, 48, 24]} /></mesh>
}

function EarthBall() {
  const map = useTexture(`${import.meta.env.BASE_URL}data/earth.jpg`)
  map.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh rotation={[0.41, 0, 0]}>
      <sphereGeometry args={[0.28, 64, 32]} />
      <meshStandardMaterial map={map} roughness={0.75} emissive="#0b1e3d" emissiveIntensity={0.35} />
      <Atmosphere radius={0.28} />
    </mesh>
  )
}

export type FlightView = 'overview' | 'chase' | 'pilot' | 'site'

/** The spacecraft's route: trans-lunar coast, polar orbit over the site, powered descent; a craft flies it in a loop.
 *  In the follow views the camera rides along (chase, pilot) or watches from the landing site, the descent gets a
 *  bigger share of the loop so it can be followed, and a HUD element (#flight-hud) shows phase, altitude and time. */
function Flight({ lat, lon, approach, earthDir, labels, view, start = 0, showLabel = true }: { lat: number; lon: number; approach: Approach; earthDir: THREE.Vector3; labels: [string, string, string, string]; view: FlightView; start?: number; showLabel?: boolean }) {
  const f = useMemo(() => flightPath(lat, lon, earthDir, approach),
    [lat, lon, earthDir.x, earthDir.y, earthDir.z, approach.headingDeg])  // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => {
    const mk = (pts: THREE.Vector3[], color: string, opacity: number, dashed = false) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      const l = new THREE.Line(g, mat)
      if (dashed) l.computeLineDistances()
      return l
    }
    return [mk(f.transfer, '#60a5fa', 0.85, true), mk(f.orbit, '#a1a1aa', 0.22), mk(f.parking, '#e4e4e7', 0.7), mk(f.descent, '#fb923c', 1)]
  }, [f])
  const craft = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const { camera } = useThree()
  const t0 = useRef<number | null>(null)
  const follow = view !== 'overview'
  useEffect(() => {
    t0.current = null                                  // restart the loop when the view changes
    const cam = camera as THREE.PerspectiveCamera
    cam.near = follow ? 0.0002 : 0.01                  // the follow views come within a few km of the ground
    cam.updateProjectionMatrix()
    if (!follow) cam.up.set(0, 1, 0)
    return () => { cam.near = 0.01; cam.up.set(0, 1, 0); cam.updateProjectionMatrix() }
  }, [follow, view, camera])
  const site = useMemo(() => surfacePoint(lat, lon, 1.004), [lat, lon])
  const tmp = useMemo(() => ({ fwd: new THREE.Vector3(), up: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3(), q: new THREE.Quaternion(),
    camLook: new THREE.Vector3(), camUp: new THREE.Vector3(0, 1, 0), started: false }), [])
  // smooth curves through each phase, sampled by distance (constant speed within a phase, no corners)
  const curves = useMemo(() => [f.transfer, f.parking, f.descent].map((pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal')), [f])
  const plume = useRef<THREE.Sprite>(null)
  const plumeTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,160,60,0.6)'); g.addColorStop(1, 'rgba(255,120,40,0)')
    x.fillStyle = g; x.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
  useFrame(({ clock }, dtRaw) => {
    if (!craft.current) return
    const dt = Math.min(dtRaw, 0.1)
    if (t0.current === null) { t0.current = clock.elapsedTime; tmp.started = false }
    // share of the loop per phase (the rest: landed); the follow views spend longer on the orbit and the descent
    const T = view === 'overview' ? 16 : view === 'site' ? 22 : 32
    const w = view === 'overview' ? [0.42, 0.28, 0.22] : view === 'site' ? [0.12, 0.2, 0.58] : [0.22, 0.3, 0.4]
    const u = ((((clock.elapsedTime - t0.current) % T) / T) + start) % 1   // start: where in the loop to begin (film scenes)
    let phase: number, s: number
    if (u < w[0]) { phase = 0; s = u / w[0] }
    else if (u < w[0] + w[1]) { phase = 1; s = (u - w[0]) / w[1] }
    else if (u < w[0] + w[1] + w[2]) { phase = 2; s = (u - w[0] - w[1]) / w[2] }
    else { phase = 3; s = 1 }
    // the descent brakes: fast at the top, slow into touchdown; the coast eases in and out
    const e = phase === 2 ? 1 - (1 - s) ** 2.2 : phase === 0 ? s * s * (3 - 2 * s) : s
    const cv = curves[Math.min(2, phase)]
    const p = cv.getPointAt(Math.min(1, e))
    const { fwd, up, pos, look, q } = tmp
    fwd.copy(cv.getTangentAt(Math.min(0.999, e))).normalize()
    up.copy(p).normalize()
    craft.current.position.copy(p)
    // the lander model stands on its legs: +y along the local vertical
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
    craft.current.quaternion.copy(q)
    if (label.current) label.current.textContent = view === 'pilot' ? '' : labels[Math.min(2, phase)]
    if (plume.current) {
      // engine glow under the lander while it brakes, flickering a little
      const on = phase === 2 && s < 0.995
      plume.current.visible = on
      const sz = (follow ? 0.004 : 0.02) * (0.8 + 0.3 * Math.random())
      plume.current.scale.set(sz, sz, 1)
      plume.current.position.copy(up).multiplyScalar(-(follow ? 0.0012 : 0.006))
    }

    // HUD: phase, altitude (orbit 100 km, the drawing is lifted for visibility) and time to touchdown
    const hud = document.getElementById('flight-hud')
    if (hud) {
      const altKm = phase === 0 ? null : Math.max(0, ((p.length() - 1.004) / (1.09 - 1.004)) * 100)
      hud.dataset.phase = phase === 3 ? 'landed' : String(phase)
      hud.textContent = phase === 3 ? labels[3]
        : phase === 0 ? `${labels[0]} · ${(e * 4.5).toFixed(1)} / ~4.5 d`
        : phase === 1 ? `${labels[1]} · ${altKm!.toFixed(0)} km`
        : `${labels[2]} · ${altKm! < 1 ? `${Math.round(altKm! * 1000)} m` : `${altKm!.toFixed(1)} km`} · T−${((1 - s) * 12).toFixed(1)} min`
    }

    if (!follow) return
    if (view === 'chase') {
      pos.copy(p).addScaledVector(fwd, -0.05).addScaledVector(up, phase === 2 ? 0.012 : 0.025)
      look.copy(p).addScaledVector(fwd, 0.04)
    } else if (view === 'pilot') {
      // from the cockpit: ahead along the track, tipping down toward the ground as the descent goes on
      const down = phase >= 2 ? 0.25 + 0.75 * Math.min(1, s) : phase === 1 ? 0.15 : 0
      pos.copy(p).addScaledVector(up, 0.0004)
      look.copy(p).addScaledVector(fwd, 0.1 * (1 - down)).addScaledVector(up, -0.1 * down)
    } else {
      // standing near the landing site, a little to the side, looking up at the craft
      const side = new THREE.Vector3().crossVectors(up, fwd).normalize()
      pos.copy(site).addScaledVector(site.clone().normalize(), 0.004).addScaledVector(side, 0.02).addScaledVector(fwd, 0.02)
      look.copy(p)
    }
    // frame-rate independent smoothing for position, aim and roll (no snapping between path segments)
    const a = (rate: number) => 1 - Math.exp(-dt * rate)
    if (!tmp.started) { camera.position.copy(pos); tmp.camLook.copy(look); tmp.camUp.copy(up); tmp.started = true }
    camera.position.lerp(pos, a(view === 'pilot' ? 14 : 5))
    tmp.camLook.lerp(look, a(view === 'pilot' ? 10 : 6))
    tmp.camUp.lerp(up, a(4)).normalize()
    camera.up.copy(tmp.camUp)
    camera.lookAt(tmp.camLook)
  })
  return (
    <>
      {lines.map((l, k) => <primitive key={k} object={l} />)}
      <group ref={craft}>
        {view === 'pilot' ? null : follow
          ? <Suspense fallback={<mesh><sphereGeometry args={[0.002, 12, 12]} /><meshBasicMaterial color="#fde68a" /></mesh>}>
              <NasaModel file="lander.glb" size={view === 'site' ? 0.004 : 0.003} shadows={false} />
            </Suspense>
          : <mesh><sphereGeometry args={[0.012, 12, 12]} /><meshBasicMaterial color="#fde68a" /></mesh>}
        {showLabel && <Html center className="tag tag-craft"><div ref={label} /></Html>}
        <sprite ref={plume} visible={false}><spriteMaterial map={plumeTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      </group>
    </>
  )
}

export default function Globe({ poleCap, overlay, pins, selected, sunDir, earthDir, earthLabel, onPick, flight, targets, onTarget, labels = true }: Props) {
  const closeUp = !!flight && flight.view !== 'overview'
  const sun = useMemo(() => toThree(sunDir).normalize(), [sunDir])
  const earth = useMemo(() => toThree(earthDir).normalize(), [earthDir])
  const target = useMemo(() => (selected ? surfacePoint(selected.lat, selected.lon, 1) : surfacePoint(-89.9, 0, 1)),
    [selected])
  const flat = flight?.lat, flon = flight?.lon
  const wide = useMemo(() => {
    if (flat === undefined || flon === undefined) return null
    const n = new THREE.Vector3().crossVectors(surfacePoint(-90, 0, 1), surfacePoint(flat, flon, 1)).normalize()
    return { earth: earth.clone().multiplyScalar(5.2), normal: n }
  }, [flat, flon, earth.x, earth.y, earth.z])  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Canvas camera={{ position: [0.6, -3.6, 2.2], fov: 36, near: 0.01, far: 200 }} dpr={[1, 2]}>
      <color attach="background" args={['#000000']} />
      <Stars radius={60} depth={30} count={5000} factor={3.2} saturation={0.7} fade speed={0.3} />
      <SunGlow dir={sun} />
      <ambientLight intensity={0.05} />
      <hemisphereLight args={['#6d7cff', '#000000', 0.12]} />
      <directionalLight position={sun.clone().multiplyScalar(20)} intensity={3.2} color="#fff6e8" />
      <Moon />
      {poleCap && <PoleCap cap={poleCap} />}
      {overlay && !closeUp && <OverlayCap overlay={overlay} />}
      <group position={earth.clone().multiplyScalar(5.2)}>
        <Suspense fallback={null}><EarthBall /></Suspense>
        {labels && <Html center className="tag tag-earth">{earthLabel}</Html>}
      </group>
      {!closeUp && targets?.map((t) => (
        <group key={t.id} position={surfacePoint(t.lat, t.lon, 1.004)}>
          <mesh onClick={(e) => { e.stopPropagation(); onTarget?.(t.id) }}>
            <octahedronGeometry args={[t.selected ? 0.016 : 0.01, 0]} />
            <meshBasicMaterial color={t.colour} />
          </mesh>
          <Html center className={`sci-tag ${t.selected ? 'on' : ''}`} style={{ ['--k' as string]: t.colour }}>
            <span onClick={() => onTarget?.(t.id)}>{t.name}</span>
          </Html>
        </group>
      ))}
      {!closeUp && pins.map((p, k) => (
        <group key={k} position={surfacePoint(p.lat, p.lon, 1.003)}>
          <mesh onClick={(e) => { e.stopPropagation(); onPick?.(k) }}>
            <sphereGeometry args={[0.009, 12, 12]} />
            <meshBasicMaterial color={p.good ? '#4ade80' : '#ff6b6b'} />
          </mesh>
          <Html center className={`pin-num ${p.good ? 'good' : 'bad'}`}>
            <span onClick={() => onPick?.(k)}>{p.label}</span>
          </Html>
        </group>
      ))}
      {selected && !closeUp && (
        <group position={surfacePoint(selected.lat, selected.lon, 1.004)}>
          <mesh>
            <sphereGeometry args={[0.014, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html center className="tag tag-spot">{selected.label}</Html>
        </group>
      )}
      {flight ? <Flight {...flight} earthDir={earth} showLabel={labels} /> : <Orbiter />}
      <OrbitControls makeDefault enabled={!flight || flight.view === 'overview'} enablePan={false} minDistance={1.06} maxDistance={flight ? 16 : 8} rotateSpeed={0.5} zoomSpeed={0.6} />
      {(!flight || flight.view === 'overview') && <CameraFlight target={target} wide={wide} />}
    </Canvas>
  )
}
