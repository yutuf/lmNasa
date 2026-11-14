// The Gemini call is tested against a fake fetch: request shape, key placement, reply parsing, actions.
import { describe, expect, it } from 'vitest'
import handler, { ask, buildRequest, type AskBody } from './ask.js'

const body: AskBody = { question: 'Find a 3-week mission in March 2027', lang: 'en', context: { results: [] } }

describe('Ask Luna', () => {
  it('sends the key in a header, never in the URL, and asks for JSON', async () => {
    let seenUrl = ''
    let seenInit: RequestInit = {}
    const fake = (async (url: string, init: RequestInit) => {
      seenUrl = url
      seenInit = init
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        reply: 'Set a 21-day stay from 1 March 2027.', action: { type: 'search', params: { days: 21, start: '2027-03-01' } } }) }] } }] }))
    }) as unknown as typeof fetch
    const r = await ask(body, 'SECRET', 'gemini-2.5-flash', fake)
    expect(seenUrl).not.toContain('SECRET')
    expect((seenInit.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET')
    const sent = JSON.parse(seenInit.body as string)
    expect(sent.generationConfig.responseMimeType).toBe('application/json')
    expect(r.action).toEqual({ type: 'search', params: { days: 21, start: '2027-03-01' } })
  })

  it('keeps only the last six turns of history', () => {
    const req = buildRequest({ ...body, history: Array.from({ length: 10 }, (_, k) => ({ role: k % 2 ? 'luna' : 'user', text: `t${k}` })) })
    expect(req.contents).toHaveLength(7)
    expect(req.contents[0].role).toBe('user')
  })

  it('answers 503 without a key', async () => {
    const saved = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    let code = 0
    const res = { status: (c: number) => { code = c; return res }, json: () => undefined, setHeader: () => undefined }
    await handler({ method: 'POST', body }, res)
    expect(code).toBe(503)
    if (saved) process.env.GEMINI_API_KEY = saved
  })
})

describe('Ask Luna model fallback', () => {
  it('retries with the latest-flash alias when the model name is retired', async () => {
    const urls: string[] = []
    const fake = (async (url: string) => {
      urls.push(url)
      if (url.includes('old-model')) return new Response('{}', { status: 404 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: 'ok', action: null }) }] } }] }))
    }) as unknown as typeof fetch
    const r = await ask(body, 'K', 'old-model', fake)
    expect(r.reply).toBe('ok')
    expect(urls[1]).toContain('gemini-flash-latest')
  })
})
