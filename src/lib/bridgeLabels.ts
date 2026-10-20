/**
 * One label through the Print Bridge, whichever way this printer takes it.
 *
 * Three routes, picked from what the bridge says about the printer and
 * what the user chose on Settings › Label printer:
 *   - raw, through Windows: the label in the printer's own language
 *     (TSPL, ZPL, EPL, ESC/POS), passed to the printer untouched;
 *   - raw, straight to the printer's network address, when it has one
 *     (or one was typed in), so nothing on the PC sits in between;
 *   - a picture, drawn by the printer's own driver at exactly the label's
 *     size, for DYMO, Brother QL and anything else that only takes its
 *     driver.
 * The label size is the one picked on the screen doing the printing, for
 * every route: TSPL's SIZE, EPL's q and Q, and the picture's page.
 */
import { buildLabelBytes } from '@/lib/labelBytes'
import { buildLabelPng } from '@/lib/pngLabels'
import {
  bridgeHost,
  bridgePrint,
  bridgePrinter,
  bridgePrintImage,
  bridgePrintNetwork,
  directNetworkTarget,
  printMode,
  savedCapabilities,
  savedPrinterInfo,
  splitHost,
  type BridgePrinter,
  type PrintMode,
} from '@/lib/printBridge'
import { THERMAL_SIZES, type ThermalSizeKey } from '@/lib/thermalLabels'
import type { PdfLabel } from '@/lib/pdfLabels'

export interface BridgeLabelResult {
  mode: PrintMode
  via: 'windows' | 'network' | 'driver'
  /** Only for a picture: false when the driver kept its own paper size. */
  pageFits?: boolean
}

/** Label-roll sizes, the ones that go to a label printer one at a time. */
export const ROLL_SIZES: readonly ThermalSizeKey[] = ['1x1', '2x1', '2.25x1.25', '3x2', '4x6']

/** The test label's size: the one last picked on a Print labels screen, when it is a roll size. */
export function testLabelSize(remembered: ThermalSizeKey | null): ThermalSizeKey {
  return remembered && ROLL_SIZES.includes(remembered) ? remembered : '2.25x1.25'
}

/** A label size in millimetres, for the picture route. */
export function labelSizeMm(size: ThermalSizeKey): { widthMm: number; heightMm: number } {
  const spec = THERMAL_SIZES[size]
  if (!spec || !spec.w || !spec.h) throw new Error('Pick a label size first.')
  return { widthMm: Math.round(spec.w * 254) / 10, heightMm: Math.round(spec.h * 254) / 10 }
}

/**
 * The resolution to draw a picture at: what the driver says it prints at,
 * kept between 150 and 600, or 300 when it says nothing. The bridge
 * scales to the printer's real resolution, so this only needs to be close.
 */
export function pictureDpi(printer: BridgePrinter | null | undefined): number {
  const dpi = printer?.dpi ?? 0
  if (!dpi || !Number.isFinite(dpi)) return 300
  return Math.min(600, Math.max(150, Math.round(dpi)))
}

/** "data:image/png;base64,...." → the PNG's bytes. */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function printLabelThroughBridge(
  label: PdfLabel,
  size: ThermalSizeKey,
  opts: {
    copies?: number
    jobName?: string
    /** Fresh details from the bridge; the saved ones otherwise. */
    printer?: BridgePrinter | null
    capabilities?: readonly string[]
    /** Force a mode, e.g. the settings page testing one. */
    mode?: PrintMode
  } = {},
): Promise<BridgeLabelResult> {
  const printer = opts.printer ?? savedPrinterInfo()
  const capabilities = opts.capabilities ?? savedCapabilities()
  const mode = opts.mode ?? printMode(printer, capabilities)
  const copies = opts.copies ?? 1
  const jobName = opts.jobName ?? 'CrewBarn label'

  const typed = bridgeHost()
  if (typed) {
    if (mode === 'image') {
      throw new Error(
        'A printer reached by its network address needs a language, not its driver. Pick one under "What it speaks".',
      )
    }
    const bytes = await buildLabelBytes(label, size, mode)
    await bridgePrintNetwork(bytes, { ...splitHost(typed), copies })
    return { mode, via: 'network' }
  }

  if (mode === 'image') {
    const { widthMm, heightMm } = labelSizeMm(size)
    const png = dataUrlBytes(await buildLabelPng(label, size, pictureDpi(printer)))
    const { pageFits } = await bridgePrintImage(png, { widthMm, heightMm, copies, jobName, printer: printer?.name ?? bridgePrinter() })
    return { mode, via: 'driver', pageFits }
  }

  const bytes = await buildLabelBytes(label, size, mode)
  const direct = directNetworkTarget(printer, capabilities)
  if (direct) {
    try {
      await bridgePrintNetwork(bytes, { ...direct, copies })
      return { mode, via: 'network' }
    } catch (e) {
      // Could not connect at all: the address Windows has may be out of
      // date, or the printer only listens through a print server. Windows
      // still knows the way, so go through it. Anything else (it stopped
      // part way) is reported rather than retried, so nothing prints twice.
      const message = (e as { message?: unknown } | null)?.message
      if (typeof message !== 'string' || !/could not reach/i.test(message)) throw e
    }
  }
  await bridgePrint(bytes, { copies, jobName, printer: printer?.name ?? bridgePrinter() })
  return { mode, via: 'windows' }
}
