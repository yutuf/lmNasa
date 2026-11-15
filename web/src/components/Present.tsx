// Presentation mode (the Present button, or #present=1): the pitch's 7 sections, each one a screen of the real app or,
// for the last three, a full screen in the app's style. presentation-kit/SUNUM_AKISI.md is the script for it.
//   1 Opportunity: the judges' room (big QR)      2 Problem: Advanced, sunlight map playing
//   3 Solution: Simple, water-ice results           4 Proof: real landings panel (then the Judges button: duels)
//   5 Scale: who uses it + a live API call         6 Advantage and team         7 Vision: closing screen
// The judges' room stays mounted the whole time (App), so phones stay connected; the Judges button shows or hides it.
// PageDown / PageUp (presentation clickers) move between sections. App opens each section's app screen.
import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { ChevronLeft, ChevronRight, QrCode, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { shareOrigin } from '../publicOrigin'
import Patch from './Patch'
import '../present.css'

export type SectionId = 'opportunity' | 'problem' | 'solution' | 'proof' | 'scale' | 'team' | 'vision'
export const SECTIONS: { id: SectionId; en: string; tr: string }[] = [
  { id: 'opportunity', en: 'Opportunity', tr: 'Fırsat' },
  { id: 'problem', en: 'Problem', tr: 'Problem' },
  { id: 'solution', en: 'Solution', tr: 'Çözüm' },
  { id: 'proof', en: 'Proof', tr: 'Kanıt' },
  { id: 'scale', en: 'Scale', tr: 'Ölçek' },
  { id: 'team', en: 'Advantage & team', tr: 'Avantaj ve ekip' },
  { id: 'vision', en: 'Vision', tr: 'Vizyon' },
]

function typing(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function useQr(url: string) {
  return useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) }, [url])
}

function Tiles({ tiles }: { tiles: { k: string; b: string; s: string; c: string }[] }) {
  return (
    <div className="pr-tiles">
      {tiles.map((t, i) => (
        <div key={t.k} className="pr-tile" style={{ background: t.c }}>
          <span className="pr-tile-n">{String(i + 1).padStart(2, '0')}</span>
          <p className="pr-tile-k">{t.k}</p><p className="pr-tile-b">{t.b}</p><p className="pr-tile-s">{t.s}</p>
        </div>
      ))}
    </div>
  )
}

/** A live call to the public API: proof on screen that the endpoint answers. */
function ApiCall({ tr }: { tr: boolean }) {
  const [res, setRes] = useState<{ ok: boolean; n: number; ms: number } | null>(null)
  useEffect(() => {
    const t0 = performance.now()
    fetch('/api/v1/search?start=2027-09-01&window=12&days=14&top=5')
      .then(async (r) => { const j = r.ok ? await r.json() : null; setRes({ ok: r.ok, n: j?.sites?.length ?? 0, ms: performance.now() - t0 }) })
      .catch(() => setRes({ ok: false, n: 0, ms: 0 }))
  }, [])
  return (
    <div className="pr-api">
      <code>GET adaptlab.us/api/v1/search?start=2027-09-01&amp;days=14&amp;top=5</code>
      <span className={res ? (res.ok ? 'ok' : 'no') : ''}>{!res ? (tr ? 'çağrılıyor…' : 'calling…')
        : res.ok ? `200 · ${res.n} ${tr ? 'yer' : 'sites'} · ${(res.ms / 1000).toFixed(1).replace('.', tr ? ',' : '.')} ${tr ? 'sn' : 's'}` : (tr ? 'çevrimdışı' : 'offline')}</span>
    </div>
  )
}

function Brand() { return <p className="pr-close-brand"><Patch size={40} /> <b className="wordmark">AdaptLab</b></p> }

function Scale({ tr }: { tr: boolean }) {
  return (
    <div className="pr-close pr-one">
      <div className="pr-close-main">
        <Brand />
        <h2>{tr ? 'Aynı motor, açık API: görev ekipleri kendi yazılımından sorar.' : 'Same engine, open API: mission teams ask from their own software.'}</h2>
        <Tiles tiles={tr
          ? [{ k: 'Görev planlama', b: 'İniş aracı ekipleri', s: 'Erken aşamada yer ve tarih elemesi', c: '#5A4A9E' },
             { k: 'Bilim', b: 'Gezgin ve buz ekipleri', s: 'Buz hedefine yakın, güneş alan yerler', c: '#1F6B52' },
             { k: 'Eğitim', b: 'Sınıflar', s: 'TR/EN arayüz, 3D görev filmi, canlı oyun', c: '#9E3A2E' }]
          : [{ k: 'Mission planning', b: 'Lander teams', s: 'Early screening of sites and dates', c: '#5A4A9E' },
             { k: 'Science', b: 'Rover and ice teams', s: 'Sunlit sites near the ice targets', c: '#1F6B52' },
             { k: 'Education', b: 'Classrooms', s: 'TR/EN interface, 3D mission film, live game', c: '#9E3A2E' }]} />
        <ApiCall tr={tr} />
        <p className="pr-team">{tr ? '/search · /site · /sky · Uygulamayla aynı motor. Hedef kitle; müşteri iddiası değil.' : '/search · /site · /sky · The same engine as the app. Target users, not a customer claim.'}</p>
      </div>
    </div>
  )
}

function Team({ tr }: { tr: boolean }) {
  const rows = tr
    ? ['Görev hedefinden başlar', 'Her yeri, her iniş günü için saat saat tarar', 'Kararın nedenini gösterir', 'Gerçek inişlerle sınandı, sınırını söyler']
    : ['Starts from the mission goal', 'Scans every site, every landing day, hour by hour', 'Shows why each answer is GO or NO-GO', 'Tested against real landings, states its limits']
  return (
    <div className="pr-close pr-one">
      <div className="pr-close-main">
        <Brand />
        <h2>{tr ? 'Harita nereyi gösterir; AdaptLab nereye ve ne zaman inileceğini sıralar.' : 'Maps show where. AdaptLab ranks where and when to land, and says why.'}</h2>
        <ol className="pr-rows">{rows.map((r, i) => <li key={r}><span>{String(i + 1).padStart(2, '0')}</span>{r}</li>)}</ol>
        <Tiles tiles={tr
          ? [{ k: 'Teknik', b: 'Yusuf Kerim Kaymakçı', s: 'Motor, veri, web uygulaması', c: '#5A4A9E' },
             { k: 'Sunum', b: 'Yusuf Çırpan', s: 'Sunum ve jüri deneyimi', c: '#1F6B52' },
             { k: 'Takım', b: 'No Limits Lunar', s: 'NASA Space Apps 2026', c: '#76671F' }]
          : [{ k: 'Technical', b: 'Yusuf Kerim Kaymakçı', s: 'Engine, data, web app', c: '#5A4A9E' },
             { k: 'Presentation', b: 'Yusuf Çırpan', s: 'Presentation and judge experience', c: '#1F6B52' },
             { k: 'Team', b: 'No Limits Lunar', s: 'NASA Space Apps 2026', c: '#76671F' }]} />
      </div>
    </div>
  )
}

function Vision({ tr }: { tr: boolean }) {
  const url = shareOrigin(location.origin)
  const qr = useQr(url)
  return (
    <div className="pr-close">
      <div className="pr-close-main">
        <Brand />
        <h2>{tr ? 'Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı.' : 'Every lander that went dark had a better place, or a better day.'}<span> {tr ? 'AdaptLab onu bulur.' : 'AdaptLab finds it.'}</span></h2>
        <Tiles tiles={tr
          ? [{ k: 'Bugün', b: 'Canlı uygulama ve açık API', s: 'Tüm Ay · 5 gerçek iniş yeniden oynatıldı', c: '#5A4A9E' },
             { k: 'Sonra', b: 'Daha ince Artemis arazisi', s: 'Her araç için güç ve radyo bütçesi', c: '#1F6B52' },
             { k: 'Ardından', b: 'Her yeni inişi canlı karşılaştır', s: 'IM-3, Griffin 1 ve 2026 CLPS araçları', c: '#9E3A2E' }]
          : [{ k: 'Today', b: 'Live app and open API', s: 'Whole Moon · 5 real landings replayed', c: '#5A4A9E' },
             { k: 'Next', b: 'Finer Artemis terrain', s: 'A power and radio budget per lander', c: '#1F6B52' },
             { k: 'Then', b: 'Compare every new landing live', s: 'IM-3, Griffin 1 and the 2026 CLPS landers', c: '#9E3A2E' }]} />
        <p className="pr-team">No Limits Lunar · Yusuf Kerim Kaymakçı · Yusuf Çırpan · NASA Space Apps 2026 · {tr ? 'Bir planlama aracıdır; iniş sertifikası değildir.' : 'A planning tool, not a landing certification.'}</p>
      </div>
      <div className="pr-close-qr">
        <div className="pr-qr" role="img" aria-label={`QR: ${url}`} dangerouslySetInnerHTML={{ __html: qr }} />
        <p>{url.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  )
}

export default function Present({ lang, step, onStep, roomOn, onRoom, onExit, joined, planned }: {
  lang: Lang; step: number; onStep: (i: number) => void; roomOn: boolean; onRoom: (on: boolean) => void; onExit: () => void
  joined: number; planned: number
}) {
  const tr = lang === 'tr'
  const s = SECTIONS[step]
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || (e.key !== 'PageDown' && e.key !== 'PageUp')) return
      e.preventDefault(); e.stopImmediatePropagation()
      const n = stepRef.current + (e.key === 'PageDown' ? 1 : -1)
      if (n >= 0 && n < SECTIONS.length) onStep(n)
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [onStep])

  return (
    <>
      {!roomOn && s.id === 'scale' && <Scale tr={tr} />}
      {!roomOn && s.id === 'team' && <Team tr={tr} />}
      {!roomOn && s.id === 'vision' && <Vision tr={tr} />}
      <nav className="pr-pill" aria-label={tr ? 'Sunum' : 'Presentation'}>
        <button className="pr-x" onClick={() => onStep(step - 1)} disabled={step === 0} aria-label={tr ? 'Geri' : 'Back'}><ChevronLeft size={17} /></button>
        <span className="pr-pos"><b>{step + 1}</b>/{SECTIONS.length} · {tr ? s.tr : s.en}</span>
        <button className="pr-x" onClick={() => onStep(step + 1)} disabled={step === SECTIONS.length - 1} aria-label={tr ? 'İleri' : 'Next'}><ChevronRight size={17} /></button>
        <button className={roomOn ? 'on' : ''} onClick={() => onRoom(!roomOn)} aria-pressed={roomOn} title={tr ? 'Hakem odası ve düellolar' : 'Judges’ room and duels'}>
          <QrCode size={15} /><span>{tr ? `Hakemler ${joined}/8` : `Judges ${joined}/8`}</span>
        </button>
        {!roomOn && planned > 0 && <span className="pr-sent">{planned} {tr ? 'plan' : planned === 1 ? 'plan' : 'plans'}</span>}
        <button className="pr-x" onClick={onExit} aria-label={tr ? 'Sunumdan çık' : 'Exit the presentation'}><X size={15} /></button>
      </nav>
    </>
  )
}
