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

  /*
   * The face fields, matching LabelFaceData. When a page sends these the
   * PDF draws what the studio previews; when it does not, title/subtitle/
   * details are read as name/tag/path so nothing prints blank.
   */
  /** Typewriter line under the name. */
  code?: string
  /** BIN, EXTINGUISHER, SERIAL… printed as solid black. */
  tag?: string
  /** Where it lives, after a pin. */
  path?: string
  company?: string
  phone?: string
  note?: string
}

/** The face fields, whichever shape the caller sent. */
function faceOf(label: PdfLabel): {
  name: string
  code?: string
  tag?: string
  path?: string
  company?: string
  phone?: string
  note?: string
} {
  const details = label.details ?? []
  return {
    name: label.title,
    code: label.code ?? details.find((d) => /^(SKU|SN)[: ]/i.test(d)),
    tag: label.tag ?? label.subtitle,
    // A path is the detail line with separators in it; failing that, the
    // last one, which is where these pages have always put it.
    path: label.path ?? details.find((d) => d.includes('\u203a') || d.includes('>')) ?? details[details.length - 1],
    company: label.company,
    phone: label.phone,
    note: label.note,
  }
}

/**
 * Build a jsPDF document of labels at the given thermal size.
 * Each label is one page. Each label is duplicated `copies` times
 * (default 1) so a single bin sticker can be printed N times.
 *
 * Returned doc is ready for either .save() (download) or
 * .autoPrint() + .output('bloburl') (open print dialog).
 */
export async function buildLabelPdf({
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
    // Die-cut sheets space differently across and down — Avery 5160 has an
    // eighth of an inch between columns and nothing between rows.
    const x = grid.marginX + col * (size.w + grid.gapX)
    const y = grid.marginY + row * (size.h + grid.gapY)

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
  const f = faceOf(label)
  const pad = size.h * 0.07

  // High correction on the small faces: a 1in QR on a thermal head loses
  // modules to heat bleed, and a label that will not scan is a blank label.
  const qrDataUrl = await QRCode.toDataURL(label.qrValue, {
    width: 512,
    errorCorrectionLevel: size.showFullText ? 'M' : 'H',
    margin: 0,
  })

  const isTiny = size.w <= 1.05 && size.h <= 1.05
  const isPlacard = size.w >= 3.9 || size.h >= 5.5

  if (isTiny) {
    const qr = Math.min(size.w, size.h) * 0.72
    doc.addImage(qrDataUrl, 'PNG', originX + (size.w - qr) / 2, originY + size.h * 0.04, qr, qr)
    if (f.code || f.name) {
      doc.setFont('courier', 'bold')
      doc.setFontSize(Math.max(4.5, size.h * 6))
      doc.text(
        truncate(f.code ?? f.name, 16),
        originX + size.w / 2,
        originY + size.h * 0.04 + qr + size.h * 0.11,
        { align: 'center' },
      )
    }
    return
  }

  if (isPlacard) {
    const headerH = size.h * 0.07
    if (f.company || f.phone) {
      doc.setFillColor(0, 0, 0)
      doc.rect(originX, originY, size.w, headerH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(size.h * 1.9)
      if (f.company) doc.text(f.company, originX + size.w * 0.04, originY + headerH * 0.68)
      if (f.phone) {
        doc.text(f.phone, originX + size.w * 0.96, originY + headerH * 0.68, { align: 'right' })
      }
      doc.setTextColor(0, 0, 0)
    }

    const qr = Math.min(size.w * 0.62, size.h * 0.46)
    const qy = originY + headerH + size.h * 0.06
    doc.addImage(qrDataUrl, 'PNG', originX + (size.w - qr) / 2, qy, qr, qr)

    let y = qy + qr + size.h * 0.06
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size.h * 3.2)
    for (const line of (doc.splitTextToSize(f.name, size.w * 0.88) as string[]).slice(0, 2)) {
      doc.text(line, originX + size.w / 2, y, { align: 'center' })
      y += size.h * 0.045
    }
    if (f.code) {
      doc.setFont('courier', 'bold')
      doc.setFontSize(size.h * 1.9)
      doc.text(f.code, originX + size.w / 2, y, { align: 'center' })
      y += size.h * 0.035
    }
    if (f.note) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(size.h * 1.5)
      doc.text(truncate(f.note, 70), originX + size.w / 2, y, { align: 'center' })
    }

    const footY = originY + size.h - size.h * 0.035
    doc.setLineWidth(0.008)
    doc.line(originX, footY - size.h * 0.022, originX + size.w, footY - size.h * 0.022)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(size.h * 1.5)
    doc.text('Point your phone camera here', originX + size.w / 2, footY, { align: 'center' })
    return
  }

  // The common shape: QR left, words right.
  //
  // Capped by WIDTH as well as height. A square QR that is simply "the
  // label's height" eats half of a 2.25 x 1.25 and leaves the words a
  // column too narrow to wrap in — which is how the location line ended up
  // running off the edge of the first one of these that printed.
  const qr = Math.min(size.h - pad * 2, size.w * 0.42)
  doc.addImage(qrDataUrl, 'PNG', originX + pad, originY + (size.h - qr) / 2, qr, qr)

  const textX = originX + pad + qr + size.h * 0.06
  const textW = size.w - (textX - originX) - pad
  // Sized off the column, not only the label: text that fits a tall label
  // still has to fit the words beside the QR.
  const body = Math.max(4.5, Math.min(size.h * 7.2, textW * 9))
  let y = originY + pad + body * 0.014 + size.h * 0.1

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(body * 1.3)
  const nameLines = (doc.splitTextToSize(f.name, textW) as string[]).slice(0, 2)
  for (const line of nameLines) {
    doc.text(line, textX, y)
    y += size.h * 0.155
  }

  if (f.code && size.showFullText) {
    doc.setFont('courier', 'bold')
    doc.setFontSize(body * 0.9)
    doc.text(truncate(f.code, 26), textX, y)
    y += size.h * 0.125
  }

  if (f.tag && size.showFullText) {
    // The solid block the screen shows, not a grey word.
    const tag = truncate(f.tag.toUpperCase(), 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(body * 0.78)
    const tw = doc.getTextWidth(tag)
    const th = size.h * 0.1
    doc.setFillColor(0, 0, 0)
    doc.rect(textX, y - th * 0.78, tw + size.h * 0.08, th, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(tag, textX + size.h * 0.04, y)
    doc.setTextColor(0, 0, 0)
    y += size.h * 0.145
  }

  if (f.path && size.showFullText && size.w >= 1.9) {
    // A filled circle stands in for the pin: a drawn glyph survives a
    // thermal head, and the emoji it replaces did not.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(body * 0.8)
    const bottom = originY + size.h - pad
    const lines = (doc.splitTextToSize(f.path, textW - size.h * 0.07) as string[]).slice(0, 2)
    lines.forEach((line, i) => {
      if (y > bottom) return
      // One pin for the location, not one per wrapped line: the second line
      // of "Shop > Rack A > Shelf 3" is not a second place.
      if (i === 0) {
        doc.circle(textX + size.h * 0.022, y - size.h * 0.028, size.h * 0.022, 'F')
      }
      doc.text(line, textX + size.h * 0.07, y)
      y += size.h * 0.115
    })
  }

  if ((f.company || f.phone) && size.w >= 2.9 && size.showFullText) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(body * 0.78)
    const line = [f.company, f.phone].filter(Boolean).join(' \u00b7 ')
    doc.text(truncate(line, 34), textX, Math.min(y, originY + size.h - pad))
  }
}
export async function printLabelPdf(opts: {
  labels: PdfLabel[]
  thermalSize: ThermalSizeKey
  copies?: number
  multiUp?: boolean
  gap?: number
  filename?: string
}): Promise<void> {
  const doc = await buildLabelPdf(opts)
  const url = doc.output('bloburl') as unknown as string

  const printed = await printViaHiddenFrame(url)
  if (printed) {
    return
  }

  // The frame would not print. Back to a tab, with the PDF's own auto-print
  // action to trigger the dialog there.
  doc.autoPrint()
  const w = window.open(doc.output('bloburl') as unknown as string, '_blank')
  if (!w) {
    // Popup blocked — download it so the labels are not simply lost.
    doc.save(opts.filename ?? 'labels.pdf')
  }
}

/**
 * Print a PDF from an iframe on this page.
 *
 * The point is whose print() is called. Chrome's --kiosk-printing skips the
 * dialog for a print the PAGE asks for; a PDF opened in its own tab that
 * prints itself is not that, so kiosk stations still got a dialog for every
 * label. From a frame, it is the page asking.
 *
 * Resolves false on anything unexpected so the caller can fall back — it is
 * better to open a tab than to swallow somebody's labels.
 */
async function printViaHiddenFrame(url: string): Promise<boolean> {
  if (typeof document === 'undefined') return false

  return new Promise<boolean>((resolve) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;'

    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      // Long enough for the print job to be handed over. Removing the frame
      // while the dialog is still open cancels the print in some builds.
      setTimeout(() => frame.remove(), 60_000)
      resolve(ok)
    }

    // A PDF that never loads must not hang the button forever.
    const bail = setTimeout(() => finish(false), 4_000)

    frame.onload = () => {
      clearTimeout(bail)
      try {
        const win = frame.contentWindow
        if (!win) return finish(false)
        win.focus()
        win.print()
        finish(true)
      } catch {
        finish(false)
      }
    }
    frame.onerror = () => {
      clearTimeout(bail)
      finish(false)
    }

    frame.src = url
    document.body.appendChild(frame)
  })
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
