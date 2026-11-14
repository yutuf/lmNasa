// Overlays (film, workshop, decision lab, ...) and whole routes are loaded only when first opened: the first screen on
// a phone does not need their code. Each one renders nothing while its code arrives (a fraction of a second).
import { lazy, Suspense, type ComponentProps, type ComponentType } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyOverlay<C extends ComponentType<any>>(load: () => Promise<{ default: C }>) {
  const L = lazy(load)
  return function LazyOverlay(props: ComponentProps<C>) {
    return <Suspense fallback={null}><L {...props} /></Suspense>
  }
}
