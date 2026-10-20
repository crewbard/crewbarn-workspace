import { buildEscPosForLabel } from '@/lib/escposBluetooth'
import { buildEplForLabel } from '@/lib/eplLabels'
import { printerLanguage, type PrinterLanguage } from '@/lib/printBridge'
import { buildTsplForLabel } from '@/lib/tsplLabels'
import { buildZplForLabel } from '@/lib/zplLabels'
import type { PdfLabel } from '@/lib/pdfLabels'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * One label, in whatever language the printer on this desk speaks.
 *
 * Every caller that sends a label through the Print Bridge goes through
 * here, so adding a language is one case in one switch rather than a hunt
 * through the pages that print.
 */
export function buildLabelBytes(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
  language: PrinterLanguage = printerLanguage(),
): Promise<Uint8Array> {
  switch (language) {
    case 'zpl':
      return buildZplForLabel(label, thermalSize)
    case 'tspl':
      return buildTsplForLabel(label, thermalSize)
    case 'epl':
      return buildEplForLabel(label, thermalSize)
    default:
      return buildEscPosForLabel(label, thermalSize)
  }
}
