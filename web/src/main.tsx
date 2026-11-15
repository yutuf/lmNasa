import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './space.css'
import './release-fixes.css'
import { lazyOverlay } from './lazyOverlay.tsx'

// each route's code loads only when that route is opened (the judges page from a QR code stays light)
const App = lazyOverlay(() => import('./App.tsx'))
const JudgesPage = lazyOverlay(() => import('./components/JudgesPage.tsx'))
const PhoneGuest = lazyOverlay(() => import('./components/PhoneApp.tsx').then((m) => ({ default: m.PhoneGuest })))
const LiveSession = lazyOverlay(() => import('./components/LiveSession.tsx'))
const LiveJoin = lazyOverlay(() => import('./components/LiveJoin.tsx'))

// #phone is the full-screen phone (accelerometer). #judges is the landing page. Anything else is the app.
function Root() {
  const route = () => location.hash.startsWith('#join') ? 'join' : location.hash.startsWith('#live') ? 'live' : location.hash.startsWith('#phone') ? 'phone' : location.hash.startsWith('#judges') ? 'judges' : 'app'
  const [page, setPage] = useState(route)
  useEffect(() => {
    const on = () => setPage(route())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  if (page === 'join') return <LiveJoin />
  if (page === 'live') return <LiveSession />
  if (page === 'phone') return <PhoneGuest />
  return page === 'judges'
    ? <JudgesPage onOpen={(h) => { location.hash = h; scrollTo({ top: 0 }) }} />
    : <App />
}

// offline support (production only): keeps the app, the NASA data and the models it used (public/sw.js)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
