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

    const textX = qx + qrPxOnLabel + Math.round(0.08 * dpi)
    const textWidth = canvas.width - textX - padPx
    let y = qy + Math.round(0.13 * dpi)

    if (label.title) {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.font = `bold ${Math.round(0.13 * dpi)}px Helvetica, Arial, sans-serif`
      const titleLines = wrapText(ctx, label.title, textWidth)
      for (const line of titleLines.slice(0, 2)) {
        ctx.fillText(line, textX, y)
        y += Math.round(0.15 * dpi)
      }
    }
    if (label.subtitle && size.showFullText) {
      ctx.font = `${Math.round(0.1 * dpi)}px Helvetica, Arial, sans-serif`
      ctx.fillText(truncate(label.subtitle, 32), textX, y)
      y += Math.round(0.12 * dpi)
    }
    if (size.showFullText && label.details) {
      ctx.font = `${Math.round(0.085 * dpi)}px Helvetica, Arial, sans-serif`
      const lineH = Math.round(0.1 * dpi)
      const bottom = canvas.height - padPx
      for (const line of label.details) {
        if (y > bottom) break
        const wrapped = wrapText(ctx, line, textWidth)
        const remaining = Math.max(1, Math.floor((bottom - y) / lineH))
        for (const w of wrapped.slice(0, remaining)) {
          ctx.fillText(w, textX, y)
          y += lineH
        }
      }
    }
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
    if (label.subtitle) {
      ctx.font = `${Math.round(0.15 * dpi)}px Helvetica, Arial, sans-serif`
      ctx.fillText(label.subtitle, canvas.width / 2, y)
      y += Math.round(0.22 * dpi)
    }
    if (label.details) {
      ctx.font = `${Math.round(0.12 * dpi)}px Helvetica, Arial, sans-serif`
      const bottom = canvas.height - padPx
      for (const line of label.details) {
        if (y > bottom) break
        ctx.fillText(truncate(line, 60), canvas.width / 2, y)
        y += Math.round(0.18 * dpi)
      }
    }
  }

  return canvas.toDataURL('image/png')
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
