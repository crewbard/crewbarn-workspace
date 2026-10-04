import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconBookmarks,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconShoppingCart,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react'
import {
  formatSize,
  readReferenceCardDocument,
  updateReferenceCardDocument,
  type DownloadProgress,
} from '@/lib/referenceCardDocuments'
import type { DocumentTab, ReferenceCardDocument } from '@/lib/referenceCards'
import { lastCatalogPage, noteCatalogOpened, rememberCatalogPage } from '@/lib/catalogs'
import type { EstimateContext, PickedPart } from '@/lib/catalogOrders'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { OrderPanel, type OrderPanelHandle } from './OrderPanel'
import { priceAfter, type PartOnPage } from './partNumbers'
import { Book, openBook, type PageLink, type SearchHit, type Suggestion } from './pdfBook'
import { PageNumbers } from './pageNumbers'
import { TabEditor } from './TabEditor'
import { BookSearch } from './BookSearch'
import { SWATCH, colorOf } from './tabColors'

/**
 * A PDF on a card, read like the catalogue it usually is.
 *
 * Two pages side by side with the cover on its own, a page that turns
 * when you go forward, and coloured index tabs down the edge that open
 * it at a chapter -- because that is how somebody who has used the
 * printed book already finds things in it. A PDF viewer that scrolls
 * one long column throws all of that away.
 *
 * The bytes come through the API, never from a URL: the storage has a
 * public domain and the file is usually somebody else's copyright.
 */

export type MagazineViewerProps = {
  cardId: string
  document: ReferenceCardDocument
  /** The shop that owns the card, while the card can still change. */
  canEdit: boolean
  onClose: () => void
  onTabsSaved?: (document: ReferenceCardDocument) => void
  /** A page of the file to open at. Otherwise where it was left, or the cover. */
  initialPage?: number
  /** Opened from an estimate: parts go on that estimate's order. */
  estimate?: EstimateContext
}

const ZOOMS = [1, 1.5, 2] as const
const TURN_MS = 650
/** Where suggested tabs came from, as the header says it. */
const FROM: Record<Suggestion['source'], string> = {
  bookmarks: 'tabs from the PDF’s bookmarks',
  edges: 'tabs printed on its pages',
  contents: 'tabs from its contents page',
  headings: 'tabs from its headings',
}

/** Past this many tabs the edge uses short labels across, not titles down. */
const MANY_TABS = 10

type Turn = {
  dir: 'next' | 'prev'
  target: number
  /** The leaf: what is on it now, and what is on its back. */
  front: number
  back: number
  /** The page uncovered under the leaf, and the one that does not move. */
  under: number | null
  stay: number | null
  turned: boolean
}

/**
 * A book's cover sits alone on the right, like a closed book; then 2-3,
 * 4-5. A sheet of two or three pages is not a book: it opens flat, 1-2,
 * rather than a lonely cover and then a lonely back.
 */
const coverAlone = (count: number) => count > 3

function spreadOf(page: number, count: number): number {
  if (!coverAlone(count)) return Math.floor((page - 1) / 2)
  return page === 1 ? 0 : Math.floor(page / 2)
}

/** The first page of a spread: the one a jump to it lands on. */
function spreadStart(spread: number, count: number): number {
  if (!coverAlone(count)) return spread * 2 + 1
  return spread === 0 ? 1 : spread * 2
}

function spreadPages(spread: number, count: number): { left: number | null; right: number | null } {
  if (!coverAlone(count)) {
    const left = spread * 2 + 1
    return { left: left <= count ? left : null, right: left + 1 <= count ? left + 1 : null }
  }
  if (spread === 0) return { left: null, right: 1 }
  const left = spread * 2
  return { left: left <= count ? left : null, right: left + 1 <= count ? left + 1 : null }
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function MagazineViewer({
  cardId,
  document: doc,
  canEdit,
  onClose,
  onTabsSaved,
  initialPage,
  estimate,
}: MagazineViewerProps) {
  const { hasAny } = usePermissions()
  // Building an order needs the inventory right, or the estimate right for an estimate's parts.
  const canOrder = hasAny([PERM.INVENTORY_EDIT, PERM.JOBS_EDIT])
  const [book, setBook] = useState<Book | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // The file on its way down, before there is a book to show.
  const [download, setDownload] = useState<DownloadProgress | null>(null)
  const [aspect, setAspect] = useState(0.75)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  // The book's own page numbers. The file's count until the folios are read.
  const [numbers, setNumbers] = useState(() => new PageNumbers(0))

  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [tabs, setTabs] = useState<DocumentTab[]>(doc.tabs)
  /*
   * One panel at a time down the right: the tab editor or the search.
   * Both want the book beside them, and two would leave no book.
   */
  const [panel, setPanel] = useState<'tabs' | 'search' | null>(null)
  const editing = panel === 'tabs'
  const setEditing = (open: boolean | ((was: boolean) => boolean)) =>
    setPanel((was) => {
      const next = typeof open === 'function' ? open(was === 'tabs') : open
      return next ? 'tabs' : was === 'tabs' ? null : was
    })

  // What the search found, and which hit is open. Lit up on the page.
  const [hits, setHits] = useState<SearchHit[]>([])
  const [activeHit, setActiveHit] = useState<number | null>(null)
  const showHits = useCallback((found: SearchHit[]) => {
    setHits(found)
    setActiveHit(null)
  }, [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /*
   * The order beside the book: open, folded down to a bar, or not there.
   * Opened from an estimate, it starts open -- that is why it was opened.
   */
  const [ordering, setOrdering] = useState<'open' | 'min' | null>(estimate && canOrder ? 'open' : null)
  const orderPanel = useRef<OrderPanelHandle>(null)
  // How the book says to order, on the page open: a checklist for a build.
  const [formula, setFormula] = useState<string[] | null>(null)
  const pick = useCallback((part: PickedPart) => {
    setOrdering('open')
    // The panel may only now be mounting; hand it the part once it is.
    window.setTimeout(() => orderPanel.current?.add(part), 0)
  }, [])

  const [stage, setStage] = useState({ w: 0, h: 0 })

  // Read once, when the book opens: a later change is not a request to jump.
  const startAt = useRef(initialPage)

  /*
   * Measured the moment the stage exists, then on every resize. The
   * observer alone reports on the next paint, which leaves one blank
   * frame -- and none at all in a tab that is not being painted.
   */
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setStage((s) => (s.w === Math.floor(r.width) && s.h === Math.floor(r.height)
        ? s
        : { w: Math.floor(r.width), h: Math.floor(r.height) }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // The window as well: a phone turned on its side should re-lay the book
    // even where the observer is slow to report.
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // ------------------------------------------------------------ open it

  useEffect(() => {
    let live = true
    let opened: Book | null = null
    const stop = new AbortController()

    readReferenceCardDocument(cardId, doc.id, {
      signal: stop.signal,
      expectedBytes: doc.size_bytes,
      onProgress: (p) => live && setDownload(p),
    })
      .then(openBook)
      .then(async (b) => {
        if (!live) {
          b.destroy()
          return
        }
        opened = b
        const ratio = await b.aspect(1)
        if (!live) return
        setAspect(ratio)
        setBook(b)
        setNumbers(new PageNumbers(b.pageCount))

        // Back where it was left, the way a book on the bench stays open.
        const start = startAt.current ?? lastCatalogPage(doc.id)
        if (start && start <= b.pageCount) setPage(start)
        noteCatalogOpened(doc.id)

        b.pageNumbers()
          .then((found) => live && setNumbers(found))
          .catch(() => undefined)

        /*
         * Reading every page's text for a contents page and headings takes
         * a moment on a big catalogue, so the book opens first and its
         * tabs arrive when they are ready.
         */
        b.suggestTabs()
          .then((found) => live && setSuggestions(found))
          .catch(() => undefined)
      })
      .catch((e: unknown) => {
        if (!live) return
        const message = e instanceof Error ? e.message : ''
        setFailed(
          /password/i.test(message)
            ? 'This PDF is password-protected, so it cannot be shown here.'
            : /Invalid PDF|corrupt|structure/i.test(message)
              ? 'This file could not be read as a PDF. It may be damaged; try uploading it again.'
              : message || 'The file could not be opened.',
        )
      })

    return () => {
      live = false
      stop.abort()
      opened?.destroy()
    }
  }, [cardId, doc.id, doc.size_bytes])

  useEffect(() => {
    if (book) rememberCatalogPage(doc.id, page)
  }, [book, doc.id, page])

  // The page behind does not scroll under the book.
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [])

  // ------------------------------------------------------------ layout

  const count = book?.pageCount ?? 0

  /*
   * The shop's tabs, or until it has chosen some, the best the PDF offers
   * -- its bookmarks, its contents page, its headings. A catalogue gets
   * tabs the moment it is uploaded, and the shop only steps in to change
   * them.
   */
  const shownTabs = useMemo<DocumentTab[]>(
    () => (tabs.length > 0
      ? tabs
      : (suggestions[0]?.tabs ?? []).map((t) => ({ label: t.label, page: t.page, color: t.color ?? null }))),
    [tabs, suggestions],
  )

  const layout = useMemo(() => {
    const pad = 20
    const sideTabs = shownTabs.length > 0 && stage.w >= 560
    const tabRoom = sideTabs ? (shownTabs.length > MANY_TABS ? 132 : 40) : 0
    const topStrip = shownTabs.length > 0 && !sideTabs ? 40 : 0

    const availW = Math.max(0, stage.w - pad * 2 - tabRoom)
    const availH = Math.max(0, stage.h - pad * 2 - topStrip)

    let pageH = availH
    let pageW = pageH * aspect

    // Two pages when two pages fit at a readable size; one otherwise.
    const spread = stage.w >= 720 && availW / 2 >= Math.min(pageW, 300)

    const across = spread ? 2 : 1
    if (pageW * across > availW) {
      pageW = availW / across
      pageH = pageW / aspect
    }

    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2.5)
    // Bucketed, so a window dragged a few pixels does not re-render every page.
    const renderH = Math.max(256, Math.min(3600, Math.round((pageH * zoom * dpr) / 128) * 128))

    return { spread, sideTabs, topStrip, pageW, pageH, renderH }
  }, [stage, aspect, zoom, shownTabs.length])

  const { spread, pageW, pageH, renderH } = layout
  const lastSpread = count > 0 ? spreadOf(count, count) : 0

  const visible = useMemo(() => {
    if (count === 0) return { left: null, right: null }
    return spread ? spreadPages(spreadOf(page, count), count) : { left: null, right: page }
  }, [spread, page, count])

  // Keep what is on screen and either side of it rendered and pinned.
  useEffect(() => {
    if (!book || count === 0) return

    const around = spread
      ? [spreadOf(page, count) - 1, spreadOf(page, count), spreadOf(page, count) + 1]
          .filter((s) => s >= 0 && s <= lastSpread)
          .flatMap((s) => Object.values(spreadPages(s, count)))
      : [page - 1, page, page + 1, page + 2]

    const pages = [...new Set(around.filter((p): p is number => p !== null && p >= 1 && p <= count))]
    book.pin(pages.map((p) => Book.key(p, renderH)))
    pages.forEach((p) => void book.render(p, renderH).catch(() => undefined))
  }, [book, count, page, spread, renderH, lastSpread])

  // ------------------------------------------------------------ moving

  const goTo = useCallback(
    (target: number) => {
      if (count === 0 || turn) return
      setPage(Math.min(Math.max(1, Math.round(target)), count))
    },
    [count, turn],
  )

  const canPrev = count > 0 && (spread ? spreadOf(page, count) > 0 : page > 1)
  const canNext = count > 0 && (spread ? spreadOf(page, count) < lastSpread : page < count)

  /** Set while a turn waits for its pages, so a second click does not queue a second turn. */
  const preparing = useRef(false)

  const step = useCallback(
    async (dir: 'next' | 'prev') => {
      if (!book || turn || preparing.current || (dir === 'next' ? !canNext : !canPrev)) return

      if (!spread) {
        goTo(page + (dir === 'next' ? 1 : -1))
        return
      }

      const s = spreadOf(page, count)
      const t = dir === 'next' ? s + 1 : s - 1
      const target = spreadStart(t, count)
      const now = spreadPages(s, count)
      const then = spreadPages(t, count)

      // Zoomed in, or asked not to animate: just go there.
      if (zoom !== 1 || reducedMotion()) {
        goTo(target)
        return
      }

      const leaf =
        dir === 'next'
          ? { front: now.right, back: then.left, under: then.right, stay: now.left }
          : { front: now.left, back: then.right, under: then.left, stay: now.right }

      if (leaf.front === null || leaf.back === null) {
        goTo(target)
        return
      }

      /*
       * Both faces and the page beneath are painted before the leaf lifts,
       * or it turns over a blank -- but not waited on for ever. A heavy
       * page that is still drawing after a moment turns with its number
       * showing, which beats a button that seems to do nothing.
       */
      preparing.current = true
      try {
        await Promise.race([
          Promise.all(
            [leaf.front, leaf.back, leaf.under, leaf.stay]
              .filter((p): p is number => p !== null)
              .map((p) => book.render(p, renderH)),
          ).catch(() => undefined),
          new Promise((resolve) => window.setTimeout(resolve, 900)),
        ])
      } finally {
        preparing.current = false
      }

      setTurn({ dir, target, front: leaf.front, back: leaf.back, under: leaf.under, stay: leaf.stay, turned: false })
    },
    [book, turn, canNext, canPrev, spread, page, count, zoom, goTo, renderH],
  )

  /*
   * Lift the leaf on the frame after it is placed, so the turn animates.
   * A timer as well: a tab that is not being painted runs no frames, and
   * the book would sit locked mid-turn until somebody looked at it.
   */
  useEffect(() => {
    if (!turn || turn.turned) return
    const lift = () => setTurn((t) => (t && !t.turned ? { ...t, turned: true } : t))
    let inner = 0
    const frame = requestAnimationFrame(() => {
      inner = requestAnimationFrame(lift)
    })
    const fallback = window.setTimeout(lift, 120)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(inner)
      window.clearTimeout(fallback)
    }
  }, [turn])

  // Land it. A timer as well as transitionend: a hidden tab never fires the event.
  const land = useCallback(() => {
    if (!turn) return
    setPage(turn.target)
    setTurn(null)
  }, [turn])

  useEffect(() => {
    if (!turn?.turned) return
    const timer = window.setTimeout(land, TURN_MS + 150)
    return () => window.clearTimeout(timer)
  }, [turn?.turned, land])

  // ------------------------------------------------------------ keys

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The target can be the window or the document, which have no closest().
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select')

      if (e.key === 'Escape') {
        e.preventDefault()
        if (panel) setPanel(null)
        else onClose()
        return
      }

      // Ctrl-F finds in the book, not in the page behind it.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setPanel('search')
        return
      }
      if (typing) return

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        void step('next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        void step('prev')
      } else if (e.key === 'Home') {
        goTo(1)
      } else if (e.key === 'End') {
        goTo(count)
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)])
      } else if (e.key === '-') {
        setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, onClose, step, goTo, count])

  // A swipe on a phone turns the page.
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    if (!book || !ordering) return
    let live = true
    const pages = [visible.left, visible.right].filter((p): p is number => p !== null)
    Promise.all(pages.map((p) => book.orderFormula(p)))
      .then((found) => live && setFormula(found.find((f) => f !== null) ?? null))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [book, ordering, visible.left, visible.right])

  // ------------------------------------------------------------ tabs

  const furthest = Math.max(visible.left ?? 0, visible.right ?? 0)
  const activeTab = shownTabs.reduce((at, tab, i) => (tab.page <= furthest ? i : at), -1)

  const saveTabs = async (next: DocumentTab[]) => {
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await updateReferenceCardDocument(cardId, doc.id, { tabs: next })
      setTabs(saved.tabs)
      onTabsSaved?.(saved)
      setEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'The tabs did not save.')
    } finally {
      setSaving(false)
    }
  }

  // ------------------------------------------------------------ paint

  const pageLabel = count ? numbers.range(visible.left, visible.right) : ''

  const bookW = pageW * (spread ? 2 : 1) * zoom
  const bookH = pageH * zoom

  const slot = (p: number | null, side: 'left' | 'right' | 'only') =>
    book && p !== null ? (
      <PageSlot
        book={book}
        page={p}
        label={numbers.label(p)}
        pageLabel={(n) => numbers.label(n)}
        height={renderH}
        side={side}
        interactive={!turn}
        marks={hits.flatMap((hit, i) => (hit.page === p ? [{ ...hit.box, active: i === activeHit }] : []))}
        onPart={ordering ? (found) => pick({
          part_number: found.text,
          description: found.line,
          list_price_cents: found.price,
          kind: found.kind,
          source_document_id: doc.id,
          source_page: p,
          source_page_label: numbers.label(p),
        }) : undefined}
        onTurn={() => void step(side === 'left' ? 'prev' : 'next')}
        onLink={(link) => {
          if (link.page) goTo(link.page)
          else if (link.url) window.open(link.url, '_blank', 'noopener,noreferrer')
        }}
      />
    ) : (
      <div />
    )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
      /*
       * React events bubble along the component tree, through the portal.
       * Opened from a card drawer, a click here would otherwise reach the
       * drawer's backdrop and close the card under the book.
       */
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[60] flex flex-col bg-[#22262d] text-slate-100"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 35%, #333944 0%, #22262d 60%, #1b1e24 100%)' }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">{doc.title}</h2>
          <p className="truncate text-xs text-slate-400">
            {count > 0 ? `${count} pages` : failed ? 'Could not be opened' : loadingLabel(download)}
            {tabs.length === 0 && suggestions[0] && ` · ${FROM[suggestions[0].source]}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <IconX size={20} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={stageRef}
          className={'relative min-w-0 flex-1 ' + (zoom > 1 ? 'overflow-auto' : 'overflow-hidden')}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse') swipe.current = e.clientX
          }}
          onPointerUp={(e) => {
            if (swipe.current === null || zoom > 1) return
            const dx = e.clientX - swipe.current
            swipe.current = null
            if (Math.abs(dx) > 60) void step(dx < 0 ? 'next' : 'prev')
          }}
        >
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="max-w-sm rounded-lg bg-white/10 px-4 py-3 text-center text-sm text-slate-100">{failed}</p>
            </div>
          )}

          {!book && !failed && <Downloading progress={download} />}

          {book && stage.w > 0 && (
            <div
              className="flex min-h-full min-w-full flex-col items-center justify-center p-5"
              style={{ width: zoom > 1 ? bookW + 120 : undefined }}
            >
              {layout.topStrip > 0 && (
                <TabStrip tabs={shownTabs} active={activeTab} onPick={goTo} />
              )}

              <div className="relative" style={{ width: bookW, height: bookH }}>
                <div
                  className="relative grid h-full w-full shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
                  style={{ gridTemplateColumns: spread ? '1fr 1fr' : '1fr', perspective: `${bookW * 2}px` }}
                >
                  {spread
                    ? turn
                      ? turn.dir === 'next'
                        ? (<>{slot(turn.stay, 'left')}{slot(turn.under, 'right')}</>)
                        : (<>{slot(turn.under, 'left')}{slot(turn.stay, 'right')}</>)
                      : (<>{slot(visible.left, 'left')}{slot(visible.right, 'right')}</>)
                    : slot(visible.right, 'only')}

                  {/* The fold down the middle, so two pages read as one book. */}
                  {spread && visible.left !== null && visible.right !== null && !turn && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-1/2 w-16 -translate-x-1/2"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, rgba(0,0,0,0.10) 42%, rgba(0,0,0,0.28) 50%, rgba(0,0,0,0.10) 58%, transparent)',
                      }}
                    />
                  )}

                  {turn && book && (
                    <div
                      aria-hidden
                      onTransitionEnd={land}
                      className="absolute inset-y-0 w-1/2"
                      style={{
                        left: turn.dir === 'next' ? '50%' : 0,
                        transformStyle: 'preserve-3d',
                        transformOrigin: turn.dir === 'next' ? 'left center' : 'right center',
                        transform: `rotateY(${turn.turned ? (turn.dir === 'next' ? -180 : 180) : 0}deg)`,
                        transition: `transform ${TURN_MS}ms cubic-bezier(0.32, 0.72, 0.28, 1)`,
                      }}
                    >
                      <Face book={book} page={turn.front} label={numbers.label(turn.front)} height={renderH} />
                      <Face book={book} page={turn.back} label={numbers.label(turn.back)} height={renderH} back />
                    </div>
                  )}
                </div>

                {layout.sideTabs && (
                  <SideTabs
                    tabs={shownTabs}
                    active={activeTab}
                    height={bookH}
                    pageLabel={(n) => numbers.label(n)}
                    onPick={goTo}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {panel === 'search' && book && (
          <BookSearch
            book={book}
            activeHit={activeHit}
            pageLabel={(n) => numbers.label(n)}
            onHits={showHits}
            onPick={(i) => {
              const hit = hits[i]
              if (!hit) return
              setActiveHit(i)
              goTo(hit.page)
            }}
            onOrder={canOrder ? (partNumber, hit) => pick({
              part_number: partNumber,
              description: hit.text,
              list_price_cents: priceAfter(hit.text, partNumber),
              source_document_id: doc.id,
              source_page: hit.page,
              source_page_label: numbers.label(hit.page),
            }) : undefined}
            onClose={() => {
              setPanel(null)
              showHits([])
            }}
          />
        )}

        {editing && book && (
          <TabEditor
            saved={tabs}
            suggestions={suggestions}
            page={visible.right ?? visible.left ?? page}
            pageCount={count}
            numbers={numbers}
            saving={saving}
            error={saveError}
            onGo={goTo}
            onSave={(next) => void saveTabs(next)}
            onClose={() => setEditing(false)}
          />
        )}

        {ordering && book && (
          <OrderPanel
            ref={orderPanel}
            documentId={doc.id}
            estimate={estimate}
            minimized={ordering === 'min'}
            pageLabel={(n) => numbers.label(n)}
            formula={formula}
            onMinimize={(min) => setOrdering(min ? 'min' : 'open')}
            onClose={() => setOrdering(null)}
            onGoToPage={goTo}
          />
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-1">
          <ToolButton label="Previous page" disabled={!canPrev || !!turn} onClick={() => void step('prev')}>
            <IconChevronLeft size={20} />
          </ToolButton>
          <PageInput
            key={pageLabel}
            label={pageLabel}
            numbers={numbers}
            filePages={visible.left && visible.right ? `${visible.left}–${visible.right}` : String(visible.right ?? visible.left ?? '')}
            onGo={goTo}
          />
          <ToolButton label="Next page" disabled={!canNext || !!turn} onClick={() => void step('next')}>
            <IconChevronRight size={20} />
          </ToolButton>
        </div>

        {count > 1 && (
          <input
            type="range"
            min={1}
            max={count}
            value={page}
            aria-label="Page"
            aria-valuetext={`Page ${numbers.label(page)}`}
            onChange={(e) => goTo(Number(e.target.value))}
            className="w-[min(18rem,40vw)] accent-sky-400"
          />
        )}

        <div className="flex items-center gap-1">
          <ToolButton
            label="Zoom out"
            disabled={zoom === ZOOMS[0]}
            onClick={() => setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)])}
          >
            <IconZoomOut size={18} />
          </ToolButton>
          <span className="w-10 text-center text-xs tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span>
          <ToolButton
            label="Zoom in"
            disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)])}
          >
            <IconZoomIn size={18} />
          </ToolButton>
        </div>

        {book && (
          <button
            type="button"
            onClick={() => setPanel((was) => (was === 'search' ? null : 'search'))}
            aria-pressed={panel === 'search'}
            title="Find in this book (Ctrl F)"
            className={
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ' +
              (panel === 'search' ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10')
            }
          >
            <IconSearch size={16} />
            Find
            {/* Ctrl on Windows, ⌘ on a Mac: both open it. */}
            <kbd className="ml-0.5 hidden rounded border border-current/30 px-1 font-mono text-[10px] leading-4 opacity-70 sm:inline">
              {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘F' : 'Ctrl F'}
            </kbd>
          </button>
        )}

        {canOrder && book && (
          <button
            type="button"
            onClick={() => setOrdering((was) => (was === 'open' ? 'min' : 'open'))}
            aria-pressed={ordering !== null}
            title="Order parts from this catalog"
            className={
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm '
              + (ordering === 'open' ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10')
            }
          >
            <IconShoppingCart size={16} />
            Order
          </button>
        )}

        {canEdit && book && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ' +
              (editing ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10')
            }
          >
            <IconBookmarks size={16} />
            Tabs
          </button>
        )}
      </footer>
    </div>,
    document.body,
  )
}

/** "Downloading 23.4 of 61.6 MB", then "Opening…" while the PDF is read. */
function loadingLabel(progress: DownloadProgress | null): string {
  if (!progress || (progress.total !== null && progress.loaded >= progress.total)) return 'Opening…'
  return progress.total
    ? `Downloading ${formatSize(progress.loaded)} of ${formatSize(progress.total)}`
    : `Downloading ${formatSize(progress.loaded)}`
}

/**
 * The book's place while the file comes down: its shape, a bar, and how
 * much is left. Once every byte is in, the bar fills and pulses while the
 * PDF is read, which on a big catalogue takes a second or two more.
 */
function Downloading({ progress }: { progress: DownloadProgress | null }) {
  const fraction = progress?.total ? Math.min(1, progress.loaded / progress.total) : null
  // Every byte in: the PDF is being read. Before the first byte, the bar
  // waits short rather than starting full and shrinking.
  const reading = fraction === 1

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
      <div className="h-[55%] w-[min(22rem,70%)] animate-pulse rounded bg-white/10" aria-hidden />
      <div className="w-[min(22rem,80%)]">
        <div
          role="progressbar"
          aria-label="Downloading the file"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={'h-full rounded-full bg-sky-400 transition-[width] duration-200 ' + (reading || fraction === null ? 'animate-pulse' : '')}
            style={{ width: fraction === null ? '12%' : `${Math.max(2, fraction * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs tabular-nums text-slate-400" aria-live="polite">
          {reading || !progress
            ? 'Opening…'
            : fraction !== null
              ? `${Math.round(fraction * 100)}% · ${loadingLabel(progress)}`
              : loadingLabel(progress)}
        </p>
      </div>
    </div>
  )
}

/** One page in the book: the picture, its links, and a click to turn. */
function PageSlot({
  book,
  page,
  label,
  pageLabel,
  height,
  side,
  interactive,
  marks = [],
  onTurn,
  onLink,
  onPart,
}: {
  book: Book
  page: number
  /** The number printed on it. */
  label: string
  pageLabel: (page: number) => string
  height: number
  side: 'left' | 'right' | 'only'
  interactive: boolean
  /** Search hits on this page, as fractions of it. */
  marks?: Array<{ left: number; top: number; width: number; height: number; active: boolean }>
  onTurn: () => void
  onLink: (link: PageLink) => void
  /** While an order is open: a part number on the page, clicked. */
  onPart?: (part: PartOnPage) => void
}) {
  const [links, setLinks] = useState<{ page: number; links: PageLink[] } | null>(null)
  const [parts, setParts] = useState<{ page: number; parts: PartOnPage[] } | null>(null)
  const ordering = !!onPart

  useEffect(() => {
    if (!ordering) return
    let live = true
    book.partNumbers(page).then((found) => live && setParts({ page, parts: found })).catch(() => undefined)
    return () => {
      live = false
    }
  }, [book, page, ordering])

  useEffect(() => {
    let live = true
    book.links(page).then((l) => live && setLinks({ page, links: l })).catch(() => undefined)
    return () => {
      live = false
    }
  }, [book, page])

  const here = links?.page === page ? links.links : []

  return (
    <div
      className={'group relative h-full w-full overflow-hidden bg-white ' + (side === 'only' ? '' : 'cursor-pointer')}
      onClick={side === 'only' || !interactive ? undefined : onTurn}
    >
      <PageImage book={book} page={page} label={label} height={height} />

      {/* The page edge, darker toward the spine like a real book. */}
      {side !== 'only' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              side === 'left'
                ? 'linear-gradient(90deg, rgba(0,0,0,0.04), transparent 12%, transparent 88%, rgba(0,0,0,0.10))'
                : 'linear-gradient(90deg, rgba(0,0,0,0.10), transparent 12%, transparent 88%, rgba(0,0,0,0.04))',
          }}
        />
      )}

      {marks.map((mark, i) => (
        <div
          key={`mark-${i}`}
          aria-hidden
          className={
            'pointer-events-none absolute rounded-[2px] mix-blend-multiply '
            + (mark.active ? 'bg-amber-300/80 ring-2 ring-amber-500' : 'bg-yellow-200/70')
          }
          style={{
            left: `${mark.left * 100}%`,
            top: `${mark.top * 100}%`,
            width: `${mark.width * 100}%`,
            height: `${mark.height * 100}%`,
          }}
        />
      ))}

      {interactive &&
        here.map((link, i) => (
          <button
            key={i}
            type="button"
            title={link.page ? `Go to page ${pageLabel(link.page)}` : link.url}
            aria-label={link.page ? `Go to page ${pageLabel(link.page)}` : `Open ${link.url}`}
            onClick={(e) => {
              e.stopPropagation()
              onLink(link)
            }}
            className="absolute rounded-sm hover:bg-sky-400/20 focus-visible:bg-sky-400/25 focus-visible:outline-2 focus-visible:outline-sky-500"
            style={{
              left: `${link.left * 100}%`,
              top: `${link.top * 100}%`,
              width: `${link.width * 100}%`,
              height: `${link.height * 100}%`,
            }}
          />
        ))}

      {interactive && onPart && parts?.page === page &&
        parts.parts.map((part, i) => (
          <button
            key={`part-${i}`}
            type="button"
            title={`Put ${part.text} on the order`}
            aria-label={`Put ${part.text} on the order`}
            onClick={(e) => {
              e.stopPropagation()
              onPart(part)
            }}
            className="absolute rounded-[2px] outline-amber-500 hover:bg-amber-300/40 hover:outline-2 focus-visible:bg-amber-300/40 focus-visible:outline-2"
            style={{
              left: `${part.box.left * 100}%`,
              top: `${part.box.top * 100}%`,
              width: `${part.box.width * 100}%`,
              height: `${part.box.height * 100}%`,
              cursor: 'copy',
            }}
          />
        ))}

      <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-black/40 px-1.5 text-[10px] tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}

function PageImage({ book, page, label, height }: { book: Book; page: number; label: string; height: number }) {
  const key = Book.key(page, height)
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null)

  useEffect(() => {
    let live = true
    book.render(page, height).then((url) => live && setLoaded({ key, url })).catch(() => undefined)
    return () => {
      live = false
    }
  }, [book, page, height, key])

  // Already painted: show it now rather than one frame of white first.
  const url = book.peek(page, height) ?? (loaded?.key === key ? loaded.url : undefined)

  return url ? (
    <img src={url} alt={`Page ${label}`} draggable={false} className="h-full w-full select-none object-contain" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">{label}</div>
  )
}

/** One side of the turning leaf. */
function Face({
  book,
  page,
  label,
  height,
  back = false,
}: {
  book: Book
  page: number
  label: string
  height: number
  back?: boolean
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-white"
      style={{ backfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : undefined }}
    >
      <PageImage book={book} page={page} label={label} height={height} />
    </div>
  )
}

/**
 * Index tabs down the edge of the book, like the printed ones.
 *
 * A handful read down the tab, the way a printed catalogue's are. A
 * contents grid can give twenty-odd, and twenty-odd titles turned on their
 * side are three letters each -- so past a handful they sit across, short
 * and stacked, and stick out further instead.
 */
function SideTabs({
  tabs,
  active,
  height,
  pageLabel,
  onPick,
}: {
  tabs: DocumentTab[]
  active: number
  height: number
  pageLabel: (page: number) => string
  onPick: (page: number) => void
}) {
  const many = tabs.length > MANY_TABS
  const gap = many ? 2 : 4
  const each = many
    ? Math.max(18, Math.min(30, (height - gap * (tabs.length - 1)) / tabs.length))
    : Math.max(26, Math.min(118, (height - gap * (tabs.length - 1)) / tabs.length))

  return (
    <nav
      aria-label="Tabs"
      className="absolute left-full top-0 flex flex-col overflow-y-auto [scrollbar-width:none]"
      style={{ gap, maxHeight: height }}
    >
      {tabs.map((tab, i) => {
        const color = SWATCH[colorOf(tab, i)]
        const on = i === active
        return (
          <button
            key={`${tab.label}-${tab.page}`}
            type="button"
            title={`${tab.label} — page ${pageLabel(tab.page)}`}
            aria-current={on ? 'true' : undefined}
            onClick={() => onPick(tab.page)}
            className={
              'shrink-0 overflow-hidden rounded-r-md font-semibold tracking-wide shadow-[2px_2px_6px_rgba(0,0,0,0.35)] transition-[width,filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white '
              + (many ? 'px-2 text-left text-[10.5px] leading-none' : 'text-[11px]')
            }
            style={{
              height: each,
              width: many ? (on ? 124 : 112) : on ? 34 : 26,
              background: color.bg,
              color: color.fg,
              filter: on ? undefined : 'saturate(0.85)',
            }}
          >
            <span
              className="block truncate px-0.5"
              style={many ? undefined : { writingMode: 'vertical-rl', maxHeight: each - 6, margin: '0 auto' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** The same tabs across the top, when the screen is too narrow for an edge. */
function TabStrip({ tabs, active, onPick }: { tabs: DocumentTab[]; active: number; onPick: (page: number) => void }) {
  return (
    <nav aria-label="Tabs" className="mb-2 flex max-w-full gap-1.5 overflow-x-auto pb-1">
      {tabs.map((tab, i) => {
        const color = SWATCH[colorOf(tab, i)]
        return (
          <button
            key={`${tab.label}-${tab.page}`}
            type="button"
            aria-current={i === active ? 'true' : undefined}
            onClick={() => onPick(tab.page)}
            className={'shrink-0 rounded-t-md px-2.5 py-1 text-xs font-semibold ' + (i === active ? '' : 'opacity-80')}
            style={{ background: color.bg, color: color.fg }}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-200 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

/**
 * "12–13 of 63", in the book's own numbers, and typing one goes there: the
 * 13 on the bench is the 13 here. When the file counts differently, the
 * file's numbers are in the tooltip for anyone matching it to a printout.
 */
function PageInput({
  label,
  numbers,
  filePages,
  onGo,
}: {
  label: string
  numbers: PageNumbers
  filePages: string
  onGo: (page: number) => void
}) {
  const [text, setText] = useState(label)
  const [missing, setMissing] = useState(false)

  return (
    <form
      className="flex items-center gap-1.5 text-sm tabular-nums text-slate-300"
      title={numbers.differs ? `Page ${filePages} of ${numbers.count} in the file` : undefined}
      onSubmit={(e) => {
        e.preventDefault()
        // "12–13" goes to 12.
        const page = numbers.find(text.split(/[–-]/)[0] ?? '')
        setMissing(page === null)
        if (page !== null) onGo(page)
      }}
    >
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setMissing(false)
        }}
        onFocus={(e) => e.target.select()}
        aria-label="Go to page"
        aria-invalid={missing || undefined}
        className={
          'w-16 rounded border bg-white/5 px-1.5 py-0.5 text-center text-white '
          + (missing ? 'border-amber-400' : 'border-white/15')
        }
      />
      <span>{missing ? 'not in this book' : `of ${numbers.count ? numbers.last : '…'}`}</span>
    </form>
  )
}
