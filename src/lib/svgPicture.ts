/**
 * The plain parts of turning a picked SVG into a PNG (see rasterizeIfSvg.ts):
 * spotting an SVG, and how big to draw it. Kept apart so they can be tested
 * without a browser.
 */

/** Is this an SVG? By its type, its name, or "<svg" near the start (what the server checks too). */
export function looksLikeSvg(name: string, type: string, head: string): boolean {
  return type === 'image/svg+xml' || /\.svgz?$/i.test(name) || /<svg[\s>/]/i.test(head)
}

/** A width or height in pixels ("120" or "120px"); anything else (%, em, mm) is null. */
export function pixels(value: string | null | undefined): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(value ?? '')
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * How big to draw it: the SVG's own width and height, else its viewBox, else
 * square. Scaled so the longest side is between minSide and maxSide: a
 * drawing loses nothing by growing, and a huge one is kept to what a browser
 * can draw.
 */
export function pictureSize(
  width: string | null | undefined,
  height: string | null | undefined,
  viewBox: string | null | undefined,
  minSide = 1024,
  maxSide = 2048,
): { width: number; height: number } {
  const box = (viewBox ?? '').trim().split(/[\s,]+/).map(Number)
  const bw = box.length === 4 && box[2] > 0 ? box[2] : null
  const bh = box.length === 4 && box[3] > 0 ? box[3] : null
  let w = pixels(width)
  let h = pixels(height)
  if (w === null && h === null) {
    w = bw
    h = bh
  } else if (w === null && h !== null) {
    w = bw && bh ? (h * bw) / bh : h
  } else if (h === null && w !== null) {
    h = bw && bh ? (w * bh) / bw : w
  }
  if (w === null || h === null) {
    w = 1
    h = 1
  }
  const long = Math.max(w, h)
  const target = Math.min(maxSide, Math.max(minSide, long))
  const scale = target / long
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** The PNG's name: the same name, ending .png. */
export function pngName(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, '').trim()
  return `${base || 'picture'}.png`
}
