// The phone is a remote. Held upright, its turn rate moves a cursor over the lunar view.
// The picture does not follow the phone's tilt, so a wrist roll cannot flip it.
// Pair it with the desktop and the same cursor appears on the big screen.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import qrcode from 'qrcode-generator'
import * as THREE from 'three'
import { dataUrl } from '../data'
import type { Lang } from '../i18n'
import { directionMoonFixed, toThree } from '../geometry'
import { commitAim, cursorNdc, dragCursor, dragLook, eyePosition, SOUTH_POLE, stepRemote, writeLook, type CursorAim, type Stand } from '../phoneLook'
import { openGuest, openHost, parsePhoneHash, phoneUrl, roomCode, standFrom, type LinkStatus, type PhoneToDesk } from '../phoneLink'
import '../phone.css'

interface Tilt { heading: number; alt: number; roll: number }

function glowTexture(stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  for (const [t, color] of stops) g.addColorStop(t, color)
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function MoonBall() {
  const [albedo, normal] = useTexture([dataUrl('moon_albedo.jpg'), dataUrl('moon_normal.jpg')])
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 8
  return (
    <mesh>
      <sphereGeometry args={[1, 160, 80]} />
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1.2, 1.2)} roughness={1} metalness={0} color="#e4ded4" />
    </mesh>
  )
}

function Stars() {
  const geo = useMemo(() => {
    const n = 1400
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    let s = 42
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(26)
      pos.set([v.x, v.y, v.z], i * 3)
      const warm = rnd()
      col.set(warm > 0.92 ? [1, 0.86, 0.7] : warm < 0.12 ? [0.75, 0.84, 1] : [0.92, 0.93, 0.96], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  return <points geometry={geo}><pointsMaterial vertexColors size={1.15} sizeAttenuation={false} /></points>
}

function SkyBodies({ stand }: { stand: Stand }) {
  const earthMap = useTexture(dataUrl('earth.jpg'))
  earthMap.colorSpace = THREE.SRGBColorSpace
  const earthGlow = useMemo(() => glowTexture([[0, 'rgba(120,190,255,0.55)'], [0.4, 'rgba(60,120,255,0.16)'], [1, 'rgba(0,0,0,0)']]), [])
  const earth = toThree(directionMoonFixed(24, 55, stand.lat, stand.lon)).multiplyScalar(11)
  return (
    <group position={earth}>
      <sprite scale={[2.4, 2.4, 1]}><spriteMaterial map={earthGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <mesh>
        <sphereGeometry args={[0.55, 48, 32]} />
        <meshBasicMaterial map={earthMap} />
      </mesh>
    </group>
  )
}

function Sun({ stand }: { stand: Stand }) {
  const core = useMemo(() => glowTexture([[0, 'rgba(255,255,245,1)'], [0.2, 'rgba(255,236,200,0.9)'], [0.45, 'rgba(255,190,80,0.28)'], [1, 'rgba(255,160,40,0)']]), [])
  const sun = toThree(directionMoonFixed(10, 220, stand.lat, stand.lon)).multiplyScalar(15)
  return (
    <>
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={4.4} color="#fff3df" />
      <group position={sun}>
        <sprite scale={[4.5, 4.5, 1]}><spriteMaterial map={core} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      </group>
    </>
  )
}

function Beacon({ stand }: { stand: Stand }) {
  const foot = surfaceBeacon(stand.lat, stand.lon)
  const up = foot.clone().normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
  return (
    <group position={foot} quaternion={quat}>
      <mesh position={[0, 0.0045, 0]}>
        <cylinderGeometry args={[0.00012, 0.00012, 0.009, 6]} />
        <meshBasicMaterial color="#e10600" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.00035, 0]}>
        <ringGeometry args={[0.0022, 0.0027, 40]} />
        <meshBasicMaterial color="#ffd9a0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function surfaceBeacon(lat: number, lon: number) {
  return eyePosition(Math.min(lat + 0.35, 89), lon).normalize().multiplyScalar(1.0015)
}

function LookCam({ stand, tilt }: { stand: Stand; tilt: RefObject<Tilt> }) {
  const { camera, scene } = useThree()
  const lamp = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const head = lamp.current
    if (!head) return
    scene.add(head.target)
    return () => { scene.remove(head.target) }
  }, [scene])
  const aim = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Quaternion())
  const current = useRef(new THREE.Quaternion())
  const primed = useRef(false)
  useEffect(() => { primed.current = false }, [stand.lat, stand.lon])
  useFrame((_, dt) => {
    const t = tilt.current
    if (!t) return
    writeLook(target.current, stand.lat, stand.lon, t.heading, t.alt, t.roll)
    const aimQ = target.current
    if (current.current.dot(aimQ) < 0) aimQ.set(-aimQ.x, -aimQ.y, -aimQ.z, -aimQ.w)
    const k = 1 - Math.exp(-Math.min(dt, 0.05) / 0.08)
    if (!primed.current) { current.current.copy(target.current); primed.current = true }
    else current.current.slerp(target.current, k)
    camera.position.copy(eyePosition(stand.lat, stand.lon))
    camera.quaternion.copy(current.current)
    const head = lamp.current
    if (!head) return
    head.position.copy(camera.position)
    camera.getWorldDirection(aim.current)
    head.target.position.copy(camera.position).add(aim.current)
    head.target.updateMatrixWorld()
  })
  return <directionalLight ref={lamp} intensity={1.35} color="#fff8ee" />
}

function Stage({ stand, tilt }: { stand: Stand; tilt: RefObject<Tilt> }) {
  return (
    <Canvas camera={{ fov: 68, near: 0.0005, far: 40 }} dpr={[1, 1.5]} gl={{ antialias: true }}
      onCreated={({ gl, scene }) => { scene.background = new THREE.Color('#070814'); gl.setClearColor(0x070814, 1) }}>
      <hemisphereLight args={['#b7c4d4', '#3a2c22', 0.72]} />
      <Suspense fallback={null}>
        <MoonBall />
        <SkyBodies stand={stand} />
        <Sun stand={stand} />
        <Beacon stand={stand} />
      </Suspense>
      <Stars />
      <LookCam stand={stand} tilt={tilt} />
    </Canvas>
  )
}

function applyStick(tilt: RefObject<Tilt>, dx: number, dy: number) {
  const cur = tilt.current
  if (!cur) return
  const next = dragLook(cur, dx, dy)
  cur.heading = next.heading
  cur.alt = next.alt
  cur.roll = 0
}

function useDragLook(tilt: RefObject<Tilt>, active: boolean) {
  const on = useRef(active)
  on.current = active
  const last = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!on.current) return
    if ((e.target as HTMLElement).closest('button, a, .phone-dock, .phone-top, .phone-pad')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!on.current || !last.current) return
    applyStick(tilt, e.clientX - last.current.x, e.clientY - last.current.y)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const end = () => { last.current = null }
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }
}

function useDragCursor(aim: RefObject<CursorAim>, active: boolean) {
  const on = useRef(active)
  on.current = active
  const last = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!on.current) return
    if ((e.target as HTMLElement).closest('button, a, .phone-dock, .phone-top, .phone-pad')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!on.current || !last.current || !aim.current) return
    const next = dragCursor(aim.current, e.clientX - last.current.x, e.clientY - last.current.y)
    aim.current.x = next.x
    aim.current.y = next.y
    last.current = { x: e.clientX, y: e.clientY }
  }
  const end = () => { last.current = null }
  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }
}

function motionNeedsGesture(): boolean {
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  return typeof motion?.requestPermission === 'function'
}

async function allowMotion(): Promise<boolean> {
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  if (typeof motion?.requestPermission !== 'function') return true
  try { return (await motion.requestPermission()) === 'granted' } catch { return false }
}

function useRemote(aim: RefObject<CursorAim>, armed: boolean) {
  useEffect(() => {
    if (!armed) return
    let last = performance.now()
    const onMotion = (e: DeviceMotionEvent) => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      const rate = e.rotationRate
      const cur = aim.current
      if (!rate || !cur) return
      const next = stepRemote(cur, { alpha: rate.alpha ?? 0, beta: rate.beta ?? 0, gamma: rate.gamma ?? 0 }, dt)
      cur.x = next.x
      cur.y = next.y
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [aim, armed])
}

function Pad({ aim }: { aim: RefObject<CursorAim> }) {
  const hold = (dir: 'left' | 'right' | 'up' | 'down') => (e: ReactPointerEvent) => {
    e.stopPropagation()
    const step = () => {
      const cur = aim.current
      if (!cur) return
      const dx = dir === 'left' ? -4 : dir === 'right' ? 4 : 0
      const dy = dir === 'up' ? 4 : dir === 'down' ? -4 : 0
      const next = dragCursor(cur, dx / 0.16, -dy / 0.16)
      cur.x = next.x
      cur.y = next.y
    }
    step()
    const id = window.setInterval(step, 90)
    const up = () => { clearInterval(id); removeEventListener('pointerup', up); removeEventListener('pointercancel', up) }
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
  }
  return (
    <div className="phone-pad">
      <button className="n" onPointerDown={hold('up')} aria-label="Cursor up">▲</button>
      <button className="w" onPointerDown={hold('left')} aria-label="Cursor left">◀</button>
      <button className="e" onPointerDown={hold('right')} aria-label="Cursor right">▶</button>
      <button className="s" onPointerDown={hold('down')} aria-label="Cursor down">▼</button>
    </div>
  )
}

function Cursor({ aim }: { aim: RefObject<CursorAim> }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const node = el.current
      const cur = aim.current
      const box = node?.parentElement?.getBoundingClientRect()
      if (node && cur && box && box.height > 0) {
        const ndc = cursorNdc(cur.x, cur.y, 68, box.width / box.height)
        node.style.left = `${50 + ndc.x * 50}%`
        node.style.top = `${50 - ndc.y * 50}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [aim])
  return <div ref={el} className="phone-cursor" />
}

function QR({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 6, margin: 1, scalable: true })
  }, [text])
  return <div dangerouslySetInnerHTML={{ __html: svg }} />
}

const copy = {
  en: {
    hold: 'Hold the phone upright and twist it. The cursor moves, and the view stays upright.',
    remote: 'Use as a remote',
    look: 'Look here',
    center: 'Center',
    pair: 'Pair this phone',
    waiting: 'Open the code on the phone',
    live: 'Phone paired',
    find: 'Find sites',
    best: 'Open best site',
    close: 'Close',
    solo: 'Not paired. You are standing near the south pole.',
    fail: 'Pairing failed. The view still works on this phone.',
    failHost: 'Pairing failed',
  },
  tr: {
    hold: 'Telefonu dik tut ve çevir. İmleç hareket eder, görüntü dik kalır.',
    remote: 'Uzaktan kumanda yap',
    look: 'Buraya bak',
    center: 'Ortala',
    pair: 'Bu telefonu eşle',
    waiting: 'Kodu telefonda aç',
    live: 'Telefon eşlendi',
    find: 'Yerleri bul',
    best: 'En iyi yeri aç',
    close: 'Kapat',
    solo: 'Eşleşme yok. Güney kutbunun yanında duruyorsun.',
    fail: 'Eşleşme olmadı. Görüntü bu telefonda çalışmaya devam eder.',
    failHost: 'Eşleşme olmadı',
  },
}

function Readout({ tilt }: { tilt: RefObject<Tilt> }) {
  const [text, setText] = useState('ALT 0°  HDG 0°')
  useEffect(() => {
    const id = setInterval(() => {
      const t = tilt.current
      if (!t) return
      setText(`ALT ${t.alt.toFixed(0)}°  HDG ${t.heading.toFixed(0)}°`)
    }, 200)
    return () => clearInterval(id)
  }, [tilt])
  return <div className="phone-readout">{text}</div>
}

export function PhoneGuest() {
  const parsed = parsePhoneHash(location.hash)
  const [lang, setLang] = useState<Lang>(parsed.lang)
  const t = copy[lang]
  const [status, setStatus] = useState<LinkStatus>(parsed.code ? 'connecting' : 'waiting')
  const [stand, setStand] = useState<Stand>({ ...SOUTH_POLE, name: lang === 'tr' ? 'Güney kutbu' : SOUTH_POLE.name })
  const tilt = useRef<Tilt>({ heading: 0, alt: -22, roll: 0 })
  const aim = useRef<CursorAim>({ x: 0, y: 0 })
  const [armed, setArmed] = useState(() => !motionNeedsGesture())
  const send = useRef<((msg: PhoneToDesk) => void) | null>(null)
  const drag = useDragCursor(aim, true)
  useRemote(aim, armed)

  useEffect(() => {
    const code = parsed.code
    if (!code) return
    let stop = () => {}
    let timer = 0
    let dead = false
    openGuest(code, (m) => setStand(standFrom(m)), setStatus).then((link) => {
      if (dead) { link.close(); return }
      send.current = link.send
      stop = link.close
      timer = window.setInterval(() => {
        const v = tilt.current
        const a = aim.current
        if (v && a) link.send({ t: 'ori', heading: v.heading, alt: v.alt, roll: 0, aimX: a.x, aimY: a.y })
      }, 16)
    })
    return () => { dead = true; clearInterval(timer); stop() }
  }, [parsed.code, tilt])

  return (
    <div className="phone-app" {...drag}>
      <Stage stand={stand} tilt={tilt} />
      <div className="phone-hud">
        <div className="phone-top">
          <div>
            <div className="phone-brand">LUNA<b>NAV</b></div>
            <p className="phone-site">{stand.name}</p>
          </div>
          <button className="phone-x" onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}>{lang.toUpperCase()}</button>
        </div>
        <Cursor aim={aim} />
        <Readout tilt={tilt} />
        <Pad aim={aim} />
        <div className="phone-dock">
          <div className={`phone-status ${status === 'live' ? 'live' : ''} ${status === 'error' ? 'bad' : ''}`}>
            {status === 'live' ? t.live : status === 'error' ? t.fail : parsed.code ? t.waiting : t.solo}
          </div>
          <p className="phone-status">{t.hold}</p>
          <div className="phone-actions">
            {!armed && <button className="primary" onClick={() => { void allowMotion().then((ok) => { if (ok) setArmed(true) }) }}>{t.remote}</button>}
            <button onClick={() => {
              const v = tilt.current
              const a = aim.current
              if (!v || !a) return
              const next = commitAim(v, a)
              v.heading = next.heading
              v.alt = next.alt
              v.roll = 0
              a.x = 0
              a.y = 0
            }}>{t.look}</button>
            <button onClick={() => { if (aim.current) { aim.current.x = 0; aim.current.y = 0 } }}>{t.center}</button>
            <button onClick={() => send.current?.({ t: 'cmd', name: 'find' })}>{t.find}</button>
            <button className={armed ? 'primary' : ''} onClick={() => send.current?.({ t: 'cmd', name: 'best' })}>{t.best}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PhoneHost({ lang, site, onClose, onFind, onBest }: {
  lang: Lang
  site: Stand
  onClose: () => void
  onFind: () => void
  onBest: () => void
}) {
  const t = copy[lang]
  const [code] = useState(roomCode)
  const [status, setStatus] = useState<LinkStatus>('connecting')
  const [detail, setDetail] = useState('')
  const tilt = useRef<Tilt>({ heading: 0, alt: -22, roll: 0 })
  const aim = useRef<CursorAim>({ x: 0, y: 0 })
  const link = useRef<{ send: (msg: { t: 'site'; name: string; lat: number; lon: number }) => void } | null>(null)
  const onFindRef = useRef(onFind)
  const onBestRef = useRef(onBest)
  const siteRef = useRef(site)
  onFindRef.current = onFind
  onBestRef.current = onBest
  siteRef.current = site
  const url = phoneUrl(location.origin, location.pathname, code, lang)
  const localAim = status !== 'live'
  const drag = useDragLook(tilt, localAim)

  useEffect(() => {
    let stop = () => {}
    let dead = false
    openHost(code, (m) => {
      if (m.t === 'ori' && tilt.current && aim.current) {
        tilt.current.heading = m.heading
        tilt.current.alt = m.alt
        tilt.current.roll = 0
        aim.current.x = m.aimX
        aim.current.y = m.aimY
      } else if (m.t === 'cmd' && m.name === 'find') onFindRef.current()
      else if (m.t === 'cmd') onBestRef.current()
    }, (s, d) => { setStatus(s); if (d) setDetail(d) }).then((l) => {
      if (dead) { l.close(); return }
      link.current = l
      stop = l.close
      const s = siteRef.current
      l.send({ t: 'site', name: s.name, lat: s.lat, lon: s.lon })
    })
    return () => { dead = true; link.current = null; stop() }
  }, [code])

  useEffect(() => {
    link.current?.send({ t: 'site', name: site.name, lat: site.lat, lon: site.lon })
  }, [site.name, site.lat, site.lon])

  return (
    <div className="phone-app" {...drag}>
      <Stage stand={site} tilt={tilt} />
      <div className="phone-hud">
        <div className="phone-top">
          <div>
            <div className="phone-brand">LUNA<b>NAV</b></div>
            <p className="phone-site">{site.name}</p>
          </div>
          <button className="phone-x" onClick={onClose} aria-label={t.close}>×</button>
        </div>
        <Cursor aim={aim} />
        <Readout tilt={tilt} />
        <div className="phone-dock">
          {status !== 'live' && (
            <div className="phone-pair">
              <QR text={url} />
              <div className="phone-code">{code}</div>
              <small>{t.waiting}</small>
            </div>
          )}
          <div className={`phone-status ${status === 'live' ? 'live' : ''} ${status === 'error' ? 'bad' : ''}`}>
            {status === 'live' ? t.live : status === 'error' ? `${t.failHost}${detail ? ` (${detail})` : ''}.` : t.hold}
          </div>
        </div>
      </div>
    </div>
  )
}
