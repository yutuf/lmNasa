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
import { eyePosition, headingFromOrientation, lookQuaternion, SOUTH_POLE, tiltFromAccel, type Stand } from '../phoneLook'
import { openGuest, openHost, parsePhoneHash, phoneUrl, roomCode, standFrom, type LinkStatus } from '../phoneLink'
import '../phone.css'

interface Tilt { heading: number; alt: number; roll: number }

function MoonBall() {
  const [albedo, normal] = useTexture([dataUrl('moon_albedo.jpg'), dataUrl('moon_normal.jpg')])
  albedo.colorSpace = THREE.SRGBColorSpace
  return (
    <mesh>
      <sphereGeometry args={[1, 128, 64]} />
      <meshStandardMaterial map={albedo} normalMap={normal} normalScale={new THREE.Vector2(1.1, 1.1)} roughness={1} metalness={0} />
    </mesh>
  )
}

function SkyMarks({ stand }: { stand: Stand }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(400 * 3)
    for (let i = 0; i < 400; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(30)
      pos.set([v.x, v.y, v.z], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const earth = toThree(directionMoonFixed(18, 50, stand.lat, stand.lon)).multiplyScalar(12)
  const sun = toThree(directionMoonFixed(8, 220, stand.lat, stand.lon)).multiplyScalar(16)
  return (
    <>
      <points geometry={geo}><pointsMaterial color="#ffffff" size={0.06} sizeAttenuation /></points>
      <mesh position={earth}><sphereGeometry args={[0.18, 24, 16]} /><meshBasicMaterial color="#7eb6ff" /></mesh>
      <mesh position={sun}><sphereGeometry args={[0.22, 24, 16]} /><meshBasicMaterial color="#ffd27a" /></mesh>
    </>
  )
}

function LookCam({ stand, tilt }: { stand: Stand; tilt: RefObject<Tilt> }) {
  const { camera } = useThree()
  useFrame(() => {
    const t = tilt.current
    if (!t) return
    camera.position.copy(eyePosition(stand.lat, stand.lon))
    camera.quaternion.copy(lookQuaternion(stand.lat, stand.lon, t.heading, t.alt, t.roll))
  })
  return null
}

function Stage({ stand, tilt }: { stand: Stand; tilt: RefObject<Tilt> }) {
  return (
    <Canvas camera={{ fov: 62, near: 0.01, far: 80 }} dpr={[1, 1.5]} gl={{ antialias: true }}
      onCreated={({ gl, scene }) => { scene.background = new THREE.Color('#000'); gl.setClearColor(0x000000, 1) }}>
      <ambientLight intensity={0.08} />
      <hemisphereLight args={['#c5ccd6', '#000', 0.25]} />
      <directionalLight position={[4, 2, 1]} intensity={3.2} color="#fff1dc" />
      <Suspense fallback={null}>
        <MoonBall />
        <SkyMarks stand={stand} />
      </Suspense>
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
    let gotHeading = false
    const onOri = (e: DeviceOrientationEvent) => {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      const h = headingFromOrientation(e.alpha, ios)
      if (h != null) { heading = h; gotHeading = true }
    }
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity
      if (!g || g.x == null || g.y == null || g.z == null || !tilt.current) return
      if (!gotHeading && e.rotationRate?.alpha) heading = (heading + e.rotationRate.alpha * 0.02 + 360) % 360
      const next = tiltFromAccel({ x: g.x, y: g.y, z: g.z })
      const cur = tilt.current
      cur.alt += (next.alt - cur.alt) * 0.35
      cur.roll += (next.roll - cur.roll) * 0.35
      cur.heading = heading
    }
    addEventListener('deviceorientation', onOri)
    addEventListener('devicemotion', onMotion)
    return () => {
      removeEventListener('deviceorientation', onOri)
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
    hold: 'Hold the phone up. The accelerometer looks around the surface.',
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
    hold: 'Telefonu kaldır. İvmeölçer yüzeyde etrafa bakar.',
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
  const tilt = useRef<Tilt>({ heading: 0, alt: 0, roll: 0 })
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
      }, 50)
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
  const tilt = useRef<Tilt>({ heading: 0, alt: 15, roll: 0 })
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
