import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// In development, serve /api/ask, /api/tts and /api/v1 with the same handlers Vercel runs in production.
// Keys come from web/.env.local (git-ignored): GEMINI_API_KEY, ELEVENLABS_API_KEY, optional voice ids.
function apiShim(res: ServerResponse) {
  let code = 200
  const shim = {
    status: (c: number) => { code = c; return shim },
    setHeader: (k: string, v: string) => res.setHeader(k, v),
    json: (b: unknown) => {
      res.statusCode = code
      if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(b))
    },
    end: (body?: string) => {
      res.statusCode = code
      res.end(body ?? '')
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
      const loaded = await server.ssrLoadModule(moduleId) as { default: (req: { method?: string; body?: string; url?: string }, res: ReturnType<typeof apiShim>) => Promise<void> }
      await loaded.default({ method: req.method, body: raw, url: req.url }, apiShim(res))
    } catch (err) { // the handler failed before it could answer
      console.error(err)
      if (!res.writableEnded) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'api error' }))
      }
    }
  }
}

function v1Module(url: string | undefined): string | null {
  const path = (url ?? '/').split('?')[0].replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/index') return '/api/v1/index.ts'
  if (path === '/site') return '/api/v1/site.ts'
  if (path === '/search') return '/api/v1/search.ts'
  if (path === '/sky') return '/api/v1/sky.ts'
  return null
}

function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'adaptlab-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/v1', async (req, res) => {
        const file = v1Module(req.url)
        if (!file) {
          res.statusCode = 404
          res.setHeader('access-control-allow-origin', '*')
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'public, max-age=3600')
          res.end(JSON.stringify({ error: 'Unknown endpoint. See /api/v1.' }))
          return
        }
        await mount(server, file, {})(req, res)
      })
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
  return {
    plugins: [react(), devApi(env)],
    // the 3D libraries in their own files: cached across releases and fetched in parallel with the app code
    build: { rollupOptions: { output: { manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei'] } } } },
  }
})
