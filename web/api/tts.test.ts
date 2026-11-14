// ElevenLabs read-aloud, against a fake fetch: request shape, missing key, text length.
import { afterEach, describe, expect, it } from 'vitest'
import handler, { DEFAULT_VOICE_ID, MODEL_ID, synthesize, voiceFor } from './tts.js'

const saved = {
  key: process.env.ELEVENLABS_API_KEY,
  voice: process.env.ELEVENLABS_VOICE_ID,
  voiceTr: process.env.ELEVENLABS_VOICE_ID_TR,
}

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  restore('ELEVENLABS_API_KEY', saved.key)
  restore('ELEVENLABS_VOICE_ID', saved.voice)
  restore('ELEVENLABS_VOICE_ID_TR', saved.voiceTr)
})

function mockRes() {
  let code = 0
  let payload: unknown
  let sent: unknown
  const headers: Record<string, string> = {}
  const res = {
    status: (c: number) => { code = c; return res },
    json: (b: unknown) => { payload = b },
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v },
    send: (b: unknown) => { sent = b },
  }
  return { res, get code() { return code }, get payload() { return payload }, get sent() { return sent }, headers }
}

describe('Read-aloud', () => {
  it('posts the text to ElevenLabs with the key in a header, never in the URL, and returns audio/mpeg', async () => {
    let seenUrl = ''
    let seenInit: RequestInit = {}
    const bytes = Uint8Array.from([0xff, 0xfb, 0x90, 0x00])
    const fake = (async (url: string, init: RequestInit) => {
      seenUrl = url
      seenInit = init
      return new Response(bytes, { status: 200 })
    }) as unknown as typeof fetch
    const audio = await synthesize('Hello Moon', DEFAULT_VOICE_ID, 'SECRET', fake)
    expect(seenUrl).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`)
    expect(seenUrl).not.toContain('SECRET')
    expect(seenInit.method).toBe('POST')
    expect((seenInit.headers as Record<string, string>)['xi-api-key']).toBe('SECRET')
    const sent = JSON.parse(seenInit.body as string)
    expect(sent.text).toBe('Hello Moon')
    expect(sent.model_id).toBe(MODEL_ID)
    expect(sent.voice_settings.stability).toBeTypeOf('number')
    expect(sent.voice_settings.similarity_boost).toBeTypeOf('number')
    expect(Array.from(audio)).toEqual(Array.from(bytes))
  })

  it('serves mpeg bytes for a string body and uses the Turkish voice when set', async () => {
    delete process.env.ELEVENLABS_VOICE_ID
    process.env.ELEVENLABS_VOICE_ID_TR = 'voice-tr'
    process.env.ELEVENLABS_API_KEY = 'SECRET'
    let seenUrl = ''
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      seenUrl = String(url)
      return new Response(Uint8Array.from([1, 2, 3]), { status: 200 })
    }) as typeof fetch
    try {
      const out = mockRes()
      await handler({ method: 'POST', body: JSON.stringify({ text: 'Merhaba Ay', lang: 'tr' }) }, out.res)
      expect(out.code).toBe(200)
      expect(seenUrl).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-tr')
      expect(seenUrl).not.toContain('SECRET')
      expect(out.headers['content-type']).toBe('audio/mpeg')
      expect(Array.from(out.sent as Uint8Array)).toEqual([1, 2, 3])
      expect(voiceFor('en')).toBe(DEFAULT_VOICE_ID)
      expect(voiceFor('tr')).toBe('voice-tr')
    } finally {
      globalThis.fetch = orig
    }
  })

  it('answers 503 without a key', async () => {
    delete process.env.ELEVENLABS_API_KEY
    const out = mockRes()
    await handler({ method: 'POST', body: { text: 'Hello', lang: 'en' } }, out.res)
    expect(out.code).toBe(503)
    expect(out.payload).toMatchObject({ error: expect.stringContaining('ELEVENLABS_API_KEY') })
  })

  it('rejects other methods', async () => {
    process.env.ELEVENLABS_API_KEY = 'SECRET'
    const out = mockRes()
    await handler({ method: 'GET', body: { text: 'Hello', lang: 'en' } }, out.res)
    expect(out.code).toBe(405)
  })

  it('rejects empty and over-long text without calling ElevenLabs', async () => {
    process.env.ELEVENLABS_API_KEY = 'SECRET'
    const orig = globalThis.fetch
    let called = 0
    globalThis.fetch = (async () => {
      called += 1
      return new Response(Uint8Array.from([7]), { status: 200 })
    }) as typeof fetch
    try {
      const empty = mockRes()
      await handler({ method: 'POST', body: { text: '   ', lang: 'en' } }, empty.res)
      expect(empty.code).toBe(400)
      const over = mockRes()
      await handler({ method: 'POST', body: { text: 'x'.repeat(1001), lang: 'en' } }, over.res)
      expect(over.code).toBe(400)
      expect(over.payload).toMatchObject({ error: expect.stringContaining('1000') })
      expect(called).toBe(0)
      const exact = mockRes()
      await handler({ method: 'POST', body: { text: 'y'.repeat(1000), lang: 'en' } }, exact.res)
      expect(exact.code).toBe(200)
      expect(called).toBe(1)
    } finally {
      globalThis.fetch = orig
    }
  })

  it('does not return the key when ElevenLabs refuses', async () => {
    process.env.ELEVENLABS_API_KEY = 'SECRET'
    const orig = globalThis.fetch
    globalThis.fetch = (async () => new Response('invalid api key SECRET', { status: 401 })) as typeof fetch
    try {
      const out = mockRes()
      await handler({ method: 'POST', body: { text: 'Hello', lang: 'en' } }, out.res)
      expect(out.code).toBe(502)
      const encoded = JSON.stringify(out.payload)
      expect(encoded).not.toContain('SECRET')
      expect(encoded).toContain('401')
    } finally {
      globalThis.fetch = orig
    }
  })
})

describe('ElevenLabs errors', () => {
  it('passes on the reason ElevenLabs gives, without the key', async () => {
    const fake = (async () => new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota.' } }), { status: 401 })) as unknown as typeof fetch
    await expect(synthesize('Hi', DEFAULT_VOICE_ID, 'SECRET-KEY', fake)).rejects.toThrow(/401 \(quota_exceeded: This request exceeds your quota\.\)/)
    await expect(synthesize('Hi', DEFAULT_VOICE_ID, 'SECRET-KEY', fake)).rejects.not.toThrow(/SECRET/)
  })
})
