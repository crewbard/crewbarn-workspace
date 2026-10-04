import type { ReferenceCard, ReferenceCardDocument } from '@/lib/referenceCards'
import type { EstimateContext } from '@/lib/catalogOrders'

/**
 * The shop's catalogues: every PDF on every reference card it can read,
 * opened from anywhere with Alt C.
 *
 * A catalogue lives on a card because that is where it was uploaded, but
 * nobody looking up a part number thinks "which card was that on". The
 * launcher lists the files themselves, the ones used last first, and each
 * opens at the page it was left on.
 */

export type Catalog = { card: ReferenceCard; document: ReferenceCardDocument }

/** Open the launcher, or one catalogue straight away. */
export type OpenCatalogsDetail = {
  documentId?: string
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

/** Every file on every card, once each, by title. */
export function catalogsIn(cards: ReferenceCard[]): Catalog[] {
  const seen = new Set<string>()
  const out: Catalog[] = []
  for (const card of cards) {
    for (const document of card.documents ?? []) {
      if (seen.has(document.id)) continue
      seen.add(document.id)
      out.push({ card, document })
    }
  }
  return out.sort((a, b) => a.document.title.localeCompare(b.document.title))
}

/** Every word typed is in its title, its card's title or its file name. */
export function matchCatalogs(catalogs: Catalog[], query: string): Catalog[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return catalogs
  return catalogs.filter(({ card, document }) => {
    const text = `${document.title} ${card.title} ${document.original_filename}`.toLowerCase()
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
