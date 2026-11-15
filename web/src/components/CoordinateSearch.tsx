// Type a lunar coordinate and hand the point to the app. This row does not search:
// onGo receives the parsed latitude and longitude, and the app evaluates that point.
import { MapPin } from 'lucide-react'
import { useId, useState } from 'react'
import { formatCoords, parseCoords, PIN_EXAMPLES } from '../pinSite'
import '../pin.css'

const COPY = {
  en: {
    label: 'Go to any point on the Moon: type coordinates',
    go: 'Go',
    placeholder: '−89.5, 120',
    examples: 'Example points',
    error: 'Could not read that. Try -89.5, 120 or 89.5S 120E.',
  },
  tr: {
    label: 'Ay’da herhangi bir noktaya git: koordinat yazın',
    go: 'Git',
    placeholder: '−89.5, 120',
    examples: 'Örnek noktalar',
    error: 'Bunu okuyamadım. Deneyin: -89.5, 120 veya 89.5G 120D.',
  },
} as const

export default function CoordinateSearch({ lang, onGo }: { lang: 'en' | 'tr'; onGo: (lat: number, lon: number) => void }) {
  const id = useId()
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const t = COPY[lang]

  const apply = (raw: string) => {
    const parsed = parseCoords(raw)
    if (!parsed) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(formatCoords(parsed.lat, parsed.lon))
    onGo(parsed.lat, parsed.lon)
  }

  return (
    <form className="pin-search" onSubmit={(e) => { e.preventDefault(); apply(text) }}>
      <label className="pin-label" htmlFor={id}>
        <MapPin size={16} strokeWidth={2.25} aria-hidden="true" />
        <span>{t.label}</span>
      </label>
      <div className="pin-row">
        <input
          id={id}
          className="pin-input"
          value={text}
          onChange={(e) => { setText(e.target.value); setInvalid(false) }}
          placeholder={t.placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          inputMode="text"
          enterKeyHint="go"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
        />
        <button type="submit" className="pin-go">{t.go}</button>
      </div>
      <div className="pin-chips" role="group" aria-label={t.examples}>
        {PIN_EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex.id}
            className="pin-chip"
            title={formatCoords(ex.lat, ex.lon)}
            onClick={() => apply(formatCoords(ex.lat, ex.lon))}
          >
            {ex.label[lang]}
          </button>
        ))}
      </div>
      {invalid && <p id={`${id}-err`} className="pin-error" role="alert">{t.error}</p>}
    </form>
  )
}
