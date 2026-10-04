import type { Line, LinePart } from './autoTabs'

/**
 * The part numbers printed on a page, and where each one is.
 *
 * So a number in a catalogue's table can be clicked onto the order instead
 * of typed. Read from the PDF's text, the same lines Find reads; a scanned
 * page has none and nothing on it is clickable.
 *
 * A part number is a run of letters and digits, maybe split by dashes,
 * dots or slashes: 164-R8324, 5943674, HU101, B111, and a four-digit
 * product code like 7108. What is not one: a year, a page number, a price,
 * a quantity, a phone number, a bare word. Under a "Product Code" or
 * "Part #" column heading, a three- or four-digit number is one whatever
 * it looks like -- a code can be 2050.
 * Some model names will still look like part numbers -- F-150 does -- and
 * clicking one only offers it, so a near miss costs nothing.
 *
 * Option codes count too: the short capitals in brackets after a name,
 * "Satin Brass (US4)", "Astoria Knob (AS)". They are what a build is made
 * of -- the finish, the style -- even where they are too short to pass
 * for a part number on their own.
 */

export type PartOnPage = {
  text: string
  /** A part number, or an option code in brackets (a finish, a style). */
  kind: 'part' | 'option'
  /**
   * The words that go with it, as a description for a part the shop does
   * not carry: its own cells of the table row, not the whole row across a
   * three-column index.
   */
  line: string
  /**
   * The price printed on its row, in cents: what the book charges the
   * customer. The first one to its right, so a row with a standard price
   * and an upgrade price ($284 $335) gives the standard one.
   */
  price?: number
  /** Fractions of the page, top-left origin. */
  box: { left: number; top: number; width: number; height: number }
}

const TOKEN = /[A-Za-z0-9][A-Za-z0-9./-]*[A-Za-z0-9]/g

/** Is this word a part number? */
export function looksLikePartNumber(token: string): boolean {
  const bare = token.replace(/[^A-Za-z0-9]/g, '')
  const digits = (bare.match(/\d/g) ?? []).length
  const letters = bare.length - digits
  if (digits === 0) return false

  // 414-247-3333, 1-800-555-1212, 356-2741: a phone number.
  if (/^(1-)?(\d{3}[-.])?\d{3}[-.]\d{4}$/.test(token)) return false
  // "Pages 10-23": a range of pages.
  if (/^\d{1,3}[-–]\d{1,3}$/.test(token)) return false
  // 12.50, 3/4, 10.5: a price, a size, a measurement.
  if (/^\d+([./]\d+)+$/.test(token) && bare.length < 7) return false

  if (letters === 0) {
    // 7108 is a product code; 2026 is a year.
    if (bare.length === 4) return !/^(19|20)\d\d$/.test(bare)
    return bare.length >= 5
  }
  // Mixed: HU101, B111, 164-R8324. Not 4B, 2X, MHz.
  return bare.length >= 4 && digits >= 2
}

/**
 * Where each part number on a line sits: each piece of text is laid out
 * in proportion to its characters, which is close enough to put a box
 * around one number in a table cell.
 */
export function partsOnLines(lines: Line[], pageHeight: number): PartOnPage[] {
  const out: PartOnPage[] = []
  const columns = codeColumns(lines)
  const prices = pricesOn(lines)
  // Under a code column heading on this page: that column, below the heading.
  const inCodeColumn = (x: number, top: number) => columns.some((c) => top > c.top && x >= c.from && x <= c.to)

  for (const line of lines) {
    for (const part of line.parts ?? []) {
      const chars = [...part.text]
      if (chars.length === 0) continue
      const per = part.width / chars.length

      for (const m of part.text.matchAll(TOKEN)) {
        const token = m[0]
        const at = [...part.text.slice(0, m.index ?? 0)].length
        // $1114 is a price, 15% a discount.
        const before = part.text[(m.index ?? 0) - 1] ?? ''
        const after = part.text[(m.index ?? 0) + token.length] ?? ''
        if (/[$£€]/.test(before) || after === '%') continue

        const center = part.x + (at + token.length / 2) * per
        const coded = /^\d{3,4}$/.test(token) && inCodeColumn(center, line.top)
        const option = before === '(' && after === ')' && OPTION.test(token)
        if (!coded && !option && !looksLikePartNumber(token)) continue
        // In brackets after a name it is a choice -- a finish, a style -- even when it looks like a part.
        const kind = option ? 'option' : 'part'
        out.push({
          text: token,
          kind,
          line: kind === 'option' ? optionName(line, part, token) : wordsFor(line, token),
          // A finish or a style has no price of its own; the row's price is the product's.
          price: kind === 'part' ? priceFor(prices, center, line.top) : undefined,
          box: {
            left: Math.max(0, part.x + at * per - 0.003),
            top: Math.max(0, line.top - (line.size * 0.95) / pageHeight),
            width: Math.min(1, [...token].length * per + 0.006),
            height: (line.size * 1.25) / pageHeight,
          },
        })
      }
    }
  }

  return out
}

/**
 * The first price after a code in a line of text: what a Find result's
 * line charges for the code that was searched for.
 */
export function priceAfter(text: string, code: string): number | undefined {
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const want = fold(code)
  let at = 0
  // Where the code ends, compared with dashes and spaces aside.
  for (let i = 0; i < text.length && want; i++) {
    if (fold(text.slice(0, i + 1)).endsWith(want)) {
      at = i + 1
      break
    }
  }
  const m = text.slice(at).match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?!\d)/)
  if (!m) return undefined
  return Number(m[1].replace(/,/g, '')) * 100 + Number(m[2] ?? 0)
}

/** Every dollar amount on a page, and where it sits. */
function pricesOn(lines: Line[]): Array<{ cents: number; x: number; top: number }> {
  const out: Array<{ cents: number; x: number; top: number }> = []
  for (const line of lines) {
    for (const part of line.parts ?? []) {
      const per = part.text.length > 0 ? part.width / part.text.length : 0
      for (const m of part.text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?!\d)/g)) {
        const dollars = Number(m[1].replace(/,/g, ''))
        if (!Number.isFinite(dollars) || dollars <= 0) continue
        out.push({ cents: dollars * 100 + Number(m[2] ?? 0), x: part.x + (m.index ?? 0) * per, top: line.top })
      }
    }
  }
  return out
}

/**
 * The price on a code's row: to its right, on its line or a hair either
 * side -- a table cell set a point higher than its neighbours still
 * belongs to the same row -- the nearest first, then the leftmost.
 */
function priceFor(prices: Array<{ cents: number; x: number; top: number }>, x: number, top: number): number | undefined {
  const row = prices
    .filter((p) => p.x > x && Math.abs(p.top - top) <= 0.012)
    .sort((a, b) => Math.abs(a.top - top) - Math.abs(b.top - top) || a.x - b.x)
  return row[0]?.cents
}

/**
 * How the book says to order: "To order: Function + Product Code +
 * Backset + Knob/Lever Style + Handing + Finish". The pieces, in order, as
 * a checklist for a build. Null on a page that does not say.
 */
export function orderFormula(lines: Line[]): string[] | null {
  for (const line of lines) {
    // Anywhere on the line: a footer shares its baseline with the page number.
    const m = line.text.match(/(?:^|\s)(?:to order|how to order|ordering)\s*:\s*(.+)$/i)
    if (!m) continue
    const pieces = m[1]
      .split(/\s*\+\s*/)
      .map((p) => p.replace(/\s+\d{1,4}$/, '').replace(/\s+/g, ' ').trim())
      .filter((p) => /[A-Za-z]{2}/.test(p))
    if (pieces.length >= 2) return pieces.slice(0, 12)
  }
  return null
}

/**
 * What an option code is called: the words just before its brackets in
 * the same piece of text -- "Satin Brass (US4)" is Satin Brass -- or the
 * piece before it when the code was set on its own.
 */
function optionName(line: Line, part: LinePart, token: string): string {
  const before = part.text.slice(0, part.text.indexOf(`(${token})`)).trim()
  // Only the last phrase: a column of words can run into the name ahead of it.
  const own = before.split(/\s{2,}|[|•]|\)\s/).pop()?.trim() ?? ''
  const name = own.split(/\s+/).slice(-4).join(' ')
  if (/[A-Za-z]{2}/.test(name)) return name.replace(/^[-–:,\s]+/, '').slice(0, 80)

  const parts = line.parts ?? []
  const previous = parts[parts.indexOf(part) - 1]
  return previous ? previous.text.trim().split(/\s+/).slice(-4).join(' ').slice(0, 80) : token
}

/** "(US4)", "(AS)", "(US3NL)": capitals and digits, short, starting with a letter. */
const OPTION = /^[A-Z][A-Z0-9]{0,6}$/

/** Any code at all in a piece of text: where one cell's words end and the next part's begin. */
const hasCode = (text: string) =>
  [...text.matchAll(TOKEN)].some((m) => looksLikePartNumber(m[0]))
  || /\([A-Z][A-Z0-9]{0,6}\)/.test(text)

/**
 * The words that belong to a code: its own cell, and the cells beside it
 * up to the next code. A bare number on its left is the end of the
 * previous entry (an index's page number), not this one's.
 */
export function wordsFor(line: Line, token: string): string {
  const cells = line.segments && line.segments.length > 1 ? line.segments : [line.text]
  const at = cells.findIndex((c) => c.includes(token))
  if (at < 0) return line.text.trim().slice(0, 160)

  let from = at
  while (from > 0 && !hasCode(cells[from - 1]) && !/^\$?[\d.,]+$/.test(cells[from - 1].trim())) from--
  let to = at
  while (to < cells.length - 1 && !hasCode(cells[to + 1])) to++

  return cells.slice(from, to + 1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}

/** "Product Code", "Part #", "SKU", "Item No." -- or "Code" under "Product" in a two-line heading. */
const CODE_HEADING = /^((product|part|item|model|catalog|cat\.?|stock|order|style|article|ref\.?)\s*)?(code|no\.?|number|#|sku|p\/n)$|^(sku|model|part\s*#|p\/n)$/i

/** Where the code columns are on a page: each heading's width, a little either side. */
function codeColumns(lines: Line[]): Array<{ from: number; to: number; top: number }> {
  const out: Array<{ from: number; to: number; top: number }> = []
  for (const line of lines) {
    for (const part of line.parts ?? []) {
      if (!CODE_HEADING.test(part.text.trim())) continue
      const center = part.x + part.width / 2
      const half = Math.max(part.width / 2 + 0.01, 0.03)
      out.push({ from: center - half, to: center + half, top: line.top })
    }
  }
  return out
}
