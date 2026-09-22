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
  | '2x1'        // Small — Dymo 30330 (1.875" x 0.75" ish; rounded for cleanliness)
  | '2.25x1.25'  // Standard Dymo 30334 (most common LabelWriter roll)
  | '3x2'        // Mid-size general purpose
  | '4x6'        // Shipping label — Dymo 30253 / 4x6 thermal

export interface ThermalSize {
  key: ThermalSizeKey
  label: string
  /** width in inches (label dimensions, NOT page dimensions for sheets) */
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
    label: 'Full sheet · 2.25" × 1.25" labels (Avery 5160)',
    w: 2.25,
    h: 1.25,
    qrPx: 80,
    showFullText: true,
    fullSheet: true,
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
  marginX: number
  marginY: number
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
  return { cols, rows, marginX, marginY }
}

export function parseThermalSize(value: string | null | undefined): ThermalSizeKey {
  if (value && value in THERMAL_SIZES) return value as ThermalSizeKey
  return 'sheet'
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
