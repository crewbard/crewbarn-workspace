import { apiRequest } from '@/lib/api'
import type { CatalogLink, ReferenceCard, ReferenceCardDocument } from '@/lib/referenceCards'
import type { EstimateContext } from '@/lib/catalogOrders'
import type { PickedPart } from '@/lib/catalogOrders'
import type { CatalogIndexStatus } from '@/lib/catalogIndex'

/**
 * The shop's catalogs: PDF books in their own library, opened from
 * anywhere with Alt C.
 *
 * A catalog no longer lives on a reference card. Cards point into it
 * instead ("found in: page 52"), and a card can be made from a part on
 * one of its pages. The launcher lists the books, the ones used last
 * first, and each opens at the page it was left on.
 */

/** A book in the library. Same id the portal and order lines use. */
export type Catalog = ReferenceCardDocument & {
  vendor: string | null
  /** The shop's vendor it belongs to (its Catalogs tab), when linked. */
  vendor_id?: string | null
  page_count: number | null
  last_opened_at: string | null
  created_at: string | null
  /** This shop's own, and not being read by other shops: rename, tabs, delete. */
  editable: boolean
  /** How many of the shop's cards say they are found in it. */
  card_count: number
  has_cover?: boolean
  /** The card it was first uploaded to, before catalogs had a library. */
  home_card_id?: string | null
  /** How far this shop's search index of it got (lib/catalogIndex); null when never read. */
  index?: CatalogIndexStatus | null
}

export const CATALOGS_KEY = ['catalogs'] as const

export const loadCatalogs = () => apiRequest<{ catalogs: Catalog[] }>('/v1/catalogs')

export async function updateCatalog(
  id: string,
  patch: { title?: string; vendor?: string | null; vendor_id?: string | null; shareable?: boolean; tabs?: Catalog['tabs'] },
): Promise<Catalog> {
  return (await apiRequest<{ catalog: Catalog }>(`/v1/catalogs/${id}`, { method: 'PATCH', body: patch })).catalog
}

/** Let the shop's customers read it in the portal, or stop them. */
export async function shareCatalogWithCustomers(id: string, on: boolean): Promise<Catalog> {
  return (await apiRequest<{ catalog: Catalog }>(`/v1/catalogs/${id}/customers`, {
    method: 'PATCH',
    body: { customer_visible: on },
  })).catalog
}

export async function deleteCatalog(id: string): Promise<void> {
  await apiRequest(`/v1/catalogs/${id}`, { method: 'DELETE' })
}

/** For the library's "last opened", and its page count, which only an open book knows. */
export function noteCatalogOpenedOnServer(id: string, pageCount: number): void {
  void apiRequest(`/v1/catalogs/${id}/opened`, { method: 'POST', body: { page_count: pageCount } }).catch(() => undefined)
}

export type MadeCards = {
  created: Array<{ part_number: string; card_id: string }>
  linked: Array<{ part_number: string; card_id: string }>
  already_linked: Array<{ part_number: string; card_id: string | null; reason?: string }>
}

/** Cards for part numbers on a page. One that already has a card is linked instead. */
export function makeCardsFromCatalog(
  id: string,
  parts: Array<{ part_number: string; title?: string; page?: number; page_label?: string }>,
): Promise<MadeCards> {
  return apiRequest<MadeCards>(`/v1/catalogs/${id}/cards`, { method: 'POST', body: { parts } })
}

export type LookedUpCard = ReferenceCard & { matched_on: string; matched_name: string; exact: boolean }

/** The cards a part number or name opens. */
export function lookupCards(term: string): Promise<{ term: string; cards: LookedUpCard[] }> {
  return apiRequest(`/v1/reference-cards/lookup?term=${encodeURIComponent(term)}`)
}

export async function linkCardToCatalog(
  cardId: string,
  link: { document_id: string; page?: number | null; page_label?: string | null },
): Promise<CatalogLink[]> {
  return (await apiRequest<{ found_in: CatalogLink[] }>(`/v1/reference-cards/${cardId}/catalog-links`, {
    method: 'POST',
    body: link,
  })).found_in
}

export async function unlinkCardFromCatalog(cardId: string, linkId: string): Promise<CatalogLink[]> {
  return (await apiRequest<{ found_in: CatalogLink[] }>(`/v1/reference-cards/${cardId}/catalog-links/${linkId}`, {
    method: 'DELETE',
  })).found_in
}

/** Open the launcher, or one catalogue straight away. */
export type OpenCatalogsDetail = {
  documentId?: string
  /** Focus create forms can keep the protected book beside the form on wide screens. */
  docked?: boolean
  /** A line editor can receive PDF picks without changing the purchasing cart. */
  onPickLine?: (part: PickedPart) => Promise<string | void> | string | void
  /** A page of the file to open at, instead of where it was left. */
  page?: number
  /** Opened from an estimate: what is ordered from the catalogue is for it. */
  estimate?: EstimateContext
}

const EVENT = 'crewbarn:open-catalogs'

/** Anything on the page can open it: a search result, a button on an estimate. */
export function openCatalogs(detail: OpenCatalogsDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenCatalogsDetail>(EVENT, { detail }))
}

export function onOpenCatalogs(handler: (detail: OpenCatalogsDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<OpenCatalogsDetail>).detail ?? {})
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/**
 * Alt C, and Option C on a Mac.
 *
 * By the key's place, not the letter it types: Option C types "ç" on a
 * Mac, so e.key is never "c" there.
 */
export function isCatalogShortcut(e: KeyboardEvent): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyC'
}

export const CATALOG_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥C' : 'Alt C'

/** Every word typed is in its title, its vendor or its file name. */
export function matchCatalogs(catalogs: Catalog[], query: string): Catalog[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return catalogs
  return catalogs.filter((c) => {
    const text = `${c.title} ${c.vendor ?? ''} ${c.original_filename}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

// ------------------------------------------------------------ this browser

/*
 * Which catalogues were opened last, and the page each was left on. Kept
 * in this browser only: it is a convenience, and the bench computer and
 * the phone in the van are rightly at different pages.
 */

const RECENT_KEY = 'crewbarn.catalogs.recent'
const PAGES_KEY = 'crewbarn.catalogs.pages'
const KEEP_RECENT = 6
const KEEP_PAGES = 60

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private window or storage full: the launcher still works, it just forgets.
  }
}

/** Ids of the catalogues opened last, newest first. */
export function recentCatalogIds(): string[] {
  const ids = read<unknown>(RECENT_KEY, [])
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

export function noteCatalogOpened(documentId: string): void {
  write(RECENT_KEY, [documentId, ...recentCatalogIds().filter((id) => id !== documentId)].slice(0, KEEP_RECENT))
}

/** The page of the file it was left on. */
export function lastCatalogPage(documentId: string): number | null {
  const pages = read<Record<string, unknown>>(PAGES_KEY, {})
  const page = pages && typeof pages === 'object' ? pages[documentId] : null
  return typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : null
}

export function rememberCatalogPage(documentId: string, page: number): void {
  const pages = read<Record<string, number>>(PAGES_KEY, {})
  const next: Record<string, number> = { [documentId]: page }
  // Newest first, so the oldest fall off the end.
  for (const [id, p] of Object.entries(pages && typeof pages === 'object' ? pages : {})) {
    if (id !== documentId && Object.keys(next).length < KEEP_PAGES) next[id] = p
  }
  write(PAGES_KEY, next)
}

/**
 * The shelf picture for a catalog just uploaded: page one, drawn here, since
 * the server never opens a PDF. A catalog without one still works; it gets
 * one when first opened.
 */
export async function saveCatalogCover(catalogId: string, file: File): Promise<void> {
  try {
    const { openBook } = await import('@/components/magazine/pdfBook')
    const { sendImage } = await import('@/lib/referenceCardDocuments')
    const book = await openBook(await file.arrayBuffer())
    try {
      const url = await book.render(1, 420)
      const blob = await (await fetch(url)).blob()
      await sendImage(`/v1/catalogs/${catalogId}/cover`, 'cover', blob, { page_count: String(book.pageCount) })
    } finally {
      book.destroy()
    }
  } catch {
    // Nothing to tell anyone: the cover is a nicety.
  }
}
