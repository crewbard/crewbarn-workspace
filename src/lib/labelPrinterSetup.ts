/**
 * Setting up the Print Bridge on this computer: the steps behind the
 * printer setup panel, shared by the Print labels screen and Settings ›
 * Label printer so the two can never disagree.
 *
 * Everything is kept where printBridge.ts keeps it, in this browser's
 * storage, so a printer chosen on one screen is the printer on the other.
 * Nothing here draws anything; LabelPrinterSetup.tsx does.
 */
import {
  bridgeHost,
  bridgePrinter,
  checkBridge,
  forgetBridge,
  pairBridge,
  PRINTER_LANGUAGE_NAMES,
  savePrinterInfo,
  setBridgeHost,
  setBridgePrinter,
  splitHost,
  type BridgeCheck,
  type BridgePrinter,
} from '@/lib/printBridge'
import type { BridgeLabelResult } from '@/lib/bridgeLabels'

/**
 * Where this computer is at, in the order it gets set up:
 *   looking        still asking the bridge
 *   not-running    the bridge isn't running here (never installed, or closed)
 *   needs-pairing  it is running but this computer isn't connected, or its
 *                  connection was refused and needs a new code
 *   needs-printer  connected, but no printer chosen, or the chosen one is gone
 *   ready          connected with a printer (or a network address) to send to
 */
export type SetupStage = 'looking' | 'not-running' | 'needs-pairing' | 'needs-printer' | 'ready'

export function setupStage(check: BridgeCheck, chosen = bridgePrinter(), host = bridgeHost()): SetupStage {
  if (check.running === null) return 'looking'
  if (!check.running) return 'not-running'
  if (!check.paired || check.printers === null) return 'needs-pairing'
  if (host) return 'ready'
  if (!chosen || !check.printers.some((p) => p.name === chosen)) return 'needs-printer'
  return 'ready'
}

/** A running bridge from before version 2: it can't print through a driver or say what a printer is. */
export function bridgeOutdated(check: BridgeCheck): boolean {
  return check.running === true && check.version !== '' && !check.capabilities.includes('image')
}

/** "USB", "network, 192.168.1.40" and the like, for under the printer picker. */
export function connectedBy(p: BridgePrinter): string {
  switch (p.port_kind) {
    case 'usb':
      return 'USB'
    case 'tcp':
      return p.network ? `network, ${p.network.host}${p.network.port !== 9100 ? `:${p.network.port}` : ''}` : 'network'
    case 'wsd':
      return 'network (found by Windows)'
    case 'shared':
      return 'shared from another computer'
    case 'file':
      return 'saves a file, not a printer'
    default:
      return p.port ?? ''
  }
}

/** Remember a printer, and what the bridge said about it so printing elsewhere knows too. */
export function choosePrinter(name: string, printers: readonly BridgePrinter[] | null): void {
  setBridgePrinter(name || null)
  savePrinterInfo(name ? (printers ?? []).find((p) => p.name === name) ?? null : null)
}

/**
 * Nothing picked yet: start on the Windows default (or the only printer),
 * which is what somebody would have chosen by hand anyway. Returns the
 * printer now chosen, or '' when there is none.
 */
export function adoptDefaultPrinter(printers: readonly BridgePrinter[]): string {
  const current = bridgePrinter()
  if (current) return current
  const fallback = printers.find((p) => p.is_default) ?? printers[0]
  if (!fallback) return ''
  choosePrinter(fallback.name, printers)
  return fallback.name
}

export const PAIRING_CODE = /^\d{6}$/

/** Only digits, at most six, as the code box takes them. */
export const cleanPairingCode = (typed: string) => typed.replace(/\D/g, '').slice(0, 6)

/**
 * Connect this computer with the code from the bridge's window, then look
 * again so whatever shows the status sees it straight away. Picks the
 * Windows default printer when none is chosen yet.
 */
export async function connectBridge(
  code: string,
  deps: { pair?: (code: string) => Promise<void>; check?: () => Promise<BridgeCheck> } = {},
): Promise<BridgeCheck> {
  const typed = code.trim()
  if (!PAIRING_CODE.test(typed)) throw new Error('Type the six-digit code from the Print Bridge window.')
  await (deps.pair ?? pairBridge)(typed)
  const check = await (deps.check ?? checkBridge)()
  if (check.printers) {
    adoptDefaultPrinter(check.printers)
    // The check saved details only for a printer chosen before it ran.
    savePrinterInfo(check.printers.find((p) => p.name === bridgePrinter()) ?? null)
  }
  return check
}

/** Forget the connection on this computer. A new code is needed to connect again. */
export function disconnectBridge(check: BridgeCheck): BridgeCheck {
  forgetBridge()
  return { ...check, paired: false, printers: null }
}

/**
 * Use a printer's network address instead of a Windows printer. Returns
 * false, changing nothing, when what was typed isn't an address. An empty
 * box goes back to the printer list.
 */
export function chooseHost(typed: string): boolean {
  const value = typed.trim()
  if (value && !splitHost(value).host) return false
  setBridgeHost(value || null)
  return true
}

/** What to say after a test label, by how it went. */
export function testLabelMessage(result: BridgeLabelResult, spec: { w: number; h: number }): string {
  const size = `${spec.w}" × ${spec.h}"`
  if (result.mode === 'image') {
    return result.pageFits === false
      ? `Sent through the printer's driver. The driver kept its own paper size, so the ${size} label printed in the corner of a bigger page: ` +
          `in Windows, open the printer's Printing preferences and set the label size to ${size}.`
      : `Sent through the printer's driver at ${size}. If nothing came out, check the printer in Windows' own print queue.`
  }
  const where = result.via === 'network' ? ' straight to its network address' : ''
  return (
    `Sent as ${PRINTER_LANGUAGE_NAMES[result.mode]}${where}. If nothing came out, pick another option under ` +
    `"What it speaks" and try again${result.mode === 'tspl' ? '' : ' (TSPL first: most 4×6 and shipping label printers speak it)'}. ` +
    'A printer sent the wrong language blinks and does nothing, which looks like a dead cable.'
  )
}
