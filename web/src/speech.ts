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

const TTS_MAX = 1000
const clips = new Map<string, Blob>()
let remoteDown = false
let token = 0
let currentAudio: HTMLAudioElement | null = null
let settle: (() => void) | null = null
let inflight: AbortController | null = null
let rawCancel: (() => void) | null = null
let hooked = false

function ttsPieces(text: string) {
  return splitSpeech(text, TTS_MAX).flatMap((part) => {
    const out: string[] = []
    for (let i = 0; i < part.length; i += TTS_MAX) out.push(part.slice(i, i + TTS_MAX))
    return out
  }).filter((part) => part.trim().length > 0)
}

function abortInflight() {
  const ctrl = inflight
  inflight = null
  try { ctrl?.abort() } catch { /* already settled */ }
}

function stopAudio() {
  const done = settle
  settle = null
  const audio = currentAudio
  currentAudio = null
  if (audio) {
    audio.onended = null
    audio.onerror = null
    try { audio.pause() } catch { /* already stopped */ }
    const src = audio.src
    try { audio.removeAttribute('src') } catch { /* ignore */ }
    if (src.startsWith('blob:')) { try { URL.revokeObjectURL(src) } catch { /* ignore */ } }
  }
  done?.()
}

// Mute buttons call speechSynthesis.cancel(). That has to stop an ElevenLabs clip too.
function installStopHook() {
  if (hooked || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  hooked = true
  const synth = window.speechSynthesis
  const original = synth.cancel.bind(synth)
  rawCancel = original
  const wrapped = () => { stopSpoken() }
  try {
    Object.defineProperty(synth, 'cancel', { configurable: true, writable: true, value: wrapped })
  } catch {
    try { (synth as { cancel: () => void }).cancel = wrapped }
    catch { rawCancel = null; hooked = false }
  }
}

function stopSpoken() {
  token += 1
  abortInflight()
  stopAudio()
  try { rawCancel?.() } catch { /* ignore */ }
}

function browserSpeak(text: string, lang: Lang, voice: SpeechVoice | undefined, rate: number) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return
  const synth = window.speechSynthesis
  try { (rawCancel ?? synth.cancel.bind(synth))() } catch { /* ignore */ }
  try {
    for (const chunk of splitSpeech(text)) {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = locale(lang)
      utterance.rate = rate
      utterance.pitch = 0.98
      utterance.volume = 1
      if (voice) utterance.voice = voice
      synth.speak(utterance)
    }
  } catch { /* speaking must never throw */ }
}

async function clip(text: string, lang: Lang): Promise<Blob | null> {
  const key = `${lang}\u0000${text}`
  const hit = clips.get(key)
  if (hit) return hit
  const ctrl = new AbortController()
  inflight = ctrl
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, lang }),
      signal: ctrl.signal,
    })
    if (ctrl.signal.aborted) return null
    if (response.status === 503 || !response.ok) { remoteDown = true; return null }
    const blob = await response.blob()
    if (ctrl.signal.aborted) return null
    if (!blob.size) { remoteDown = true; return null }
    clips.set(key, blob)
    return blob
  } catch (e) {
    if (ctrl.signal.aborted || (e instanceof Error && e.name === 'AbortError')) return null
    remoteDown = true
    return null
  } finally {
    if (inflight === ctrl) inflight = null
  }
}

function playBlob(blob: Blob, rate: number, my: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (my !== token) { resolve(false); return }
    let url = ''
    try { url = URL.createObjectURL(blob) } catch { resolve(false); return }
    const audio = new Audio()
    audio.setAttribute('playsinline', 'true')
    audio.preload = 'auto'
    currentAudio = audio
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (settle === finish) settle = null
      if (currentAudio === audio) currentAudio = null
      audio.onended = null
      audio.onerror = null
      try { audio.pause() } catch { /* already stopped */ }
      try { audio.removeAttribute('src') } catch { /* ignore */ }
      if (url) { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
      resolve(ok)
    }
    settle = () => finish(false)
    audio.onended = () => finish(true)
    audio.onerror = () => finish(false)
    audio.src = url
    const pace = Number.isFinite(rate) && rate > 0 && rate <= 4 ? rate : 0.94
    try { audio.playbackRate = pace } catch { /* browser default */ }
    audio.play().catch(() => finish(false))
  })
}

async function playRemote(my: number, text: string, lang: Lang, voice: SpeechVoice | undefined, rate: number): Promise<boolean> {
  const parts = ttsPieces(text)
  if (!parts.length) return false
  for (let i = 0; i < parts.length; i++) {
    if (my !== token) return true
    const blob = await clip(parts[i], lang)
    if (my !== token) return true
    const rest = () => { browserSpeak(parts.slice(i).join(' '), lang, voice, rate); return true }
    if (!blob) return i === 0 ? false : rest()
    const ok = await playBlob(blob, rate, my)
    if (my !== token) return true
    if (!ok) return i === 0 ? false : rest()
  }
  return true
}

async function speakNow(my: number, text: string, lang: Lang, voice: SpeechVoice | undefined, rate: number) {
  try {
    if (!remoteDown) {
      const played = await playRemote(my, text, lang, voice, rate)
      if (played || my !== token) return
    }
    if (my !== token) return
    browserSpeak(text, lang, voice, rate)
  } catch {
    if (my !== token) return
    try { browserSpeak(text, lang, voice, rate) } catch { /* speaking must never throw */ }
  }
}

export function speakText(text: string, lang: Lang, voice?: SpeechVoice, rate = 0.94) {
  try {
    if (typeof window === 'undefined' || !text.trim()) return
    installStopHook()
    stopSpoken()
    const my = token
    void speakNow(my, text, lang, voice, rate).catch(() => { /* speaking must never throw */ })
  } catch { /* speaking must never throw */ }
}

export function useSpeechVoice(lang: Lang) {
  const [voices, setVoices] = useState<SpeechVoice[]>([])
  const [selectedUri, setSelectedUri] = useState('')
  useEffect(() => {
    installStopHook()
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
