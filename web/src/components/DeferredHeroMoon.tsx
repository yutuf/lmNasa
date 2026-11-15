import { lazy, Suspense, useEffect, useState } from 'react'
import { afterResultsPaint } from '../resultsPaint'

const HeroMoon = lazy(() => import('./HeroMoon'))

/** Mount the decorative textured sky only after the first useful results have painted. */
export default function DeferredHeroMoon() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    void afterResultsPaint().then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [])
  return ready ? <Suspense fallback={null}><HeroMoon /></Suspense> : <div className="hero-sky" aria-hidden="true" />
}
