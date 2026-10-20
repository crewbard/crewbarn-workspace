/**
 * Printing labels to a Bluetooth (BLE) label printer from the browser.
 *
 * Web Bluetooth: Chrome and Edge on a computer, Chrome on Android. Not
 * Safari or anything on an iPhone, which is why the screen only offers it
 * where it works (isWebBluetoothSupported).
 *
 * Moved out of escposBluetooth.ts so it can send any label language: many
 * Bluetooth label printers (most 4x6 and 2-inch shipping ones) speak TSPL,
 * not ESC/POS, and a printer sent the wrong one blinks and does nothing.
 * The language is set on Settings › Label printer, separately from the
 * Print Bridge's, because the Bluetooth printer is usually a different
 * printer.
 *
 * What cannot be checked without the printer in hand: which service each
 * brand really uses, and how fast it can take data. The lists below are
 * the published ones; the pacing is conservative; a printer that refuses
 * long writes gets short ones.
 */
import { isWebBluetoothSupported } from '@/lib/escposBluetooth'
import { buildLabelBytes } from '@/lib/labelBytes'
import { matchPrinterLanguage, PRINTER_LANGUAGES, type PrinterLanguage } from '@/lib/printBridge'
import type { ThermalSizeKey } from '@/lib/thermalLabels'
import type { PdfLabel } from '@/lib/pdfLabels'

const uuid16 = (short: string) => `0000${short}-0000-1000-8000-00805f9b34fb`

/**
 * Services a BLE label printer puts its "send data here" characteristic
 * under. The browser only lets the page see services named here, so a
 * printer whose service is missing from this list looks like it has
 * nothing to write to.
 */
export const CANDIDATE_SERVICES = [
  uuid16('18f0'), // The common "printer" service: Phomemo, MUNBYN, many Chinese printers
  uuid16('ff00'), // HM-10 style modules
  uuid16('ffe0'), // HC-08 / HM-10 / JDY modules
  uuid16('ffe5'), // Some modules split write out to here
  uuid16('fee7'), // WeChat-style modules used in cheap printers
  uuid16('ae30'), // Mini "cat" printers and some Phomemo models
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC transparent UART (many label printers)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Xprinter, HPRT and other Chinese label printers
]

/**
 * The characteristic to write the label to, per service, when the printer
 * has the usual one. Picked ahead of "the first one that can be written":
 * some printers also expose a writable settings characteristic, and a
 * label sent there goes nowhere.
 */
export const PREFERRED_WRITE = [
  uuid16('2af1'),
  uuid16('ff02'),
  uuid16('ffe1'),
  uuid16('ffe9'),
  uuid16('fec7'),
  uuid16('ae01'),
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
]

export interface WritableCharacteristic {
  uuid: string
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
  writeValueWithResponse?: (value: BufferSource) => Promise<void>
  writeValue?: (value: BufferSource) => Promise<void>
}

interface BleService {
  uuid: string
  getCharacteristics: () => Promise<WritableCharacteristic[]>
}

interface BleDevice {
  id?: string
  name?: string
  gatt?: {
    connected?: boolean
    connect: () => Promise<{ getPrimaryServices: () => Promise<BleService[]> }>
    disconnect?: () => void
  }
}

const LANGUAGE_KEY = 'crewbarn.bluetooth.language'
const DEVICE_KEY = 'crewbarn.bluetooth.device'

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private window: not remembering is fine */
  }
}

/** What the Bluetooth printer speaks, chosen by hand, or 'auto'. */
export function bluetoothLanguageChoice(): PrinterLanguage | 'auto' {
  const v = read(LANGUAGE_KEY)
  return (PRINTER_LANGUAGES as readonly string[]).includes(v) ? (v as PrinterLanguage) : 'auto'
}

export const setBluetoothLanguage = (choice: PrinterLanguage | 'auto') =>
  write(LANGUAGE_KEY, choice === 'auto' ? null : choice)

/** The last Bluetooth printer's name, for the guess shown on the settings page. */
export const lastBluetoothPrinterName = () => {
  try {
    return (JSON.parse(read(DEVICE_KEY) || '{}') as { name?: string }).name ?? ''
  } catch {
    return ''
  }
}

/**
 * The language for a Bluetooth printer: the choice, or the guess from the
 * name it advertises ("Rollo", "MUNBYN ITPP941", "PM-241-BT" speak TSPL).
 * A name that says nothing stays on ESC/POS, which is what this always
 * sent.
 */
export function bluetoothLanguageFor(deviceName: string, choice = bluetoothLanguageChoice()): PrinterLanguage {
  if (choice !== 'auto') return choice
  return matchPrinterLanguage(deviceName) ?? 'escpos'
}

/** The characteristic to send the label to, or null when there is none. */
export async function pickWriteCharacteristic(services: BleService[]): Promise<WritableCharacteristic | null> {
  const all: WritableCharacteristic[] = []
  // In the order of the candidate list, not the order the printer happens
  // to report, so the same printer always gets the same choice.
  const rank = (u: string) => {
    const i = CANDIDATE_SERVICES.indexOf(u.toLowerCase())
    return i < 0 ? CANDIDATE_SERVICES.length : i
  }
  for (const svc of [...services].sort((a, b) => rank(a.uuid) - rank(b.uuid))) {
    try {
      all.push(...(await svc.getCharacteristics()))
    } catch {
      /* a service that will not list is skipped */
    }
  }
  const writable = all.filter((c) => c.properties.write || c.properties.writeWithoutResponse)
  for (const want of PREFERRED_WRITE) {
    const hit = writable.find((c) => c.uuid.toLowerCase() === want)
    if (hit) return hit
  }
  return writable[0] ?? null
}

export interface ChunkOptions {
  /** Bytes per write. */
  chunkSize?: number
  /** Pause between writes that get no answer, so a slow printer keeps up. */
  pauseMs?: number
  sleep?: (ms: number) => Promise<void>
}

/** Below the smallest Bluetooth packet (23 bytes, less 3 of header). */
export const SAFE_CHUNK = 20

/**
 * Send the bytes in pieces.
 *
 * Writes without an answer are faster and what most printers expect, but
 * nothing slows them down, so there is a pause after each. Writes with an
 * answer wait for the printer anyway. A printer that refuses the first
 * piece is usually one that cannot take pieces this big, so it gets the
 * smallest size every printer takes, and everything is sent again from
 * the start: nothing had been accepted yet.
 */
export async function sendChunked(
  char: WritableCharacteristic,
  bytes: Uint8Array,
  opts: ChunkOptions = {},
): Promise<void> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const noAnswer = char.properties.writeWithoutResponse && typeof char.writeValueWithoutResponse === 'function'
  const send = (slice: Uint8Array<ArrayBuffer>) => {
    if (noAnswer) return char.writeValueWithoutResponse!(slice)
    if (typeof char.writeValueWithResponse === 'function') return char.writeValueWithResponse(slice)
    if (typeof char.writeValue === 'function') return char.writeValue(slice)
    throw new Error('This printer will not take data over Bluetooth.')
  }

  const run = async (chunkSize: number, pauseMs: number) => {
    for (let off = 0; off < bytes.length; off += chunkSize) {
      try {
        await send(new Uint8Array(bytes.subarray(off, off + chunkSize)))
      } catch (e) {
        if (off === 0 && chunkSize > SAFE_CHUNK) return 'retry-small' as const
        throw e
      }
      if (noAnswer && pauseMs > 0) await sleep(pauseMs)
    }
    return 'done' as const
  }

  const first = await run(opts.chunkSize ?? 180, opts.pauseMs ?? 12)
  if (first === 'retry-small') {
    await run(SAFE_CHUNK, Math.max(2, Math.round((opts.pauseMs ?? 12) / 3)))
  }
}

/**
 * Print labels to a Bluetooth label printer.
 *
 * The browser asks which printer the first time. After that the same
 * printer is reconnected without asking (where the browser allows it), so
 * forty labels ask once, not forty times. The connection is closed at the
 * end so the printer is free for its own app or another computer.
 */
export async function printLabelsViaBluetooth({
  labels,
  thermalSize,
  copies = 1,
  preferId,
}: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
  /** Reconnect to this device if it is still permitted, rather than asking. */
  preferId?: string
}): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth is not available in this browser. Try Chrome on desktop or Android, or use the PNG download for iOS / Safari.')
  }
  if (thermalSize === 'sheet') {
    throw new Error('Bluetooth printing requires a specific thermal size, not sheet.')
  }

  const nav = navigator as Navigator & {
    bluetooth: {
      getDevices?: () => Promise<BleDevice[]>
      requestDevice: (options: { acceptAllDevices?: boolean; filters?: unknown; optionalServices?: string[] }) => Promise<BleDevice>
    }
  }

  // The printer used last time, if the browser still allows it. Never just
  // "the first device allowed": that can be somebody's headphones.
  const wantId = preferId ?? lastDeviceId()
  let device: BleDevice | null = null
  if (wantId && typeof nav.bluetooth.getDevices === 'function') {
    try {
      device = (await nav.bluetooth.getDevices()).find((d) => d.id === wantId) ?? null
    } catch {
      device = null
    }
  }

  let server: Awaited<ReturnType<NonNullable<BleDevice['gatt']>['connect']>> | null = null
  if (device?.gatt) {
    server = await connectWithRetry(device).catch(() => null)
  }
  if (!server) {
    try {
      // Every device, because a printer's name and address are unknown
      // ahead of time; the services list is what lets the page use it.
      device = await nav.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: CANDIDATE_SERVICES })
    } catch (e) {
      if (e instanceof Error && e.name === 'NotFoundError') throw new Error('No printer was picked.', { cause: e })
      if (e instanceof Error && e.name === 'SecurityError') {
        throw new Error('The printer from last time did not answer. Turn it on, then press Bluetooth printer again to pick it.', {
          cause: e,
        })
      }
      throw e
    }
    if (!device.gatt) throw new Error('That device cannot be printed to.')
    server = await connectWithRetry(device)
  }
  rememberDevice(device!)

  try {
    const services = await server.getPrimaryServices()
    const char = await pickWriteCharacteristic(services)
    if (!char) {
      throw new Error(
        'No way to send a label was found on this printer. It may not be a printer CrewBarn knows over Bluetooth. Try the Download image button instead.',
      )
    }
    const language = bluetoothLanguageFor(device!.name ?? '')
    for (const label of labels) {
      const bytes = await buildLabelBytes(label, thermalSize, language)
      for (let i = 0; i < Math.max(1, copies); i++) await sendChunked(char, bytes)
    }
  } finally {
    try {
      device!.gatt?.disconnect?.()
    } catch {
      /* already gone */
    }
  }
}

async function connectWithRetry(device: BleDevice) {
  // The first connect after the printer wakes up often fails; the second
  // usually works.
  try {
    return await device.gatt!.connect()
  } catch {
    await new Promise((r) => setTimeout(r, 400))
    return await device.gatt!.connect()
  }
}

function lastDeviceId(): string {
  try {
    return (JSON.parse(read(DEVICE_KEY) || '{}') as { id?: string }).id ?? ''
  } catch {
    return ''
  }
}

function rememberDevice(device: BleDevice) {
  if (device.id) write(DEVICE_KEY, JSON.stringify({ id: device.id, name: device.name ?? '' }))
}
