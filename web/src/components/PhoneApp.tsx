// The phone app. Hold it up: the accelerometer tilts the view and the compass turns it,
// from a point standing on the Moon. Pair it with the desktop and the same look drives the big screen,
// and the phone can run the search.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import qrcode from 'qrcode-generator'
import * as THREE from 'three'
import { dataUrl } from '../data'
import type { Lang } from '../i18n'
import { directionMoonFixed, toThree } from '../geometry'
import { eyePosition, headingFromOrientation, SOUTH_POLE, tiltFromAccel, tiltFromOrientation, writeLook, type Stand } from '../phoneLook'
import { openGuest, openHost, parsePhoneHash, phoneUrl, roomCode, standFrom, type LinkStatus } from '../phoneLink'
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
    const k = 1 - Math.exp(-Math.min(dt, 0.05) / 0.04)
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

async function askMotion(): Promise<boolean> {
  const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  const motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
  try {
    if (orientation.requestPermission && await orientation.requestPermission() !== 'granted') return false
    if (motion.requestPermission && await motion.requestPermission() !== 'granted') return false
    return true
  } catch {
    return false
  }
}

function useLocalTilt(on: boolean, tilt: RefObject<Tilt>) {
  useEffect(() => {
    if (!on || !tilt.current) return
    let heading = tilt.current.heading
    let absolute = false
    let fused = false
    const apply = (e: DeviceOrientationEvent, abs: boolean) => {
      if (abs) absolute = true
      else if (absolute) return
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      const h = headingFromOrientation(e.alpha, ios)
      if (h != null) heading = h
      const next = tiltFromOrientation(e.beta, e.gamma)
      const cur = tilt.current
      if (!next || !cur) return
      fused = true
      cur.alt = next.alt
      cur.roll = next.roll
      cur.heading = heading
    }
    const onAbs = (e: DeviceOrientationEvent) => apply(e, true)
    const onRel = (e: DeviceOrientationEvent) => apply(e, false)
    const onMotion = (e: DeviceMotionEvent) => {
      if (fused || !tilt.current) return
      const g = e.accelerationIncludingGravity
      if (!g || g.x == null || g.y == null || g.z == null) return
      if (e.rotationRate?.alpha) heading = (heading + e.rotationRate.alpha * 0.016 + 360) % 360
      const next = tiltFromAccel({ x: g.x, y: g.y, z: g.z })
      tilt.current.alt = next.alt
      tilt.current.roll = next.roll
      tilt.current.heading = heading
    }
    addEventListener('deviceorientationabsolute', onAbs)
    addEventListener('deviceorientation', onRel)
    addEventListener('devicemotion', onMotion)
    return () => {
      removeEventListener('deviceorientationabsolute', onAbs)
      removeEventListener('deviceorientation', onRel)
      removeEventListener('devicemotion', onMotion)
    }
  }, [on, tilt])
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
    hold: 'Tilt it. Down is the ground ahead, up is Earth and the Sun.',
    enable: 'Enable motion',
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
    hold: 'Eğ. Aşağıda önündeki yer, yukarıda Dünya ve Güneş.',
    enable: 'Hareketi aç',
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
  const [motion, setMotion] = useState(false)
  const [status, setStatus] = useState<LinkStatus>(parsed.code ? 'connecting' : 'waiting')
  const [stand, setStand] = useState<Stand>({ ...SOUTH_POLE, name: lang === 'tr' ? 'Güney kutbu' : SOUTH_POLE.name })
  const tilt = useRef<Tilt>({ heading: 0, alt: -22, roll: 0 })
  const send = useRef<((msg: { t: 'ori'; heading: number; alt: number; roll: number } | { t: 'cmd'; name: 'find' | 'best' }) => void) | null>(null)
  useLocalTilt(motion, tilt)

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
        if (v) link.send({ t: 'ori', heading: v.heading, alt: v.alt, roll: v.roll })
      }, 16)
    })
    return () => { dead = true; clearInterval(timer); stop() }
  }, [parsed.code, tilt])

  return (
    <div className="phone-app">
      <Stage stand={stand} tilt={tilt} />
      <div className="phone-hud">
        <div className="phone-top">
          <div>
            <div className="phone-brand">LUNA<b>NAV</b></div>
            <p className="phone-site">{stand.name}</p>
          </div>
          <button className="phone-x" onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}>{lang.toUpperCase()}</button>
        </div>
        <div className="phone-cross" />
        <Readout tilt={tilt} />
        <div className="phone-dock">
          <div className={`phone-status ${status === 'live' ? 'live' : ''} ${status === 'error' ? 'bad' : ''}`}>
            {status === 'live' ? t.live : status === 'error' ? t.fail : parsed.code ? t.waiting : t.solo}
          </div>
          <p className="phone-status">{t.hold}</p>
          <div className="phone-actions">
            {!motion && <button className="primary" onClick={async () => setMotion(await askMotion())}>{t.enable}</button>}
            <button onClick={() => send.current?.({ t: 'cmd', name: 'find' })}>{t.find}</button>
            <button onClick={() => send.current?.({ t: 'cmd', name: 'best' })}>{t.best}</button>
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
  const link = useRef<{ send: (msg: { t: 'site'; name: string; lat: number; lon: number }) => void } | null>(null)
  const onFindRef = useRef(onFind)
  const onBestRef = useRef(onBest)
  const siteRef = useRef(site)
  onFindRef.current = onFind
  onBestRef.current = onBest
  siteRef.current = site
  const url = phoneUrl(location.origin, location.pathname, code, lang)

  useEffect(() => {
    let stop = () => {}
    let dead = false
    openHost(code, (m) => {
      if (m.t === 'ori' && tilt.current) {
        tilt.current.heading = m.heading
        tilt.current.alt = m.alt
        tilt.current.roll = m.roll
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
    <div className="phone-app">
      <Stage stand={site} tilt={tilt} />
      <div className="phone-hud">
        <div className="phone-top">
          <div>
            <div className="phone-brand">LUNA<b>NAV</b></div>
            <p className="phone-site">{site.name}</p>
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
