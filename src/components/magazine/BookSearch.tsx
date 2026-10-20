import { useEffect, useRef, useState } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import type { Book, Box, SearchHit } from './pdfBook'
import { useBookFind } from './useBookFind'

/**
 * A place lit up on the page: what Find and the parts cart found. The one
 * open now is amber and pulses a few times, then stays lit; when the page
 * is zoomed in, it is scrolled to.
 */
export function FoundMark({ box, active, scroll = false }: { box: Box; active: boolean; scroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (scroll) el.scrollIntoView({ block: 'center', inline: 'center', behavior: still ? 'auto' : 'smooth' })
    if (still || typeof el.animate !== 'function') return
    const pulse = el.animate(
      [
        { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.85)', backgroundColor: 'rgba(252, 211, 77, 0.95)' },
        { boxShadow: '0 0 0 14px rgba(245, 158, 11, 0)', backgroundColor: 'rgba(252, 211, 77, 0.55)' },
      ],
      { duration: 650, iterations: 3, easing: 'ease-out' },
    )
    return () => pulse.cancel()
  }, [active, scroll, box.left, box.top])

  return (
    <div
      ref={ref}
      aria-hidden
      data-found={active ? 'active' : 'other'}
      className={
        'pointer-events-none absolute rounded-[3px] mix-blend-multiply '
        + (active ? 'z-[1] bg-amber-300/70 outline outline-2 outline-offset-1 outline-amber-500' : 'bg-yellow-200/70')
      }
      style={{
        left: `${box.left * 100}%`,
        top: `${box.top * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
      }}
    />
  )
}

/**
 * Find in this book.
 *
 * A parts catalogue is looked things up in, not read: a part number off a
 * fob, a model, a keyway. So the box searches every page as you type, the
 * hits arrive while it is still reading, and each one opens its page with
 * the line lit up.
 *
 * Only finds what the PDF has as text. A scanned page is a picture, and
 * the panel says how many pages it read so an empty result is not taken
 * for "it is not in there".
 */
export function BookSearch({
  book,
  activeHit,
  pageLabel,
  onHits,
  onPick,
  onOrder,
  actionLabel = 'Order',
  onClose,
}: {
  book: Book
  activeHit: number | null
  /** The number printed on a page, which is what the results show. */
  pageLabel: (page: number) => string
  onHits: (hits: SearchHit[]) => void
  onPick: (index: number) => void
  /** Put what was searched for on the order, from this hit's page. */
  onOrder?: (partNumber: string, hit: SearchHit) => void
  actionLabel?: 'Order' | 'Line'
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const { hits, readTo, running } = useBookFind(book, query, { onFound: onHits })

  const pages = new Set(hits.map((hit) => hit.page)).size
  // A part number was searched for, or one sits at the hit: it can go on the order.
  const typedCode = /\d/.test(query) ? query.trim() : null
  const codeOf = (hit: SearchHit) => (onOrder ? hit.part?.text ?? typedCode : null)

  return (
    <aside
      aria-label="Find in this book"
      data-tour="book-search"
      className="flex h-full w-[min(22rem,100vw)] shrink-0 flex-col border-l border-white/10 bg-white text-slate-900"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
        <IconSearch size={18} className="shrink-0 text-slate-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits.length > 0) {
              e.preventDefault()
              onPick(activeHit === null ? 0 : (activeHit + (e.shiftKey ? hits.length - 1 : 1)) % hits.length)
            }
          }}
          placeholder="Part number, model, name…"
          aria-label="Find in this book"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <IconX size={16} />
        </button>
      </div>

      <p className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500" aria-live="polite">
        {query.trim().length < 2
          ? 'Dashes and spaces in part numbers do not matter: 95440S9610 finds 95440-S9610.'
          : running
            ? `Reading page ${readTo || 1} of ${book.pageCount}… ${hits.length} found so far`
            : hits.length === 0
              ? `Not found in the text of ${book.pageCount} pages. A scanned page is a picture and cannot be searched.`
              : `${hits.length}${hits.length >= 300 ? '+' : ''} found on ${pages} ${pages === 1 ? 'page' : 'pages'}. Enter for the next.`}
      </p>

      <ol className="m-0 flex-1 list-none overflow-y-auto p-0">
        {hits.map((hit, i) => {
          const orderable = codeOf(hit)
          return (
            <li key={`${hit.page}-${i}`} className="relative">
              {orderable && (
                <button
                  type="button"
                  onClick={() => onOrder?.(orderable, hit)}
                  title={`Add ${orderable} to ${actionLabel.toLowerCase()}`}
                  className="absolute right-2 top-1.5 z-10 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-50"
                >
                  + {actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={i === activeHit ? 'true' : undefined}
                className={
                  'flex w-full items-baseline gap-2.5 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-sky-50 '
                  + (i === activeHit ? 'bg-amber-50 ' : '')
                  + (orderable ? 'pr-16' : '')
                }
              >
                <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">p. {pageLabel(hit.page)}</span>
                <span className="min-w-0 break-words font-mono text-[12.5px] text-slate-800">{hit.text}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
