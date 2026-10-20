import { apiRequest } from '@/lib/api'
import { readCatalogFile } from '@/lib/referenceCardDocuments'
import type { Catalog } from '@/lib/catalogs'
import type { Book } from '@/components/magazine/pdfBook'
import type { PartOnPage } from '@/components/magazine/partNumbers'

/**
 * Catalogs searchable without opening them (CatalogIndex on the server).
 *
 * The server never opens a PDF, so this browser reads the catalog page by
 * page -- the same reader the viewer uses -- and sends each page's text,
 * heading and part numbers with their prices, a batch at a time. A read
 * that stops part way carries on from where it got to next time.
 */

export type CatalogIndexStatus = {
  page_count: number
  pages_done: number
  parts_found: number
  prices_found: number
  finished_at: string | null
  current: boolean
}

export type CatalogHit = {
  document_id: string
  title: string
  vendor: string | null
  page: number
  page_label: string
  heading: string | null
  part: { code: string; price_cents: number | null; line: string | null } | null
  /** The line it is on; words found are marked «like this». */
  snippet: string | null
  score: number
}

/** Fully read, by the current reader. */
export const isSearchable = (index: CatalogIndexStatus | null | undefined): boolean =>
  !!index && !!index.finished_at && index.current && index.pages_done >= index.page_count

export const searchCatalogs = (q: string, opts: { vendor_id?: string; document_id?: string; limit?: number } = {}) => {
  const params = new URLSearchParams({ q })
  for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== '') params.set(k, String(v))
  return apiRequest<{ hits: CatalogHit[]; indexed: number }>(`/v1/catalogs/search?${params.toString()}`)
}

const BATCH = 25

/** What the overlay is told as the read goes. */
export type IndexEvent =
  | { type: 'download'; fraction: number | null }
  | { type: 'opening' }
  | { type: 'start'; book: Book; pageCount: number; from: number; index: CatalogIndexStatus }
  | { type: 'page'; page: number; label: string; heading: string | null; parts: PartOnPage[] }
  | { type: 'saved'; index: CatalogIndexStatus }
  | { type: 'done'; index: CatalogIndexStatus }

/**
 * Read one catalog for search. `file` is the PDF just uploaded, when there
 * is one, so it is not downloaded straight back. Resolves with the index
 * as the server has it; rejects when stopped or when the book cannot be
 * read. The book is closed when the read ends.
 */
export async function indexCatalog(
  catalog: Pick<Catalog, 'id' | 'size_bytes'>,
  opts: { file?: File; restart?: boolean; signal: AbortSignal; onEvent: (e: IndexEvent) => void },
): Promise<CatalogIndexStatus> {
  const { signal, onEvent } = opts
  const stopped = () => signal.aborted

  const bytes = opts.file
    ? await opts.file.arrayBuffer()
    : await readCatalogFile(catalog.id, {
      signal,
      expectedBytes: catalog.size_bytes,
      onProgress: (p) => onEvent({ type: 'download', fraction: p.total ? p.loaded / p.total : null }),
    })
  if (stopped()) throw new DOMException('Stopped', 'AbortError')

  onEvent({ type: 'opening' })
  const { openBook } = await import('@/components/magazine/pdfBook')
  const book = await openBook(bytes)

  try {
    const numbers = await book.pageNumbers().catch(() => null)
    const started = await apiRequest<{ index: CatalogIndexStatus }>(`/v1/catalogs/${catalog.id}/index`, {
      method: 'POST',
      body: { page_count: book.pageCount, restart: !!opts.restart },
    })
    let index = started.index
    const from = Math.min(index.pages_done + 1, book.pageCount + 1)
    onEvent({ type: 'start', book, pageCount: book.pageCount, from, index })

    let batch: Array<Record<string, unknown>> = []
    // One batch on its way while the next is read: in order, never two at once.
    let sending: Promise<void> = Promise.resolve()
    const send = (pages: Array<Record<string, unknown>>) => {
      sending = sending.then(async () => {
        const res = await apiRequest<{ index: CatalogIndexStatus }>(`/v1/catalogs/${catalog.id}/index/pages`, { method: 'POST', body: { pages } })
        index = res.index
        onEvent({ type: 'saved', index })
      })
      return sending
    }

    for (let page = from; page <= book.pageCount; page++) {
      if (stopped()) break
      const read = await book.readPage(page).catch(() => ({ text: '', heading: null, parts: [] as PartOnPage[] }))
      const label = numbers?.label(page) ?? String(page)
      onEvent({ type: 'page', page, label, heading: read.heading, parts: read.parts })
      batch.push({
        page,
        label,
        heading: read.heading,
        text: read.text.slice(0, 20000),
        parts: read.parts.slice(0, 400).map((p) => ({ code: p.text, price_cents: p.price ?? null, line: p.line.slice(0, 300) })),
      })
      if (batch.length >= BATCH) {
        void send(batch)
        batch = []
      }
      // Let the page breathe between pages: the overlay draws as the read goes.
      if (page % 4 === 0) await new Promise((r) => window.setTimeout(r, 0))
    }
    if (batch.length > 0) void send(batch)
    await sending
    if (stopped()) throw new DOMException('Stopped', 'AbortError')

    const done = await apiRequest<{ index: CatalogIndexStatus }>(`/v1/catalogs/${catalog.id}/index/done`, { method: 'POST' })
    onEvent({ type: 'done', index: done.index })
    return done.index
  } finally {
    // Let a page still being drawn for the overlay finish before the book goes.
    window.setTimeout(() => book.destroy(), 1500)
  }
}
