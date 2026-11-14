import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// In development, serve /api/ask and /api/tts with the same handlers Vercel runs in production.
// Keys come from web/.env.local (git-ignored): GEMINI_API_KEY, ELEVENLABS_API_KEY, optional voice ids.
function apiShim(res: ServerResponse) {
  let code = 200
  const shim = {
    status: (c: number) => { code = c; return shim },
    setHeader: (k: string, v: string) => res.setHeader(k, v),
    json: (b: unknown) => {
      res.statusCode = code
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(b))
    },
    // Raw bytes (audio/mpeg). The ask handler only uses json().
    send: (b: Uint8Array | string) => {
      res.statusCode = code
      if (typeof b === 'string') {
        if (!res.getHeader('content-type')) res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end(b)
        return
      }
      if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/octet-stream')
      const bytes = new Uint8Array(b.byteLength)
      bytes.set(b)
      res.setHeader('content-length', String(bytes.byteLength))
      res.end(bytes)
    },
  }
  return shim
}

function mount(server: ViteDevServer, moduleId: string, envAssign: Record<string, string>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      let raw = ''
      for await (const chunk of req) raw += chunk
      Object.assign(process.env, envAssign)
      const loaded = await server.ssrLoadModule(moduleId) as { default: (req: { method?: string; body?: string }, res: ReturnType<typeof apiShim>) => Promise<void> }
      await loaded.default({ method: req.method, body: raw }, apiShim(res))
    } catch { // the handler failed before it could answer
      if (!res.writableEnded) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'api error' }))
      }
    }
  }
}

function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'lunanav-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ask', mount(server, '/api/ask.ts', {
        GEMINI_API_KEY: env.GEMINI_API_KEY ?? '',
        GEMINI_MODEL: env.GEMINI_MODEL ?? '',
      }))
      server.middlewares.use('/api/tts', mount(server, '/api/tts.ts', {
        ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY ?? '',
        ELEVENLABS_VOICE_ID: env.ELEVENLABS_VOICE_ID ?? '',
        ELEVENLABS_VOICE_ID_TR: env.ELEVENLABS_VOICE_ID_TR ?? '',
      }))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), devApi(env)] }
})
