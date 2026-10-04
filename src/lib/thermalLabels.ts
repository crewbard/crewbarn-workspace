/**
 * Thermal label size presets — each printer roll has a fixed label
 * dimension; the print layout has to match so the thermal printer
 * lays one label per "page" exactly.
 *
 * Common Dymo/Brother sizes covered. Add more entries here as needed.
 */
export type ThermalSizeKey =
  | 'sheet'      // Default 8.5x11 / A4 grid mode (existing behavior)
  | 'full'       // Full-page sticker — one giant 8.5"x11" QR per page
  // "full-NxM" entries: letter-sized sticker paper with a grid of labels
  // at the chosen tile size. Picks multi-up automatically.
  | 'full-1x1'
  | 'full-2x1'
  | 'full-2.25x1.25'
  | 'full-3x2'
  | '1x1'        // Tiny square — Dymo 30332
  | 'avery-5160'
  | 'avery-5161'
  | 'avery-5163'
  | 'avery-5167'
  | '2x1'        // Small — Dymo 30330 (1.875" x 0.75" ish; rounded for cleanliness)
  | '2.25x1.25'  // Standard Dymo 30334 (most common LabelWriter roll)
  | '3x2'        // Mid-size general purpose
  | '4x6'        // Shipping label — Dymo 30253 / 4x6 thermal

export interface ThermalSize {
  key: ThermalSizeKey
  label: string
  /** width in inches (label dimensions, NOT page dimensions for sheets) */
  /** Set when this is a sheet you can buy, with fixed die-cut positions. */
  stock?: SheetStock
  w: number
  /** height in inches */
  h: number
  /** suggested QR pixel size when this label is printed */
  qrPx: number
  /** whether to show the secondary text rows (path, type, etc.) */
  showFullText: boolean
  /**
   * When true, this is a full letter-sized sheet of pre-cut stickers
   * laid out as a multi-up grid at the (w, h) tile size. Pages that
   * render labels should treat this like the existing `multiUp=true`
   * mode automatically (no separate checkbox needed).
   */
  fullSheet?: boolean
}

/** True if this size means "letter paper with a multi-up grid of tiles". */
export function isFullSheetSize(key: ThermalSizeKey): boolean {
  return THERMAL_SIZES[key]?.fullSheet === true
}

export const THERMAL_SIZES: Record<ThermalSizeKey, ThermalSize> = {
  sheet: {
    key: 'sheet',
    label: 'Sheet (Letter / A4)',
    w: 0,
    h: 0,
    qrPx: 96,
    showFullText: true,
  },
  full: {
    key: 'full',
    label: 'Full-page sticker · one big QR (8.5" × 11")',
    w: 8.5,
    h: 11,
    qrPx: 400,
    showFullText: true,
  },
  'full-1x1': {
    key: 'full-1x1',
    label: 'Full sheet · 1" × 1" labels',
    w: 1,
    h: 1,
    qrPx: 70,
    showFullText: false,
    fullSheet: true,
  },
  'full-2x1': {
    key: 'full-2x1',
    label: 'Full sheet · 2" × 1" labels',
    w: 2,
    h: 1,
    qrPx: 70,
    showFullText: true,
    fullSheet: true,
  },
  'full-2.25x1.25': {
    key: 'full-2.25x1.25',
    // Not an Avery size. It used to say "(Avery 5160)", which sent people
    // to buy 5160 and print a layout that misses every label on it.
    label: 'Full sheet · 2.25" × 1.25" labels (generic)',
    w: 2.25,
    h: 1.25,
    qrPx: 80,
    showFullText: true,
    fullSheet: true,
  },
  'avery-5160': {
    key: 'avery-5160',
    label: 'Avery 5160 / 8160 / 5260 · 30 per sheet (2⅝" × 1")',
    w: 2.625,
    h: 1,
    qrPx: 70,
    showFullText: true,
    fullSheet: true,
    stock: { cols: 3, rows: 10, marginLeft: 0.1875, marginTop: 0.5, gapX: 0.125, gapY: 0 },
  },
  'avery-5161': {
    key: 'avery-5161',
    label: 'Avery 5161 / 8161 · 20 per sheet (4" × 1")',
    w: 4,
    h: 1,
    qrPx: 70,
    showFullText: true,
    fullSheet: true,
    stock: { cols: 2, rows: 10, marginLeft: 0.15625, marginTop: 0.5, gapX: 0.1875, gapY: 0 },
  },
  'avery-5163': {
    key: 'avery-5163',
    label: 'Avery 5163 / 8163 · 10 per sheet (4" × 2")',
    w: 4,
    h: 2,
    qrPx: 130,
    showFullText: true,
    fullSheet: true,
    stock: { cols: 2, rows: 5, marginLeft: 0.15625, marginTop: 0.5, gapX: 0.1875, gapY: 0 },
  },
  'avery-5167': {
    key: 'avery-5167',
    label: 'Avery 5167 / 8167 · 80 per sheet (1¾" × ½")',
    w: 1.75,
    h: 0.5,
    qrPx: 44,
    showFullText: false,
    fullSheet: true,
    stock: { cols: 4, rows: 20, marginLeft: 0.28125, marginTop: 0.5, gapX: 0.3125, gapY: 0 },
  },
  'full-3x2': {
    key: 'full-3x2',
    label: 'Full sheet · 3" × 2" labels',
    w: 3,
    h: 2,
    qrPx: 130,
    showFullText: true,
    fullSheet: true,
  },
  '1x1': {
    key: '1x1',
    label: 'Thermal · 1" × 1"',
    w: 1,
    h: 1,
    qrPx: 70,
    showFullText: false,
  },
  '2x1': {
    key: '2x1',
    label: 'Thermal · 2" × 1"',
    w: 2,
    h: 1,
    qrPx: 70,
    // Plenty of room beside the QR on a 2x1 — show the full tree path,
    // kind tag, and any extra details. Was false earlier on the
    // assumption it's too small; the right column is ~1" wide which
    // wraps a path label across 2-3 lines just fine.
    showFullText: true,
  },
  '2.25x1.25': {
    key: '2.25x1.25',
    label: 'Thermal · 2.25" × 1.25" (Dymo 30334)',
    w: 2.25,
    h: 1.25,
    qrPx: 80,
    showFullText: true,
  },
  '3x2': {
    key: '3x2',
    label: 'Thermal · 3" × 2"',
    w: 3,
    h: 2,
    qrPx: 130,
    showFullText: true,
  },
  '4x6': {
    key: '4x6',
    label: 'Thermal · 4" × 6" (shipping)',
    w: 4,
    h: 6,
    qrPx: 220,
    showFullText: true,
  },
}

/**
 * Layout result for a multi-up sheet: columns/rows that fit on letter
 * paper at the given thermal size + gap, and the centering margins.
 */
export interface SheetGridLayout {
  cols: number
  rows: number
  /** Left edge of the first label, not page padding. */
  marginX: number
  /** Top edge of the first label, not page padding. */
  marginY: number
  /** Distance between labels across. Die-cut sheets differ across and down. */
  gapX: number
  gapY: number
}

/**
 * A sheet that exists as a product, with the geometry off its spec sheet.
 *
 * Every number is the manufacturer's, in inches, measured from the top-left
 * of US Letter. They are not centred and not symmetrical, which is exactly
 * why a computed grid cannot land on them.
 */
export interface SheetStock {
  cols: number
  rows: number
  marginLeft: number
  marginTop: number
  gapX: number
  gapY: number
}

/**
 * Compute the grid for a multi-up sheet of labels at thermal `size`,
 * separated by `gap` inches in both directions. The grid is centered
 * on letter paper with at least `minMargin` inches of edge padding.
 *
 * Generic across pre-cut label sheet brands — pick the gap that
 * matches your specific sheet's die-cut spec (Avery, OnlineLabels, etc.).
 * 0 = labels touch (most low-cost sheets); 0.125" is also common.
 */
export function computeSheetGrid(
  size: ThermalSize,
  gap = 0,
  minMargin = 0.25,
): SheetGridLayout {
  // A sheet you can buy knows where its labels are. Nothing to compute.
  if (size.stock) {
    const st = size.stock
    return {
      cols: st.cols,
      rows: st.rows,
      marginX: st.marginLeft,
      marginY: st.marginTop,
      gapX: st.gapX,
      gapY: st.gapY,
    }
  }

  const pageW = 8.5
  const pageH = 11
  // pageW >= 2*minMargin + cols*size.w + (cols-1)*gap
  const cols = Math.max(
    1,
    Math.floor((pageW - 2 * minMargin + gap) / (size.w + gap)),
  )
  const rows = Math.max(
    1,
    Math.floor((pageH - 2 * minMargin + gap) / (size.h + gap)),
  )
  // Center the grid by computing actual margins from used width/height.
  const usedW = cols * size.w + Math.max(0, cols - 1) * gap
  const usedH = rows * size.h + Math.max(0, rows - 1) * gap
  const marginX = (pageW - usedW) / 2
  const marginY = (pageH - usedH) / 2
  return { cols, rows, marginX, marginY, gapX: gap, gapY: gap }
}

/**
 * Where this browser's last label size is kept.
 *
 * Per browser, not per tenant: a label printer is a physical thing bolted
 * to one PC, and the shop machine with the 2x1 thermal and the laptop that
 * prints Avery sheets are the same login.
 */
const REMEMBERED_SIZE_KEY = 'crewbarn.labels.size'

/** The size this browser used last, if it is still a size we offer. */
export function rememberedThermalSize(): ThermalSizeKey | null {
  try {
    const stored = localStorage.getItem(REMEMBERED_SIZE_KEY)
    return stored && stored in THERMAL_SIZES ? (stored as ThermalSizeKey) : null
  } catch {
    // Private window, or storage switched off. Not remembering is a fine
    // outcome; throwing on the way to printing a label is not.
    return null
  }
}

export function rememberThermalSize(key: ThermalSizeKey): void {
  try {
    localStorage.setItem(REMEMBERED_SIZE_KEY, key)
  } catch {
    /* see above */
  }
}

/**
 * The size to show, in order: what the URL asked for, then what this
 * browser printed last, then sheet.
 *
 * The URL still wins so a link that names a size prints that size.
 */
export function parseThermalSize(value: string | null | undefined): ThermalSizeKey {
  if (value && value in THERMAL_SIZES) return value as ThermalSizeKey
  return rememberedThermalSize() ?? 'sheet'
}

/**
 * Generate the @page + label-card print CSS for a chosen thermal size.
 * For sheet mode, returns the standard letter/A4 grid CSS.
 */
/**
 * Print CSS for browser-print (window.print()) flows.
 * - Sheet mode and multi-up-on-letter mode use letter paper with
 *   the standard browser print margins.
 * - Otherwise, set @page size to match the thermal label.
 */
export function thermalPrintCss(key: ThermalSizeKey, multiUp = false): string {
  if (key === 'sheet' || multiUp) {
    return `
      @media print {
        @page { margin: 0.25in; }
        html, body, #root { background: white !important; padding: 0 !important; margin: 0 !important; }
        .no-print { display: none !important; }
        .label-card { break-inside: avoid; page-break-inside: avoid; }
        .print-stage { padding: 0 !important; }
      }
    `
  }
  const { w, h } = THERMAL_SIZES[key]
  return `
    @media print {
      @page { size: ${w}in ${h}in; margin: 0; }
      html, body, #root { background: white !important; padding: 0 !important; margin: 0 !important; }
      .no-print { display: none !important; }
      .print-stage { padding: 0 !important; display: block !important; }
      .print-stage > * { display: block !important; }
      .label-card {
        width: ${w}in !important;
        height: ${h}in !important;
        box-sizing: border-box !important;
        page-break-after: always;
        break-after: page;
        border: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }
      .label-card:last-child { page-break-after: auto; }
    }
  `
}
