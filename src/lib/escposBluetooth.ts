/**
 * Web Bluetooth + ESC/POS direct print to BLE thermal printers.
 *
 * Targets the broad family of cheap-to-prosumer BLE thermal printers
 * that speak ESC/POS (Phomemo, Munbyn, Vretti, Goojprt, plus generic
 * Amazon/Aliexpress brands). Bypasses the OS print dialog entirely —
 * pair once, then printing is one click on Chrome/Edge desktop or
 * Chrome on Android.
 *
 * iOS Safari does NOT support Web Bluetooth, so this module checks
 * `isWebBluetoothSupported()` before exposing the button. For iOS,
 * users should use the PNG download or the printer's official
 * companion app.
 *
 * Tested protocol: ESC/POS GS v 0 m xL xH yL yH d... (raster bitmap)
 *
 * The Bluetooth connection itself lives in bluetoothPrint.ts, which sends
 * whichever language the printer speaks. This file is the label raster
 * every language shares, and the ESC/POS wrapping of it.
 */
import { buildLabelPng } from '@/lib/pngLabels'
import { THERMAL_SIZES, type ThermalSizeKey } from '@/lib/thermalLabels'
import type { PdfLabel } from '@/lib/pdfLabels'

/** Most thermal BLE printers run at 203 dpi. Some at 300. We default to 203. */
export const PRINTER_DPI = 203

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth
  )
}

/** A label rendered to one bit per pixel, before any printer language. */
export interface LabelRaster {
  /** Rows of MSB-first bytes, each row padded to a byte boundary. */
  bitmap: Uint8Array
  widthPx: number
  heightPx: number
  widthBytes: number
}

/**
 * The label as pixels — the part every printer language shares.
 *
 * ESC/POS wraps it in a raster command and ZPL wraps it in a graphic
 * field, but both want exactly these bytes: one bit per pixel, MSB first,
 * rows padded to a byte boundary, 1 meaning black. Rendered at the
 * printer's own DPI so nothing is resampled downstream.
 */
export async function buildLabelRaster(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<LabelRaster> {
  const size = THERMAL_SIZES[thermalSize]
  const widthPx = Math.round(size.w * PRINTER_DPI)
  const heightPx = Math.round(size.h * PRINTER_DPI)

  // Render the label to a hidden canvas at printer DPI, then sample
  // pixels into a 1-bit bitmap.
  const labelPngUrl = await buildLabelPng(label, thermalSize, PRINTER_DPI)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')!
  const img = await loadImage(labelPngUrl)
  ctx.drawImage(img, 0, 0, widthPx, heightPx)
  const imgData = ctx.getImageData(0, 0, widthPx, heightPx)

  return {
    bitmap: pixelsToOneBitBitmap(imgData),
    widthPx,
    heightPx,
    widthBytes: Math.ceil(widthPx / 8),
  }
}

/**
 * A label as ESC/POS bytes: init → raster bitmap → feed.
 *
 * The Print Bridge and Bluetooth send the very same bytes, down a USB,
 * network or radio link. The printer does not care which pipe they
 * arrived through, and neither should this.
 */
export async function buildEscPosForLabel(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<Uint8Array> {
  const { bitmap, heightPx, widthBytes } = await buildLabelRaster(label, thermalSize)

  // ESC @ — initialize printer
  // GS v 0 m xL xH yL yH ... raster bitmap
  // LF LF LF — feed the label clear of the head
  // No cut command is sent: most label thermals have no cutter, and the
  // ones that do cut on their own setting.
  const init = new Uint8Array([0x1b, 0x40])
  const rasterHeader = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    heightPx & 0xff, (heightPx >> 8) & 0xff,
  ])
  const feed = new Uint8Array([0x0a, 0x0a, 0x0a])

  // Concat init + header + bitmap + feed
  const total = new Uint8Array(init.length + rasterHeader.length + bitmap.length + feed.length)
  let offset = 0
  total.set(init, offset); offset += init.length
  total.set(rasterHeader, offset); offset += rasterHeader.length
  total.set(bitmap, offset); offset += bitmap.length
  total.set(feed, offset)
  return total
}

/**
 * Convert RGBA imageData → 1-bit-per-pixel ESC/POS raster bytes.
 * Threshold at 50% luminance. MSB-first within each byte.
 */
function pixelsToOneBitBitmap(imgData: ImageData): Uint8Array {
  const { data, width, height } = imgData
  const widthBytes = Math.ceil(width / 8)
  const out = new Uint8Array(widthBytes * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // Luma (Rec. 601). Treat alpha=0 as white so transparent regions
      // don't print as black.
      const a = data[i + 3]
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const luma = a === 0 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b
      const bit = luma < 128 ? 1 : 0 // 1 = print (black)
      if (bit) {
        const byteIdx = y * widthBytes + (x >> 3)
        const bitMask = 0x80 >> (x & 7)
        out[byteIdx] |= bitMask
      }
    }
  }
  return out
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load label image'))
    img.src = src
  })
}
