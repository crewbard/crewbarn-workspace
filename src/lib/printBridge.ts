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

const BASE = 'http://127.0.0.1:28632'

const TOKEN_KEY = 'crewbarn.printBridge.token'
const PRINTER_KEY = 'crewbarn.printBridge.printer'
const LANGUAGE_KEY = 'crewbarn.printBridge.language'

export interface BridgePrinter {
  name: string
  is_default: boolean
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
}

/**
 * What the printer on this desk speaks.
 *
 * Small thermal printers overwhelmingly take ESC/POS; Zebras take ZPL and
 * ignore ESC/POS entirely — which looks identical to a dead cable, so it
 * is not something to leave to chance. 'auto' reads it off the printer's
 * own name, which is right nearly always and wrong silently, so the
 * choice can be pinned by hand when it is.
 */
export type PrinterLanguage = 'escpos' | 'zpl'

export const bridgeLanguageChoice = (): PrinterLanguage | 'auto' => {
  const stored = read(LANGUAGE_KEY)
  return stored === 'escpos' || stored === 'zpl' ? stored : 'auto'
}

export const setBridgeLanguage = (choice: PrinterLanguage | 'auto') =>
  write(LANGUAGE_KEY, choice === 'auto' ? null : choice)

/**
 * Guess from the printer's name.
 *
 * Windows names a Zebra after its driver, and every one of those drivers
 * says so: "ZDesigner GK420d", "Zebra ZD410", "ZTC ZD621". Matching the
 * model prefixes as well catches a printer somebody has renamed to just
 * "ZD410" or "Shop GX430".
 */
export function guessPrinterLanguage(printerName: string): PrinterLanguage {
  return /zebra|zdesigner|ztc|(?:zd|zt|zq|zm|gk|gx|gc|lp|tlp)[0-9]{3}/i.test(printerName)
    ? 'zpl'
    : 'escpos'
}

/** The choice if one was made, otherwise the guess. */
export function printerLanguage(): PrinterLanguage {
  const choice = bridgeLanguageChoice()
  return choice === 'auto' ? guessPrinterLanguage(bridgePrinter()) : choice
}

/** Is it configured enough to print without asking anything? */
export function bridgeReady(): boolean {
  return bridgeToken() !== '' && bridgePrinter() !== ''
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
  try {
    const controller = new AbortController()
    const bail = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(BASE + '/v1/hello', { signal: controller.signal })
    clearTimeout(bail)
    if (!res.ok) return false
    const body = (await res.json()) as { name?: string }
    // Something else could be on that port. Only ours counts.
    return typeof body.name === 'string' && body.name.includes('CrewBarn')
  } catch {
    return false
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
 * `data` is the printer's own language — ESC/POS today, ZPL when a Zebra
 * turns up. The bridge passes it through untouched, which is the whole
 * point: no driver paper size, no scaling, no fit-to-page between the
 * label and the printer.
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
 */
function toBase64(bytes: Uint8Array): string {
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
 */
export async function downloadBridgeBinary(arch: 'x64' | 'arm64' = 'x64'): Promise<void> {
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting

  const res = await fetch(`${API_URL}/v1/print-bridge/download/${arch}`, { headers })

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

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // The name the checksum instructions on the page tell people to hash.
  a.download = arch === 'arm64' ? 'crewbarn-print-bridge-arm64.exe' : 'crewbarn-print-bridge.exe'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
