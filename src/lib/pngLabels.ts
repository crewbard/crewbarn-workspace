/**
 * Render a single label as a PNG image at thermal-printer-friendly DPI.
 *
 * Use case: user has a thermal printer whose software accepts image
 * uploads but doesn't talk over Web Bluetooth or accept PDFs cleanly.
 * Generate a PNG sized exactly to the label dimensions, download it,
 * upload to the printer's app, print.
 */
import QRCode from 'qrcode'
import { THERMAL_SIZES, type ThermalSizeKey, type ThermalSize } from '@/lib/thermalLabels'
import type { PdfLabel } from '@/lib/pdfLabels'
import { faceOf } from '@/lib/labelFaceFields'

const DEFAULT_DPI = 300

/**
 * Build a single-label PNG and return the data URL.
 */
export async function buildLabelPng(
  label: PdfLabel,
  thermalSize: ThermalSizeKey,
  dpi = DEFAULT_DPI,
): Promise<string> {
  if (thermalSize === 'sheet') {
    throw new Error('PNG generation requires a specific thermal size, not free-form sheet.')
  }
  const size = THERMAL_SIZES[thermalSize]
  // For sheet variants, render a single label at its physical dimensions
  // (not a full sheet — sheet PNG export would be huge and rarely useful).
  return renderLabelToDataUrl(label, size, dpi)
}

/**
 * Build the PNG and trigger a browser download.
 */
export async function downloadLabelPng({
  label,
  thermalSize,
  filename,
  dpi = DEFAULT_DPI,
}: {
  label: PdfLabel
  thermalSize: ThermalSizeKey
  filename: string
  dpi?: number
}): Promise<void> {
  const dataUrl = await buildLabelPng(label, thermalSize, dpi)
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function renderLabelToDataUrl(
  label: PdfLabel,
  size: ThermalSize,
  dpi: number,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.w * dpi)
  canvas.height = Math.round(size.h * dpi)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d context')

  // White background — thermal printers generally need pure white.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'

  const padPx = Math.round(0.04 * dpi)
  const isSquare = Math.abs(size.w - size.h) < 0.05

  // QR — render via qrcode lib at the right pixel size, then drawImage.
  const qrPxOnLabel = isSquare
    ? Math.min(canvas.width, canvas.height) - padPx * 2 - Math.round(0.15 * dpi)
    : size.h <= 1.5
      ? canvas.height - padPx * 2
      : Math.min(canvas.width - padPx * 2, Math.round(size.h * 0.55 * dpi))
  const qrDataUrl = await QRCode.toDataURL(label.qrValue, {
    width: qrPxOnLabel,
    errorCorrectionLevel: size.showFullText ? 'M' : 'H',
    margin: 1,
  })
  const qrImg = await loadImage(qrDataUrl)

  if (isSquare) {
    const qx = (canvas.width - qrPxOnLabel) / 2
    const qy = padPx
    ctx.drawImage(qrImg, qx, qy, qrPxOnLabel, qrPxOnLabel)
    if (label.title) {
      ctx.font = `bold ${Math.round(0.09 * dpi)}px Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(truncate(label.title, 14), canvas.width / 2, qy + qrPxOnLabel + Math.round(0.05 * dpi))
    }
  } else if (size.h <= 1.5) {
    const qx = padPx
    const qy = padPx
    ctx.drawImage(qrImg, qx, qy, qrPxOnLabel, qrPxOnLabel)
    // The same words the preview shows: name, code, type badge, place.
    // Printing used to read only title/subtitle/details, so a label sent
    // from the studio (code/tag/path) came out as a QR and a small name.
    const textX = qx + qrPxOnLabel + Math.round(0.07 * dpi)
    drawFaceColumn(ctx, label, {
      x: textX,
      y: qy,
      width: canvas.width - textX - padPx,
      bottom: canvas.height - padPx,
      dpi,
      full: Boolean(size.showFullText),
    })
  } else {
    // Tall/large
    const qx = (canvas.width - qrPxOnLabel) / 2
    const qy = padPx
    ctx.drawImage(qrImg, qx, qy, qrPxOnLabel, qrPxOnLabel)

    let y = qy + qrPxOnLabel + Math.round(0.25 * dpi)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    if (label.title) {
      ctx.font = `bold ${Math.round(0.22 * dpi)}px Helvetica, Arial, sans-serif`
      const titleLines = wrapText(ctx, label.title, canvas.width - padPx * 2)
      for (const line of titleLines.slice(0, 3)) {
        ctx.fillText(line, canvas.width / 2, y)
        y += Math.round(0.27 * dpi)
      }
    }
    const face = faceOf(label)
    if (face.code && face.code !== label.title) {
      ctx.font = `bold ${Math.round(0.14 * dpi)}px ${MONO}`
      ctx.fillText(truncate(face.code, 40), canvas.width / 2, y)
      y += Math.round(0.2 * dpi)
    }
    if (face.tag) {
      ctx.font = `${Math.round(0.15 * dpi)}px Helvetica, Arial, sans-serif`
      ctx.fillText(face.tag, canvas.width / 2, y)
      y += Math.round(0.22 * dpi)
    }
    const tallLines = label.path ? [label.path] : (label.details ?? [])
    if (tallLines.length) {
      ctx.font = `${Math.round(0.12 * dpi)}px Helvetica, Arial, sans-serif`
      const bottom = canvas.height - padPx
      for (const line of tallLines) {
        if (y > bottom) break
        ctx.fillText(truncate(line, 60), canvas.width / 2, y)
        y += Math.round(0.18 * dpi)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

const SANS = 'Helvetica, Arial, sans-serif'
const MONO = '"Courier New", Courier, monospace'

/**
 * The text beside the QR on a wide roll label, top to bottom: the name
 * (shrunk to fit, up to two lines), the code, the type as a solid black
 * badge, then the place, wrapped into whatever room is left.
 * Black on white only: this becomes a 1-bit thermal raster.
 * Exported for the tests.
 */
export function drawFaceColumn(
  ctx: CanvasRenderingContext2D,
  label: PdfLabel,
  box: { x: number; y: number; width: number; bottom: number; dpi: number; full: boolean },
): void {
  const { x, width, bottom, dpi, full } = box
  const face = faceOf(label)
  let y = box.y
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000000'

  // Name: as big as fits, 0.17" down to 0.09".
  if (face.name) {
    let px = Math.round(0.17 * dpi)
    const min = Math.round(0.09 * dpi)
    for (; px >= min; px -= 2) {
      ctx.font = `bold ${px}px ${SANS}`
      const lines = wrapText(ctx, face.name, width)
      if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= width)) break
    }
    px = Math.max(px, min)
    ctx.font = `bold ${px}px ${SANS}`
    const lines = fitLines(ctx, wrapText(ctx, face.name, width), 2, width)
    for (const line of lines) {
      ctx.fillText(line, x, y)
      y += Math.round(px * 1.12)
    }
  }

  // Code, in a typewriter face, when it says something the name does not.
  if (face.code && face.code !== face.name) {
    const px = Math.round(0.085 * dpi)
    ctx.font = `bold ${px}px ${MONO}`
    ctx.fillText(fitLines(ctx, [face.code], 1, width)[0], x, y + Math.round(0.01 * dpi))
    y += Math.round(px * 1.25)
  }

  // Type badge: white letters on solid black.
  if (face.tag && full) {
    const px = Math.round(0.07 * dpi)
    const padX = Math.round(0.025 * dpi)
    const padY = Math.round(0.012 * dpi)
    ctx.font = `bold ${px}px ${SANS}`
    const text = fitLines(ctx, [face.tag.toUpperCase()], 1, width - padX * 2)[0]
    const w = Math.min(width, ctx.measureText(text).width + padX * 2)
    const h = px + padY * 2
    y += Math.round(0.015 * dpi)
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, x + padX, y + padY + 1)
    ctx.fillStyle = '#000000'
    y += h + Math.round(0.02 * dpi)
  }

  // Where it is: the rest of the room.
  const where = label.path ? [label.path] : face.path ? [face.path] : []
  if (full && where.length) {
    const px = Math.round(0.072 * dpi)
    const lineH = Math.round(px * 1.18)
    ctx.font = `${px}px ${SANS}`
    const room = Math.max(0, Math.floor((bottom - y) / lineH))
    if (room > 0) {
      const lines = fitLines(ctx, where.flatMap((w) => wrapText(ctx, w, width)), room, width)
      for (const line of lines) {
        ctx.fillText(line, x, y)
        y += lineH
      }
    }
  }
}

/** At most `max` lines; the last one ends in "…" when anything was cut. */
function fitLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, width: number): string[] {
  const out = lines.slice(0, max)
  const cut = lines.length > max
  for (let i = 0; i < out.length; i++) {
    const last = i === out.length - 1
    let line = out[i]
    if (ctx.measureText(line).width <= width && !(last && cut)) continue
    while (line.length > 1 && ctx.measureText(line + '…').width > width) line = line.slice(0, -1)
    out[i] = line + '…'
  }
  return out
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load QR image'))
    img.src = src
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial
    } else {
      if (current) lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
