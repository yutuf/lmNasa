// Schematic route, with the same nominal descent time/altitude/range as the film HUD.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { surfacePoint } from '../geometry'
import { flightPath, type Approach } from '../flight'
import { ease, orbitalDescent, UP } from '../motion3d'
import { sceneProgress, useMissionPlayback } from '../missionPlayback'
import { NasaModel } from './Models'
import { landerFile } from './VehicleModels'
import type { Lang } from '../i18n'

const SURFACE = 1.00062
type View = 'overview' | 'chase' | 'pilot' | 'site'
export default function RouteFlight({ lat, lon, approach, earthDir, labels, view, start = 0, showLabel = true, lang = 'en' }: {
  lat: number; lon: number; approach: Approach; earthDir: THREE.Vector3; labels: [string, string, string, string]; view: View; start?: number; showLabel?: boolean; lang?: Lang
}) {
  const playback = useMissionPlayback()
  const cameraView = playback ? 'chase' : view
  const follow = view !== 'overview'
  const { camera, size } = useThree()
  const craft = useRef<THREE.Group>(null), plume = useRef<THREE.Mesh>(null), veil = useRef<THREE.Sprite>(null)
  const label = useRef<HTMLDivElement>(null), t0 = useRef<number | null>(null)
  const route = useMemo(() => {
    const u = surfacePoint(lat, lon, 1)
    const n = new THREE.Vector3().crossVectors(surfacePoint(-90, 0, 1), u)
    if (n.lengthSq() < 1e-8) n.set(1, 0, 0)
    n.normalize()
    const tangent = new THREE.Vector3().crossVectors(n, u).normalize()
    const dir = approach.headingDeg === 0 ? 1 : -1
    const profile = { altKm: 0, rangeKm: 0, velKms: 0, ttlS: 0, kind: 'profile' as const }
    const descent = (t: number, out: THREE.Vector3, handoff = false) => {
      orbitalDescent(t, handoff, profile)
      const phi = -dir * 16 * Math.PI / 180 * profile.rangeKm / 480
      return out.copy(u).multiplyScalar(Math.cos(phi)).addScaledVector(tangent, Math.sin(phi)).multiplyScalar(SURFACE + profile.altKm / 1737.4)
    }
    const f = flightPath(lat, lon, earthDir, approach, SURFACE + 100 / 1737.4)
    f.descent = Array.from({ length: 201 }, (_, i) => descent(i / 200, new THREE.Vector3()))
    const curves = [f.transfer, f.parking].map(pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal'))
    const mk = (pts: THREE.Vector3[], color: string, opacity: number) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
    const lines = [mk(f.transfer, '#7ca0bd', .6), mk(f.orbit, '#a1a1aa', .18), mk(f.parking, '#d4d8dd', .55), mk(f.descent, '#dba16c', .8)]
    return { descent, curves, lines, site: u.clone().multiplyScalar(SURFACE) }
  }, [lat, lon, earthDir, approach])
  useEffect(() => () => route.lines.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose() }), [route])
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), prev: new THREE.Vector3(), next: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(),
    thrust: new THREE.Vector3(), eye: new THREE.Vector3(), look: new THREE.Vector3(), side: new THREE.Vector3(), spare: new THREE.Vector3(),
    camLook: new THREE.Vector3(), camUp: new THREE.Vector3(), started: false }), [])
  useEffect(() => {
    t0.current = null; tmp.started = false
    const cam = camera as THREE.PerspectiveCamera
    cam.near = follow ? .0001 : .005
    cam.updateProjectionMatrix()
    return () => { cam.near = .01; cam.up.copy(UP); cam.updateProjectionMatrix() }
  }, [view, follow, camera, tmp])
  useFrame(({ clock }, rawDt) => {
    if (!craft.current) return
    const dt = Math.min(rawDt, .1)
    if (t0.current === null) t0.current = clock.elapsedTime
    const total = view === 'overview' ? 24 : view === 'site' ? 22 : 32
    const a = view === 'overview' ? .32 : view === 'site' ? .12 : .22
    const b = view === 'overview' ? .28 : view === 'site' ? .2 : .3
    const c = view === 'overview' ? .3 : view === 'site' ? .58 : .4
    const u = ((clock.elapsedTime - t0.current) / total + start) % 1
    let phase = u < a ? 0 : u < a + b ? 1 : u < a + b + c ? 2 : 3
    let s = phase === 0 ? u / a : phase === 1 ? (u - a) / b : phase === 2 ? (u - a - b) / c : 1
    if (playback) { phase = 2; s = sceneProgress(playback.current) }
    const { p, prev, next, fwd, up, thrust, eye, look, side, spare } = tmp
    const e = phase === 0 ? ease(s) : s
    if (phase >= 2) {
      const handoff = !!playback?.current.handoff
      route.descent(s, p, handoff); route.descent(Math.max(0, s - .0001), prev, handoff); route.descent(Math.min(1, s + .0001), next, handoff)
    } else {
      const curve = route.curves[phase]
      curve.getPointAt(e, p); curve.getPointAt(Math.max(0, e - .0001), prev); curve.getPointAt(Math.min(1, e + .0001), next)
    }
    fwd.subVectors(next, prev).normalize(); up.copy(p).normalize()
    craft.current.position.copy(p)
    thrust.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize().multiplyScalar(-1)
    const tilt = phase === 1 && s < .2 ? .95 * (1 - ease(s / .2)) : phase === 2 ? .95 * (1 - ease(s)) : 0
    thrust.multiplyScalar(Math.sin(tilt)).addScaledVector(up, Math.cos(tilt)).normalize()
    craft.current.quaternion.setFromUnitVectors(UP, thrust)
    if (label.current) label.current.textContent = labels[phase]
    if (plume.current) {
      const height = follow ? .003 : .012
      const len = height * 1.5 * Math.max(.08, Math.min(1, (p.length() - SURFACE) / (height * 3)))
      plume.current.visible = phase === 2 && (s < .999 || !!playback?.current.handoff) || phase === 1 && s < .18
      plume.current.scale.set(height * .2, len, height * .2)
      plume.current.position.set(0, height * .1 - len / 2, 0)
    }
    const hud = document.getElementById('flight-hud')
    if (hud) {
      const alt = Math.max(0, (p.length() - SURFACE) * 1737.4)
      hud.dataset.phase = phase === 3 ? 'landed' : String(phase)
      hud.textContent = phase === 3 ? labels[3] : phase === 0 ? `${labels[0]} · ${(e * 4.5).toFixed(1)} / ~4.5 ${lang === 'tr' ? 'g' : 'd'}`
        : phase === 1 ? `${labels[1]} · ${alt.toFixed(0)} km`
        : `${labels[2]} · ${alt < 1 ? `${Math.round(alt * 1000)} m` : `${alt.toFixed(1)} km`} · T−${(playback?.current.handoff ? 3 + (1 - s) * 9 : (1 - s) * 12).toFixed(1)} ${lang === 'tr' ? 'dk' : 'min'}`
    }
    if (follow) {
      if (cameraView === 'chase') {
        const distance = .018 / Math.max(.45, Math.min(1, size.width / size.height))
        spare.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize()
        eye.copy(p).addScaledVector(spare, -distance).addScaledVector(up, distance * .30)
        look.copy(p).addScaledVector(up, .0015)
      } else if (cameraView === 'pilot') {
        const down = phase >= 2 ? .2 + .8 * ease(s) : phase === 1 ? .1 : 0
        eye.copy(p).addScaledVector(up, .0005)
        look.copy(p).addScaledVector(fwd, .05 * (1 - down)).addScaledVector(up, -.05 * down)
      } else {
        side.crossVectors(up, fwd).normalize()
        eye.copy(route.site).addScaledVector(spare.copy(route.site).normalize(), .004).addScaledVector(side, .016)
        look.copy(p).addScaledVector(up, .001)
      }
      if (eye.length() < 1.0012) eye.setLength(1.0012)
      if (!tmp.started) { camera.position.copy(eye); tmp.camLook.copy(look); tmp.camUp.copy(up); tmp.started = true }
      const blend = playback?.current.paused ? 1 : 1 - Math.exp(-dt * (cameraView === 'pilot' ? 16 : 7))
      camera.position.lerp(eye, blend)
      if (camera.position.length() < 1.0012) camera.position.setLength(1.0012)
      tmp.camLook.lerp(look, blend); tmp.camUp.lerp(up, blend).normalize()
      camera.up.copy(tmp.camUp); camera.lookAt(tmp.camLook)
    }
    // A deliberate black cut covers the route loop's reset from the surface to Earth.
    if (veil.current) {
      veil.current.position.copy(camera.position).addScaledVector(camera.getWorldDirection(spare), (camera as THREE.PerspectiveCamera).near * 2)
      ;(veil.current.material as THREE.SpriteMaterial).opacity = playback ? 0 : Math.max(1 - ease((u - .01) / .03), ease((u - .96) / .02))
    }
  })
  return <>
    {!playback && route.lines.map((l, i) => <primitive key={i} object={l} />)}
    <group ref={craft}>
      {cameraView === 'pilot' ? null : follow
        ? <Suspense fallback={null}><NasaModel file={landerFile(playback?.current.lander ?? 'apollo')} size={.003} fit="height" shadows={false} /></Suspense>
        : <mesh><sphereGeometry args={[.012, 12, 12]} /><meshBasicMaterial color="#e7dbc0" /></mesh>}
      {showLabel && view !== 'pilot' && <Html center zIndexRange={[40, 0]} className="tag tag-craft"><div ref={label} /></Html>}
      <mesh ref={plume} visible={false}><coneGeometry args={[1, 1, 16, 1, true]} /><meshBasicMaterial color="#b4c6df" transparent opacity={.12} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} /></mesh>
    </group>
    <sprite ref={veil} scale={[100, 100, 1]} renderOrder={10000}><spriteMaterial color="#000" transparent opacity={0} depthWrite={false} depthTest={false} /></sprite>
  </>
}
