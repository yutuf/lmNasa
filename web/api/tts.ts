// Read-aloud. A Vercel serverless function so the ElevenLabs key never reaches the browser.
// Environment: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional),
// ELEVENLABS_VOICE_ID_TR (optional; used for Turkish when set).
// Default voice is Rachel, the premade calm voice. Model is multilingual so Turkish works.

export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
export const MODEL_ID = 'eleven_multilingual_v2'
export const MAX_CHARS = 1000

export interface TtsBody {
  text?: string
  lang?: string
}

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
}

export function voiceFor(lang: string | undefined): string {
  const turkish = process.env.ELEVENLABS_VOICE_ID_TR
  if (lang === 'tr' && turkish) return turkish
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
}

export function buildRequest(text: string) {
  return { text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }
}

export async function synthesize(text: string, voiceId: string, key: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<Uint8Array> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const r = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'audio/mpeg', 'xi-api-key': key },
    body: JSON.stringify(buildRequest(text)),
  })
  if (!r.ok) {
    await r.arrayBuffer().catch(() => undefined)
    throw new Error(`ElevenLabs ${r.status}`)
  }
  return new Uint8Array(await r.arrayBuffer())
}

interface Req { method?: string; body?: unknown }
interface Res {
  status: (c: number) => Res
  json: (b: unknown) => void
  setHeader: (k: string, v: string) => void
  send: (b: Uint8Array) => void
}

function readBody(raw: unknown): TtsBody {
  if (typeof raw === 'string') return JSON.parse(raw || '{}') as TtsBody
  if (raw && typeof raw === 'object') return raw as TtsBody
  return {}
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return res.status(503).json({ error: 'Read-aloud is not configured on this server (ELEVENLABS_API_KEY missing).' })
  let body: TtsBody
  try { body = readBody(req.body) } catch { return res.status(400).json({ error: 'invalid JSON' }) }
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > MAX_CHARS) return res.status(400).json({ error: `text required (max ${MAX_CHARS} chars)` })
  try {
    const audio = Buffer.from(await synthesize(text, voiceFor(body.lang), key))
    res.setHeader('content-type', 'audio/mpeg')
    res.setHeader('content-length', String(audio.length))
    res.status(200).send(audio)
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'ElevenLabs error' })
  }
}
