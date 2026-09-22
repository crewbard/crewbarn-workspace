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
 * Common service / characteristic UUIDs are listed in CANDIDATE_SERVICES.
 */
import { buildLabelPng } from '@/lib/pngLabels'
import { THERMAL_SIZES, type ThermalSizeKey } from '@/lib/thermalLabels'
import type { PdfLabel } from '@/lib/pdfLabels'

/** Service UUIDs known to host the printer's writable characteristic. */
const CANDIDATE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common Phomemo / many ESC/POS BLE
  '0000ff00-0000-1000-8000-00805f9b34fb', // HM-10 family
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HC-08 / generic
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BLE module
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Some Brother / TPL printers
]

/** Most thermal BLE printers run at 203 dpi. Some at 300. We default to 203. */
const PRINTER_DPI = 203

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth
  )
}

/**
 * Print one or more labels to a BLE thermal printer.
 * The browser will prompt the user to pick the printer from a device
 * chooser the first time. After pairing, subsequent prints reuse the
 * same device until the page is reloaded.
 */
export async function printLabelsViaBluetooth({
  labels,
  thermalSize,
  copies = 1,
}: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
}): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth is not available in this browser. Try Chrome on desktop or Android, or use the PNG download for iOS / Safari.')
  }
  if (thermalSize === 'sheet') {
    throw new Error('Bluetooth printing requires a specific thermal size, not sheet.')
  }

  // Ask the user to pick a printer. acceptAllDevices + optionalServices
  // gives broad compatibility because we don't know the printer's MAC
  // ahead of time. The user picks theirs from the prompt.
  const nav = navigator as Navigator & {
    bluetooth: {
      requestDevice: (options: {
        acceptAllDevices?: boolean
        filters?: unknown
        optionalServices?: string[]
      }) => Promise<{
        gatt?: {
          connect: () => Promise<{
            getPrimaryServices: () => Promise<unknown[]>
          }>
        }
      }>
    }
  }
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES,
  })

  if (!device.gatt) {
    throw new Error('Selected device has no GATT server.')
  }

  const server = await device.gatt.connect()
  const services = (await server.getPrimaryServices()) as Array<{
    uuid: string
    getCharacteristics: () => Promise<Array<{
      uuid: string
      properties: { write: boolean; writeWithoutResponse: boolean }
      writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
      writeValue: (value: BufferSource) => Promise<void>
    }>>
  }>

  // Find any writable characteristic — most ESC/POS BLE devices have
  // one obvious write endpoint. We pick the first that supports write.
  let writeChar: {
    properties: { write: boolean; writeWithoutResponse: boolean }
    writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
    writeValue: (value: BufferSource) => Promise<void>
  } | null = null
  for (const svc of services) {
    const chars = await svc.getCharacteristics()
    for (const c of chars) {
      if (c.properties.writeWithoutResponse || c.properties.write) {
        writeChar = c
        break
      }
    }
    if (writeChar) break
  }
  if (!writeChar) {
    throw new Error('No writable characteristic found on this printer. It may not be a generic ESC/POS device — try the PNG download instead.')
  }

  // Build commands for all labels (with copies expansion).
  const expanded: PdfLabel[] = []
  for (const l of labels) {
    for (let i = 0; i < Math.max(1, copies); i++) expanded.push(l)
  }

  for (let i = 0; i < expanded.length; i++) {
    const bytes = await buildEscPosForLabel(expanded[i], thermalSize)
    await sendChunked(writeChar, bytes)
  }
}

/**
 * Build the ESC/POS byte stream for one label: init → raster bitmap → feed → cut.
 */
async function buildEscPosForLabel(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
): Promise<Uint8Array> {
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

  const bitmap = pixelsToOneBitBitmap(imgData)
  const widthBytes = Math.ceil(widthPx / 8)

  // ESC @ — initialize printer
  // GS v 0 m xL xH yL yH ... raster bitmap
  // LF — feed line
  // GS V 1 — partial cut (skipped on most BLE thermals; harmless)
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

/**
 * Most BLE characteristics cap writes at ~150-512 bytes. Send the
 * payload in conservative 180-byte chunks with a tiny pause between
 * to avoid overruns on cheap printers.
 */
async function sendChunked(
  writeChar: {
    properties: { write: boolean; writeWithoutResponse: boolean }
    writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
    writeValue: (value: BufferSource) => Promise<void>
  },
  bytes: Uint8Array,
): Promise<void> {
  const chunkSize = 180
  const useNoResponse = writeChar.properties.writeWithoutResponse
  for (let off = 0; off < bytes.length; off += chunkSize) {
    const slice = bytes.slice(off, off + chunkSize)
    if (useNoResponse && writeChar.writeValueWithoutResponse) {
      await writeChar.writeValueWithoutResponse(slice)
    } else {
      await writeChar.writeValue(slice)
    }
    // Tiny breath between chunks for slower printers.
    await new Promise((resolve) => setTimeout(resolve, 8))
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load label image'))
    img.src = src
  })
}
