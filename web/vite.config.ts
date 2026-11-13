import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// In development, serve /api/ask with the same handler Vercel runs in production. The key comes from
// web/.env.local (GEMINI_API_KEY=...), which is git-ignored.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'lunanav-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ask', async (req, res) => {
        let raw = ''
        for await (const chunk of req) raw += chunk
        Object.assign(process.env, { GEMINI_API_KEY: env.GEMINI_API_KEY ?? '', GEMINI_MODEL: env.GEMINI_MODEL ?? '' })
        const { default: handler } = await server.ssrLoadModule('/api/ask.ts')
        let code = 200
        const shim = {
          status: (c: number) => { code = c; return shim },
          setHeader: (k: string, v: string) => res.setHeader(k, v),
          json: (b: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)) },
        }
        await handler({ method: req.method, body: raw }, shim)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), devApi(env)] }
})
