import { Play } from 'lucide-react'
import type { Lang } from '../i18n'
import type { SpeechVoice } from '../speech'

export default function VoicePicker({ lang, voices, selected, onChange, onPreview }: {
  lang: Lang; voices: SpeechVoice[]; selected?: SpeechVoice; onChange: (id: string) => void; onPreview: () => void
}) {
  const tr = lang === 'tr'
  if (!voices.length) return <span className="voice-unavailable">{tr ? 'Bu dil için sistem sesi bulunamadı' : 'No system voice found for this language'}</span>
  return (
    <div className="voice-picker">
      <select aria-label={tr ? 'Ses seç' : 'Choose voice'} value={selected?.voiceURI ?? ''} onChange={(e) => onChange(e.target.value)}>
        {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? '' : ' · Online'}</option>)}
      </select>
      <button type="button" onClick={onPreview} aria-label={tr ? 'Sesi dene' : 'Preview voice'} title={tr ? 'Sesi dene' : 'Preview voice'}><Play size={12} /></button>
    </div>
  )
}
