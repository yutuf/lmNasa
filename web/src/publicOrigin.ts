// The host a phone can open. Loopback, www, and the old Vercel host all rewrite to it.
export const PUBLIC_ORIGIN = 'https://adaptlab.us'

const REWRITE = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'www.adaptlab.us', 'lunanav-theta.vercel.app'])

export function shareOrigin(origin: string): string {
  try {
    const host = new URL(origin).hostname
    if (REWRITE.has(host)) return PUBLIC_ORIGIN
  } catch {
    return PUBLIC_ORIGIN
  }
  return origin.replace(/\/$/, '')
}
