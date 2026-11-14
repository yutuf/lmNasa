import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './space.css'
import App from './App.tsx'
import JudgesPage from './components/JudgesPage.tsx'

// #judges shows the landing page (QR code, one-screen summary); anything else is the app
function Root() {
  const isJudges = () => location.hash.startsWith('#judges')
  const [judges, setJudges] = useState(isJudges)
  useEffect(() => {
    const on = () => setJudges(isJudges())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return judges ? <JudgesPage onOpen={(h) => { location.hash = h; scrollTo({ top: 0 }) }} /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
