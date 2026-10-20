import { buildLabelRaster, PRINTER_DPI, type LabelRaster } from '@/lib/escposBluetooth'
import type { PdfLabel } from '@/lib/pdfLabels'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * Labels for TSPL printers.
 *
 * TSPL (TSC's language) is what most 4x6 shipping and desktop label
 * printers speak: Rollo, MUNBYN, JADENS, iDPRT, HPRT, Polono, Xprinter,
 * Beeprt, Arkscan, TSC itself. Sent ESC/POS or ZPL they take the data,
 * blink, and print nothing, which looks exactly like a broken cable.
 *
 * Same pixels as every other language (buildLabelRaster). Only the wrapping
 * changes: SIZE and GAP describe the stock, CLS clears the image buffer,
 * BITMAP places the picture and PRINT prints one.
 *
 * POLARITY. In a TSPL BITMAP a 0 bit prints a dot and a 1 bit leaves it
 * white, the opposite of our raster (1 = black). Source: TSC "TSPL/TSPL2
 * Programming Language" manual, BITMAP command; its worked example draws
 * the shape with 0 bits on a field of 1s
 * (https://btpos.md/wp-content/uploads/2024/03/TSC-Programming-Manual-TSPLTSPL2-EN.pdf).
 * tspl-core's protocol notes say the same and invert the same way
 * (https://thermal-label.github.io/tspl-core/protocol/tspl). So every byte
 * is inverted here. Row padding past the label's width is 0 in our raster,
 * which becomes 1, white, as it should.
 *
 * Commands end in CRLF, as in the manual. The bitmap is raw binary, not
 * hex: TSPL has no hex form of BITMAP. That is safe end to end because the
 * bytes travel as base64 to the Print Bridge and as RAW to the spooler.
 */

/** The gap between labels on most die-cut rolls. The printer's own gap sensor corrects small differences. */
export const TSPL_GAP_MM = 2

const ascii = (s: string) => {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f
  return out
}

/** Dots to millimetres at the printer's DPI, one decimal place, no trailing ".0". */
function mm(dots: number, dpi: number): string {
  return String(Math.round((dots / dpi) * 25.4 * 10) / 10)
}

/** One's complement of every byte: our 1 = black becomes TSPL's 0 = black. */
export function invertBits(bitmap: Uint8Array): Uint8Array {
  const out = new Uint8Array(bitmap.length)
  for (let i = 0; i < bitmap.length; i++) out[i] = ~bitmap[i] & 0xff
  return out
}

/** The TSPL job around an already-rasterised label. Pure, so it can be checked without a browser. */
export function tsplForRaster(
  raster: LabelRaster,
  opts: { dpi?: number; gapMm?: number } = {},
): Uint8Array {
  const dpi = opts.dpi ?? PRINTER_DPI
  const gap = opts.gapMm ?? TSPL_GAP_MM
  const { bitmap, widthPx, heightPx, widthBytes } = raster

  const head = ascii(
    [
      `SIZE ${mm(widthPx, dpi)} mm,${mm(heightPx, dpi)} mm`,
      `GAP ${gap} mm,0 mm`,
      'DIRECTION 0,0',
      'REFERENCE 0,0',
      'CLS',
      `BITMAP 0,0,${widthBytes},${heightPx},0,`,
    ].join('\r\n'),
  )
  const tail = ascii('\r\nPRINT 1,1\r\n')
  const body = invertBits(bitmap)

  const out = new Uint8Array(head.length + body.length + tail.length)
  out.set(head, 0)
  out.set(body, head.length)
  out.set(tail, head.length + body.length)
  return out
}

/** A label as TSPL bytes, ready for the Print Bridge to hand to the spooler. */
export async function buildTsplForLabel(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<Uint8Array> {
  return tsplForRaster(await buildLabelRaster(label, thermalSize))
}
