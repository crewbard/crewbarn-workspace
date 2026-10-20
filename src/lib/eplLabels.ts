import { buildLabelRaster, type LabelRaster } from '@/lib/escposBluetooth'
import { invertBits } from '@/lib/tsplLabels'
import type { PdfLabel } from '@/lib/pdfLabels'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * Labels for EPL2 printers: older Zebras such as the LP 2844 and TLP 2844
 * (and the Eltron printers they came from). They do not understand ZPL, so
 * a Zebra name alone is not enough to pick it.
 *
 * N clears the image buffer, q sets the print width and Q the label length
 * and gap (both in dots), GW writes the picture, P1 prints one.
 *
 * POLARITY. In GW data a 0 bit is a black dot and a 1 bit is white, the
 * opposite of our raster (1 = black). Source: Zebra's own note on the GW
 * command (https://cpws.zebra.com/cpws/docs/eltron/gw_command.htm): "In
 * the binary data, a 1 = white dot and 0 = black dot". The EPL2
 * Programmer's Manual describes the data as raw binary, p3 bytes by p4
 * lines. So every byte is inverted, exactly as for TSPL.
 *
 * The opening blank line ends any half-sent command a previous job left
 * behind, which is what Zebra's examples do.
 */

/** About 3 mm at 203 dpi, the usual gap on Zebra die-cut stock. The printer's sensor corrects small differences. */
export const EPL_GAP_DOTS = 24

const ascii = (s: string) => {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f
  return out
}

/** The EPL2 job around an already-rasterised label. Pure, so it can be checked without a browser. */
export function eplForRaster(raster: LabelRaster, opts: { gapDots?: number } = {}): Uint8Array {
  const gap = opts.gapDots ?? EPL_GAP_DOTS
  const { bitmap, heightPx, widthBytes } = raster

  const head = ascii(
    ['', 'N', `q${widthBytes * 8}`, `Q${heightPx},${gap}`, `GW0,0,${widthBytes},${heightPx},`].join('\r\n'),
  )
  const tail = ascii('\r\nP1\r\n')
  const body = invertBits(bitmap)

  const out = new Uint8Array(head.length + body.length + tail.length)
  out.set(head, 0)
  out.set(body, head.length)
  out.set(tail, head.length + body.length)
  return out
}

/** A label as EPL2 bytes, ready for the Print Bridge to hand to the spooler. */
export async function buildEplForLabel(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<Uint8Array> {
  return eplForRaster(await buildLabelRaster(label, thermalSize))
}
