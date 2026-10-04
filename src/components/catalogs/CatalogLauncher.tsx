import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IconBook2, IconSearch } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import type { ReferenceCard } from '@/lib/referenceCards'
import { formatSize } from '@/lib/referenceCardDocuments'
import type { EstimateContext } from '@/lib/catalogOrders'
import { OpenDocument } from '@/components/magazine/OpenDocument'
import {
  CATALOG_SHORTCUT_LABEL,
  catalogsIn,
  isCatalogShortcut,
  lastCatalogPage,
  matchCatalogs,
  onOpenCatalogs,
  recentCatalogIds,
  type Catalog,
} from '@/lib/catalogs'

const CARDS_KEY = ['reference-cards']
const loadCards = () => apiRequest<{ cards: ReferenceCard[] }>('/v1/reference-cards')

/**
 * Catalogues, from anywhere: Alt C, or the book in the header.
 *
 * Every PDF on every reference card, the ones used last at the top, each
 * opening at the page it was left on. Type to narrow; Enter opens the
 * first. Mounted once per shell -- the work app's top bar and Connect's
 * header -- and anything else can open it with openCatalogs().
 */
export function CatalogLauncher({ tone = 'chrome' }: { tone?: 'chrome' | 'light' }) {
  const { has } = usePermissions()
  const allowed = has(PERM.CATALOG_VIEW)
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [reading, setReading] = useState<{ catalog: Catalog; page?: number } | null>(null)
  // Opened from an estimate: everything opened from here orders for it, until closed.
  const [estimate, setEstimate] = useState<EstimateContext | undefined>(undefined)

  const cards = useQuery({
    queryKey: CARDS_KEY,
    queryFn: loadCards,
    enabled: allowed && open,
    staleTime: 60_000,
  })
  const catalogs = useMemo(() => catalogsIn(cards.data?.cards ?? []), [cards.data])

  useEffect(() => {
    if (!allowed) return
    const onKey = (e: KeyboardEvent) => {
      if (!isCatalogShortcut(e)) return
      e.preventDefault()
      setOpen((was) => !was)
    }
    window.addEventListener('keydown', onKey)
    // One catalogue asked for by id opens straight away; gone since, the list does.
    const stop = onOpenCatalogs(({ documentId, page, estimate: forEstimate }) => {
      setEstimate(forEstimate)
      if (!documentId) {
        setOpen(true)
        return
      }
      qc.fetchQuery({ queryKey: CARDS_KEY, queryFn: loadCards, staleTime: 60_000 })
        .then((data) => {
          const catalog = catalogsIn(data.cards).find((c) => c.document.id === documentId)
          setOpen(!catalog)
          if (catalog) setReading({ catalog, page })
        })
        .catch(() => setOpen(true))
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      stop()
    }
  }, [allowed, qc])

  if (!allowed) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Catalogs (${CATALOG_SHORTCUT_LABEL})`}
        aria-label="Catalogs"
        aria-keyshortcuts="Alt+C"
        className={
          tone === 'chrome'
            ? 'flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white'
            : 'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-amber-500'
        }
      >
        <IconBook2 size={tone === 'chrome' ? 20 : 17} stroke={1.75} />
        {tone === 'light' && <span className="hidden sm:inline">Catalogs</span>}
      </button>

      {open && (
        <Picker
          catalogs={catalogs}
          estimate={estimate}
          loading={cards.isPending}
          failed={cards.isError}
          canUpload={has(PERM.CATALOG_EDIT)}
          onPick={(catalog) => {
            setOpen(false)
            setReading({ catalog })
          }}
          onClose={() => {
            setOpen(false)
            // Nothing open for the estimate any more: Alt C is the shop's catalogues again.
            if (!reading) setEstimate(undefined)
          }}
        />
      )}

      {reading && (
        <OpenDocument
          key={reading.catalog.document.id}
          cardId={reading.catalog.card.id}
          document={reading.catalog.document}
          canEdit={has(PERM.CATALOG_EDIT) && reading.catalog.card.mine && reading.catalog.card.status !== 'approved'}
          initialPage={reading.page}
          estimate={estimate}
          onClose={() => {
            setReading(null)
            setEstimate(undefined)
          }}
          onTabsSaved={() => void qc.invalidateQueries({ queryKey: ['reference-cards'] })}
        />
      )}
    </>
  )
}

function Picker({
  catalogs,
  estimate,
  loading,
  failed,
  canUpload,
  onPick,
  onClose,
}: {
  catalogs: Catalog[]
  estimate?: EstimateContext
  loading: boolean
  failed: boolean
  canUpload: boolean
  onPick: (catalog: Catalog) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  /*
   * Recent first, then the rest by title. Searching drops the split: the
   * one that matches is the one wanted, wherever it was.
   */
  const { recent, rest } = useMemo(() => {
    const found = matchCatalogs(catalogs, query)
    if (query.trim()) return { recent: [] as Catalog[], rest: found }
    const ids = recentCatalogIds()
    const recent = ids.flatMap((id) => found.filter((c) => c.document.id === id))
    return { recent, rest: found.filter((c) => !ids.includes(c.document.id)) }
  }, [catalogs, query])
  const rows = [...recent, ...rest]

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      // Only this: a book open behind it stays open.
      e.stopPropagation()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, Math.max(rows.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[cursor]
      if (row) onPick(row)
    }
  }

  const row = (catalog: Catalog, index: number) => {
    const page = lastCatalogPage(catalog.document.id)
    const tabs = catalog.document.tabs.length
    return (
      <li key={catalog.document.id}>
        <button
          type="button"
          onClick={() => onPick(catalog)}
          onMouseEnter={() => setCursor(index)}
          aria-current={index === cursor ? 'true' : undefined}
          className={
            'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors '
            + (index === cursor ? 'bg-amber-50' : 'hover:bg-slate-50')
          }
        >
          <span className="flex h-9 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-gradient-to-r from-slate-200 to-white text-slate-500 shadow-[1px_1px_0_rgba(0,0,0,0.08)]">
            <IconBook2 size={14} stroke={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-navy-900">{catalog.document.title}</span>
            <span className="block truncate text-xs text-slate-500">
              {[
                catalog.card.title !== catalog.document.title ? catalog.card.title : null,
                tabs > 0 ? `${tabs} ${tabs === 1 ? 'tab' : 'tabs'}` : null,
                formatSize(catalog.document.size_bytes),
              ].filter(Boolean).join(' · ')}
            </span>
          </span>
          {page !== null && page > 1 && (
            <span className="shrink-0 text-[11px] text-slate-400" title="Opens where you left it">
              left open
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    // Above an open book, so Alt C swaps one catalogue for another.
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Catalogs">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
          <IconSearch size={18} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Find a catalog…"
            aria-label="Find a catalog"
            className="flex-1 bg-transparent py-3.5 text-sm placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
            {CATALOG_SHORTCUT_LABEL}
          </kbd>
        </div>

        {estimate && (
          <p className="border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs text-sky-900">
            Ordering for estimate {estimate.number}{estimate.title ? ` · ${estimate.title}` : ''}. Parts picked go on the estimate and its order.
          </p>
        )}

        <div className="max-h-[55vh] overflow-y-auto py-1">
          {loading && <p className="px-4 py-6 text-center text-sm text-slate-400">Loading catalogs…</p>}
          {failed && <p className="px-4 py-6 text-center text-sm text-slate-500">The catalogs could not be loaded. Try again in a moment.</p>}
          {!loading && !failed && catalogs.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              No catalogs yet. A PDF added to a reference card shows up here.
            </p>
          )}
          {!loading && catalogs.length > 0 && rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No catalog matches “{query.trim()}”.</p>
          )}

          {recent.length > 0 && (
            <>
              <h3 className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Opened lately</h3>
              <ul className="m-0 list-none p-0">{recent.map((c, i) => row(c, i))}</ul>
            </>
          )}
          {rest.length > 0 && (
            <>
              {recent.length > 0 && (
                <h3 className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">All catalogs</h3>
              )}
              <ul className="m-0 list-none p-0">{rest.map((c, i) => row(c, recent.length + i))}</ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <Link to="/catalog/products" onClick={onClose} className="font-medium text-sky-700 hover:underline">Products</Link>
          <Link to="/catalog/services" onClick={onClose} className="font-medium text-sky-700 hover:underline">Services</Link>
          {canUpload && (
            <Link to="/reference-cards" onClick={onClose} className="font-medium text-sky-700 hover:underline">Add a catalog</Link>
          )}
          <span className="grow" />
          <span className="text-slate-400">↑↓ to move · ↵ to open · Esc to close</span>
        </div>
      </div>
    </div>
  )
}
