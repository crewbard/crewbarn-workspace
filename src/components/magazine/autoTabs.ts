import type { TabColor } from '@/lib/referenceCards'

/**
 * Tabs for a PDF that came with none worth using.
 *
 * A shop uploads what the supplier sent. Most of it has no bookmarks, and
 * some has bookmarks that are the print shop's file names ("4729170AA-Body-
 * lores"). What it does have is what a person uses to find their way
 * through it on paper -- a contents page, and headings bigger than the text
 * under them. So tabs are read from those when the shop has not set its own.
 *
 * A catalogue's contents page is often a grid: makes down the side, the
 * book's sections across the top, page numbers in the cells. Read as plain
 * lines it is a list of makes with strings of numbers after them, and the
 * sections -- which is how the printed book is tabbed -- are lost. So the
 * column headings are read too, each number goes under the heading above
 * it, and the tabs are the makes plus a tab for each section after the
 * first, coloured by section.
 *
 * Best of all is a book that prints its tabs: the section name set
 * sideways at the edge of every page, where the coloured tab is on paper
 * ("MORTISE ENTRY SETS"). Where a book has those, they are its tabs.
 *
 * Pure functions over lines of text, so they can be tested without a PDF.
 * pdfBook.ts turns pages into lines; this decides what is a tab.
 */

/** Part of a line as it sat on the page; x and width are fractions of the page width. */
export type LinePart = { text: string; x: number; width: number; start: number }

/**
 * One line of text on a page. `top` runs 0 (top) to 1 (bottom).
 *
 * `segments` is the same line cut where a wide gap separates columns: a
 * two-column data sheet puts "Specifications" and "Requirements" on one
 * baseline, and as one line they read as a single heading neither is.
 */
export type Line = { text: string; size: number; top: number; parts?: LinePart[]; segments?: string[] }

export type PageLines = { page: number; lines: Line[] }

export type SuggestedTab = { label: string; page: number; color?: TabColor | null }

export type TabSource = 'bookmarks' | 'edges' | 'contents' | 'headings'

export type Suggestion = { source: TabSource; tabs: SuggestedTab[] }

/** More than a printed catalogue ever has; past this they stop being tabs. */
export const MAX_TABS = 24

/** A link on the contents page, as fractions of the page. */
export type ContentsLink = { top: number; height: number; page?: number }

/** Section colours, in the order a printed catalogue tends to use them. */
const SECTION_COLORS: TabColor[] = ['blue', 'green', 'yellow', 'orange', 'red', 'teal', 'purple', 'pink', 'navy', 'slate']

// ------------------------------------------------------------- text helpers

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'for', 'with', 'to', 'in', 'on', 'by', 'a', 'an'])

/**
 * Capitals to title case, without un-capitalising what is meant to be:
 * "GM FOBS" is "GM Fobs", not "Gm Fobs", and "2-IN-1 TOOLS" keeps its code.
 */
function titleCase(text: string): string {
  return text.split(' ').map((word, i) => {
    const letters = word.replace(/[^A-Za-z]/g, '')
    if (letters.length <= 2 && !SMALL_WORDS.has(letters.toLowerCase())) return word
    if (/\d/.test(word)) return word
    const lower = word.toLowerCase()
    if (i > 0 && SMALL_WORDS.has(lower)) return lower
    return lower.replace(/(^|[/&(-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase())
  }).join(' ')
}

/** "CAR INDEX ....." -> "Car Index". A tab is read sideways; capitals shout. */
export function tidyLabel(text: string): string {
  let label = text.replace(/\s+/g, ' ').trim().replace(/[\s.·…_:–—-]+$/, '').trim()
  if (label.length > 3 && label === label.toUpperCase() && /[A-Z]{2}/.test(label)) label = titleCase(label)
  return label.slice(0, 40).trim()
}

/**
 * A contents line names a section and then describes it: "MagnaVault TL30
 * High Security safes with 1 hour fire rating". A tab is the name. Long
 * labels are cut at the first comma or bracket, then before the first
 * lowercase word once there are two words to stand on.
 */
export function shortLabel(text: string): string {
  if (text.length <= 24) return text

  let label = text

  // At a bracket or a dash; at a comma only when that leaves a name of two
  // words or more -- "Tube, Coil, & Cooling Tower Cleaning" is not "Tube".
  const bracket = label.split(/\s*[(;]\s*|\s+[-–—]\s+/)[0]
  if (bracket && bracket.split(' ').length >= 2) label = bracket
  const comma = label.split(/\s*,\s*/)[0]
  if (label.length > 24 && comma.split(' ').length >= 2) label = comma
  if (label.length <= 24) return label

  const words = label.split(' ')
  const cut = words.findIndex((word, i) => i >= 2 && /^[a-z]/.test(word))
  if (cut > 0) label = words.slice(0, cut).join(' ')

  // Still long: whole words up to what fits on a tab.
  if (label.length > 32) {
    const kept: string[] = []
    for (const word of label.split(' ')) {
      if ([...kept, word].join(' ').length > 32) break
      kept.push(word)
    }
    label = kept.join(' ').replace(/[\s,&]+$/, '') || label.slice(0, 32)
  }
  return label.trim()
}

/** Could this be a heading or a contents entry? Short, words not numbers, not a sentence. */
function headingLike(text: string): boolean {
  const t = text.trim()
  if (t.length < 2 || t.length > 60) return false
  if ((t.match(/[A-Za-z]/g) ?? []).length < 2) return false
  if (t.split(/\s+/).length > 8) return false
  if (/[a-z]{3,}\.$/.test(t)) return false
  if (PAGE_WORDS.test(t)) return false
  return !/^(page|p\.)\s*\d+$/i.test(t) && !/^(https?:|www\.)/i.test(t)
}

/** "Pages 28–37", "See page 211": a pointer to a page, never the name of one. */
const PAGE_WORDS = /^(see\s+)?(pages?|pgs?|pp?)\.?$/i

const isContentsTitle = (text: string) =>
  /^(table of )?contents$|^in this (guide|catalog|catalogue|book)$/i.test(text.replace(/\s+/g, ' ').trim())

/**
 * Lines printed on most pages: the running header, the footer, the
 * publisher's web address. On a two-page data sheet "redcloudnode
 * datasheet" is on both pages and is the biggest text on each -- without
 * this it would be every tab.
 */
export function runningLines(pages: PageLines[]): Set<string> {
  if (pages.length < 2) return new Set()

  const seen = new Map<string, number>()
  for (const page of pages) {
    for (const key of new Set(page.lines.map((line) => normalise(line.text)))) {
      if (key) seen.set(key, (seen.get(key) ?? 0) + 1)
    }
  }

  const often = Math.max(2, Math.ceil(pages.length * 0.5))
  return new Set([...seen].filter(([, n]) => n >= often).map(([key]) => key))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Never the same tab twice, in page order. Two makes may share a page. */
function inPageOrder(tabs: SuggestedTab[]): SuggestedTab[] {
  const seen = new Set<string>()
  return [...tabs]
    .sort((a, b) => a.page - b.page)
    .filter((tab) => {
      const key = normalise(tab.label)
      if (!tab.label || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ------------------------------------------------------------- bookmarks

/**
 * Bookmarks a layout program wrote rather than a person: the file names of
 * the pieces the PDF was stitched from. "4729170AA -Cover-lores",
 * "4729170AA-Body-lores2" -- tabs nobody can use.
 */
export function bookmarksAreFileNames(marks: SuggestedTab[]): boolean {
  if (marks.length === 0) return false

  const fileish = (label: string) =>
    /\d{5,}/.test(label)
    || /\.(pdf|indd|idml|ai|qxd|qxp|docx?|pptx?)\b/i.test(label)
    || /[-_ ](lo|hi)-?res\d*\b/i.test(label)
    || /^[A-Za-z0-9]+[-_][A-Za-z0-9_-]+$/.test(label)

  if (marks.filter((m) => fileish(m.label)).length * 2 >= marks.length) return true

  // All sharing one long prefix is a set of numbered files, not chapters.
  if (marks.length >= 2) {
    const first = marks[0].label
    let shared = first.length
    for (const m of marks) {
      let i = 0
      while (i < shared && i < m.label.length && m.label[i] === first[i]) i++
      shared = i
    }
    if (shared >= 6) return true
  }

  return false
}

// ------------------------------------------------------------ page numbers

/**
 * How far this file's pages are from the numbers printed on them.
 *
 * Read from the folios -- a bare number at the very top or bottom of a
 * page. A cover and an inside cover before page 1 put every printed number
 * one or two ahead, and a contents page says the printed number.
 */
export function printedShift(pages: PageLines[]): number | null {
  const votes = new Map<number, number>()
  for (const page of pages) {
    for (const line of page.lines) {
      const folio = line.text.trim().replace(/^(page|p\.?)\s*/i, '').replace(/^[|\s\-–—([]+|[|\s\-–—)\]]+$/g, '')
      if (!/^\d{1,4}$/.test(folio)) continue
      if (line.top > 0.1 && line.top < 0.9) continue
      const shift = page.page - Number(folio)
      votes.set(shift, (votes.get(shift) ?? 0) + 1)
    }
  }

  const [best] = [...votes].sort((a, b) => b[1] - a[1])
  if (!best) return null
  // A folio is on most pages; a stray number at the foot of a few is not one.
  return best[1] >= Math.max(2, Math.floor(pages.length * 0.25)) ? best[0] : null
}

// ------------------------------------------------------------ contents page

/** One contents line: what it names, and the page numbers after it, with where each sits. */
type Entry = { label: string; top: number; numbers: Array<{ value: number; x: number }> }

/** Rough character widths in ems, to find where a number sits inside a run of leader dots. */
const ems = (ch: string) =>
  /[.,:;'·\s]/.test(ch) ? 0.28 : /[0-9]/.test(ch) ? 0.55 : /[A-Z]/.test(ch) ? 0.68 : /[a-z]/.test(ch) ? 0.5 : 0.5

/** Where character `index` of the line sits across the page, as a fraction of its width. */
function xAt(line: Line, index: number): number {
  const part = [...(line.parts ?? [])].reverse().find((p) => p.start <= index)
  if (!part) return 0
  const inside = index - part.start
  const total = [...part.text].reduce((n, ch) => n + ems(ch), 0)
  const upto = [...part.text.slice(0, inside)].reduce((n, ch) => n + ems(ch), 0)
  return part.x + (total > 0 ? (upto / total) * part.width : 0)
}

/**
 * "NISSAN......64.......73......127......174" -> Nissan, [64, 73, 127, 174].
 * "Cars 3", "Motorcycle Index . . . 59" -> one number. A range keeps its
 * start ("129-135" -> 129); "75, 78" keeps both.
 */
function parseEntry(line: Line): Entry | null {
  const text = line.text.trim()
  const leader = text.search(/\s*(?:[.·…_]\s?){3,}/)
  let end = leader
  if (end < 0) {
    const m = text.match(/\s(\d{1,4})(?=\s*(?:[-–,]\s*\d|\s|$))/)
    end = m?.index ?? -1
  }
  if (end <= 0) return null

  const raw = tidyLabel(text.slice(0, end).replace(/[\s:–—-]+$/, '').replace(/\s+(p|pg|pp|page|pages)\.?$/i, ''))

  // A contents entry may describe its section, but it does not ask
  // questions: "Don't see what you are looking for? ... TOC - 1" is a footer.
  if (/[?!]/.test(raw) || raw.split(/\s+/).length > 14 || (raw.match(/[A-Za-z]/g) ?? []).length < 2) return null

  const label = shortLabel(raw)
  if (!headingLike(label)) return null

  const offset = line.text.indexOf(text)
  const numbers: Entry['numbers'] = []
  for (const m of text.slice(end).matchAll(/(^|[^\d–-])(\d{1,4})(?!\d)/g)) {
    const at = end + (m.index ?? 0) + m[1].length
    numbers.push({ value: Number(m[2]), x: xAt(line, offset + at + m[2].length / 2) })
  }

  return numbers.length > 0 ? { label, top: line.top, numbers } : null
}

/** Column headings above the entries, grouped by where they are centred. */
function columnsAbove(page: PageLines, from: number, to: number): Array<{ label: string; center: number }> {
  const words = page.lines
    .filter((line) => line.top > from && line.top < to && !isContentsTitle(line.text))
    .flatMap((line) => (line.parts ?? []).map((part) => ({ text: part.text.trim(), center: part.x + part.width / 2, top: line.top })))
    .filter((word) => /[A-Za-z]/.test(word.text))

  const columns: Array<{ words: typeof words; center: number }> = []
  for (const word of words) {
    const column = columns.find((c) => Math.abs(c.center - word.center) < 0.05)
    if (column) column.words.push(word)
    else columns.push({ words: [word], center: word.center })
  }

  return columns
    .map((c) => ({ label: tidyLabel(c.words.sort((a, b) => a.top - b.top).map((w) => w.text).join(' ')), center: c.center }))
    .sort((a, b) => a.center - b.center)
}

export type Contents = {
  page: number
  /** Printed page numbers, with the colour of the section each belongs to. */
  entries: Array<{ label: string; printed: number; top: number; color?: TabColor | null }>
}

/**
 * Find the contents page in the first few pages and read it.
 *
 * Specification tables also end lines in numbers ("Conforms to UL 294"),
 * so a page is only taken as contents when it says so, or when such lines
 * are most of what is on it -- and a number past the end of the book is
 * not a page.
 */
export function findContents(pages: PageLines[], pageCount: number): Contents | null {
  for (const page of pages.slice(0, 8)) {
    const lines = splitColumns(joinLooseNumbers(page.lines.filter((line) => line.text.trim() !== '')))
    const title = lines.find((line) => isContentsTitle(line.text))

    const entries = lines
      .map(parseEntry)
      .filter((e): e is Entry => e !== null)
      .map((e) => ({ ...e, numbers: e.numbers.filter((n) => n.value >= 1 && n.value <= pageCount + 30) }))
      .filter((e) => e.numbers.length > 0)

    if (entries.length < 3) continue
    if (!title && (entries.length < 5 || entries.length / lines.length < 0.4)) continue

    const firsts = entries.map((e) => e.numbers[0].value)
    const inOrder = firsts.filter((n, i) => i === 0 || n >= firsts[i - 1]).length
    // A grid's first column is in order down the page, and so is a list.
    if (inOrder / firsts.length < 0.7) continue

    const grid = readGrid(page, entries, title?.top ?? 0)
    if (grid) return { page: page.page, entries: grid }

    return {
      page: page.page,
      entries: entries.map((e) => ({ label: e.label, printed: e.numbers[0].value, top: e.top })),
    }
  }
  return null
}

/**
 * A contents page in two columns reads as one line across both: "EMPowered
 * 2 28    Flush Pulls 200". Where a line's columns each end in a page
 * number, each column is its own entry -- and the left column is read
 * top to bottom before the right, the way a person reads it.
 */
function splitColumns(lines: Line[]): Line[] {
  // A name and its page number in each column -- not a grid's row of bare numbers.
  const numbered = (text: string) => /[A-Za-z]{2}.*\s\d{1,4}\s*$/.test(text)
  const split = lines.filter((line) => (line.segments ?? []).filter(numbered).length >= 2).length
  if (split < 3) return lines

  const out: Array<Line & { column: number }> = []
  for (const line of lines) {
    const parts = line.parts ?? []
    const segments = line.segments ?? [line.text]
    let at = 0
    for (const segment of segments) {
      // The parts that make up this segment, in order.
      const mine: LinePart[] = []
      let text = ''
      while (at < parts.length && text.length < segment.length) {
        text = text ? `${text} ${parts[at].text}` : parts[at].text
        mine.push(parts[at])
        at++
      }
      let offset = 0
      const rebased = mine.map((p) => {
        const part = { ...p, start: offset }
        offset += p.text.length + 1
        return part
      })
      out.push({ ...line, text: segment, parts: rebased, segments: [segment], column: (mine[0]?.x ?? 0) < 0.5 ? 0 : 1 })
    }
  }

  return out
    .sort((a, b) => a.column - b.column || a.top - b.top)
    .map((line): Line => ({ text: line.text, size: line.size, top: line.top, parts: line.parts, segments: line.segments }))
}

/**
 * Some contents pages set the page number as its own piece, a hair off the
 * leader line it belongs to, so "Air Flow & Motors……" and "1" come out as
 * two lines. A line that ends in leaders takes the bare number after it.
 */
function joinLooseNumbers(lines: Line[]): Line[] {
  const out: Line[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const next = lines[i + 1]
    if (
      next
      && /(?:[.·…_]\s?){3,}\s*$/.test(line.text)
      && /^\d{1,4}(?:\s*[-–]\s*\d{1,4})?$/.test(next.text.trim())
      && Math.abs(next.top - line.top) < 0.03
    ) {
      const start = line.text.length + 1
      out.push({
        ...line,
        text: `${line.text} ${next.text.trim()}`,
        parts: [...(line.parts ?? []), ...(next.parts ?? []).map((p) => ({ ...p, start: start + p.start }))],
      })
      i++
      continue
    }
    out.push(line)
  }
  return out
}

/**
 * A contents grid: rows of names, columns of sections.
 *
 * Every row becomes a tab at its first page, coloured by the section that
 * page is in; every section after the first becomes a tab at its first
 * page. The first section's own tab would land on the same page as the
 * first row, so it is left to the rows.
 */
function readGrid(page: PageLines, entries: Entry[], titleTop: number): Contents['entries'] | null {
  if (!entries.some((e) => e.numbers.length >= 2)) return null

  const columns = columnsAbove(page, titleTop, Math.min(...entries.map((e) => e.top)) - 0.002)
  if (columns.length < 2) return null

  const columnOf = (x: number) =>
    columns.reduce((best, c, i) => (Math.abs(c.center - x) < Math.abs(columns[best].center - x) ? i : best), 0)

  const starts = new Map<number, number>()
  for (const entry of entries) {
    for (const n of entry.numbers) {
      const c = columnOf(n.x)
      starts.set(c, Math.min(starts.get(c) ?? Infinity, n.value))
    }
  }

  // Columns that never got a number are the heading over the names.
  const used = [...starts.keys()].sort((a, b) => a - b)
  if (used.length < 2) return null
  const color = (c: number) => SECTION_COLORS[used.indexOf(c) % SECTION_COLORS.length]

  const rows = entries.map((e) => ({
    label: e.label,
    printed: e.numbers[0].value,
    top: e.top,
    color: color(columnOf(e.numbers[0].x)),
  }))

  const sections = used.slice(1).map((c) => ({
    label: columns[c].label,
    printed: starts.get(c)!,
    top: -1,
    color: color(c),
  }))

  return [...rows, ...sections]
}

/**
 * Turn printed page numbers into pages of this file.
 *
 * A contents line that is also a link says exactly where it goes, so that
 * wins. Then the folios. Failing those, each label is looked for on the
 * pages and the shift most of them agree on is used -- "Nissan" turns up
 * on a lot of pages, but only one shift lines the makes up at once.
 */
export function placeContents(
  contents: Contents,
  pages: PageLines[],
  pageCount: number,
  links: ContentsLink[] = [],
): SuggestedTab[] {
  const linked = (top: number) =>
    top < 0 ? undefined : links.find((l) => l.page && top >= l.top - 0.015 && top <= l.top + l.height + 0.015)?.page

  let shift = printedShift(pages)

  if (shift === null) {
    /*
     * Every shift that puts some label on a page showing it is a
     * candidate, and the one that does so for the most labels wins. A
     * word like "Supplies" is on hundreds of pages and suggests hundreds
     * of shifts; only the right one lands Chemicals, Controls and Tools
     * on their own pages at the same time.
     */
    const text = new Map(pages.map((p) => [p.page, ` ${p.lines.map((l) => normalise(l.text)).join(' ')} `]))
    const named = contents.entries
      .map((entry) => ({ printed: entry.printed, needle: ` ${normalise(entry.label)} ` }))
      .filter((entry) => entry.needle.trim().length >= 3)

    const candidates = new Set<number>([0])
    for (const entry of named) {
      for (const p of pages) {
        if (p.page !== contents.page && text.get(p.page)?.includes(entry.needle)) candidates.add(p.page - entry.printed)
      }
    }

    const score = (s: number) => named.filter((entry) => text.get(entry.printed + s)?.includes(entry.needle)).length

    shift = [...candidates]
      .map((s) => ({ s, score: score(s) }))
      .sort((a, b) => b.score - a.score || Math.abs(a.s) - Math.abs(b.s))[0]?.s ?? 0
  }

  const tabs = contents.entries
    .map((entry) => ({ label: entry.label, page: linked(entry.top) ?? entry.printed + shift, color: entry.color ?? null }))
    .filter((tab) => tab.page >= 1 && tab.page <= pageCount)

  return inPageOrder(tabs).slice(0, MAX_TABS)
}

// ----------------------------------------------------------------- headings

/**
 * One tab per page that has a heading, at the level that gives a usable
 * number of them.
 *
 * Each page offers its biggest line, if it stands clear of the body text.
 * Then the levels are tried from the biggest down: the biggest alone is
 * often just the cover, the smallest is every product name. The first
 * level that gives four or more tabs is the one -- or, for a short
 * document, the most it can give without passing the limit.
 */
export function headingTabs(pages: PageLines[], running = runningLines(pages)): SuggestedTab[] {
  const body = median(pages.flatMap((p) => p.lines.map((l) => l.size)))
  if (body <= 0) return []

  const offered = pages.flatMap((page) => {
    const lines = page.lines
      .filter((l) => !running.has(normalise(l.text)))
      .flatMap((l) => (l.segments ?? [l.text]).map((text) => ({ ...l, text })))
      .filter((l) => headingLike(l.text) && l.text.trim().length >= 3 && !running.has(normalise(l.text)))
    if (lines.length === 0) return []

    // A heading stands clear of the body text: a size or more above it.
    const biggest = Math.max(...lines.map((l) => l.size))
    if (biggest < body * 1.15) return []

    const top = lines.filter((l) => l.size >= biggest * 0.97).sort((a, b) => a.top - b.top)[0]
    return [{ page: page.page, label: shortLabel(tidyLabel(top.text)), size: biggest }]
  })

  // A run of pages under one heading is one chapter.
  const chapters = (picked: typeof offered) =>
    inPageOrder(picked.filter((o, i, all) => i === 0 || normalise(all[i - 1].label) !== normalise(o.label)))

  const levels = [...new Set(offered.map((o) => Math.round(o.size * 10) / 10))].sort((a, b) => b - a)

  let best: SuggestedTab[] = []
  for (const level of levels) {
    const tabs = chapters(offered.filter((o) => o.size >= level * 0.97))
    if (tabs.length > MAX_TABS) break
    best = tabs
    if (tabs.length >= 4) break
  }

  return best
}

// ------------------------------------------------------------ edge tabs

/** Sideways text at a page's edge, as fractions of the page. */
export type EdgeItem = {
  text: string
  /** Across the page: 0 is the left edge. */
  x: number
  /** Down the page where the text starts, and how far it runs. */
  y: number
  length: number
  /** Reads bottom to top (turned left), rather than top to bottom. */
  up: boolean
}

/** How close to the edge a printed tab sits. */
const EDGE = 0.1

/**
 * The section name printed sideways at the edge of a page -- the book's
 * own index tab. Only the text nearest the edge: a page can carry other
 * sideways words further in ("CLASSIC", "DESIGNER" down a table). Words of
 * one name are joined; two names printed over each other are both kept,
 * and edgeTabs() decides between them.
 */
export function edgeLabels(items: EdgeItem[]): string[] {
  const near = items.filter((i) => (i.x < EDGE || i.x > 1 - EDGE) && /[A-Za-z]{2}/.test(i.text))
  if (near.length === 0) return []

  const fromEdge = (x: number) => Math.min(x, 1 - x)
  const closest = Math.min(...near.map((i) => fromEdge(i.x)))
  const column = near.filter((i) => fromEdge(i.x) - closest < 0.012)

  // Along the reading direction: where each piece starts and ends.
  const spans = column
    .map((i) => (i.up ? { text: i.text.trim(), from: 1 - i.y, to: 1 - i.y + i.length } : { text: i.text.trim(), from: i.y, to: i.y + i.length }))
    .sort((a, b) => a.from - b.from)

  const labels: Array<{ text: string; to: number }> = []
  for (const span of spans) {
    const last = labels[labels.length - 1]
    // The next word of the same name starts just after the last one ends.
    if (last && span.from >= last.to - 0.005 && span.from - last.to < 0.03) {
      last.text = `${last.text} ${span.text}`
      last.to = span.to
    } else {
      labels.push({ text: span.text, to: span.to })
    }
  }

  return [...new Set(labels.map((l) => l.text.replace(/\s+/g, ' ').trim()).filter(headingLike))]
}

/**
 * Tabs from the names printed at the page edges: one at the first page of
 * each section.
 *
 * Where two names are printed over each other on a page, the one found on
 * fewer pages is that page's own -- the other is the next section's,
 * showing through. A name on most pages, beside others, is the book's
 * name rather than a section's. Three sections at least, or it is not a
 * tabbed book.
 */
export function edgeTabs(pages: Array<{ page: number; labels: string[] }>): SuggestedTab[] {
  const labelled = pages.filter((p) => p.labels.length > 0).sort((a, b) => a.page - b.page)
  if (labelled.length < 3) return []

  const count = new Map<string, number>()
  for (const p of labelled) {
    for (const key of new Set(p.labels.map(normalise))) count.set(key, (count.get(key) ?? 0) + 1)
  }
  const running = new Set(
    [...count].filter(([, n]) => count.size >= 3 && n > labelled.length * 0.6).map(([key]) => key),
  )

  const tabs: SuggestedTab[] = []
  const seen = new Set<string>()
  for (const p of labelled) {
    const options = p.labels.filter((l) => !running.has(normalise(l)))
    if (options.length === 0) continue
    const pick = [...options].sort((a, b) => (count.get(normalise(a)) ?? 0) - (count.get(normalise(b)) ?? 0))[0]
    const key = normalise(pick)
    if (seen.has(key)) continue
    seen.add(key)
    tabs.push({ label: shortLabel(tidyLabel(pick)), page: p.page })
  }

  return tabs.length >= 3 && tabs.length <= MAX_TABS ? tabs : []
}

// ------------------------------------------------------------------ choice

/**
 * Every source of tabs this PDF has, best first. The viewer uses the first;
 * the tab editor offers them all, so a wrong guess is one click to change.
 *
 * Bookmarks first, unless they are file names, or a handful against a
 * book that names far more. Then the tabs printed at the page edges, which
 * are the book's own; then its contents page; then its headings. Two tabs
 * or none: one tab on a book is not a way through it.
 */
export function suggestTabs(
  bookmarks: SuggestedTab[],
  pages: PageLines[],
  pageCount: number,
  contentsLinks: (page: number) => ContentsLink[] = () => [],
  edges: Array<{ page: number; labels: string[] }> = [],
): Suggestion[] {
  if (pageCount < 2) return []

  const found: Suggestion[] = []

  const contents = findContents(pages, pageCount)
  const fromContents = contents ? placeContents(contents, pages, pageCount, contentsLinks(contents.page)) : []
  const fromEdges = edgeTabs(edges)
  const fromHeadings = headingTabs(pages)
  const marks = bookmarks.slice(0, MAX_TABS)

  const usableMarks = marks.length >= 2 && !bookmarksAreFileNames(marks)
  const thin = marks.length <= 3 && Math.max(fromContents.length, fromEdges.length) >= marks.length * 2

  if (usableMarks && !thin) found.push({ source: 'bookmarks', tabs: marks })
  if (fromEdges.length >= 3) found.push({ source: 'edges', tabs: fromEdges })
  if (fromContents.length >= 2) found.push({ source: 'contents', tabs: fromContents })
  if (usableMarks && thin) found.push({ source: 'bookmarks', tabs: marks })
  if (fromHeadings.length >= 2) found.push({ source: 'headings', tabs: fromHeadings })
  // File-name bookmarks last: offered, never chosen for you.
  if (marks.length >= 2 && !usableMarks) found.push({ source: 'bookmarks', tabs: marks })

  return found
}

/**
 * Text items from a page, joined into lines.
 *
 * Positions are in the page's own units, `y` the baseline from the top.
 * Items whose baselines sit within half a line of each other are one line,
 * read left to right; each keeps where it was, so a contents grid can put
 * its numbers under the right headings.
 */
export function linesFromItems(
  items: Array<{ text: string; x: number; y: number; size: number; width: number }>,
  pageWidth: number,
  pageHeight: number,
): Line[] {
  const sorted = items
    .filter((item) => item.text.trim() !== '' && item.size > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const grouped: Array<{ items: typeof sorted; y: number; size: number }> = []
  for (const item of sorted) {
    const line = grouped[grouped.length - 1]
    if (line && Math.abs(item.y - line.y) <= Math.max(line.size, item.size) * 0.5) {
      line.items.push(item)
      line.size = Math.max(line.size, item.size)
    } else {
      grouped.push({ items: [item], y: item.y, size: item.size })
    }
  }

  return grouped.map((line) => {
    let text = ''
    const parts: LinePart[] = []
    const segments: string[] = []
    let end = -Infinity
    for (const item of line.items.sort((a, b) => a.x - b.x)) {
      const piece = item.text.replace(/\s+/g, ' ').trim()
      // A gap of a few characters is a column break, not a space.
      if (segments.length === 0 || item.x - end > line.size * 2) segments.push(piece)
      else segments[segments.length - 1] += ` ${piece}`
      end = Math.max(end, item.x + item.width)

      if (text) text += ' '
      parts.push({
        text: piece,
        start: text.length,
        x: pageWidth > 0 ? item.x / pageWidth : 0,
        width: pageWidth > 0 ? item.width / pageWidth : 0,
      })
      text += piece
    }
    return { text, size: line.size, top: pageHeight > 0 ? line.y / pageHeight : 0, parts, segments }
  })
}
