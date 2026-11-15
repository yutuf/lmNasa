// Presentation mode (the Present button, or #present=1). Three screens, nothing drawn over the app:
//   room: the judges' live room, big QR and room code (opens first, so the judges join while you talk);
//   app:  the plain app, you demo it yourself; the room keeps running in the background, phones stay connected;
//   end:  the closing screen with the team and a QR to the site.
// A small pill (bottom right) switches screens and shows how many judges joined. PageDown / PageUp (presentation
// clickers) go room -> app -> end and back. App keeps LiveSession mounted while presenting; this draws the pill and
// the closing screen.
import { useEffect, useMemo, useRef } from 'react'
import qrcode from 'qrcode-generator'
import { Flag, MonitorPlay, QrCode, X } from 'lucide-react'
import type { Lang } from '../i18n'
import { shareOrigin } from '../publicOrigin'
import Patch from './Patch'
import '../present.css'

export type PresentView = 'room' | 'app' | 'end'
const ORDER: PresentView[] = ['room', 'app', 'end']

function typing(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
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

export default function Present({ lang, view, onView, onExit, joined, planned }: {
  lang: Lang; view: PresentView; onView: (v: PresentView) => void; onExit: () => void; joined: number; planned: number
}) {
  const tr = lang === 'tr'
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || (e.key !== 'PageDown' && e.key !== 'PageUp')) return
      e.preventDefault(); e.stopImmediatePropagation()
      const i = ORDER.indexOf(viewRef.current) + (e.key === 'PageDown' ? 1 : -1)
      if (i >= 0 && i < ORDER.length) onView(ORDER[i])
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [onView])

  const btn = (v: PresentView, icon: React.ReactNode, label: string) => (
    <button className={view === v ? 'on' : ''} onClick={() => onView(v)} aria-pressed={view === v}>{icon}<span>{label}</span></button>
  )
  return (
    <>
      {view === 'end' && <Closing tr={tr} />}
      <nav className="pr-pill" aria-label={tr ? 'Sunum' : 'Presentation'}>
        {btn('room', <QrCode size={15} />, tr ? `Hakemler ${joined}/8` : `Judges ${joined}/8`)}
        {btn('app', <MonitorPlay size={15} />, tr ? 'Uygulama' : 'App')}
        {btn('end', <Flag size={15} />, tr ? 'Kapanış' : 'End')}
        {view !== 'room' && planned > 0 && <span className="pr-sent" title={tr ? 'Planını gönderen hakemler' : 'Judges who sent a plan'}>{planned} {tr ? 'plan' : planned === 1 ? 'plan' : 'plans'}</span>}
        <button className="pr-x" onClick={onExit} aria-label={tr ? 'Sunumdan çık' : 'Exit the presentation'}><X size={15} /></button>
      </nav>
    </>
  )
}
