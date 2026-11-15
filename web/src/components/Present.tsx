// Presentation mode (#present=1, or the Present button): walks the judges through the real app, one screen per step,
// in the pitch's order (opportunity, problem, solution, proof, the judges' own turn, scale, vision). App opens each
// step's screen; this component draws the caption, the controls and the closing screen.
// Keys: PageDown / PageUp (presentation clickers) always; arrows too, except during the film, which uses them.
import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { shareOrigin } from '../publicOrigin'
import Patch from './Patch'
import '../present.css'

type T = { en: string; tr: string }
export type PresentId = 'open' | 'problem' | 'goal' | 'results' | 'site' | 'film' | 'proof' | 'live' | 'scale' | 'close'
export interface PresentStep { id: PresentId; part: T; title: T; sub: T }

export const PRESENT_STEPS: PresentStep[] = [
  { id: 'open', part: { en: 'Opportunity', tr: 'Fırsat' },
    title: { en: 'This decade’s Moon landings aim at the south pole.', tr: 'Bu on yılın Ay inişleri güney kutbunu hedefliyor.' },
    sub: { en: 'Water ice and all 9 Artemis III regions are there, under a Sun that barely clears the horizon.', tr: 'Su buzu ve 9 Artemis III bölgesinin hepsi orada; Güneş ise ufkun ancak üstüne çıkıyor.' } },
  { id: 'problem', part: { en: 'Problem', tr: 'Problem' },
    title: { en: 'Landers die from where and when they land.', tr: 'Araçlar nereye ve ne zaman indikleri yüzünden ölüyor.' },
    sub: { en: 'IM-1 tipped over and went dark after 7 days. Chandrayaan-3 never woke from its first lunar night.', tr: 'IM-1 devrildi ve 7 günde karardı. Chandrayaan-3 ilk Ay gecesinden hiç uyanmadı.' } },
  { id: 'goal', part: { en: 'Solution', tr: 'Çözüm' },
    title: { en: 'Name the goal. AdaptLab finds where and when.', tr: 'Hedefi söyle. AdaptLab nereye ve ne zaman inileceğini bulur.' },
    sub: { en: 'What the mission is for, how long it stays, when it lands. Here: water ice.', tr: 'Görevin amacı, ne kadar kalacağı, ne zaman ineceği. Burada: su buzu.' } },
  { id: 'results', part: { en: 'Solution', tr: 'Çözüm' },
    title: { en: '21,856 points, every hour of every landing day.', tr: '21.856 nokta, her iniş gününün her saati.' },
    sub: { en: 'Sunlight, Earth contact, slope and the longest night, on NASA LOLA terrain. Ranked in about a second.', tr: 'Güneş, Dünya bağlantısı, eğim ve en uzun gece; NASA LOLA arazisinde. Yaklaşık bir saniyede sıralanır.' } },
  { id: 'site', part: { en: 'Solution', tr: 'Çözüm' },
    title: { en: 'Every site says why: GO or NO-GO.', tr: 'Her yer nedenini söyler: UYGUN ya da DEĞİL.' },
    sub: { en: 'The real terrain under the landing day’s Sun, light and radio day by day, and the biggest risk.', tr: 'İniş gününün Güneşi altında gerçek arazi, gün gün ışık ve radyo, ve en büyük risk.' } },
  { id: 'film', part: { en: 'Solution', tr: 'Çözüm' },
    title: { en: 'The mission, from launch to the rover on the ice.', tr: 'Görev: fırlatmadan buzdaki gezgine.' },
    sub: { en: 'Built from the same data: the Sun, Earth and terrain are the real ones for that site and date.', tr: 'Aynı veriden: Güneş, Dünya ve arazi o yer ve tarih için gerçek.' } },
  { id: 'proof', part: { en: 'Proof', tr: 'Kanıt' },
    title: { en: 'We replayed 5 real landings.', tr: '5 gerçek inişi yeniden oynattık.' },
    sub: { en: 'Red: when AdaptLab predicts the lander stops. White: when it really did. Blue Ghost 1: 15.0 vs 14.6 days.', tr: 'Kırmızı: AdaptLab’ın aracın duracağını öngördüğü an. Beyaz: gerçekte durduğu an. Blue Ghost 1: 15,0 / 14,6 gün.' } },
  { id: 'live', part: { en: 'Your turn', tr: 'Sıra sizde' },
    title: { en: 'Scan, plan a mission, beat AdaptLab.', tr: 'Tara, bir görev planla, AdaptLab’ı yen.' },
    sub: { en: 'Up to 8 judges. Your spot against AdaptLab’s pick, on the same live engine.', tr: 'En fazla 8 hakem. Senin yerin AdaptLab’ın seçimine karşı, aynı canlı motorla.' } },
  { id: 'scale', part: { en: 'Scale', tr: 'Ölçek' },
    title: { en: 'Advanced mode for engineers. An open API for mission tools.', tr: 'Mühendisler için gelişmiş mod. Görev araçları için açık API.' },
    sub: { en: 'Every requirement, chart and export, and the same engine at adaptlab.us/api/v1.', tr: 'Her gereksinim, grafik ve dışa aktarma; aynı motor adaptlab.us/api/v1 adresinde.' } },
  { id: 'close', part: { en: 'Vision', tr: 'Vizyon' },
    title: { en: 'Every lander that went dark had a better place, or a better day.', tr: 'Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı.' },
    sub: { en: 'AdaptLab finds it.', tr: 'AdaptLab onu bulur.' } },
]

/** Steps where the app's own screen fills everything: only the controls show, no caption. */
const BARE: PresentId[] = ['film', 'live', 'close']

function typing(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/** A live call to the public API, shown on the scale step: proof that the endpoint answers. */
function ApiCall({ tr }: { tr: boolean }) {
  const [res, setRes] = useState<{ ok: boolean; n: number; ms: number } | null>(null)
  useEffect(() => {
    const t0 = performance.now()
    fetch('/api/v1/search?start=2027-09-01&window=12&days=14&top=5')
      .then(async (r) => { const j = r.ok ? await r.json() : null; setRes({ ok: r.ok, n: j?.sites?.length ?? 0, ms: performance.now() - t0 }) })
      .catch(() => setRes({ ok: false, n: 0, ms: 0 }))
  }, [])
  return (
    <p className="pr-api">
      <code>GET /api/v1/search?start=2027-09-01&amp;days=14&amp;top=5</code>
      <span className={res ? (res.ok ? 'ok' : 'no') : ''}>{!res ? (tr ? 'çağrılıyor…' : 'calling…') : res.ok ? `200 · ${res.n} ${tr ? 'yer' : 'sites'} · ${(res.ms / 1000).toFixed(1)} s` : (tr ? 'çevrimdışı' : 'offline')}</span>
    </p>
  )
}

function Closing({ tr }: { tr: boolean }) {
  const url = shareOrigin(location.origin)
  const qr = useMemo(() => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) }, [url])
  const tiles = tr
    ? [{ k: 'Bugün', b: 'Canlı uygulama ve açık API', s: 'Tüm Ay · 5 gerçek iniş yeniden oynatıldı', c: '#5A4A9E' },
       { k: 'Sonra', b: 'Daha ince Artemis arazisi', s: 'Her araç için güç ve radyo bütçesi', c: '#1F6B52' },
       { k: 'Ardından', b: 'Her yeni inişi canlı oynat', s: 'IM-3, Griffin 1 ve 2026 CLPS araçları', c: '#9E3A2E' }]
    : [{ k: 'Today', b: 'Live app and open API', s: 'Whole Moon · 5 real landings replayed', c: '#5A4A9E' },
       { k: 'Next', b: 'Finer Artemis terrain', s: 'A power and radio budget per lander', c: '#1F6B52' },
       { k: 'Then', b: 'Replay every new landing live', s: 'IM-3, Griffin 1 and the 2026 CLPS landers', c: '#9E3A2E' }]
  return (
    <div className="pr-close">
      <div className="pr-close-main">
        <p className="pr-close-brand"><Patch size={44} /> <b className="wordmark">AdaptLab</b></p>
        <h2>{tr ? 'Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı.' : 'Every lander that went dark had a better place, or a better day.'}<span> {tr ? 'AdaptLab onu bulur.' : 'AdaptLab finds it.'}</span></h2>
        <div className="pr-tiles">
          {tiles.map((t, i) => (
            <div key={t.k} className="pr-tile" style={{ background: t.c }}>
              <span className="pr-tile-n">{String(i + 1).padStart(2, '0')}</span>
              <p className="pr-tile-k">{t.k}</p><p className="pr-tile-b">{t.b}</p><p className="pr-tile-s">{t.s}</p>
            </div>
          ))}
        </div>
        <p className="pr-team">No Limits Lunar · Yusuf Kerim Kaymakçı · Yusuf Çırpan · NASA Space Apps 2026</p>
      </div>
      <div className="pr-close-qr">
        <div className="pr-qr" role="img" aria-label={`QR: ${url}`} dangerouslySetInnerHTML={{ __html: qr }} />
        <p>{url.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  )
}

export default function Present({ lang, step, onStep, onExit }: { lang: Lang; step: number; onStep: (i: number) => void; onExit: () => void }) {
  const tr = lang === 'tr'
  const s = PRESENT_STEPS[step]
  const [caption, setCaption] = useState(true)
  const [awake, setAwake] = useState(true)
  const sleep = useRef<number | undefined>(undefined)
  const wake = () => { setAwake(true); clearTimeout(sleep.current); sleep.current = window.setTimeout(() => setAwake(false), 2500) }
  const go = (d: 1 | -1) => { const n = step + d; if (n >= 0 && n < PRESENT_STEPS.length) onStep(n); wake() }
  const goRef = useRef(go)
  goRef.current = go

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      const film = PRESENT_STEPS[step].id === 'film'
      const next = e.key === 'PageDown' || (!film && e.key === 'ArrowRight')
      const prev = e.key === 'PageUp' || (!film && e.key === 'ArrowLeft')
      if (next || prev) { e.preventDefault(); e.stopImmediatePropagation(); goRef.current(next ? 1 : -1) }
      else if (e.key === 'c' || e.key === 'C') setCaption((x) => !x)
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [step])
  useEffect(() => { wake(); return () => clearTimeout(sleep.current) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const bare = BARE.includes(s.id)
  return (
    <>
      {s.id === 'close' && <Closing tr={tr} />}
      {!bare && caption && (
        <aside className={`pr-cap${s.id === 'problem' || s.id === 'proof' ? ' right' : ''}`} key={s.id}>
          <span className="pr-num">{String(step + 1).padStart(2, '0')}</span>
          <div>
            <p className="pr-part">{tr ? s.part.tr : s.part.en}</p>
            <p className="pr-title">{tr ? s.title.tr : s.title.en}</p>
            <p className="pr-sub">{tr ? s.sub.tr : s.sub.en}</p>
            {s.id === 'scale' && <ApiCall tr={tr} />}
          </div>
        </aside>
      )}
      <nav className={`pr-bar ${awake ? 'awake' : ''}`} onMouseMove={wake} aria-label={tr ? 'Sunum' : 'Presentation'}>
        <button onClick={() => go(-1)} disabled={step === 0} aria-label={tr ? 'Geri' : 'Back'}><ChevronLeft size={18} /></button>
        <span className="pr-pos"><b>{step + 1}</b>/{PRESENT_STEPS.length} · {tr ? s.part.tr : s.part.en}</span>
        <button onClick={() => go(1)} disabled={step === PRESENT_STEPS.length - 1} aria-label={tr ? 'İleri' : 'Next'}><ChevronRight size={18} /></button>
        {!bare && <button onClick={() => setCaption((x) => !x)} aria-label={tr ? 'Yazıyı gizle' : 'Hide the caption'} title="C">{caption ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
        <button onClick={onExit} aria-label={tr ? 'Sunumdan çık' : 'Exit the presentation'}><X size={16} /></button>
      </nav>
    </>
  )
}
