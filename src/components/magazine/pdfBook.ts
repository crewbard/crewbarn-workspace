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
} from './autoTabs'
import { PageNumbers } from './pageNumbers'
import { orderFormula, partsOnLines, type PartOnPage } from './partNumbers'

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
}

/** Results past this stop being a list anybody reads. */
const MAX_HITS = 300

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
  async partNumbers(page: number): Promise<PartOnPage[]> {
    const lines = await this.pageLines(page)
    return partsOnLines(lines, this.heights.get(page) ?? 792)
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

    return suggestTabs(marks, pages, this.pageCount, (page) => links.get(page) ?? [], edges)
  }

  /**
   * Every place the text appears, page by page.
   *
   * Reports as it goes -- a nine-hundred-page catalogue takes a few seconds
   * to read through, and the first hits are usually what was wanted -- and
   * stops when told to, because a new search makes the old one moot.
   */
  async search(
    query: string,
    report: (hits: SearchHit[], readTo: number) => void,
    stopped: () => boolean,
  ): Promise<SearchHit[]> {
    const fold = searchFold(query)
    const want = fold(query.trim())
    const hits: SearchHit[] = []
    if (want.length < 2) return hits

    for (let page = 1; page <= this.pageCount && hits.length < MAX_HITS; page++) {
      if (stopped()) return hits

      const lines = await this.pageLines(page).catch(() => [] as Line[])
      const height = this.heights.get(page) ?? 792

      for (const line of lines) {
        if (!fold(line.text).includes(want)) continue

        /*
         * A box per piece that holds it -- a table row can carry the same
         * number in two columns, and one box from the first to the last
         * would light up everything between. When no single piece holds
         * it ("95440-" and "S9610" set apart), the line is the box.
         */
        const parts = line.parts ?? []
        const holding = parts.filter((part) => fold(part.text).includes(want))
        const spans = holding.length > 0
          ? holding.map((part) => [part.x, part.x + part.width])
          : [[parts.length ? Math.min(...parts.map((part) => part.x)) : 0,
            parts.length ? Math.max(...parts.map((part) => part.x + part.width)) : 1]]

        for (const [left, right] of spans) {
          hits.push({
            page,
            text: line.text.length > 140 ? `${line.text.slice(0, 140)}…` : line.text,
            box: {
              left: Math.max(0, left - 0.004),
              top: Math.max(0, line.top - (line.size * 0.95) / height),
              width: Math.min(1, right - left + 0.008),
              height: (line.size * 1.25) / height,
            },
          })
        }
        if (hits.length >= MAX_HITS) break
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
