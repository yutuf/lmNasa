import { useEffect, useMemo, useState } from 'react'
import type { Lang } from './i18n'

export type SpeechVoice = SpeechSynthesisVoice
const voiceKey = (lang: Lang) => `lunanav-voice-${lang}`
const locale = (lang: Lang) => lang === 'tr' ? 'tr-TR' : 'en-US'

function rankVoice(voice: SpeechVoice, lang: Lang) {
  const language = voice.lang.toLowerCase()
  const wanted = locale(lang).toLowerCase()
  let score = language === wanted ? 40 : language.startsWith(lang) ? 25 : 0
  if (/natural|neural|enhanced|premium/i.test(voice.name)) score += 35
  else if (/google|microsoft|online/i.test(voice.name)) score += 14
  if (voice.localService) score += 4
  if (voice.default) score += 1
  return score
}

export function speechVoices(lang: Lang) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith(lang))
    .sort((a, b) => rankVoice(b, lang) - rankVoice(a, lang) || a.name.localeCompare(b.name))
}

export function splitSpeech(text: string, max = 190) {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]?/g) ?? [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences.map((part) => part.trim()).filter(Boolean)) {
    if ((current + ' ' + sentence).trim().length <= max) {
      current = `${current} ${sentence}`.trim()
      continue
    }
    if (current) chunks.push(current)
    if (sentence.length <= max) { current = sentence; continue }
    const words = sentence.split(' ')
    current = ''
    for (const word of words) {
      if ((current + ' ' + word).trim().length > max && current) { chunks.push(current); current = word }
      else current = `${current} ${word}`.trim()
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function speakText(text: string, lang: Lang, voice?: SpeechVoice, rate = 0.94) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return
  const synth = window.speechSynthesis
  synth.cancel()
  for (const chunk of splitSpeech(text)) {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.lang = locale(lang)
    utterance.rate = rate
    utterance.pitch = 0.98
    utterance.volume = 1
    if (voice) utterance.voice = voice
    synth.speak(utterance)
  }
}

export function useSpeechVoice(lang: Lang) {
  const [voices, setVoices] = useState<SpeechVoice[]>([])
  const [selectedUri, setSelectedUri] = useState('')
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const sync = () => setVoices(speechVoices(lang))
    sync()
    window.speechSynthesis.addEventListener('voiceschanged', sync)
    const retry = window.setTimeout(sync, 500)
    return () => { window.clearTimeout(retry); window.speechSynthesis.removeEventListener('voiceschanged', sync) }
  }, [lang])
  const preferred = voices[0]
  const selected = useMemo(() => voices.find((voice) => voice.voiceURI === selectedUri) ?? preferred, [voices, selectedUri, preferred])
  const choose = (uri: string) => {
    setSelectedUri(uri)
    try { localStorage.setItem(voiceKey(lang), uri) } catch { /* private mode */ }
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(voiceKey(lang))
      if (saved && voices.some((voice) => voice.voiceURI === saved)) setSelectedUri(saved)
      else if (preferred) setSelectedUri(preferred.voiceURI)
    } catch { if (preferred) setSelectedUri(preferred.voiceURI) }
  }, [lang, voices, preferred])
  return { voices, selected, choose, speak: (text: string, rate?: number) => speakText(text, lang, selected, rate) }
}
