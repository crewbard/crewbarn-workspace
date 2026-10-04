import { buildEscPosForLabel } from '@/lib/escposBluetooth'
import { printerLanguage, type PrinterLanguage } from '@/lib/printBridge'
import { buildZplForLabel } from '@/lib/zplLabels'
import type { PdfLabel } from '@/lib/pdfLabels'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * One label, in whatever language the printer on this desk speaks.
 *
 * Every caller that sends a label through the Print Bridge goes through
 * here, so adding a third language later is one case in one switch rather
 * than a hunt through the pages that print.
 */
export function buildLabelBytes(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
  language: PrinterLanguage = printerLanguage(),
): Promise<Uint8Array> {
  return language === 'zpl'
    ? buildZplForLabel(label, thermalSize)
    : buildEscPosForLabel(label, thermalSize)
}
