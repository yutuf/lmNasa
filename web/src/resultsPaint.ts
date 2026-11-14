/** Decorative terrain must not compete with the first results. No data values depend on this gate. */
let ready: Promise<void> | undefined
export function afterResultsPaint(): Promise<void> {
  return ready ??= new Promise<void>((resolve) => {
    const painted = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    const hasResults = () => document.querySelector('.site-card, #results .table tbody tr') !== null
    if (hasResults()) { painted(); return }
    const observer = new MutationObserver(() => {
      if (hasResults()) { observer.disconnect(); painted() }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}
