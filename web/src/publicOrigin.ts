// The name judges and phones should open. Loopback and the old Vercel host both rewrite to it.
export const PUBLIC_ORIGIN = 'https://adaptlabs.us'

const REWRITE = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'lunanav-theta.vercel.app'])

export function shareOrigin(origin: string): string {
  try {
    const host = new URL(origin).hostname
    if (REWRITE.has(host)) return PUBLIC_ORIGIN
  } catch {
    return PUBLIC_ORIGIN
  }
  return origin.replace(/\/$/, '')
}
