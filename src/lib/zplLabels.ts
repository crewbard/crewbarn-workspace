import { buildLabelRaster, type LabelRaster } from '@/lib/escposBluetooth'
import type { PdfLabel } from '@/lib/pdfLabels'
import type { ThermalSizeKey } from '@/lib/thermalLabels'

/**
 * Labels for Zebra printers.
 *
 * Zebras do not speak ESC/POS. Sent a raster command they either print a
 * page of garbage or, more often, sit there — which looks exactly like a
 * broken cable or a bad pairing, and is the sort of thing a shop gives up
 * on rather than reports. Zebra is also the label printer most likely to
 * already be on the counter of a business that prints labels at all, so
 * "it is not supported" was the wrong answer to leave in place.
 *
 * Nothing here re-does the hard part. The label is rasterised once, the
 * same way it is for every other printer, and this only changes the
 * envelope: ZPL wants a graphic field where ESC/POS wants a raster
 * command. Same pixels, same DPI, same look.
 */

/** ZPL wants ASCII hex, two characters a byte, uppercase. */
function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out.toUpperCase()
}

/**
 * The ZPL envelope around an already-rasterised label.
 *
 * Separate from the rasterising so it can be checked without a browser:
 * the canvas work needs a DOM, the byte counts and the field syntax are
 * arithmetic, and the arithmetic is the part that silently produces a
 * blank label when it is wrong.
 *
 * ^GFA takes the bitmap as it already is — one bit per pixel, MSB first,
 * rows padded to a byte boundary, 1 meaning black — so no repacking is
 * needed. It is sent as ASCII hex rather than binary or Z64: twice the
 * size of binary, which at roughly 30 KB for a 2×1 nobody will notice,
 * and it cannot be mangled by anything in the path that takes an interest
 * in control characters.
 *
 * The graphic field is emitted as one unbroken line. A newline inside
 * ^GFA data is not reliably ignored across firmware, and a printer that
 * decides the field ended early prints the top inch and stops.
 *
 * ^PW and ^LL are set from the label's own size so a printer that has
 * never been calibrated still prints at the right dimensions. Darkness,
 * speed and media type are deliberately left alone — those are set on the
 * printer for the stock in it, and a label job has no business overriding
 * what somebody calibrated.
 */
export function zplForRaster(raster: LabelRaster): string {
  const { bitmap, heightPx, widthBytes } = raster
  const total = bitmap.length

  return [
    '^XA',
    // Print width in dots. Taken from the padded row, so it matches the
    // bitmap rather than the label's nominal width.
    `^PW${widthBytes * 8}`,
    `^LL${heightPx}`,
    // Home at the top-left corner, so the field below lands where the
    // preview says it will.
    '^LH0,0',
    `^FO0,0^GFA,${total},${total},${widthBytes},${toHex(bitmap)}^FS`,
    '^XZ',
    '',
  ].join('\n')
}

/** A label as ZPL bytes, ready for the Print Bridge to hand to the spooler. */
export async function buildZplForLabel(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<Uint8Array> {
  return new TextEncoder().encode(zplForRaster(await buildLabelRaster(label, thermalSize)))
}
