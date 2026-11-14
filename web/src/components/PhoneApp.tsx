// The phone is only a steering wheel. Twisting it turns the lunar view on the big screen.
// The turn rate is used, not the absolute tilt, so the picture cannot flip. The phone does not
// draw that picture: the wheel would take it out of view.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import qrcode from 'qrcode-generator'
import * as THREE from 'three'
import { dataUrl } from '../data'
import type { Lang } from '../i18n'
import { dragLook, SOUTH_POLE, stepSlew, type Stand } from '../phoneLook'
import { standGeometry, standLook, standQuaternion } from '../phoneGround'
import { parseDem, type Dem } from '../terrain'
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

const REGOLITH_NORMAL = new THREE.Vector2(1.2, 1.2)

let poleDem: Promise<Dem> | null = null
function loadPoleDem() {
  return (poleDem ??= fetch(dataUrl('pole_dem.bin')).then((r) => r.arrayBuffer()).then(parseDem))
}

function Stars() {
  const geo = useMemo(() => {
    const n = 2200
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    let s = 42
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(9000)
      pos.set([v.x, v.y, v.z], i * 3)
      const warm = rnd()
      col.set(warm > 0.92 ? [1, 0.86, 0.7] : warm < 0.12 ? [0.75, 0.84, 1] : [0.92, 0.93, 0.96], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  return <points geometry={geo}><pointsMaterial vertexColors size={1.4} sizeAttenuation={false} /></points>
}

function LowSun({ lon }: { lon: number }) {
  const core = useMemo(() => glowTexture([[0, 'rgba(255,255,245,1)'], [0.2, 'rgba(255,236,200,0.9)'], [0.45, 'rgba(255,190,80,0.28)'], [1, 'rgba(255,160,40,0)']]), [])
  const at = useMemo(() => standLook(220, 6, lon).normalize().multiplyScalar(4000), [lon])
  return (
    <>
      <directionalLight position={at} intensity={3.2} color="#fff1d2" />
      <sprite position={at} scale={[260, 260, 1]}>
        <spriteMaterial map={core} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  )
}

function SiteMast() {
  return (
    <group position={[0, 0, -14]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
        <meshBasicMaterial color="#e10600" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.1, 1.35, 40]} />
        <meshBasicMaterial color="#ffd9a0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function PolarGround({ stand, onGround }: { stand: Stand; onGround: (s: 'load' | 'ok' | 'out') => void }) {
  const [color, normal] = useTexture([dataUrl('regolith_color.jpg'), dataUrl('regolith_normal.jpg')])
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null)
  const held = useRef<THREE.BufferGeometry | null>(null)
  const report = useRef(onGround)
  report.current = onGround
  useLayoutEffect(() => {
    for (const map of [color, normal]) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping
      map.anisotropy = 8
    }
    color.colorSpace = THREE.SRGBColorSpace
  }, [color, normal])
  useEffect(() => {
    let dead = false
    report.current('load')
    const swap = (next: THREE.BufferGeometry | null) => {
      const prev = held.current
      held.current = next
      if (prev && prev !== next) prev.dispose()
      setGeo(next)
    }
    loadPoleDem().then((dem) => {
      if (dead) return
      const next = standGeometry(dem, stand.lat, stand.lon)
      if (!next) {
        report.current('out')
        swap(null)
        return
      }
      report.current('ok')
      swap(next)
    }).catch(() => {
      if (!dead) {
        report.current('out')
        swap(null)
      }
    })
    return () => { dead = true }
  }, [stand.lat, stand.lon])
  useEffect(() => () => { held.current?.dispose(); held.current = null }, [])
  if (!geo) return null
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial map={color} normalMap={normal} normalScale={REGOLITH_NORMAL} roughness={0.97} metalness={0} color="#d9d0c4" />
    </mesh>
  )
}

function LookCam({ stand, tilt }: { stand: Stand; tilt: RefObject<Tilt> }) {
  const { camera, scene } = useThree()
  const lamp = useRef<THREE.SpotLight>(null)
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
    standQuaternion(target.current, t.heading, t.alt, stand.lon)
    const aimQ = target.current
    if (current.current.dot(aimQ) < 0) aimQ.set(-aimQ.x, -aimQ.y, -aimQ.z, -aimQ.w)
    const k = 1 - Math.exp(-Math.min(dt, 0.05) / 0.08)
    if (!primed.current) { current.current.copy(target.current); primed.current = true }
    else current.current.slerp(target.current, k)
    camera.position.set(0, 1.8, 0)
    camera.quaternion.copy(current.current)
    const head = lamp.current
    if (!head) return
    head.position.copy(camera.position)
    camera.getWorldDirection(aim.current)
    head.target.position.copy(camera.position).addScaledVector(aim.current, 8)
    head.target.updateMatrixWorld()
  })
  return <spotLight ref={lamp} intensity={40} angle={0.7} penumbra={0.45} distance={50} color="#fff6e8" />
}

function Stage({ stand, tilt, onGround }: { stand: Stand; tilt: RefObject<Tilt>; onGround: (s: 'load' | 'ok' | 'out') => void }) {
  return (
    <Canvas camera={{ position: [0, 1.8, 0], fov: 68, near: 0.15, far: 20000 }} dpr={[1, 1.5]} gl={{ antialias: true }}
      onCreated={({ gl, scene }) => { scene.background = new THREE.Color('#000000'); gl.setClearColor(0x000000, 1) }}>
      <hemisphereLight args={['#c5d4e8', '#3a2a22', 0.55]} />
      <LowSun lon={stand.lon} />
      <Suspense fallback={null}>
        <PolarGround stand={stand} onGround={onGround} />
      </Suspense>
      <SiteMast />
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

function motionNeedsGesture(): boolean {
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  return typeof motion?.requestPermission === 'function'
}

async function allowMotion(): Promise<boolean> {
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  if (typeof motion?.requestPermission !== 'function') return true
  try { return (await motion.requestPermission()) === 'granted' } catch { return false }
}

function useRemote(tilt: RefObject<Tilt>, armed: boolean) {
  useEffect(() => {
    if (!armed) return
    let last = performance.now()
    const onMotion = (e: DeviceMotionEvent) => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      const rate = e.rotationRate
      const cur = tilt.current
      if (!rate || !cur) return
      const next = stepSlew(cur, { alpha: rate.alpha ?? 0, beta: rate.beta ?? 0, gamma: rate.gamma ?? 0 }, dt)
      cur.heading = next.heading
      cur.alt = next.alt
      cur.roll = 0
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [tilt, armed])
}

function Wheel({ tilt, drag }: { tilt: RefObject<Tilt>; drag: ReturnType<typeof useDragLook> }) {
  const wheel = useRef<HTMLDivElement>(null)
  const figure = useRef<HTMLElement>(null)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const t = tilt.current
      const node = wheel.current
      const num = figure.current
      if (t && node && num) {
        node.style.transform = `rotate(${t.heading}deg)`
        num.style.transform = `rotate(${-t.heading}deg)`
        num.textContent = `${((t.heading % 360) + 360) % 360 | 0}°`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [tilt])
  return (
    <div className="phone-wheel-wrap" {...drag}>
      <div className="phone-wheel" ref={wheel}>
        <i />
        <b ref={figure}>0°</b>
      </div>
    </div>
  )
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
    hold: 'Twist the phone like a wheel. The Moon stays on the big screen.',
    lola: 'NASA LOLA, real heights. The Sun is a fixed low light, not this landing hour.',
    lolaLoad: 'Loading the NASA LOLA height map.',
    outside: 'This site is outside the south-polar height map.',
    remote: 'Enable steering',
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
    hold: 'Telefonu bir direksiyon gibi çevir. Ay büyük ekranda kalır.',
    lola: 'NASA LOLA, gerçek yükseklikler. Güneş sabit alçak bir ışık; iniş saati değil.',
    lolaLoad: 'NASA LOLA yükseklik haritası yükleniyor.',
    outside: 'Bu yer güney kutup yükseklik haritasının dışında.',
    remote: 'Direksiyonu aç',
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
  const tilt = useRef<Tilt>({ heading: 0, alt: -8, roll: 0 })
  const [armed, setArmed] = useState(() => !motionNeedsGesture())
  const send = useRef<((msg: PhoneToDesk) => void) | null>(null)
  const drag = useDragLook(tilt, true)
  useRemote(tilt, armed)

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
        if (v) link.send({ t: 'ori', heading: v.heading, alt: v.alt, roll: 0, aimX: 0, aimY: 0 })
      }, 16)
    })
    return () => { dead = true; clearInterval(timer); stop() }
  }, [parsed.code, tilt])

  return (
    <div className="phone-app phone-remote">
      <div className="phone-top">
        <div>
          <div className="phone-brand">LUNA<b>NAV</b></div>
          <p className="phone-site">{stand.name}</p>
        </div>
        <button className="phone-x" onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}>{lang.toUpperCase()}</button>
      </div>
      <Wheel tilt={tilt} drag={drag} />
      <div className="phone-dock">
        <div className={`phone-status ${status === 'live' ? 'live' : ''} ${status === 'error' ? 'bad' : ''}`}>
          {status === 'live' ? t.live : status === 'error' ? t.fail : parsed.code ? t.waiting : t.solo}
        </div>
        <p className="phone-status">{t.hold}</p>
        <div className="phone-actions">
          {!armed && <button onClick={() => { void allowMotion().then((ok) => { if (ok) setArmed(true) }) }}>{t.remote}</button>}
          <button onClick={() => send.current?.({ t: 'cmd', name: 'find' })}>{t.find}</button>
          <button className="primary" onClick={() => send.current?.({ t: 'cmd', name: 'best' })}>{t.best}</button>
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
  const tilt = useRef<Tilt>({ heading: 0, alt: -8, roll: 0 })
  const [ground, setGround] = useState<'load' | 'ok' | 'out'>('load')
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
      if (m.t === 'ori' && tilt.current) {
        tilt.current.heading = m.heading
        tilt.current.alt = m.alt
        tilt.current.roll = 0
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
      <Stage stand={site} tilt={tilt} onGround={setGround} />
      <div className="phone-visor" />
      <div className="phone-hud">
        <div className="phone-top">
          <div>
            <div className="phone-brand">LUNA<b>NAV</b></div>
            <p className="phone-site">{site.name}</p>
            <p className="phone-lola">{ground === 'out' ? t.outside : ground === 'load' ? t.lolaLoad : t.lola}</p>
          </div>
          <button className="phone-x" onClick={onClose} aria-label={t.close}>×</button>
        </div>
        <div className="phone-cross" />
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
