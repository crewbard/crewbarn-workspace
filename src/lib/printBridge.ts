/**
 * Talking to the CrewBarn Print Bridge.
 *
 * The bridge is a small program on the user's own PC that does the one
 * thing a browser is not allowed to do: send a print job to a printer
 * chosen by name. A page cannot list printers, name one, or open a socket
 * to one — there is no API for any of it — so without the bridge the only
 * options are the print dialog or the Windows default.
 *
 * Everything here is per BROWSER, not per tenant: a printer is a physical
 * object bolted to one desk, and the same login on a laptop at home should
 * not think it has a label printer. So the token and the chosen printer
 * live in localStorage, like the label size does.
 *
 * Nothing here is required. Every call fails softly, and a shop that never
 * installs the bridge keeps the print dialog it has always had.
 */

import { API_URL, getActingTenant, getStoredToken } from '@/lib/api'
import { assertFileResponse } from '@/lib/fileResponse'

const BASE = 'http://127.0.0.1:28632'

const TOKEN_KEY = 'crewbarn.printBridge.token'
const PRINTER_KEY = 'crewbarn.printBridge.printer'
const LANGUAGE_KEY = 'crewbarn.printBridge.language'
/** A network address typed in by hand, used instead of a Windows printer. */
const HOST_KEY = 'crewbarn.printBridge.host'
/** What the bridge said about the chosen printer, last time it was asked. */
const INFO_KEY = 'crewbarn.printBridge.printerInfo'
/** What the bridge on this computer can do, from /v1/hello. */
const CAPS_KEY = 'crewbarn.printBridge.capabilities'

/**
 * One printer, as the bridge lists it.
 *
 * Version 1 of the bridge sends only `name` and `is_default`. Version 2
 * adds the Windows driver and port, which say what the printer is far more
 * reliably than a name somebody may have changed. Everything past the
 * first two is optional, so an older bridge still works.
 */
export interface BridgePrinter {
  name: string
  is_default: boolean
  driver?: string
  port?: string
  port_kind?: 'usb' | 'tcp' | 'wsd' | 'shared' | 'file' | 'other' | ''
  network?: { host: string; port: number; protocol: 'raw' | 'lpr' } | null
  dpi?: number
  offline?: boolean
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    // Private window or storage switched off. Not remembering is fine;
    // throwing on the way to printing a label is not.
    return ''
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* see above */
  }
}

export const bridgeToken = () => read(TOKEN_KEY)
export const bridgePrinter = () => read(PRINTER_KEY)
export const setBridgePrinter = (name: string | null) => write(PRINTER_KEY, name)
export const forgetBridge = () => {
  write(TOKEN_KEY, null)
  write(PRINTER_KEY, null)
  write(LANGUAGE_KEY, null)
  write(HOST_KEY, null)
  write(INFO_KEY, null)
  write(CAPS_KEY, null)
}

/** A printer's network address typed in by hand ("192.168.1.40" or "192.168.1.40:9100"). */
export const bridgeHost = () => read(HOST_KEY)
export const setBridgeHost = (host: string | null) => write(HOST_KEY, host && host.trim() ? host.trim() : null)

/** "192.168.1.40:9101" → host and port; the port defaults to 9100. */
export function splitHost(value: string): { host: string; port: number } {
  const v = value.trim()
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(v)
  if (bracketed) return { host: bracketed[1], port: bracketed[2] ? Number(bracketed[2]) : 9100 }
  const parts = v.split(':')
  if (parts.length === 2 && /^\d+$/.test(parts[1])) return { host: parts[0], port: Number(parts[1]) }
  return { host: v, port: 9100 }
}

/** The chosen printer's details from the last listing, if there were any. */
export function savedPrinterInfo(): BridgePrinter | null {
  try {
    const info = JSON.parse(read(INFO_KEY) || 'null') as BridgePrinter | null
    return info && info.name === bridgePrinter() ? info : null
  } catch {
    return null
  }
}

export const savePrinterInfo = (info: BridgePrinter | null) => write(INFO_KEY, info ? JSON.stringify(info) : null)

export function savedCapabilities(): string[] {
  try {
    const caps = JSON.parse(read(CAPS_KEY) || '[]') as unknown
    return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

/**
 * What the printer on this desk speaks.
 *
 * A printer sent the wrong language takes the data, blinks, and prints
 * nothing, which looks identical to a dead cable, so it is not something
 * to leave to chance:
 *   - ESC/POS: small receipt-style thermal printers.
 *   - ZPL: Zebras.
 *   - TSPL: most 4x6 shipping and desktop label printers (Rollo, MUNBYN,
 *     iDPRT, TSC and the like).
 *   - EPL: older Zebras such as the LP 2844, which do not know ZPL.
 * 'auto' reads it off the printer's own name, which is right nearly always
 * and wrong silently, so the choice can be pinned by hand when it is.
 */
export type PrinterLanguage = 'escpos' | 'zpl' | 'tspl' | 'epl'

export const PRINTER_LANGUAGES: readonly PrinterLanguage[] = ['tspl', 'zpl', 'epl', 'escpos']

/**
 * How a label goes to the printer: in one of the languages above, sent
 * raw, or as a picture drawn by the printer's own Windows driver. The
 * picture is for printers that take nothing but their driver (DYMO
 * LabelWriter, Brother QL), and needs version 2 of the bridge.
 */
export type PrintMode = PrinterLanguage | 'image'

/** Short name, for "Sent as ..." and the guess shown next to "auto". */
export const PRINTER_LANGUAGE_NAMES: Record<PrinterLanguage, string> = {
  escpos: 'ESC/POS',
  zpl: 'ZPL',
  tspl: 'TSPL',
  epl: 'EPL',
}

export const PRINT_MODE_NAMES: Record<PrintMode, string> = {
  ...PRINTER_LANGUAGE_NAMES,
  image: 'Printer driver',
}

const isLanguage = (v: string): v is PrinterLanguage => (PRINTER_LANGUAGES as readonly string[]).includes(v)
const isMode = (v: string): v is PrintMode => v === 'image' || isLanguage(v)

/** The choice made by hand, which always wins over anything detected. */
export const bridgeLanguageChoice = (): PrintMode | 'auto' => {
  const stored = read(LANGUAGE_KEY)
  return isMode(stored) ? stored : 'auto'
}

export const setBridgeLanguage = (choice: PrintMode | 'auto') =>
  write(LANGUAGE_KEY, choice === 'auto' ? null : choice)

/*
 * EPL-only Zebras: the LP/TLP 2844, 2824, 2742 and 2442 families and the
 * Eltron printers before them. The "-Z" models (and the ZDesigner "...-Z"
 * drivers) speak ZPL, so a trailing Z sends them to ZPL instead.
 */
const EPL_NAMES = /eltron|\bt?lp ?(?:2844|2824|2742|2442|2348)(?!\s*-?\s*z(?![a-z]))/i

/*
 * Receipt printers, which really do speak ESC/POS even from a brand that
 * also sells TSPL label printers (Xprinter's XP-58 and XP-80, Epson TM-T
 * and TM-U, anything sold by its 58 or 80 mm paper width).
 */
const RECEIPT_NAMES = /receipt|\bxp-?(?:58|76|80)|\bgp-?(?:58|80)|\b(?:58|80) ?mm\b|\bpos-?(?:58|80)\b|\btm-?[tu]\d/i

/*
 * TSPL printers, by brand and by TSC's own model prefixes (TTP-, TDP-,
 * TE200-series, DA200-series). Xprinter's label models are XP-2xx to XP-4xx.
 */
const TSPL_NAMES =
  /rollo|munbyn|idprt|gprinter|gainscha|jadens|hprt|polono|xprinter|\bxp-?[234]\d\d|beeprt|arkscan|nelko|itari|4barcode|phomemo ?pm-?24[16]|(?:^|[^a-z])tsc(?:[^a-z]|$)|\bt[td]p-?\d{3}|\bte[23]\d0\b|\bda2\d0\b/i

/*
 * Zebras that speak ZPL. Windows names a Zebra after its driver, and every
 * one of those drivers says so: "ZDesigner GK420d", "Zebra ZD410", "ZTC
 * ZD621". Matching the model prefixes as well catches a printer somebody
 * has renamed to just "ZD410" or "Shop GX430".
 */
const ZPL_NAMES = /zebra|zdesigner|ztc|(?:zd|zt|zq|zm|gk|gx|gc|lp|tlp)[0-9]{3}/i

/** The language a name or driver name says, or null when it says none. */
export function matchPrinterLanguage(text: string): PrinterLanguage | null {
  if (!text) return null
  if (EPL_NAMES.test(text)) return 'epl'
  if (RECEIPT_NAMES.test(text)) return 'escpos'
  if (TSPL_NAMES.test(text)) return 'tspl'
  if (ZPL_NAMES.test(text)) return 'zpl'
  return null
}

/**
 * Guess from the printer's name. Anything not recognised stays on ESC/POS,
 * which is what this always did; the page shows the guess and suggests
 * trying TSPL when a test label does not come out.
 */
export function guessPrinterLanguage(printerName: string): PrinterLanguage {
  return matchPrinterLanguage(printerName) ?? 'escpos'
}

/*
 * Printers that take nothing but their own driver: DYMO LabelWriters,
 * Brother QL and P-touch label printers. Also the "printers" that are
 * really a file or an app, which have no language to speak at all.
 */
const DRIVER_ONLY =
  /dymo|labelwriter|brother\s+(?:ql|pt|p-touch)|\bql-?\d{3}|\bp-?touch|\bpt-?[a-z]?\d{3}|microsoft print to pdf|microsoft xps|onenote|\bfax\b|send to/i

/* The Windows text-only driver passes bytes straight through: raw it is. */
const PASS_THROUGH_DRIVER = /generic\s*\/\s*text only|generic text/i

/* Zebra's drivers say which language they are set up for. */
const DRIVER_LANGUAGE_TAG = /\((epl|zpl)(?:\s*ii)?\)|\b(epl|zpl)\s*$/i

/**
 * What a printer speaks, from what the bridge says about it.
 *
 * The Windows driver name is the strongest clue: it is set by the
 * printer's maker and nobody renames it. With version 2 of the bridge:
 *   1. DYMO, Brother QL and similar: the printer's driver (a picture).
 *   2. A driver that names its language, then a driver or printer name
 *      that matches a known brand or model.
 *   3. The text-only driver: ESC/POS, as before.
 *   4. Anything else is a driver-only printer as far as CrewBarn can tell,
 *      so the picture goes through its driver, which knows its own printer.
 * An older bridge says nothing but the name, and the name guess is used,
 * exactly as before.
 */
export function detectPrintMode(printer: BridgePrinter | null | undefined, capabilities: readonly string[]): PrintMode {
  if (!printer) return 'escpos'
  const driver = printer.driver ?? ''
  const canImage = capabilities.includes('image')
  if (!driver) return guessPrinterLanguage(printer.name)

  if (canImage && (DRIVER_ONLY.test(driver) || DRIVER_ONLY.test(printer.name))) return 'image'

  const tag = DRIVER_LANGUAGE_TAG.exec(driver)
  if (tag) return (tag[1] ?? tag[2]).toLowerCase() as PrinterLanguage

  const known = matchPrinterLanguage(driver) ?? matchPrinterLanguage(printer.name)
  if (known) return known

  if (PASS_THROUGH_DRIVER.test(driver)) return 'escpos'
  return canImage ? 'image' : guessPrinterLanguage(printer.name)
}

/**
 * How labels go to the printer on this desk: the choice if one was made,
 * otherwise what the bridge's details say, otherwise the name guess.
 */
export function printMode(
  printer: BridgePrinter | null = savedPrinterInfo(),
  capabilities: readonly string[] = savedCapabilities(),
): PrintMode {
  const choice = bridgeLanguageChoice()
  if (choice !== 'auto') return choice
  if (bridgeHost()) return guessPrinterLanguage(bridgeHost())
  return printer ? detectPrintMode(printer, capabilities) : guessPrinterLanguage(bridgePrinter())
}

/**
 * The language for raw bytes. When labels go through the driver instead,
 * this is still the best raw guess, for the places that can only send raw.
 */
export function printerLanguage(): PrinterLanguage {
  const mode = printMode()
  return mode === 'image' ? guessPrinterLanguage(bridgePrinter()) : mode
}

/**
 * Is a printer's own network address worth sending to directly? Only a
 * Standard TCP/IP port taking raw data on a printer port, and only when
 * the bridge on this computer can do it safely (version 2 checks the
 * address is on the local network).
 */
export function directNetworkTarget(
  printer: BridgePrinter | null | undefined,
  capabilities: readonly string[],
): { host: string; port: number } | null {
  const net = printer?.network
  if (!net || !capabilities.includes('network')) return null
  if (net.protocol !== 'raw' || net.port < 9100 || net.port > 9119 || !net.host) return null
  return { host: net.host, port: net.port }
}

/** Is it configured enough to print without asking anything? */
export function bridgeReady(): boolean {
  return bridgeToken() !== '' && (bridgePrinter() !== '' || bridgeHost() !== '')
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = bridgeToken()
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ??
        'The Print Bridge did not understand that. Try restarting it.',
    )
  }
  return body as T
}

/**
 * Is the bridge running on this computer?
 *
 * A short timeout on purpose: when it is not running the request fails
 * immediately anyway, and when something else holds that port we do not
 * want a settings page hanging on it.
 */
export async function bridgeIsRunning(): Promise<boolean> {
  return (await bridgeHello()).running
}

export interface BridgeHello {
  running: boolean
  version: string
  /** raw, image, network, printer-details. Empty from version 1. */
  capabilities: string[]
}

/**
 * Is it running, which version, and what can it do. Version 1 sends no
 * capabilities, which reads as "raw printing only", which is right.
 */
export async function bridgeHello(): Promise<BridgeHello> {
  const off: BridgeHello = { running: false, version: '', capabilities: [] }
  try {
    const controller = new AbortController()
    const bail = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(BASE + '/v1/hello', { signal: controller.signal })
    clearTimeout(bail)
    if (!res.ok) return off
    const body = (await res.json()) as { name?: string; version?: string; capabilities?: unknown }
    // Something else could be on that port. Only ours counts.
    if (typeof body.name !== 'string' || !body.name.includes('CrewBarn')) return off
    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.filter((c): c is string => typeof c === 'string')
      : []
    write(CAPS_KEY, JSON.stringify(capabilities))
    return { running: true, version: typeof body.version === 'string' ? body.version : '', capabilities }
  } catch {
    return off
  }
}

/** Swap the code shown in the bridge's window for a lasting token. */
export async function pairBridge(code: string): Promise<void> {
  const body = await call<{ token: string }>('/v1/pair', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim() }),
  })
  if (!body.token) throw new Error('The Print Bridge did not send a token back.')
  write(TOKEN_KEY, body.token)
}

export async function bridgePrinters(): Promise<BridgePrinter[]> {
  const body = await call<{ printers: BridgePrinter[] }>('/v1/printers')
  return body.printers ?? []
}

/**
 * Send a label to a printer by name.
 *
 * `data` is the printer's own language: ESC/POS, ZPL, TSPL or EPL. The
 * bridge passes it through untouched, which is the whole point: no driver
 * paper size, no scaling, no fit-to-page between the label and the
 * printer.
 */
export async function bridgePrint(
  data: Uint8Array,
  opts: { printer?: string; copies?: number; jobName?: string } = {},
): Promise<void> {
  const printer = opts.printer ?? bridgePrinter()
  if (!printer) throw new Error('No printer picked yet.')

  await call('/v1/print', {
    method: 'POST',
    body: JSON.stringify({
      printer,
      data_base64: toBase64(data),
      copies: opts.copies ?? 1,
      job_name: opts.jobName ?? 'CrewBarn label',
    }),
  })
}

/**
 * A label as a picture, drawn by the printer's own driver at exactly the
 * label's size. Bridge version 2. `page_fits` is false when the driver
 * kept its own paper size: the label still prints at its size, but in the
 * corner of a bigger page, and the driver's label size needs setting.
 */
export async function bridgePrintImage(
  png: Uint8Array,
  opts: { widthMm: number; heightMm: number; printer?: string; copies?: number; jobName?: string },
): Promise<{ pageFits: boolean }> {
  const printer = opts.printer ?? bridgePrinter()
  if (!printer) throw new Error('No printer picked yet.')

  const body = await call<{ page_fits?: boolean }>('/v1/print/image', {
    method: 'POST',
    body: JSON.stringify({
      printer,
      png_base64: toBase64(png),
      width_mm: opts.widthMm,
      height_mm: opts.heightMm,
      copies: opts.copies ?? 1,
      job_name: opts.jobName ?? 'CrewBarn label',
    }),
  })
  return { pageFits: body.page_fits !== false }
}

/** A printer with an IP address, which a browser can never reach at all. */
export async function bridgePrintNetwork(
  data: Uint8Array,
  opts: { host: string; port?: number; copies?: number },
): Promise<void> {
  await call('/v1/print/network', {
    method: 'POST',
    body: JSON.stringify({
      host: opts.host,
      port: opts.port ?? 9100,
      data_base64: toBase64(data),
      copies: opts.copies ?? 1,
    }),
  })
}

/**
 * Bytes to base64, a chunk at a time.
 *
 * String.fromCharCode(...bytes) on a whole label blows the argument limit
 * — a 4x6 raster is hundreds of thousands of bytes and the call simply
 * throws.
 *
 * Byte-exact on purpose: each byte becomes one character 0-255 and btoa
 * encodes exactly those, so the binary bitmap inside a TSPL or EPL job
 * (bytes above 127 included) reaches the printer unchanged. Never route
 * these bytes through TextEncoder or a JSON string of their own: UTF-8
 * would turn every byte above 127 into two.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Download the Print Bridge binary.
 *
 * A plain `<a href>` to the API is what this used to be, and it went out
 * with no Authorization header — so clicking Download landed the tenant
 * on a page of JSON reading "Authentication required". The route is
 * behind the ordinary API guard and always was; nothing about the button
 * ever carried a token.
 *
 * So: fetch it with the bearer token, then hand the browser the bytes.
 * Five megabytes through a blob is unremarkable, and it keeps the route
 * authenticated — the repository the binary is built from is private,
 * which is the reason the API serves it at all rather than linking a
 * GitHub release.
 *
 * The API sends the SHA-256 it recorded when the build was published. The
 * bytes are checked against it before anything is saved, so a download
 * damaged on the way is refused rather than run.
 *
 * `from` swaps in another download route. The platform admin page passes its
 * own (src/admin), which needs no company picked, so no X-Act-As-Tenant
 * header is sent with it.
 */
export async function downloadBridgeBinary(
  arch: 'x64' | 'arm64' = 'x64',
  opts: { from?: string } = {},
): Promise<{ sha256: string | null; verified: boolean }> {
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting && !opts.from) headers['X-Act-As-Tenant'] = acting

  const path = opts.from ?? '/v1/print-bridge/download/'
  const res = await fetch(`${API_URL}${path}${arch}`, { headers })

  if (! res.ok) {
    let message = `Could not download the Print Bridge (${res.status}).`
    try {
      const body = (await res.json()) as { message?: string }
      if (typeof body?.message === 'string') message = body.message
    } catch {
      /* not JSON */
    }
    throw new Error(message)
  }

  assertFileResponse(res)
  const bytes = await res.arrayBuffer()
  const expected = (res.headers.get('X-Checksum-SHA256') ?? '').trim().toLowerCase()
  const actual = await sha256Hex(bytes)
  if (expected && actual && actual !== expected) {
    throw new Error(
      "The download arrived damaged: its checksum doesn't match the one recorded when it was published, so it was not saved. Try again.",
    )
  }

  // Typed as a plain binary, so nothing on the way treats it as text.
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // The name the checksum instructions on the page tell people to hash.
  a.download = arch === 'arm64' ? 'crewbarn-print-bridge-arm64.exe' : 'crewbarn-print-bridge.exe'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { sha256: actual || expected || null, verified: Boolean(expected && actual) }
}

/** SHA-256 as lowercase hex, or '' where the browser has no crypto.subtle (plain http). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return ''
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ */
/* The status light on the Print labels screen                         */
/* ------------------------------------------------------------------ */

export interface BridgeCheck {
  /** null while still asking. */
  running: boolean | null
  paired: boolean
  /** null when the bridge would not list them (not paired any more, or an error). */
  printers: BridgePrinter[] | null
  capabilities: string[]
  version: string
}

/** Ask the bridge everything the status light needs, once. */
export async function checkBridge(): Promise<BridgeCheck> {
  const paired = bridgeToken() !== ''
  const hello = await bridgeHello()
  if (!hello.running || !paired) {
    return { running: hello.running, paired, printers: null, capabilities: hello.capabilities, version: hello.version }
  }
  let printers: BridgePrinter[] | null
  try {
    printers = await bridgePrinters()
    const chosen = printers.find((p) => p.name === bridgePrinter())
    if (chosen) savePrinterInfo(chosen)
  } catch {
    printers = null
  }
  return { running: true, paired, printers, capabilities: hello.capabilities, version: hello.version }
}

export type BridgeLight = 'green' | 'amber' | 'red' | 'grey'

export interface BridgeStatus {
  light: BridgeLight
  title: string
  detail: string
  /** Labels can go straight to the printer now. */
  ready: boolean
  /** Something to set up or fix, in the printer setup. */
  needsSetup: boolean
  printer: BridgePrinter | null
  mode: PrintMode | null
}

/**
 * What the light says, from a check. Green: connected, with the printer
 * and how labels go to it. Amber: the bridge is running but the printer
 * is missing, not chosen, offline, or the pairing has lapsed. Red: paired
 * on this computer but the bridge is not running. Grey: never set up, or
 * still checking.
 */
export function describeBridge(
  check: BridgeCheck,
  chosen = bridgePrinter(),
  host = bridgeHost(),
  choice: PrintMode | 'auto' = bridgeLanguageChoice(),
): BridgeStatus {
  const base = { ready: false, needsSetup: true, printer: null, mode: null }
  if (check.running === null) {
    return { ...base, light: 'grey', title: 'Looking for the Print Bridge…', detail: '', needsSetup: false }
  }
  if (!check.running && !check.paired) {
    return {
      ...base,
      light: 'grey',
      title: 'Print Bridge not set up',
      detail: 'Set it up once and labels go straight to your label printer, with no print window.',
    }
  }
  if (!check.running) {
    return {
      ...base,
      light: 'red',
      title: 'Print Bridge is not running',
      detail: 'Start CrewBarn Print Bridge on this computer, or print another way below.',
    }
  }
  if (!check.paired) {
    return {
      ...base,
      light: 'amber',
      title: 'Print Bridge is running, not connected',
      detail: 'Type the code from its window to connect this computer.',
    }
  }
  if (check.printers === null) {
    return {
      ...base,
      light: 'amber',
      title: 'Print Bridge needs connecting again',
      detail: 'It did not accept this computer. Type a new code from its window to connect again.',
    }
  }

  const modeFor = (printer: BridgePrinter | null): PrintMode => {
    if (choice !== 'auto') return choice
    if (host) return guessPrinterLanguage(host)
    return printer ? detectPrintMode(printer, check.capabilities) : guessPrinterLanguage(chosen)
  }

  if (host) {
    const mode = modeFor(null)
    return {
      light: 'green',
      title: `Ready · ${host} · ${PRINT_MODE_NAMES[mode]}`,
      detail: 'Straight to the printer at that network address.',
      ready: true,
      needsSetup: false,
      printer: null,
      mode,
    }
  }
  if (!chosen) {
    return { ...base, light: 'amber', title: 'No label printer chosen', detail: 'Pick your label printer in the printer setup.' }
  }
  const printer = check.printers.find((p) => p.name === chosen) ?? null
  if (!printer) {
    return {
      ...base,
      light: 'amber',
      title: `Can't find ${chosen}`,
      detail: 'Check it is on and plugged in, or pick another printer.',
    }
  }
  const mode = modeFor(printer)
  if (printer.offline) {
    return {
      light: 'amber',
      title: `${chosen} · ${PRINT_MODE_NAMES[mode]}`,
      detail: 'Windows says this printer is offline. Check it is on and plugged in.',
      ready: true,
      needsSetup: false,
      printer,
      mode,
    }
  }
  return {
    light: 'green',
    title: `Ready · ${chosen} · ${PRINT_MODE_NAMES[mode]}`,
    detail: mode === 'image' ? "Through the printer's own driver, at the label's exact size." : 'Straight to the printer, no print window.',
    ready: true,
    needsSetup: false,
    printer,
    mode,
  }
}
