// The host a phone can open today. adaptlabs.us has no public DNS record yet, so it is not used.
export const PUBLIC_ORIGIN = 'https://lunanav-theta.vercel.app'

const REWRITE = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function shareOrigin(origin: string): string {
  try {
    const host = new URL(origin).hostname
    if (REWRITE.has(host)) return PUBLIC_ORIGIN
  } catch {
    return PUBLIC_ORIGIN
  }
  return origin.replace(/\/$/, '')
}
