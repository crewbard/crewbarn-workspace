/**
 * Generate a thermal-ready PDF with exact page sizes — bypasses the
 * browser's flaky @page size handling on "Save as PDF".
 *
 * Each label gets its own page sized to the chosen thermal preset
 * (1x1, 2x1, 2.25x1.25, etc.). QR is rendered as a true raster image
 * embedded in the PDF, which prints reliably on any thermal printer
 * driver that respects PDF page sizes (which is all of them).
 */
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { THERMAL_SIZES, computeSheetGrid, type ThermalSizeKey } from '@/lib/thermalLabels'

export interface PdfLabel {
  /** What the QR encodes — typically a code or scan URL. */
  qrValue: string
  /** Big bold first line (e.g. bin code, asset name). */
  title: string
  /** Optional subtitle (e.g. kind tag, asset type). */
  subtitle?: string
  /** Additional smaller text rows (path, sku, sn, etc.). */
  details?: string[]
}

/**
 * Build a jsPDF document of labels at the given thermal size.
 * Each label is one page. Each label is duplicated `copies` times
 * (default 1) so a single bin sticker can be printed N times.
 *
 * Returned doc is ready for either .save() (download) or
 * .autoPrint() + .output('bloburl') (open print dialog).
 */
async function buildLabelPdf({
  labels,
  thermalSize,
  copies = 1,
  multiUp = false,
  gap = 0,
}: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
  /** When true, lay out labels as a grid on letter paper instead of one-per-page. */
  multiUp?: boolean
  /** Gap (inches) between labels in multi-up sheet mode. */
  gap?: number
}): Promise<jsPDF> {
  if (thermalSize === 'sheet') {
    throw new Error('PDF generation is only used for thermal sizes; sheet mode uses browser print.')
  }
  if (labels.length === 0) {
    throw new Error('No labels to generate.')
  }

  const size = THERMAL_SIZES[thermalSize]

  // Multiply labels by copies — each label expanded N times.
  const expanded: PdfLabel[] = []
  const n = Math.max(1, copies)
  for (const label of labels) {
    for (let i = 0; i < n; i++) expanded.push(label)
  }

  // ---- Multi-up sheet layout (letter paper, configurable gap) ----
  if (multiUp) {
    return buildSheetPdf(expanded, size, gap)
  }

  // ---- Thermal one-label-per-page layout ----
  const doc = new jsPDF({
    orientation: size.w > size.h ? 'landscape' : 'portrait',
    unit: 'in',
    format: [size.w, size.h],
  })

  // One label per page at thermal dimensions. drawLabelOnPdf is the
  // shared layout used by sheet (multi-up) mode too.
  for (let i = 0; i < expanded.length; i++) {
    if (i > 0) doc.addPage([size.w, size.h])
    await drawLabelOnPdf(doc, expanded[i], size, 0, 0)
  }

  return doc
}

/**
 * Build a letter-sized PDF with a grid of labels at size.w × size.h
 * dimensions. Auto-computes the columns/rows that fit on letter paper
 * given the chosen gap, and centers the grid on the page.
 *
 * Generic across all label-sheet brands — pick the gap that matches
 * the die-cut spec of the sheet you're feeding through your printer.
 */
async function buildSheetPdf(
  labels: PdfLabel[],
  size: import('./thermalLabels').ThermalSize,
  gap = 0,
): Promise<jsPDF> {
  const pageW = 8.5
  const pageH = 11

  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: [pageW, pageH] })

  const grid = computeSheetGrid(size, gap, 0.25)
  const perPage = grid.cols * grid.rows

  for (let i = 0; i < labels.length; i++) {
    const onPage = i % perPage
    if (onPage === 0 && i > 0) doc.addPage([pageW, pageH], 'portrait')

    const col = onPage % grid.cols
    const row = Math.floor(onPage / grid.cols)
    const x = grid.marginX + col * (size.w + gap)
    const y = grid.marginY + row * (size.h + gap)

    await drawLabelOnPdf(doc, labels[i], size, x, y)
  }
  return doc
}

/**
 * Draw one label onto a PDF at (x, y) with width × height matching the
 * preset. Used by both the thermal one-per-page flow and the sheet
 * multi-up flow.
 */
async function drawLabelOnPdf(
  doc: jsPDF,
  label: PdfLabel,
  size: import('./thermalLabels').ThermalSize,
  originX: number,
  originY: number,
): Promise<void> {
  const qrPx = 256
  const qrDataUrl = await QRCode.toDataURL(label.qrValue, {
    width: qrPx,
    errorCorrectionLevel: size.showFullText ? 'M' : 'H',
    margin: 1,
  })

  const padding = 0.04
  const isSquare = Math.abs(size.w - size.h) < 0.05

  if (isSquare) {
    const qrSize = Math.min(size.w, size.h) - padding * 2 - 0.15
    const qx = originX + (size.w - qrSize) / 2
    const qy = originY + padding
    doc.addImage(qrDataUrl, 'PNG', qx, qy, qrSize, qrSize)
    const textY = qy + qrSize + 0.1
    if (label.title) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(truncate(label.title, 14), originX + size.w / 2, textY, { align: 'center' })
    }
  } else if (size.h <= 1.5) {
    const qrSize = size.h - padding * 2
    const qx = originX + padding
    const qy = originY + padding
    doc.addImage(qrDataUrl, 'PNG', qx, qy, qrSize, qrSize)

    const textX = qx + qrSize + 0.08
    const textWidth = size.w - (qrSize + padding * 2 + 0.08)
    let y = qy + 0.13

    if (label.title) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(label.title, textWidth)
      doc.text(titleLines.slice(0, 2), textX, y)
      y += 0.13 * Math.min(titleLines.length, 2)
    }
    if (label.subtitle && size.showFullText) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(truncate(label.subtitle, 32), textX, y)
      y += 0.11
    }
    if (size.showFullText && label.details) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const lineH = 0.1
      const bottom = originY + size.h - padding
      for (const line of label.details) {
        if (y > bottom) break
        const wrapped: string[] = doc.splitTextToSize(line, textWidth)
        const remainingLines = Math.max(1, Math.floor((bottom - y) / lineH))
        const toShow = wrapped.slice(0, remainingLines)
        doc.text(toShow, textX, y)
        y += lineH * toShow.length
      }
    }
  } else {
    // Tall/large label
    const qrSize = Math.min(size.w - padding * 2, size.h * 0.55)
    const qx = originX + (size.w - qrSize) / 2
    const qy = originY + padding
    doc.addImage(qrDataUrl, 'PNG', qx, qy, qrSize, qrSize)

    let y = qy + qrSize + 0.2
    if (label.title) {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(label.title, size.w - padding * 2)
      doc.text(titleLines.slice(0, 3), originX + size.w / 2, y, { align: 'center' })
      y += 0.25 * Math.min(titleLines.length, 3)
    }
    if (label.subtitle) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(label.subtitle, originX + size.w / 2, y, { align: 'center' })
      y += 0.2
    }
    if (label.details) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const bottom = originY + size.h - padding
      for (const line of label.details) {
        if (y > bottom) break
        doc.text(truncate(line, 60), originX + size.w / 2, y, { align: 'center' })
        y += 0.16
      }
    }
  }
}

/**
 * Generate the PDF and trigger the browser print dialog directly.
 * The user picks a printer + copies in the dialog; thermal page size
 * is baked into the PDF so the driver respects it.
 *
 * Opens the PDF in a new window so the print dialog can be invoked
 * and so the user can save/re-print later from the same window.
 */
export async function printLabelPdf(opts: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
  multiUp?: boolean
  gap?: number
  filename?: string
}): Promise<void> {
  const doc = await buildLabelPdf(opts)
  doc.autoPrint()
  // dataurlnewwindow opens the PDF in a new tab and the embedded
  // autoPrint() action triggers the print dialog there. Falls back
  // to data URL when popup blockers prevent window.open with bloburl.
  const url = doc.output('bloburl')
  const w = window.open(url, '_blank')
  if (!w) {
    // Popup blocked — fall back to download so the user still gets the file.
    doc.save(opts.filename ?? 'labels.pdf')
  }
}

/**
 * Generate the PDF and download as a file (no print dialog).
 * Useful when the user wants to save the file or send it elsewhere.
 */
export async function downloadLabelPdf(opts: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
  multiUp?: boolean
  gap?: number
  filename: string
}): Promise<void> {
  const doc = await buildLabelPdf(opts)
  doc.save(opts.filename)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
