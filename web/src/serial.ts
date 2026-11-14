// Web Serial link to the LED-ring "sky compass" (hardware/sky_link). Chrome and Edge only.
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  writable: WritableStream<Uint8Array> | null
}

let port: SerialPortLike | null = null
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
const enc = new TextEncoder()

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator
export const serialConnected = () => writer !== null

export async function connectSerial(): Promise<boolean> {
  if (!serialSupported()) return false
  try {
    const serial = (navigator as unknown as { serial: { requestPort(): Promise<SerialPortLike> } }).serial
    port = await serial.requestPort()
    await port.open({ baudRate: 115200 })
    writer = port.writable?.getWriter() ?? null
    return writer !== null
  } catch {
    port = null
    writer = null
    return false
  }
}

export async function disconnectSerial() {
  try { writer?.releaseLock() } catch { /* already released */ }
  try { await port?.close() } catch { /* already closed */ }
  writer = null
  port = null
}

/** One sky line for the ring; azimuths are relative to the vehicle's nose, clockwise. */
export function skyLine(sunAz: number, sunFrac: number, earthAz: number, earthUp: boolean, battery: number, psr: boolean) {
  const a = (v: number) => Math.round(((v % 360) + 360) % 360)
  return `L ${a(sunAz)} ${Math.round(Math.max(0, Math.min(1, sunFrac)) * 255)} ${a(earthAz)} ${earthUp ? 1 : 0} ${Math.round(Math.max(0, Math.min(100, battery)))} ${psr ? 1 : 0}\n`
}

let busy = false
export function sendSky(line: string) {
  if (!writer || busy) return
  busy = true
  writer.write(enc.encode(line)).catch(() => disconnectSerial()).finally(() => { busy = false })
}
