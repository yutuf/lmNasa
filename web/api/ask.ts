// "Ask Luna": the AI guide. A Vercel serverless function so the Gemini API key never reaches the browser.
// Environment: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-2.5-flash).
// The model only sees the numbers the page sends in `context` (mission settings, engine results, the selected
// site) and is told to use nothing else; it may return an action (run a search, select a result) as JSON.

export interface AskBody {
  question: string
  lang: 'en' | 'tr'
  context: unknown
  history?: { role: 'user' | 'luna'; text: string }[]
}

export interface AskReply {
  reply: string
  action: null | { type: 'search'; params: Record<string, number | string | boolean> } | { type: 'select'; rank: number }
}

const SYSTEM = `You are Luna, the guide inside LunaNav, an open-source tool that finds where and when a solar-powered
lander can land near the Moon's south pole. LunaNav's engine checks 21,856 points on NASA LOLA terrain hour by hour:
Sun above the local horizon (power), Earth above the horizon (radio), optionally a NASA Deep Space Network dish facing
the Moon, and a battery model. You receive the current mission settings and the engine's results as JSON.

Rules:
- Use ONLY numbers and facts present in the context. If something is not there, say you don't have it. Never invent
  coordinates, percentages, dates or missions.
- Answer in the user's language (lang "tr" = Turkish, "en" = English), 1 to 4 short sentences, plain words, no jargon
  unless asked. You may be warm and curious, like a planetarium guide.
- If the user describes a mission or asks to change settings, return action {"type":"search","params":{...}} with any of:
  start (YYYY-MM-DD, between 2026-11-01 and 2028-11-30), windowDays (5-90), days (1-30, time on the surface),
  sun (0-100, minimum % of hours with sunlight), earth (0-100, minimum % of hours with Earth contact),
  shadow (0-240, longest tolerated darkness in hours), batt (500-20000 Wh), slope (2-20 degrees), dsn (true/false),
  zone (landing-zone radius in metres: 0 off, 100 precision landing, 250, 500, 1000 typical robotic lander),
  zslope (2-30 degrees: 95% of the landing zone must be gentler than this).
  Only include parameters the user implied; say in the reply what you set.
- If the user asks to look at a result, return {"type":"select","rank":N} (1-based).
- Otherwise action is null.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    action: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        type: { type: 'STRING', enum: ['search', 'select'] },
        rank: { type: 'INTEGER' },
        params: {
          type: 'OBJECT',
          properties: {
            start: { type: 'STRING' }, windowDays: { type: 'INTEGER' }, days: { type: 'INTEGER' },
            sun: { type: 'INTEGER' }, earth: { type: 'INTEGER' }, shadow: { type: 'INTEGER' },
            batt: { type: 'INTEGER' }, slope: { type: 'INTEGER' }, dsn: { type: 'BOOLEAN' },
            zone: { type: 'INTEGER' }, zslope: { type: 'INTEGER' },
          },
        },
      },
      required: ['type'],
    },
  },
  required: ['reply'],
}

export function buildRequest(body: AskBody) {
  const turns = (body.history ?? []).slice(-6).map((h) => ({ role: h.role === 'luna' ? 'model' : 'user', parts: [{ text: h.text }] }))
  return {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      ...turns,
      { role: 'user', parts: [{ text: `lang: ${body.lang}\ncontext:\n${JSON.stringify(body.context).slice(0, 12000)}\n\nquestion: ${body.question}` }] },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600, responseMimeType: 'application/json', responseSchema: SCHEMA },
  }
}

export function parseReply(data: unknown): AskReply {
  const text = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '').join('') ?? ''
  const out = JSON.parse(text) as AskReply
  if (typeof out.reply !== 'string') throw new Error('no reply')
  return { reply: out.reply, action: out.action ?? null }
}

export async function ask(body: AskBody, key: string, model: string, fetchImpl: typeof fetch = fetch): Promise<AskReply> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const r = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(buildRequest(body)),
  })
  if (!r.ok) throw new Error(`Gemini ${r.status}`)
  return parseReply(await r.json())
}

interface Req { method?: string; body?: unknown }
interface Res { status: (c: number) => Res; json: (b: unknown) => void; setHeader: (k: string, v: string) => void }

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'Luna is not configured on this server (GEMINI_API_KEY missing).' })
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as AskBody
  if (!body?.question || body.question.length > 2000) return res.status(400).json({ error: 'question required (max 2000 chars)' })
  try {
    res.status(200).json(await ask(body, key, process.env.GEMINI_MODEL || 'gemini-2.5-flash'))
  } catch (e) {
    res.status(502).json({ error: String((e as Error).message ?? e) })
  }
}
