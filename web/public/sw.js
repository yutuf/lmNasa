// LunaNav offline support. After one visit, the app and every NASA data file and 3D model it used are kept, so the
// site works without a network (a judging room with bad wifi). Pages: network first, cached copy when offline.
// Data, models, code and fonts: cache first (they are versioned by file name or never change). /api is never cached.
const VERSION = 'lunanav-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/api/')) return
  const sameOrigin = url.origin === self.location.origin
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!sameOrigin && !fonts) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(VERSION).then((c) => c.put('/', copy))
      return res
    }).catch(() => caches.match('/').then((r) => r || Response.error())))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
      const copy = res.clone()
      caches.open(VERSION).then((c) => c.put(req, copy))
    }
    return res
  })))
})
