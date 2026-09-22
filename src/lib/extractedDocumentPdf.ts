import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

declare global {
  interface Window {
    html2canvas?: typeof html2canvas
  }
}

// jsPDF.html() lazily imports html2canvas when it is not present on
// window. That lazy import points at a hashed Vite chunk, which can
// disappear after a deploy while a user still has the app open. Keeping
// html2canvas loaded with this renderer avoids late stale-chunk failures
// on the Download PDF button.
if (typeof window !== 'undefined') {
  window.html2canvas = html2canvas
}

/**
 * Minimal markdown → HTML for our extracted-doc content.
 *
 * Supports:
 *   - # / ## / ### / #### headings
 *   - **bold** + *italic*
 *   - Unordered lists (-, *)
 *   - Ordered lists (1.)
 *   - Paragraphs (blank-line separated)
 *   - Inline backticks → <code>
 *   - Pipe tables (| col | col |)
 *
 * Not a full CommonMark renderer — only what AI extraction produces.
 * Anything fancier should pull in `marked` (≈22kb gz). For now this
 * keeps the bundle small and predictable.
 *
 * Kept for the in-app HTML preview pane. The PDF renderer below does
 * NOT use this — it goes straight from markdown to native jsPDF text
 * calls so the output is selectable real text and never blank.
 */
export function markdownToHtml(md: string): string {
  // First, escape HTML to prevent injection from anything in the source.
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inTable = false

  function closeLists() {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }
  function closeTable() {
    if (inTable) { out.push('</tbody></table>'); inTable = false }
  }

  function inline(s: string): string {
    let escaped = esc(s)
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    escaped = escaped.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
    return escaped
  }

  function parseAlignmentsHtml(separator: string, colCount: number): Array<'left' | 'right' | 'center'> {
    const cells = separator.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    const result: Array<'left' | 'right' | 'center'> = []
    for (let i = 0; i < colCount; i++) {
      const c = cells[i] ?? '---'
      const l = c.startsWith(':')
      const r = c.endsWith(':')
      result.push(l && r ? 'center' : r ? 'right' : 'left')
    }
    return result
  }

  function stripInlineForCheck(s: string): string {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
  }

  let tableAligns: Array<'left' | 'right' | 'center'> = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    if (line === '') {
      closeLists()
      closeTable()
      continue
    }

    // -------- :::cols ... +++ ... ::: side-by-side block --------
    if (/^:::\s*cols?\b/i.test(line)) {
      closeLists()
      closeTable()
      const collected: string[] = []
      let j = i + 1
      let closed = false
      while (j < lines.length) {
        if (/^:::\s*$/.test(lines[j].trim())) { closed = true; break }
        collected.push(lines[j])
        j++
      }
      if (!closed) {
        out.push(`<p>${inline(line)}</p>`)
        continue
      }
      i = j
      const groups: string[][] = [[]]
      for (const ln of collected) {
        if (/^\+\+\+\s*$/.test(ln.trim())) groups.push([])
        else groups[groups.length - 1].push(ln)
      }
      const nonEmpty = groups.filter((g) => g.some((l) => l.trim() !== ''))
      const colHtml = nonEmpty.map((g) => `<div class="md-col">${markdownToHtml(g.join('\n'))}</div>`).join('')
      out.push(`<div class="md-cols" style="display:flex;gap:16px;align-items:flex-start;">${colHtml}</div>`)
      continue
    }

    const h = /^(#{1,4})\s+(.+)$/.exec(line)
    if (h) {
      closeLists()
      closeTable()
      const level = h[1].length
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      continue
    }

    if (/^\|.+\|$/.test(line) && /^\|[\s|:-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      closeLists()
      const headers = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const sep = (lines[i + 1] ?? '').trim()
      tableAligns = parseAlignmentsHtml(sep, headers.length)
      out.push('<table><thead><tr>' + headers.map((c, ci) => `<th style="text-align:${tableAligns[ci]}">${inline(c)}</th>`).join('') + '</tr></thead><tbody>')
      inTable = true
      i++
      continue
    }
    if (inTable && /^\|.+\|$/.test(line)) {
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      out.push('<tr>' + cells.map((c, ci) => {
        const cellText = stripInlineForCheck(c).trim()
        const isNumeric = /^\$?[\d.,()\-\s%]+\$?$/.test(cellText) && cellText !== ''
        const align = tableAligns[ci] === 'left' && isNumeric ? 'right' : (tableAligns[ci] ?? 'left')
        return `<td style="text-align:${align}">${inline(c)}</td>`
      }).join('') + '</tr>')
      continue
    }
    if (inTable) closeTable()

    const ul = /^[-*]\s+(.+)$/.exec(line)
    if (ul) {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }

    const ol = /^\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }

    closeLists()
    out.push(`<p>${inline(line)}</p>`)
  }

  closeLists()
  closeTable()
  return out.join('\n')
}

/**
 * Map of `[[signature:role]]` role → captured PNG data URL.
 */
export type SignatureMap = Record<string, string>

/**
 * Per-template design overrides. The PDF renderer respects these so the
 * tenant can theme their docs without changing the markdown body. All
 * fields optional — missing values fall back to the classic amber/navy
 * brand defaults.
 */
/**
 * Supported font family names. The PDF renderer maps these to jsPDF's
 * stock fonts (helvetica / times / courier); the in-app preview uses
 * the closest real CSS font.
 *
 *   helvetica, arial, inter        → jsPDF helvetica  (sans-serif)
 *   times, georgia                 → jsPDF times      (serif)
 *   courier                        → jsPDF courier    (monospace)
 *
 * Old values 'sans' + 'serif' still accepted for backwards compatibility.
 */
export type FontFamilyName =
  | 'helvetica' | 'arial' | 'inter'
  | 'times' | 'georgia'
  | 'courier'
  // legacy:
  | 'sans' | 'serif'

export interface DesignTokens {
  theme?: 'classic' | 'modern' | 'bold' | 'minimal' | 'emerald' | 'custom'
  primary_color?: string
  accent_color?: string
  header_alignment?: 'left' | 'center'
  show_logo?: boolean
  paper_size?: 'letter' | 'legal' | 'a4'
  layout_density?: 'compact' | 'normal' | 'spacious'
  font_family?: FontFamilyName
  header_banner?: boolean
  footer_text?: string
  /**
   * Editor source-of-truth format for the body.
   *   markdown — the renderer parses pipe tables, :::cols, headings,
   *              merge tags; PDF uses the native jsPDF renderer.
   *   html     — body is raw HTML; preview renders it directly; PDF
   *              uses jsPDF.html() (html2canvas under the hood).
   */
  body_format?: 'markdown' | 'html'
  /**
   * Merge tags the user "pinned" for this template — surface as a
   * one-click chip strip above the body editor for quick insertion.
   * Set by the Starter detail picker; user can edit anytime in the
   * 🏷 Tags side tab.
   */
  pinned_tags?: string[]
}

/**
 * Map a frontend font family name to a jsPDF stock font.
 */
export function mapFontToJsPdf(font?: FontFamilyName): 'helvetica' | 'times' | 'courier' {
  switch (font) {
    case 'times':
    case 'georgia':
    case 'serif':
      return 'times'
    case 'courier':
      return 'courier'
    case 'helvetica':
    case 'arial':
    case 'inter':
    case 'sans':
    case undefined:
    default:
      return 'helvetica'
  }
}

/**
 * Map a frontend font family name to a CSS font-family stack.
 */
export function fontToCss(font?: FontFamilyName): string {
  switch (font) {
    case 'times':    return '"Times New Roman", Times, serif'
    case 'georgia':  return 'Georgia, "Times New Roman", serif'
    case 'serif':    return '"Times New Roman", Times, serif'
    case 'courier':  return '"Courier New", Courier, monospace'
    case 'arial':    return 'Arial, Helvetica, sans-serif'
    case 'inter':    return 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
    case 'helvetica':
    case 'sans':
    case undefined:
    default:         return 'Helvetica, Arial, sans-serif'
  }
}

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

const DEFAULT_PRIMARY: [number, number, number] = [245, 158, 11]   // amber-500
const DEFAULT_ACCENT: [number, number, number] = [15, 23, 42]      // navy-900

// ---------------------------------------------------------------
// Native jsPDF renderer (no html2canvas)
// ---------------------------------------------------------------
//
// Why native instead of pdf.html()?
//   - jsPDF.html() wraps html2canvas, which rasterizes the off-screen
//     DOM into an image. That pipeline is fragile: any off-screen
//     positioning trick (left: -10000px, opacity: 0, z-index: -1) can
//     trip html2canvas into skipping the paint and producing a blank
//     page. Multiple attempts to dodge that didn't stick.
//   - Going native means: real selectable PDF text, no DOM hack at all,
//     smaller output, and rendering that simply can't go blank.
//   - We lose true HTML fidelity (inline bold/italic flatten to plain
//     text in paragraphs). For markdown templates this is fine.

interface DensityConfig {
  marginX: number
  marginY: number
  bodySize: number
  lineGap: number      // extra px on each line beyond fontSize
  paragraphGap: number // gap after blank lines
  titleSize: number
  titleGap: number     // gap below title underline
  rowH: number         // table row height
}

const DENSITY: Record<'compact' | 'normal' | 'spacious', DensityConfig> = {
  compact:  { marginX: 36, marginY: 36, bodySize: 10, lineGap: 2, paragraphGap: 3, titleSize: 16, titleGap: 8,  rowH: 15 },
  normal:   { marginX: 50, marginY: 50, bodySize: 11, lineGap: 4, paragraphGap: 6, titleSize: 18, titleGap: 12, rowH: 18 },
  spacious: { marginX: 64, marginY: 64, bodySize: 12, lineGap: 6, paragraphGap: 9, titleSize: 20, titleGap: 16, rowH: 22 },
}

const FOOTER_RESERVE = 28

interface PdfCtx {
  pdf: jsPDF
  y: number
  pageW: number
  pageH: number
  contentW: number
  /**
   * Current rendering region — x origin + width. Defaults to the page's
   * margin/content box but gets temporarily overridden inside :::cols
   * blocks so writeText / drawTable / lists render into a sub-column.
   */
  regionX: number
  regionW: number
  primary: [number, number, number]
  accent: [number, number, number]
  headerAlign: 'left' | 'center'
  density: DensityConfig
  font: 'helvetica' | 'times' | 'courier'
  headerBanner: boolean
  footerText: string
}

function newCtx(tokens?: DesignTokens): PdfCtx {
  const paper = tokens?.paper_size ?? 'letter'
  const pdf = new jsPDF({ unit: 'pt', format: paper })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const density = DENSITY[tokens?.layout_density ?? 'normal']
  const contentW = pageW - density.marginX * 2
  return {
    pdf,
    y: density.marginY,
    pageW,
    pageH,
    contentW,
    regionX: density.marginX,
    regionW: contentW,
    primary: hexToRgb(tokens?.primary_color) ?? DEFAULT_PRIMARY,
    accent: hexToRgb(tokens?.accent_color) ?? DEFAULT_ACCENT,
    headerAlign: tokens?.header_alignment === 'center' ? 'center' : 'left',
    density,
    font: mapFontToJsPdf(tokens?.font_family),
    headerBanner: !!tokens?.header_banner,
    footerText: tokens?.footer_text ?? '',
  }
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y + needed > ctx.pageH - ctx.density.marginY - FOOTER_RESERVE) {
    ctx.pdf.addPage()
    ctx.y = ctx.density.marginY
  }
}

function stripInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
}

function writeText(
  ctx: PdfCtx,
  text: string,
  opts: { size?: number; bold?: boolean; italic?: boolean; indent?: number; color?: [number, number, number] } = {},
) {
  const size = opts.size ?? ctx.density.bodySize
  const style = opts.bold ? (opts.italic ? 'bolditalic' : 'bold') : opts.italic ? 'italic' : 'normal'
  ctx.pdf.setFont(ctx.font, style)
  ctx.pdf.setFontSize(size)
  if (opts.color) ctx.pdf.setTextColor(opts.color[0], opts.color[1], opts.color[2])
  else ctx.pdf.setTextColor(30, 41, 59)

  const indent = opts.indent ?? 0
  const lineH = size + ctx.density.lineGap
  const wrapped = ctx.pdf.splitTextToSize(text, ctx.regionW - indent)
  for (const line of wrapped) {
    ensureSpace(ctx, lineH)
    ctx.pdf.text(line, ctx.regionX + indent, ctx.y + size - 2)
    ctx.y += lineH
  }
}

function drawTitle(ctx: PdfCtx, title: string) {
  const tSize = ctx.density.titleSize
  const wrapped = (() => {
    ctx.pdf.setFont(ctx.font, 'bold')
    ctx.pdf.setFontSize(tSize)
    return ctx.pdf.splitTextToSize(title, ctx.contentW)
  })()

  if (ctx.headerBanner) {
    // Full-width colored banner across the top of the page, title in
    // contrasting white (or accent-on-light when primary is light).
    const bannerH = (tSize + 8) * wrapped.length + 18
    ctx.pdf.setFillColor(ctx.primary[0], ctx.primary[1], ctx.primary[2])
    ctx.pdf.rect(0, 0, ctx.pageW, bannerH, 'F')

    // Pick white or near-black title color based on banner luminance.
    const lum = 0.299 * ctx.primary[0] + 0.587 * ctx.primary[1] + 0.114 * ctx.primary[2]
    if (lum > 170) ctx.pdf.setTextColor(15, 23, 42)  // dark banner color → use dark accent
    else ctx.pdf.setTextColor(255, 255, 255)

    ctx.pdf.setFont(ctx.font, 'bold')
    ctx.pdf.setFontSize(tSize)
    let bY = 16
    for (const line of wrapped) {
      if (ctx.headerAlign === 'center') {
        ctx.pdf.text(line, ctx.pageW / 2, bY + tSize - 2, { align: 'center' })
      } else {
        ctx.pdf.text(line, ctx.density.marginX, bY + tSize - 2)
      }
      bY += tSize + 8
    }
    // Reset body cursor below banner with breathing room
    ctx.y = bannerH + Math.max(12, ctx.density.titleGap)
    return
  }

  // Non-banner: title text colored, then brand-colored underline
  ctx.pdf.setFont(ctx.font, 'bold')
  ctx.pdf.setFontSize(tSize)
  ctx.pdf.setTextColor(ctx.accent[0], ctx.accent[1], ctx.accent[2])
  for (const line of wrapped) {
    ensureSpace(ctx, tSize + 4)
    if (ctx.headerAlign === 'center') {
      ctx.pdf.text(line, ctx.pageW / 2, ctx.y + tSize - 2, { align: 'center' })
    } else {
      ctx.pdf.text(line, ctx.density.marginX, ctx.y + tSize - 2)
    }
    ctx.y += tSize + 4
  }
  ctx.pdf.setDrawColor(ctx.primary[0], ctx.primary[1], ctx.primary[2])
  ctx.pdf.setLineWidth(1.5)
  ctx.pdf.line(ctx.density.marginX, ctx.y, ctx.pageW - ctx.density.marginX, ctx.y)
  ctx.y += ctx.density.titleGap
  ctx.pdf.setDrawColor(0, 0, 0)
  ctx.pdf.setLineWidth(0.2)
}

function drawSignature(ctx: PdfCtx, role: string, dataUrl: string) {
  ensureSpace(ctx, 86)
  try {
    const w = Math.min(200, ctx.regionW)
    const h = 60
    ctx.pdf.addImage(dataUrl, 'PNG', ctx.regionX, ctx.y, w, h, undefined, 'FAST')
    ctx.y += h + 2
    ctx.pdf.setDrawColor(148, 163, 184)
    ctx.pdf.line(ctx.regionX, ctx.y, ctx.regionX + w, ctx.y)
    ctx.y += 2
    ctx.pdf.setFont(ctx.font, 'normal')
    ctx.pdf.setFontSize(8)
    ctx.pdf.setTextColor(100, 116, 139)
    ctx.pdf.text(`Signed: ${role}`, ctx.regionX, ctx.y + 8)
    ctx.y += 18
  } catch {
    writeText(ctx, `[Signature: ${role}]`, { italic: true })
  }
}

function drawSignaturePlaceholder(ctx: PdfCtx, role: string) {
  ensureSpace(ctx, 56)
  const w = Math.min(220, ctx.regionW)
  const h = 40
  ctx.pdf.setDrawColor(203, 213, 225)
  ctx.pdf.setLineWidth(0.8)
  ctx.pdf.rect(ctx.regionX, ctx.y, w, h)
  ctx.pdf.setFont(ctx.font, 'italic')
  ctx.pdf.setFontSize(9)
  ctx.pdf.setTextColor(148, 163, 184)
  ctx.pdf.text(`Awaiting signature: ${role}`, ctx.regionX + 8, ctx.y + h / 2 + 3)
  ctx.y += h + 8
  ctx.pdf.setLineWidth(0.2)
}

/**
 * Parse a pipe-table separator row into a per-column alignment array.
 *
 *   |:---|---:|:---:|        →   ['left', 'right', 'center']
 *   |---|---|---|             →   ['left', 'left', 'left']
 */
function parseAlignments(separator: string, colCount: number): Array<'left' | 'right' | 'center'> {
  const cells = separator
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
  const out: Array<'left' | 'right' | 'center'> = []
  for (let i = 0; i < colCount; i++) {
    const c = cells[i] ?? '---'
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    if (left && right) out.push('center')
    else if (right) out.push('right')
    else out.push('left')
  }
  return out
}

const TOTALS_ROW_RE = /^(total|subtotal|tax|balance(?:\s+due)?|grand\s+total|amount\s+(paid|due))\b/i
const NUMERIC_CELL_RE = /^\$?[\d.,()\-\s%]+\$?$/

function drawTable(
  ctx: PdfCtx,
  headers: string[],
  rows: string[][],
  alignments: Array<'left' | 'right' | 'center'>,
) {
  const colCount = headers.length
  const cellPad = 4
  const cellSize = Math.max(8, ctx.density.bodySize - 1)
  const lineH = cellSize + 3

  // Smart column widths: weight by max content length, with a floor +
  // a heavy bonus for the "Description" column so it gets most of the
  // width on invoices.
  const weights = headers.map((h, i) => {
    let w = Math.max(stripInline(h).length, 4)
    for (const row of rows) {
      const cell = stripInline(row[i] ?? '')
      // First line of a multi-line cell drives most of the width
      const firstLine = cell.split(/\s+/).slice(0, 12).join(' ')
      w = Math.max(w, firstLine.length)
    }
    return w
  })
  // Description-style first column gets a 1.4× bonus so totals columns
  // stay narrow when their values are short.
  if (colCount >= 3) weights[0] = weights[0] * 1.4
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const colWs = weights.map((w) => (ctx.regionW * w) / totalWeight)
  const colXs = colWs.map((_, i) => {
    let x = ctx.regionX
    for (let j = 0; j < i; j++) x += colWs[j]
    return x
  })

  function wrapRow(row: string[]): { wrapped: string[][]; h: number } {
    const wrapped = row.map((cell, i) => {
      ctx.pdf.setFontSize(cellSize)
      return ctx.pdf.splitTextToSize(stripInline(cell), colWs[i] - cellPad * 2)
    })
    const maxLines = Math.max(...wrapped.map((l) => l.length || 1))
    return { wrapped, h: maxLines * lineH + cellPad * 2 }
  }

  function drawCellText(
    text: string,
    align: 'left' | 'right' | 'center',
    colIdx: number,
    lineY: number,
  ) {
    const x = colXs[colIdx]
    const w = colWs[colIdx]
    if (align === 'right') {
      ctx.pdf.text(text, x + w - cellPad, lineY, { align: 'right' })
    } else if (align === 'center') {
      ctx.pdf.text(text, x + w / 2, lineY, { align: 'center' })
    } else {
      ctx.pdf.text(text, x + cellPad, lineY)
    }
  }

  // -------- Header row --------
  ctx.pdf.setFont(ctx.font, 'bold')
  ctx.pdf.setFontSize(cellSize)
  const headerInfo = wrapRow(headers)
  ensureSpace(ctx, headerInfo.h + 4)
  ctx.pdf.setFillColor(241, 245, 249)
  ctx.pdf.rect(ctx.regionX, ctx.y, ctx.regionW, headerInfo.h, 'F')
  ctx.pdf.setTextColor(30, 41, 59)
  for (let i = 0; i < colCount; i++) {
    const lines = headerInfo.wrapped[i] ?? []
    for (let ln = 0; ln < lines.length; ln++) {
      drawCellText(lines[ln], alignments[i] ?? 'left', i, ctx.y + cellPad + (ln + 1) * lineH - 3)
    }
  }
  ctx.y += headerInfo.h
  ctx.pdf.setDrawColor(203, 213, 225)
  ctx.pdf.line(ctx.regionX, ctx.y, ctx.regionX + ctx.regionW, ctx.y)

  // -------- Body rows --------
  ctx.pdf.setFont(ctx.font, 'normal')
  for (const row of rows) {
    while (row.length < colCount) row.push('')
    const isTotals = TOTALS_ROW_RE.test(stripInline(row[0] ?? ''))
    if (isTotals) ctx.pdf.setFont(ctx.font, 'bold')

    const info = wrapRow(row)
    ensureSpace(ctx, info.h)
    if (isTotals) {
      // Light highlight on totals rows
      ctx.pdf.setFillColor(248, 250, 252)
      ctx.pdf.rect(ctx.regionX, ctx.y, ctx.regionW, info.h, 'F')
    }
    for (let i = 0; i < colCount; i++) {
      // Per-cell alignment: explicit from separator > numeric-auto-right > left
      const cellText = stripInline(row[i] ?? '').trim()
      const autoAlign: 'left' | 'right' =
        NUMERIC_CELL_RE.test(cellText) && cellText !== '' ? 'right' : 'left'
      const explicit = alignments[i]
      const align: 'left' | 'right' | 'center' =
        explicit && explicit !== 'left' ? explicit : explicit === 'left' ? 'left' : autoAlign
      const lines = info.wrapped[i] ?? ['']
      for (let ln = 0; ln < lines.length; ln++) {
        drawCellText(lines[ln], align, i, ctx.y + cellPad + (ln + 1) * lineH - 3)
      }
    }
    if (isTotals) ctx.pdf.setFont(ctx.font, 'normal')
    ctx.y += info.h
    ctx.pdf.setDrawColor(229, 231, 235)
    ctx.pdf.line(ctx.regionX, ctx.y, ctx.regionX + ctx.regionW, ctx.y)
  }
  ctx.y += Math.max(4, ctx.density.paragraphGap)
  ctx.pdf.setDrawColor(0, 0, 0)
}

function drawFooter(ctx: PdfCtx) {
  const total = ctx.pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    ctx.pdf.setPage(p)
    ctx.pdf.setFont(ctx.font, 'normal')
    ctx.pdf.setFontSize(8)
    ctx.pdf.setDrawColor(226, 232, 240)
    ctx.pdf.line(
      ctx.density.marginX,
      ctx.pageH - ctx.density.marginY + 6,
      ctx.pageW - ctx.density.marginX,
      ctx.pageH - ctx.density.marginY + 6,
    )

    // Tenant-supplied footer line (e.g. "{{company.name}} · 555-1234")
    // takes precedence over the generic "Generated ... CrewBarn" line.
    const left = ctx.footerText
      ? ctx.footerText
      : `Generated ${new Date().toLocaleString()} · CrewBarn`
    ctx.pdf.setTextColor(100, 116, 139)
    ctx.pdf.text(left, ctx.density.marginX, ctx.pageH - ctx.density.marginY + 18)

    ctx.pdf.setTextColor(148, 163, 184)
    ctx.pdf.text(
      `Page ${p} of ${total}`,
      ctx.pageW - ctx.density.marginX,
      ctx.pageH - ctx.density.marginY + 18,
      { align: 'right' },
    )
  }
}

/**
 * Render a markdown document to a PDF Blob using native jsPDF text
 * calls. No html2canvas, no off-screen DOM — output is always real
 * selectable text and never comes out blank.
 *
 * Custom syntax beyond CommonMark:
 *   - `[[signature:role]]`        signature image / placeholder
 *   - `:::cols ... +++ ... :::`   side-by-side multi-column block
 *
 * Pipe-table separator alignment (`|:---|---:|:---:|`) is honored.
 * Numeric / $-prefixed cells auto-right-align even without an
 * alignment hint. Rows whose first cell starts with Total / Subtotal
 * / Tax / Balance / Amount Paid get bolded with a light highlight.
 */
export async function renderMarkdownToPdfBlob(
  title: string,
  markdown: string,
  signatures?: SignatureMap,
  designTokens?: DesignTokens,
): Promise<Blob> {
  const ctx = newCtx(designTokens)
  drawTitle(ctx, title)

  const lines = markdown.split(/\r?\n/)
  renderLines(ctx, lines, signatures, /* allowColumns */ true)

  drawFooter(ctx)
  return ctx.pdf.output('blob')
}

/**
 * Process a list of markdown lines and emit them into the current
 * ctx region. Pulled out of the main render function so it can be
 * called recursively from inside `:::cols` blocks (each column is
 * just another renderLines call into a narrower region).
 *
 * `allowColumns=false` prevents pathological infinite nesting if a
 * user puts a :::cols inside a :::cols column.
 */
function renderLines(
  ctx: PdfCtx,
  lines: string[],
  signatures: SignatureMap | undefined,
  allowColumns: boolean,
) {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    if (line === '') {
      ctx.y += ctx.density.paragraphGap
      continue
    }

    // -------- Custom: side-by-side columns block --------
    //   :::cols
    //   left column markdown
    //   +++
    //   right column markdown
    //   :::
    if (allowColumns && /^:::\s*cols?\b/i.test(line)) {
      // Collect lines until the closing ":::"
      const collected: string[] = []
      let j = i + 1
      let closed = false
      while (j < lines.length) {
        if (/^:::\s*$/.test(lines[j].trim())) {
          closed = true
          break
        }
        collected.push(lines[j])
        j++
      }
      if (!closed) {
        // Malformed — fall back to rendering as a paragraph so we don't
        // silently swallow the user's content.
        writeText(ctx, stripInline(line))
        continue
      }
      i = j  // outer loop's i++ skips past the closing :::

      // Split by `+++` separators into per-column line groups
      const groups: string[][] = [[]]
      for (const ln of collected) {
        if (/^\+\+\+\s*$/.test(ln.trim())) {
          groups.push([])
        } else {
          groups[groups.length - 1].push(ln)
        }
      }
      const nonEmpty = groups.filter((g) => g.some((l) => l.trim() !== ''))
      if (nonEmpty.length <= 1) {
        // Just one column → render as a single block (no point in cols)
        renderLines(ctx, collected, signatures, false)
        continue
      }

      renderColumns(ctx, nonEmpty, signatures)
      continue
    }

    // -------- [[signature:role]] token --------
    const sigMatch = line.match(/^\[\[signature:([a-zA-Z0-9_-]+)\]\]$/)
    if (sigMatch) {
      const role = sigMatch[1]
      const dataUrl = signatures?.[role]
      if (dataUrl) drawSignature(ctx, role, dataUrl)
      else drawSignaturePlaceholder(ctx, role)
      continue
    }

    // -------- Headings --------
    const h = /^(#{1,4})\s+(.+)$/.exec(line)
    if (h) {
      const level = h[1].length
      const base = ctx.density.bodySize
      const size = level === 1 ? base + 5 : level === 2 ? base + 3 : level === 3 ? base + 1 : base
      ctx.y += level <= 2 ? Math.max(4, ctx.density.paragraphGap) : 2
      writeText(ctx, stripInline(h[2]), {
        size,
        bold: true,
        color: ctx.accent,
      })
      ctx.y += 2
      continue
    }

    // -------- Pipe table (with alignment + multi-line cells) --------
    if (/^\|.+\|$/.test(line) && /^\|[\s|:-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      const headers = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const separator = (lines[i + 1] ?? '').trim()
      const alignments = parseAlignments(separator, headers.length)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i++
      }
      i--  // rewind one for the outer loop ++
      drawTable(ctx, headers, rows, alignments)
      continue
    }

    // -------- Blockquote --------
    if (line.startsWith('> ')) {
      writeText(ctx, stripInline(line.slice(2)), {
        italic: true,
        indent: 14,
        color: [100, 116, 139],
      })
      continue
    }

    // -------- Unordered list item --------
    const ul = /^[-*]\s+(.+)$/.exec(line)
    if (ul) {
      const base = ctx.density.bodySize
      ensureSpace(ctx, base + ctx.density.lineGap)
      ctx.pdf.setFont(ctx.font, 'normal')
      ctx.pdf.setFontSize(base)
      ctx.pdf.setTextColor(30, 41, 59)
      ctx.pdf.text('•', ctx.regionX + 4, ctx.y + base - 2)
      writeText(ctx, stripInline(ul[1]), { indent: 14 })
      continue
    }

    // -------- Ordered list item --------
    const ol = /^(\d+)\.\s+(.+)$/.exec(line)
    if (ol) {
      const base = ctx.density.bodySize
      ensureSpace(ctx, base + ctx.density.lineGap)
      ctx.pdf.setFont(ctx.font, 'normal')
      ctx.pdf.setFontSize(base)
      ctx.pdf.setTextColor(30, 41, 59)
      ctx.pdf.text(`${ol[1]}.`, ctx.regionX + 2, ctx.y + base - 2)
      writeText(ctx, stripInline(ol[2]), { indent: 18 })
      continue
    }

    // -------- Plain paragraph --------
    writeText(ctx, stripInline(line))
  }
}

/**
 * Render N columns side-by-side. Each column is just another
 * renderLines() call into a narrower region. After all columns are
 * laid out, ctx.y advances to the deepest column's end.
 */
function renderColumns(ctx: PdfCtx, groups: string[][], signatures: SignatureMap | undefined) {
  const colCount = groups.length
  const gap = 14
  const colW = (ctx.regionW - gap * (colCount - 1)) / colCount
  const startY = ctx.y
  const originalX = ctx.regionX
  const originalW = ctx.regionW
  let maxEndY = startY
  for (let i = 0; i < colCount; i++) {
    ctx.regionX = originalX + i * (colW + gap)
    ctx.regionW = colW
    ctx.y = startY
    renderLines(ctx, groups[i], signatures, false)
    if (ctx.y > maxEndY) maxEndY = ctx.y
  }
  ctx.regionX = originalX
  ctx.regionW = originalW
  ctx.y = maxEndY + ctx.density.paragraphGap
}

/**
 * Build a safe download filename for a rendered PDF.
 *
 * Sanitizes title (strips weird chars), trims to 80 chars, and ensures a
 * single .pdf extension — so titles that already include ".pdf" (because
 * we used the original upload filename as the title) don't produce
 * `resume.pdf.pdf`.
 */
export function buildPdfFilename(title: string): string {
  const cleaned = title.replace(/[^\w.-]+/g, '_').slice(0, 80)
  const withoutExt = cleaned.replace(/(\.pdf)+$/i, '')
  return `${withoutExt || 'document'}.pdf`
}

function splitHtmlPdfPages(html: string): string[] {
  if (!html.includes('data-pdf-page-break')) return [html]

  const styleTags = html.match(/<style[\s\S]*?<\/style>/gi)?.join('') ?? ''
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, '')
  const parts = body
    .split(/<div\b(?=[^>]*data-pdf-page-break=["']always["'])[^>]*>\s*(?:&nbsp;)?\s*<\/div>/gi)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) return [html]

  return parts.map((part) => `${styleTags}${part}`)
}

/**
 * Render a raw-HTML body to a PDF Blob using jsPDF.html() (html2canvas
 * under the hood). Used when body_format = 'html'.
 *
 * To avoid html2canvas's "blank page" failure mode with off-screen
 * elements, we render briefly on-screen behind a full-page white
 * overlay so the user just sees a "Rendering PDF…" mask.
 */
export async function renderHtmlToPdfBlob(
  title: string,
  html: string,
  designTokens?: DesignTokens,
): Promise<Blob> {
  const paper = designTokens?.paper_size ?? 'letter'
  const primary = designTokens?.primary_color ?? '#f59e0b'
  const accent = designTokens?.accent_color ?? '#0f172a'
  const fontCss = fontToCss(designTokens?.font_family)
  const alignTitle = designTokens?.header_alignment === 'center' ? 'center' : 'left'

  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 99999',
    'background: rgba(255, 255, 255, 0.97)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'font-family: system-ui, -apple-system, sans-serif',
    'font-size: 14px',
    'color: #475569',
  ].join(';')
  overlay.textContent = 'Rendering PDF…'

  const container = document.createElement('div')
  container.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 720px',
    'padding: 32px',
    'background: white',
    'z-index: 1',
    `font-family: ${fontCss}`,
    'font-size: 12px',
    'line-height: 1.5',
    'color: #1e293b',
  ].join(';')

  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const titleHtml = designTokens?.header_banner
    ? `<div style="background:${primary};padding:18px 28px;margin:-32px -32px 18px;color:${
        bannerTextColor(primary)
      };text-align:${alignTitle};">
         <h1 style="margin:0;font-size:20px;font-weight:bold;">${safeTitle}</h1>
       </div>`
    : `<h1 style="margin:0 0 4px;color:${accent};text-align:${alignTitle};font-size:20px;">
         ${safeTitle}
       </h1>
       <div style="height:3px;background:${primary};margin-bottom:16px;"></div>`

  const htmlPages = splitHtmlPdfPages(html)
  const renderedPages = htmlPages.map((pageHtml, index) =>
    index === 0 ? `${titleHtml}<div>${pageHtml}</div>` : `<div>${pageHtml}</div>`,
  )

  container.innerHTML = renderedPages[0]
  document.body.appendChild(overlay)
  document.body.appendChild(container)

  async function waitForImages(): Promise<void> {
    // Tag every image with crossorigin="anonymous" BEFORE we wait for
    // loads. Without this, html2canvas can't sample pixels from cross-
    // origin images (e.g. logos on images.crewbarn.com) and the whole
    // snapshot bails — producing a blank body with only the title.
    // The img is already in the DOM, so we re-trigger the load by
    // reassigning src after setting crossOrigin.
    const imgs = Array.from(container.querySelectorAll('img'))
    imgs.forEach((img) => {
      if (!img.crossOrigin) {
        const src = img.src
        img.crossOrigin = 'anonymous'
        img.src = src
      }
    })

    // Wait for all images to settle (load or error) before snapshot.
    // html2canvas will otherwise rasterize a frame where the logo is
    // still 0×0 and the layout collapses.
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise<void>((resolve) => {
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          // 3s safety net so a hung CDN doesn't block the whole download.
          setTimeout(done, 3000)
        })
      }),
    )
  }

  try {
    const pdf = new jsPDF({ unit: 'pt', format: paper })
    if (renderedPages.length > 1) {
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let pageIndex = 0; pageIndex < renderedPages.length; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage()
        container.innerHTML = renderedPages[pageIndex]
        await waitForImages()

        const canvas = await html2canvas(container, {
          useCORS: true,
          allowTaint: true,
          logging: false,
        })
        const imageHeight = (canvas.height * pageWidth) / canvas.width
        const renderHeight = Math.min(imageHeight, pageHeight)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, renderHeight)
      }

      return pdf.output('blob')
    }

    await waitForImages()
    await pdf.html(container, {
      x: 0,
      y: 0,
      width: pdf.internal.pageSize.getWidth(),
      windowWidth: 720,
      // 'slice' = chop the rasterized image cleanly at page boundaries.
      // 'text' (the previous setting) tries to break at text boundaries
      // and overlays a separate text layer on top of the bitmap — when
      // the two layers desync (which happens to table rows), the same
      // row visibly renders twice at offset y-positions, looking like a
      // strikethrough. Slice mode is just one bitmap per page, no
      // overlay, no double-render.
      autoPaging: 'slice',
      margin: [40, 0, 40, 0],
      // html2canvas options pass through. useCORS lets us draw images
      // served with Access-Control-Allow-Origin headers; allowTaint is
      // the fallback so the snapshot still completes (just tainted)
      // when the server doesn't return CORS. Either way the page is
      // not blank.
      //
      // NOTE: do NOT pass scale > 1 here. jsPDF.html() derives the
      // output width from the rasterized bitmap dimensions, so a 2×
      // canvas scale doubles the placed-page width and the right edge
      // gets clipped on letter paper. Default scale (1) keeps the
      // 720px source mapping cleanly to the 612pt page width.
      html2canvas: {
        useCORS: true,
        allowTaint: true,
        logging: false,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    return pdf.output('blob')
  } finally {
    document.body.removeChild(container)
    document.body.removeChild(overlay)
  }
}

function bannerTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 170 ? '#0f172a' : '#ffffff'
}

/** Trigger a browser download for a Blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
