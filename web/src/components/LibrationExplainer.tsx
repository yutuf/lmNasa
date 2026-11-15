// Why Earth wobbles in the lunar sky. SVG only: the Moon on an exaggerated ellipse, and a
// to-scale inset of the south-pole sky where Earth traces a Lissajous loop.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Orbit, Pause, Play, X } from 'lucide-react'
import type { Lang } from '../i18n'
import {
  LIBRATION, ORBIT_DRAW, SKY_DRAW, librationDeg, orbitPath, projectMoon, skyPoint, skyTrace, southPoleElevation,
} from '../librationModel'
import '../tour.css'

const MONTH = LIBRATION.lonPeriodDays
const SPEED = MONTH / 16
const EARTH_R = LIBRATION.earthRadiusDeg * SKY_DRAW.pxPerDeg
const ORBIT = orbitPath(ORBIT_DRAW)
const FLAT = orbitPath({ ...ORBIT_DRAW, tiltDeg: 0 })
const MONTH_TRACE = skyTrace(MONTH, 280)
const LONG_TRACE = skyTrace(MONTH * 8, 960)
const PERI = projectMoon(0)
const APO = projectMoon(MONTH / 2)
const ARROW = (() => {
  const a = projectMoon(MONTH * 0.12)
  const b = projectMoon(MONTH * 0.12 + 0.25)
  return { x: a.x, y: a.y, rot: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
})()

const BOX = {
  x: SKY_DRAW.cx - LIBRATION.lonAmpDeg * SKY_DRAW.pxPerDeg,
  y: SKY_DRAW.cy - LIBRATION.latAmpDeg * SKY_DRAW.pxPerDeg,
  w: 2 * LIBRATION.lonAmpDeg * SKY_DRAW.pxPerDeg,
  h: 2 * LIBRATION.latAmpDeg * SKY_DRAW.pxPerDeg,
}

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function signed(n: number, tr: boolean): string {
  const v = Math.round(n * 10) / 10
  const body = Math.abs(v).toFixed(1)
  const text = tr ? body.replace('.', ',') : body
  if (v > 0) return `+${text}°`
  if (v < 0) return `−${text}°`
  return `${tr ? '0,0' : '0.0'}°`
}

function dayText(day: number, tr: boolean): string {
  const body = day.toFixed(1)
  return tr ? body.replace('.', ',') : body
}

export default function LibrationExplainer({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const tr = lang === 'tr'
  const titleId = useId()
  const reduce = useRef(prefersReduced())
  const [playing, setPlaying] = useState(!reduce.current)
  const playingRef = useRef(!reduce.current)
  const dayRef = useRef(reduce.current ? LIBRATION.latPeriodDays / 2 : 0)
  const langRef = useRef(lang)
  const rafRef = useRef(0)
  const moonRef = useRef<SVGGElement>(null)
  const linkRef = useRef<SVGLineElement>(null)
  const earthRef = useRef<SVGGElement>(null)
  const dropRef = useRef<SVGLineElement>(null)
  const statusRef = useRef<SVGTextElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const dayNumRef = useRef<HTMLElement>(null)
  const readRef = useRef<HTMLParagraphElement>(null)
  langRef.current = lang

  const draw = useCallback((day: number) => {
    const moon = projectMoon(day)
    const lib = librationDeg(day)
    const sky = southPoleElevation(day)
    const pt = skyPoint(day)
    const trNow = langRef.current === 'tr'
    const face = (Math.atan2(ORBIT_DRAW.cy - moon.y, ORBIT_DRAW.cx - moon.x) * 180) / Math.PI
    moonRef.current?.setAttribute('transform', `translate(${moon.x.toFixed(2)} ${moon.y.toFixed(2)}) rotate(${(face + lib.lon).toFixed(2)})`)
    if (linkRef.current) {
      linkRef.current.setAttribute('x2', moon.x.toFixed(2))
      linkRef.current.setAttribute('y2', moon.y.toFixed(2))
    }
    earthRef.current?.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`)
    if (dropRef.current) {
      dropRef.current.setAttribute('x1', pt.x.toFixed(2))
      dropRef.current.setAttribute('x2', pt.x.toFixed(2))
      dropRef.current.setAttribute('y1', pt.y.toFixed(2))
      dropRef.current.setAttribute('y2', String(SKY_DRAW.cy))
    }
    const above = sky.elDeg > 0.2
    const below = sky.elDeg < -0.2
    if (statusRef.current) {
      statusRef.current.textContent = above
        ? (trNow ? 'UFKUN ÜSTÜNDE' : 'ABOVE THE HORIZON')
        : below
          ? (trNow ? 'UFKUN ALTINDA' : 'BELOW THE HORIZON')
          : (trNow ? 'UFUKTA' : 'ON THE HORIZON')
      statusRef.current.style.fill = above ? '#2fd27a' : below ? '#ff5050' : '#ffc83d'
    }
    if (dayNumRef.current) dayNumRef.current.textContent = `${dayText(day, trNow)} / ${dayText(MONTH, trNow)}`
    if (sliderRef.current && document.activeElement !== sliderRef.current) sliderRef.current.value = String(day)
    if (readRef.current) {
      const where = above
        ? (trNow ? `ufkun ${signed(sky.elDeg, true)} üstünde` : `${signed(sky.elDeg, false)} above the horizon`)
        : below
          ? (trNow ? `ufkun ${signed(-sky.elDeg, true)} altında` : `${signed(-sky.elDeg, false)} below the horizon`)
          : (trNow ? 'ufukta' : 'on the horizon')
      readRef.current.textContent = trNow
        ? `${dayText(day, true)}. gün. Boylam ${signed(lib.lon, true)}. Enlem ${signed(lib.lat, true)}. Dünya ${where}.`
        : `Day ${dayText(day, false)}. Longitude ${signed(lib.lon, false)}. Latitude ${signed(lib.lat, false)}. Earth is ${where}.`
    }
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const start = useCallback(() => {
    stop()
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!playingRef.current) return
      dayRef.current = (dayRef.current + dt * SPEED) % MONTH
      draw(dayRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [draw, stop])

  // After every commit: a parent re-render must not leave the imperative labels blank.
  useLayoutEffect(() => { draw(dayRef.current) })

  useEffect(() => {
    playingRef.current = playing
    if (!playing) { stop(); return }
    start()
    return stop
  }, [playing, start, stop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      const field = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')
      if (field) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPlaying((p) => !p) }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        playingRef.current = false
        setPlaying(false)
        const dir = e.key === 'ArrowRight' ? 0.5 : -0.5
        dayRef.current = (dayRef.current + dir + MONTH) % MONTH
        draw(dayRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draw, onClose])

  const onScrub = (e: FormEvent<HTMLInputElement>) => {
    if (playingRef.current) { playingRef.current = false; setPlaying(false) }
    dayRef.current = Number(e.currentTarget.value)
    draw(dayRef.current)
  }

  const lon = LIBRATION.lonAmpDeg
  const lat = LIBRATION.latAmpDeg
  return (
    <div className="workshop lib" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ws-head">
        <div>
          <h1 id={titleId}><Orbit size={26} />{tr ? 'Dünya neden salınır' : 'Why Earth wobbles'}</h1>
          <p>{tr
            ? 'Ay bir yüzünü Dünya’ya dönük tutar; yine de Dünya, Ay göğünde küçük bir halka çizer.'
            : 'The Moon keeps one face toward Earth, but Earth still traces a small loop in the lunar sky.'}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={tr ? 'Kapat' : 'Close'}><X size={18} /></button>
      </div>
      <div className="lib-body">
        <div className="lib-stage">
          <svg className="lib-svg" viewBox="0 0 980 540" role="img" aria-label={tr
            ? 'Şema: Ay’ın eliptik yörüngesi ve güney kutbundan Dünya’nın gökteki halkası.'
            : 'Schematic: the Moon on its ellipse, and the loop Earth traces in the south-pole sky.'}>
            <rect width="548" height="540" fill="#12121a" />
            <rect x="548" width="432" height="540" fill="#0e0e16" />
            <line x1="548" y1="0" x2="548" y2="540" stroke="#33333f" />

            <text x="24" y="36" className="lib-k">{tr ? 'YÖRÜNGE · ŞEMA' : 'ORBIT · SCHEMATIC'}</text>
            <text x="24" y="62" className="lib-h">{tr ? 'Eliptik, eğik' : 'Elliptical, tilted'}</text>
            <text x="24" y="84" className="lib-s">{tr ? 'Basıklık ve eğim büyütüldü' : 'Stretch and tilt enlarged'}</text>

            <path d={FLAT} fill="none" stroke="#3a3a48" strokeWidth="1.25" strokeDasharray="5 5" />
            <path d={ORBIT} fill="none" stroke="#e10600" strokeWidth="2" />
            <g transform={`translate(${ARROW.x} ${ARROW.y}) rotate(${ARROW.rot})`}>
              <polygon points="0,-5 12,0 0,5" fill="#e10600" />
            </g>
            <line ref={linkRef} x1={ORBIT_DRAW.cx} y1={ORBIT_DRAW.cy} x2={PERI.x} y2={PERI.y} stroke="#4ea4ff" strokeWidth="1" strokeDasharray="3 4" opacity="0.8" />
            <circle cx={ORBIT_DRAW.cx} cy={ORBIT_DRAW.cy} r="30" fill="#4ea4ff" opacity="0.12" />
            <circle cx={ORBIT_DRAW.cx} cy={ORBIT_DRAW.cy} r="16" fill="#1a4c86" stroke="#b9d8ff" strokeWidth="2" />
            <circle cx={ORBIT_DRAW.cx - 4} cy={ORBIT_DRAW.cy - 5} r="4.5" fill="#4ea4ff" opacity="0.7" />
            <text x={ORBIT_DRAW.cx} y={ORBIT_DRAW.cy + 36} textAnchor="middle" className="lib-tag">{tr ? 'Dünya' : 'Earth'}</text>
            <g ref={moonRef}>
              <circle r="13" fill="#d9d7e2" />
              <circle r="13" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="-3" cy="-3" r="3.2" fill="#b7b5c2" />
              <circle cx="2" cy="4" r="1.8" fill="#aeaab8" />
              <circle cx="8.5" cy="0" r="2.4" fill="#e10600" />
            </g>
            <text x={PERI.x + 18} y={PERI.y + 4} textAnchor="start" className="lib-s">{tr ? 'yakın, hızlı' : 'closer, faster'}</text>
            <text x={APO.x} y={APO.y - 22} textAnchor="middle" className="lib-s">{tr ? 'uzak, yavaş' : 'farther, slower'}</text>
            <text x="24" y="518" className="lib-s">{tr ? 'Kırmızı nokta Ay’ın yakın yüzü. Dünya’ya dönük kalır.' : 'Red dot: the near side. It stays turned toward Earth.'}</text>

            <text x="572" y="36" className="lib-k">{tr ? 'GÜNEY KUTBU · ÖLÇEKLİ' : 'SOUTH POLE · TO SCALE'}</text>
            <text x="572" y="62" className="lib-h">{tr ? 'Gökyüzünde Dünya' : 'Earth in the sky'}</text>
            <text x="572" y="84" className="lib-s">{tr ? 'Disk yaklaşık 1,9° genişliğinde' : 'The disk is about 1.9° across'}</text>

            <rect x="590" y="168" width="360" height="132" fill="#0c1428" />
            <rect x="590" y={SKY_DRAW.cy} width="360" height="132" fill="#2a2118" />
            <text x="938" y="188" textAnchor="end" className="lib-s">{tr ? 'gök' : 'sky'}</text>
            <text x="938" y="420" textAnchor="end" className="lib-s">{tr ? 'yüzey' : 'surface'}</text>
            <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} fill="none" stroke="rgba(225,6,0,.75)" strokeWidth="1.25" strokeDasharray="4 4" />
            <text x={BOX.x + BOX.w} y={BOX.y - 8} textAnchor="end" className="lib-s">{`±${tr ? String(lon).replace('.', ',') : lon}°`}</text>
            <text x={BOX.x - 8} y={BOX.y + 12} textAnchor="end" className="lib-s">{`±${tr ? String(lat).replace('.', ',') : lat}°`}</text>
            <path d={LONG_TRACE} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.25" />
            <path d={MONTH_TRACE} fill="none" stroke="#4ea4ff" strokeWidth="2" />
            <line x1="590" y1={SKY_DRAW.cy} x2="950" y2={SKY_DRAW.cy} stroke="#ffffff" strokeWidth="1.5" />
            <text x="600" y={SKY_DRAW.cy - 8} className="lib-k">{tr ? 'UFUK' : 'HORIZON'}</text>
            <line ref={dropRef} stroke="#4ea4ff" strokeWidth="1" strokeDasharray="3 3" />
            <g ref={earthRef}>
              <circle r={EARTH_R} fill="#4ea4ff" stroke="#e8f3ff" strokeWidth="1.5" />
              <circle r={EARTH_R * 0.42} cx={-EARTH_R * 0.22} cy={-EARTH_R * 0.16} fill="#b9dcff" />
            </g>
            <line x1="572" y1="456" x2="596" y2="456" stroke="rgba(255,255,255,.7)" strokeWidth="2" />
            <text x="602" y="460" className="lib-s">{tr ? 'sekiz ay' : 'eight months'}</text>
            <line x1="700" y1="456" x2="724" y2="456" stroke="#4ea4ff" strokeWidth="2" />
            <text x="730" y="460" className="lib-s">{tr ? 'bir ay' : 'one month'}</text>
            <text ref={statusRef} x="770" y="508" textAnchor="middle" className="lib-status" />
          </svg>
        </div>
        <div>
          <ol className="lib-points">
            <li><b>1</b><span>{tr
              ? 'Ay bir yüzünü Dünya’ya dönük tutar. Yüzeyden bakınca Dünya gökte neredeyse hiç kımıldamaz.'
              : 'The Moon keeps one face toward Earth, so from the surface Earth hangs almost still in the sky.'}</span></li>
            <li><b>2</b><span>{tr
              ? 'Yörünge elipstir: Ay yaklaşınca hızlanır, uzaklaşınca yavaşlar. Ekvatoru da 6,7° eğiktir. İkisi birlikte Dünya’yı boylamda yaklaşık ±7,9°, enlemde ±6,7° oynatır. Buna librasyon denir.'
              : 'The orbit is an ellipse, so the Moon speeds up and slows down, and its equator is tilted by 6.7°. Together they swing Earth by about ±7.9° in longitude and ±6.7° in latitude. That is libration.'}</span></li>
            <li><b>3</b><span>{tr
              ? 'Güney kutbunda Dünya ufuktadır. Bu salınım onu ufkun üstüne çıkarır ya da altına indirir; iniş aracı yalnızca bazı saatlerde eve seslenebilir. Touchdown bu yüzden Dünya’yı saat saat kontrol eder.'
              : 'At the south pole Earth sits on the horizon. The wobble lifts it above the horizon or drops it below, so a lander can call home only some of the time. That is why Touchdown checks Earth hour by hour.'}</span></li>
          </ol>
          <p className="lib-note"><b>{tr ? 'Şema' : 'Schematic'}</b>{tr
            ? 'Belirli bir tarihin tahmini değil. Yörüngenin basıklığı ve eğimi görülsün diye büyütüldü; gerçek dışmerkezlik 0,055’tir. Gökyüzü ölçeklidir: Dünya yaklaşık 1,9° genişliğindedir, kutu ±7,9° ve ±6,7°’dir. Parlak iz bir aydır (27,6 gün), soluk iz sekiz aydır. 27,6 ve 27,2 günlük dönemler örtüşmez, yol kapanmaz. Aramanın kendisi JPL efemerisini kullanır.'
            : 'Not a forecast for a real date. The orbit’s stretch and tilt are enlarged so you can see them; the real eccentricity is 0.055. The sky is to scale: Earth is about 1.9° wide, inside a box of ±7.9° by ±6.7°. The bright trace is one month (27.6 days), the faint trace is eight. The 27.6-day and 27.2-day swings do not match, so the path does not close. The search itself uses the JPL ephemeris.'}</p>
          <div className="lib-ctl">
            <button type="button" className="tour-btn primary" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {playing ? (tr ? 'Durdur' : 'Pause') : (tr ? 'Oynat' : 'Play')}
            </button>
            <label className="lib-slider">
              <span>{tr ? 'Örnek ay' : 'Sample month'} <b ref={dayNumRef} /></span>
              <input
                ref={sliderRef}
                type="range"
                min={0}
                max={MONTH}
                step={0.05}
                defaultValue={dayRef.current}
                onInput={onScrub}
                aria-label={tr ? 'Örnek aydaki gün' : 'Day of the sample month'}
              />
            </label>
          </div>
          <p className="lib-read" ref={readRef} />
        </div>
      </div>
    </div>
  )
}
