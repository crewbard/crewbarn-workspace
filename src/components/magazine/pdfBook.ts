import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  edgeLabels,
  linesFromItems,
  printedShift,
  suggestTabs,
  type ContentsLink,
  type EdgeItem,
  type Line,
  type Suggestion,
  findSectionContents,
} from './autoTabs'
import { PageNumbers } from './pageNumbers'
import type { TabColor } from '@/lib/referenceCards'
import { SWATCH } from './tabColors'
import { orderFormula, partsOnLines, priceAfter, wordsFor, type PartOnPage } from './partNumbers'

/**
 * A PDF opened for reading as a book: pages as pictures, the links
 * printed inside it, and the bookmarks it carries.
 *
 * pdf.js is loaded on first use, not with the app. It is a megabyte of
 * code that only the people opening a manual need, and the main bundle
 * is already the thing every page waits for.
 */

/** A link printed on a page, in fractions of the page so it scales with it. */
export type PageLink = {
  left: number
  top: number
  width: number
  height: number
  /** Another page of this file. */
  page?: number
  /** Somewhere outside it. Only http, https and mailto are kept. */
  url?: string
}

/** A place on a page, in fractions of it, top-left origin. */
export type Box = { left: number; top: number; width: number; height: number }

/** A bookmark from the PDF, offered as a tab. */
export type Bookmark = { label: string; page: number }

export type { Suggestion } from './autoTabs'

/**
 * Pages read for tabs. A contents page is in the first few, but the tabs
 * printed at the page edges run to the back of the book -- a price book's
 * index starts past page 240. Past this many the wait is not worth it.
 */
const READ_PAGES = 400

/** Pages read for the folios. Enough to outvote a stray number; quick on any book. */
const FOLIO_PAGES = 40

/** A place in the book where the search text is, and the box to light up. */
export type SearchHit = {
  page: number
  /** The line it is on, for the results list. */
  text: string
  /** Fractions of the page, top-left origin. */
  box: { left: number; top: number; width: number; height: number }
  /**
   * How well it matches: 4 the very part number, 3 the words as typed,
   * 2 every word on one line, 1 the words on lines next to each other.
   */
  score: number
  /** The part number at the match, when there is one, to put in the cart. */
  part?: PartOnPage
}

/** Results past this stop being a list anybody reads. */
const MAX_HITS = 300

/** The best of a list of hits: the closest match, the earliest page. */
export function bestHit(hits: SearchHit[]): number | null {
  let best: number | null = null
  hits.forEach((hit, i) => {
    if (best === null || hit.score > hits[best].score) best = i
  })
  return best
}

const foldCode = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const CODE_TOKEN = /[A-Za-z0-9][A-Za-z0-9./-]*[A-Za-z0-9]|[A-Za-z0-9]/g

/** Lets the page breathe: typing stays quick while a long book is read. */
const breathe = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0))

/**
 * How a search compares text. A part number is the same number written
 * 95440-S9610, 95440 S9610 or 95440S9610, so anything with a digit in it
 * is compared with the punctuation and spaces folded out. Words are
 * compared as words, case aside.
 */
export function searchFold(query: string): (text: string) => string {
  return /\d/.test(query)
    ? (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
    : (text) => text.toLowerCase().replace(/\s+/g, ' ')
}

type PdfJs = typeof import('pdfjs-dist')

let loading: Promise<PdfJs> | null = null

function pdfjs(): Promise<PdfJs> {
  loading ??= (async () => {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })()
  return loading
}

/** Rendered pages kept at once. A catalogue page is a few hundred KB as a JPEG. */
const KEEP = 40

export class Book {
  private readonly images = new Map<string, Promise<string>>()
  private readonly done = new Map<string, string>()
  private readonly linkCache = new Map<number, Promise<PageLink[]>>()
  private readonly textCache = new Map<number, Promise<{ lines: Line[]; edges: string[] }>>()
  private readonly partCache = new Map<number, Promise<PartOnPage[]>>()
  private readonly heights = new Map<number, number>()
  private aspectCache = new Map<number, number>()
  /** Pages on screen right now, which eviction must leave alone. */
  private pinned = new Set<string>()

  private readonly doc: PDFDocumentProxy

  constructor(doc: PDFDocumentProxy) {
    this.doc = doc
  }

  get pageCount(): number {
    return this.doc.numPages
  }

  /** Width over height, at the page's own rotation. */
  async aspect(page: number): Promise<number> {
    const known = this.aspectCache.get(page)
    if (known) return known

    const p = await this.doc.getPage(page)
    const vp = p.getViewport({ scale: 1 })
    const ratio = vp.width / vp.height
    this.aspectCache.set(page, ratio)
    return ratio
  }

  pin(keys: string[]): void {
    this.pinned = new Set(keys)
  }

  static key(page: number, height: number): string {
    return `${page}@${height}`
  }

  /**
   * A page already rendered, without waiting a tick for it. A turned
   * leaf that has to wait for a promise shows one blank frame first.
   */
  peek(page: number, height: number): string | undefined {
    return this.done.get(Book.key(page, height))
  }

  /**
   * One page as an image `height` device pixels tall.
   *
   * An image rather than a live canvas, so the same page can sit on
   * both faces of a turning leaf and in the book under it at once.
   */
  render(page: number, height: number): Promise<string> {
    const key = Book.key(page, height)
    const cached = this.images.get(key)
    if (cached) {
      // Most recently used goes to the back of the line.
      this.images.delete(key)
      this.images.set(key, cached)
      return cached
    }

    const job = (async () => {
      const p = await this.doc.getPage(page)
      const base = p.getViewport({ scale: 1 })
      const viewport = p.getViewport({ scale: height / base.height })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      await p.render({ canvas, viewport }).promise

      // JPEG: a page of product photography is a tenth the size it is
      // as PNG, and at device resolution the text holds up.
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Page did not render'))), 'image/jpeg', 0.9),
      )

      // Let go of the canvas's memory now rather than at the next GC.
      canvas.width = 0
      canvas.height = 0

      const url = URL.createObjectURL(blob)
      this.done.set(key, url)
      return url
    })()

    this.images.set(key, job)
    job.catch(() => this.images.delete(key))
    this.evict()
    return job
  }

  private evict(): void {
    for (const key of this.images.keys()) {
      if (this.images.size <= KEEP) return
      if (this.pinned.has(key)) continue

      const url = this.done.get(key)
      // Still rendering: leave it, it is about to be wanted.
      if (!url) continue

      URL.revokeObjectURL(url)
      this.done.delete(key)
      this.images.delete(key)
    }
  }

  /** The links printed on a page: a contents page that jumps, a web address. */
  links(page: number): Promise<PageLink[]> {
    const cached = this.linkCache.get(page)
    if (cached) return cached

    const job = (async () => {
      const p = await this.doc.getPage(page)
      const vp = p.getViewport({ scale: 1 })
      const annotations = await p.getAnnotations({ intent: 'display' })
      const out: PageLink[] = []

      for (const a of annotations) {
        if (a.subtype !== 'Link' || !Array.isArray(a.rect)) continue

        const [x1, y1] = vp.convertToViewportPoint(a.rect[0], a.rect[1])
        const [x2, y2] = vp.convertToViewportPoint(a.rect[2], a.rect[3])
        const box = {
          left: Math.min(x1, x2) / vp.width,
          top: Math.min(y1, y2) / vp.height,
          width: Math.abs(x2 - x1) / vp.width,
          height: Math.abs(y2 - y1) / vp.height,
        }

        if (typeof a.url === 'string' && /^(https?:|mailto:)/i.test(a.url)) {
          out.push({ ...box, url: a.url })
          continue
        }

        const target = a.dest ? await this.pageOf(a.dest) : null
        if (target) out.push({ ...box, page: target })
      }

      return out
    })()

    this.linkCache.set(page, job)
    return job
  }

  /**
   * The PDF's own top-level bookmarks, as tabs to start from.
   *
   * Only the top level: a catalogue's outline runs to hundreds of
   * entries, and an index tab is a chapter, not a product.
   */
  async bookmarks(limit = 24): Promise<Bookmark[]> {
    const outline = await this.doc.getOutline()
    if (!outline) return []

    const out: Bookmark[] = []
    for (const item of outline) {
      if (out.length >= limit) break

      const label = String(item.title ?? '').trim().slice(0, 40)
      const page = item.dest ? await this.pageOf(item.dest) : null
      if (label && page && !out.some((b) => b.page === page)) out.push({ label, page })
    }

    return out
  }

  /** A page's text as lines, with how big each is and where it sits. */
  private async pageLines(page: number): Promise<Line[]> {
    return (await this.pageText(page)).lines
  }

  /**
   * A page's text: its lines, and the name printed sideways at its edge
   * where the book has one -- its own index tab.
   */
  private pageText(page: number): Promise<{ lines: Line[]; edges: string[] }> {
    const cached = this.textCache.get(page)
    if (cached) return cached

    const job = (async () => {
      const p = await this.doc.getPage(page)
      const vp = p.getViewport({ scale: 1 })
      const content = await p.getTextContent()

      const sideways: EdgeItem[] = []
      const items = content.items.flatMap((item) => {
        if (!('str' in item) || item.str.trim() === '') return []
        const [a, b, c, d, e, f] = item.transform as number[]
        const [x, y] = vp.convertToViewportPoint(e, f)
        // Turned a quarter: running up or down the page rather than across it.
        if (Math.abs(b) > Math.abs(a) && vp.width > 0 && vp.height > 0) {
          sideways.push({ text: item.str, x: x / vp.width, y: y / vp.height, length: item.width / vp.height, up: b > 0 })
        }
        return [{ text: item.str, x, y, size: Math.hypot(c, d) || item.height, width: item.width }]
      })

      this.heights.set(page, vp.height)
      return { lines: linesFromItems(items, vp.width, vp.height), edges: edgeLabels(sideways) }
    })()

    this.textCache.set(page, job)
    return job
  }

  /**
   * The numbers printed on the pages: the PDF's own page labels when it
   * has them, else the shift its folios agree on. Quick -- the first forty
   * pages decide it -- so the page box can show the book's number almost
   * as soon as the book opens.
   */
  async pageNumbers(): Promise<PageNumbers> {
    const labels = await this.doc.getPageLabels().catch(() => null)
    const numbers = new PageNumbers(this.pageCount, 0, labels)
    if (numbers.differs) return numbers

    const pages = []
    for (let page = 1; page <= Math.min(this.pageCount, FOLIO_PAGES); page++) {
      pages.push({ page, lines: await this.pageLines(page).catch(() => []) })
    }
    return new PageNumbers(this.pageCount, printedShift(pages) ?? 0)
  }

  /** How the book says to order, on this page: "Function + Product Code + Finish". */
  async orderFormula(page: number): Promise<string[] | null> {
    return orderFormula(await this.pageLines(page))
  }

  /** The part numbers printed on a page, to click onto an order. */
  partNumbers(page: number): Promise<PartOnPage[]> {
    const cached = this.partCache.get(page)
    if (cached) return cached
    const job = this.pageLines(page).then((lines) => partsOnLines(lines, this.heights.get(page) ?? 792))
    this.partCache.set(page, job)
    job.catch(() => this.partCache.delete(page))
    return job
  }

  /**
   * A page as the search index keeps it (CatalogIndex on the server): its
   * text, its heading -- the biggest words on it, which say what section of
   * the book it is in -- and the part numbers on it with the price on each
   * one's row and where it sits, so the reader can be watched finding them.
   */
  async readPage(page: number): Promise<{ text: string; heading: string | null; parts: PartOnPage[] }> {
    const { lines } = await this.pageText(page)
    const parts = (await this.partNumbers(page).catch(() => [] as PartOnPage[])).filter((p) => p.kind === 'part')

    let heading: Line | null = null
    for (const line of lines) {
      const words = line.text.trim()
      if (words.replace(/[^A-Za-z]/g, '').length < 3 || words.length > 120) continue
      if (!heading || line.size > heading.size) heading = line
    }

    return {
      text: lines.map((l) => l.text.trim()).filter(Boolean).join('\n'),
      heading: heading ? heading.text.trim() : null,
      parts,
    }
  }

  /**
   * Tabs worked out from the PDF itself, best first: its bookmarks, its
   * contents page, its headings. Empty when it has none of those -- a
   * scan with no text layer, a one-page flyer.
   */
  async suggestTabs(): Promise<Suggestion[]> {
    const marks = await this.bookmarks().catch(() => [])

    const pages = []
    const edges = []
    for (let page = 1; page <= Math.min(this.pageCount, READ_PAGES); page++) {
      const text = await this.pageText(page).catch(() => ({ lines: [], edges: [] }))
      pages.push({ page, lines: text.lines })
      edges.push({ page, labels: text.edges })
    }

    // The links on the first pages, for a contents page that has them.
    const links = new Map<number, ContentsLink[]>()
    for (let page = 1; page <= Math.min(this.pageCount, 8); page++) {
      links.set(page, await this.links(page).catch(() => []))
    }

    // A contents page that lists sections is usually printed as coloured
    // bars, the same colours as the section tabs on the paper book.
    const sections = findSectionContents(pages)
    const colors = sections
      ? await this.rowColors(sections.page, sections.entries.map((e) => e.top)).catch(() => [])
      : []

    return suggestTabs(marks, pages, this.pageCount, (page) => links.get(page) ?? [], edges, colors)
  }

  /**
   * The colour printed behind each line of a page (a contents bar), as the
   * nearest tab colour, or null where the line sits on white. The page is
   * drawn small and sampled along each line, above and below the text, so
   * the white lettering on a bar doesn't count.
   */
  async rowColors(page: number, tops: number[]): Promise<Array<TabColor | null>> {
    if (typeof document === 'undefined') return tops.map(() => null)
    const p = await this.doc.getPage(page)
    const base = p.getViewport({ scale: 1 })
    const viewport = p.getViewport({ scale: 360 / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await p.render({ canvas, viewport }).promise
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return tops.map(() => null)
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    canvas.width = 0
    canvas.height = 0

    const swatches = Object.entries(SWATCH).map(([name, s]) => ({
      name: name as TabColor,
      rgb: [1, 3, 5].map((i) => parseInt(s.bg.slice(i, i + 2), 16)),
    }))
    const nearest = (r: number, g: number, b: number) =>
      swatches.reduce((best, s) => {
        const d = (s.rgb[0] - r) ** 2 + (s.rgb[1] - g) ** 2 + (s.rgb[2] - b) ** 2
        return d < best.d ? { name: s.name, d } : best
      }, { name: 'slate' as TabColor, d: Infinity }).name

    return tops.map((top) => {
      const votes = new Map<TabColor, number>()
      const baseline = Math.round(top * height)
      for (const dy of [-Math.round(height * 0.009), Math.round(height * 0.004)]) {
        const y = Math.min(height - 1, Math.max(0, baseline + dy))
        for (let x = Math.round(width * 0.2); x < width * 0.95; x += 3) {
          const i = (y * width + x) * 4
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          // Paper, ink and grey rules are not a section colour.
          if (max < 40 && min < 40 && max - min < 25) continue
          if (min > 200 || max - min < 35) continue
          const c = nearest(r, g, b)
          votes.set(c, (votes.get(c) ?? 0) + 1)
        }
      }
      const best = [...votes].sort((a, b) => b[1] - a[1])[0]
      return best && best[1] >= 8 ? best[0] : null
    })
  }

  /**
   * Every place the text appears, page by page.
   *
   * Reports as it goes -- a nine-hundred-page catalogue takes a few seconds
   * to read through, and the first hits are usually what was wanted -- and
   * stops when told to, because a new search makes the old one moot.
   *
   * A part number is matched with case, dashes and spaces aside. Words are
   * matched as typed first, then all of them on one line, then all of them
   * on lines next to each other ("satin brass" above "lever"). Each hit
   * carries the part number at it, when there is one, so it can go straight
   * into the cart.
   */
  async search(
    query: string,
    report: (hits: SearchHit[], readTo: number) => void,
    stopped: () => boolean,
    max = MAX_HITS,
  ): Promise<SearchHit[]> {
    const q = query.trim()
    const fold = searchFold(q)
    const want = fold(q)
    const hits: SearchHit[] = []
    if (want.length < 2) return hits

    // Each word compared its own way: one with a digit as a part number, the rest as words.
    const words = [...new Set(q.split(/\s+/).filter(Boolean))]
      .map((word) => (/\d/.test(word) ? { code: true, text: foldCode(word) } : { code: false, text: word.toLowerCase() }))
      .filter((word) => word.text.length >= (word.code ? 1 : 2))
    const has = (text: string, word: { code: boolean; text: string }) =>
      word.code ? foldCode(text).includes(word.text) : text.toLowerCase().includes(word.text)
    const coded = /\d/.test(q)
    const wholeWord = !coded && words.length === 1
      ? new RegExp(`(^|[^a-z0-9])${q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)
      : null

    for (let page = 1; page <= this.pageCount && hits.length < max; page++) {
      if (stopped()) return hits
      if (page % 20 === 0) await breathe()

      const lines = await this.pageLines(page).catch(() => [] as Line[])
      if (lines.length === 0) continue
      const height = this.heights.get(page) ?? 792
      let parts: PartOnPage[] | null = null
      const partsHere = async () => (parts ??= await this.partNumbers(page).catch(() => [] as PartOnPage[]))

      const boxOf = (from: Line, to: Line, left: number, right: number) => {
        const top = Math.max(0, from.top - (from.size * 0.95) / height)
        const bottom = to.top + (to.size * 0.3) / height
        return {
          left: Math.max(0, left - 0.004),
          top,
          width: Math.min(1, right - left + 0.008),
          height: Math.max((from.size * 1.25) / height, bottom - top),
        }
      }
      const spanOf = (line: Line) => {
        const ps = line.parts ?? []
        return ps.length
          ? [Math.min(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.x + p.width))]
          : [0, 1]
      }
      const snippet = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text)

      /** The part number on a line nearest a place on it, or the one that was typed. */
      const partAt = async (line: Line, x: number, typed?: string) => {
        const onLine = (await partsHere()).filter((p) => p.kind === 'part'
          && Math.abs(p.box.top + (line.size * 0.95) / height - line.top) < 0.004)
        if (typed) return onLine.find((p) => foldCode(p.text) === typed) ?? onLine.find((p) => foldCode(p.text).includes(typed))
        return onLine.sort((a, b) => Math.abs(a.box.left - x) - Math.abs(b.box.left - x))[0]
      }

      for (let i = 0; i < lines.length && hits.length < max; i++) {
        const line = lines[i]
        const lineParts = line.parts ?? []

        if (fold(line.text).includes(want)) {
          /*
           * A box per piece that holds it -- a table row can carry the same
           * number in two columns, and one box from the first to the last
           * would light up everything between. When no single piece holds
           * it ("95440-" and "S9610" set apart), the line is the box.
           */
          const holding = lineParts.filter((part) => fold(part.text).includes(want))
          const spans = holding.length > 0
            ? holding.map((part) => [part.x, part.x + part.width])
            : [spanOf(line)]
          // The very code, not one that has it inside it: 2050 is not 20500.
          const exact = coded && [...line.text.matchAll(CODE_TOKEN)].some((m) => foldCode(m[0]) === want)
          const score = exact ? 4 : wholeWord && !wholeWord.test(line.text.toLowerCase()) ? 2.5 : 3

          const typed = coded ? want : undefined
          for (const [left, right] of spans) {
            const box = boxOf(line, line, left, right)
            let part = await partAt(line, left, typed)
            // Typed as a part number but not one the page offers to click: the code as printed.
            if (!part && typed) {
              const token = [...line.text.matchAll(CODE_TOKEN)].map((m) => m[0]).find((t) => foldCode(t) === typed)
              if (token) part = { text: token, kind: 'part', line: wordsFor(line, token), price: priceAfter(line.text, token), box }
            }
            part ??= await partAt(line, left)
            hits.push({ page, text: snippet(line.text), box, score, part })
          }
          continue
        }

        if (words.length < 2 || !words.some((word) => has(line.text, word))) continue

        if (words.every((word) => has(line.text, word))) {
          const holding = lineParts.filter((part) => words.some((word) => has(part.text, word)))
          const [left, right] = holding.length
            ? [Math.min(...holding.map((p) => p.x)), Math.max(...holding.map((p) => p.x + p.width))]
            : spanOf(line)
          hits.push({ page, text: snippet(line.text), box: boxOf(line, line, left, right), score: 2, part: await partAt(line, left) })
          continue
        }

        /*
         * The rest of the words on the next line or two, in the same column:
         * a description set over two lines of a table cell.
         */
        const [from, to] = spanOf(line)
        const near: Line[] = [line]
        for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
          const next = lines[j]
          if (next.top - near[near.length - 1].top > (next.size * 2.2) / height) break
          const [l, r] = spanOf(next)
          if (r < from - 0.05 || l > to + 0.05) break
          near.push(next)
          if (words.every((word) => near.some((n) => has(n.text, word)))) break
        }
        if (near.length < 2 || !words.every((word) => near.some((n) => has(n.text, word)))) continue

        const holding = near.flatMap((n) => (n.parts ?? []).filter((part) => words.some((word) => has(part.text, word))))
        const [left, right] = holding.length
          ? [Math.min(...holding.map((p) => p.x)), Math.max(...holding.map((p) => p.x + p.width))]
          : [from, to]
        let part: PartOnPage | undefined
        for (const n of near) part ??= await partAt(n, left)
        hits.push({
          page,
          text: snippet(near.map((n) => n.text.trim()).join(' / ')),
          box: boxOf(near[0], near[near.length - 1], left, right),
          score: 1,
          part,
        })
        i += near.length - 1
      }

      if (page % 25 === 0) report([...hits], page)
    }

    report([...hits], this.pageCount)
    return hits
  }

  /** A destination is a name, or [ref, fit, ...], or [index, fit, ...]. */
  private async pageOf(dest: unknown): Promise<number | null> {
    try {
      const explicit = typeof dest === 'string' ? await this.doc.getDestination(dest) : dest
      if (!Array.isArray(explicit) || explicit.length === 0) return null

      const ref = explicit[0]
      if (Number.isInteger(ref)) return (ref as number) + 1
      if (ref && typeof ref === 'object') {
        return (await this.doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0])) + 1
      }
    } catch {
      // A broken destination is a link that goes nowhere, not an error.
    }
    return null
  }

  /**
   * A piece of a page as a JPEG: the picture on a reference card made from
   * it. `box` is in fractions of the page. Drawn fresh at a size where the
   * piece comes out about `width` pixels across, so a small part number
   * cut from a dense table is still sharp.
   */
  async crop(page: number, box: Box, width = 640): Promise<Blob> {
    if (typeof document === 'undefined') throw new Error('No canvas here.')
    const p = await this.doc.getPage(page)
    const base = p.getViewport({ scale: 1 })
    const want = width / Math.max(0.02, box.width) / base.width
    // A page drawn bigger than this would run a phone out of memory.
    const scale = Math.min(want, 6000 / Math.max(base.width, base.height))
    const viewport = p.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await p.render({ canvas, viewport }).promise

    const sx = Math.max(0, Math.floor(box.left * canvas.width))
    const sy = Math.max(0, Math.floor(box.top * canvas.height))
    const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(box.width * canvas.width)))
    const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(box.height * canvas.height)))

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('No canvas here.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sw, sh)
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    canvas.width = 0
    canvas.height = 0

    const blob = await new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture did not draw.'))), 'image/jpeg', 0.88),
    )
    out.width = 0
    out.height = 0
    return blob
  }

  /** The text inside a box on a page, line by line, top to bottom. */
  async textIn(page: number, box: Box): Promise<string[]> {
    const lines = await this.pageLines(page)
    const height = this.heights.get(page) ?? 792
    const right = box.left + box.width
    const bottom = box.top + box.height
    const out: string[] = []

    for (const line of lines) {
      // `top` is the baseline; the letters sit above it.
      const lineTop = line.top - (line.size * 0.9) / height
      if (line.top < box.top || lineTop > bottom) continue
      const parts = (line.parts ?? []).filter((part) => part.x < right && part.x + part.width > box.left)
      const text = (parts.length > 0 ? parts.map((part) => part.text).join(' ') : line.parts ? '' : line.text)
        .replace(/\s+/g, ' ')
        .trim()
      if (text) out.push(text)
    }

    return out
  }

  destroy(): void {
    for (const url of this.done.values()) URL.revokeObjectURL(url)
    this.done.clear()
    this.images.clear()
    void this.doc.loadingTask.destroy()
  }
}

/** Open bytes as a book. The fonts and decoders come from public/pdfjs/. */
export async function openBook(data: ArrayBuffer): Promise<Book> {
  const lib = await pdfjs()
  const assets = `${import.meta.env.BASE_URL}pdfjs/`

  const doc = await lib.getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
  }).promise

  return new Book(doc)
}
