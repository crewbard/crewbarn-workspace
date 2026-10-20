import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconSearch, IconX } from '@tabler/icons-react'
import { indexCatalog, searchCatalogs, type CatalogHit, type CatalogIndexStatus, type IndexEvent } from '@/lib/catalogIndex'
import { openCatalogs, type Catalog } from '@/lib/catalogs'
import type { Book } from '@/components/magazine/pdfBook'
import type { PartOnPage } from '@/components/magazine/partNumbers'
import './catalogIndexOverlay.css'

/**
 * Reading catalogs for search, shown as it happens.
 *
 * The page being read is on the left, a beam going down it and every part
 * number lighting up where it was found, its price tagged; on the right,
 * how far it has got, how fast, what it has found, and what section of the
 * book it is in. It ends searchable, with a box to try it.
 */

export type IndexJob = { catalog: Pick<Catalog, 'id' | 'title' | 'size_bytes' | 'vendor'>; file?: File; restart?: boolean }

type Phase = 'download' | 'opening' | 'reading' | 'saving' | 'done' | 'error'

type Found = { key: string; code: string; price?: number; line: string; page: string }

type Shown = { page: number; label: string; heading: string | null; url: string; parts: PartOnPage[] }

const PAGE_HEIGHT = 560
const FEED = 7

const n = (v: number) => v.toLocaleString()
const money = (cents: number) => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

export function CatalogIndexOverlay({ jobs, onClose }: { jobs: IndexJob[]; onClose: (finished: number) => void }) {
  const [at, setAt] = useState(0)
  const [phase, setPhase] = useState<Phase>('download')
  const [download, setDownload] = useState<number | null>(0)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(0)
  const [heading, setHeading] = useState<string | null>(null)
  const [parts, setParts] = useState(0)
  const [prices, setPrices] = useState(0)
  const [sections, setSections] = useState(0)
  const [feed, setFeed] = useState<Found[]>([])
  const [shown, setShown] = useState<Shown | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Array<{ title: string; index: CatalogIndexStatus }>>([])

  const control = useRef<AbortController | null>(null)
  const book = useRef<Book | null>(null)
  // The last few pages read, with their parts, for the page on show.
  const pages = useRef(new Map<number, { label: string; heading: string | null; parts: PartOnPage[] }>())
  const latest = useRef(0)
  const drawing = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    control.current = controller
    let session = { from: 1, startedAt: 0 }
    const headings = new Set<string>()

    const on = (e: IndexEvent) => {
      switch (e.type) {
        case 'download':
          setPhase('download')
          setDownload(e.fraction)
          break
        case 'opening':
          setPhase('opening')
          break
        case 'start':
          book.current = e.book
          session = { from: e.from, startedAt: performance.now() }
          setPhase(e.from > e.pageCount ? 'saving' : 'reading')
          setPageCount(e.pageCount)
          setPage(e.from - 1)
          setParts(e.index.parts_found)
          setPrices(e.index.prices_found)
          break
        case 'page': {
          const priced = e.parts.filter((p) => p.price !== undefined && p.price > 0).length
          setPage(e.page)
          setParts((v) => v + e.parts.length)
          setPrices((v) => v + priced)
          if (e.heading) {
            setHeading(e.heading)
            headings.add(e.heading.toLowerCase())
            setSections(headings.size)
          }
          if (e.parts.length > 0) {
            const fresh = e.parts.slice(0, 3).map((p, i) => ({ key: `${e.page}-${i}-${p.text}`, code: p.text, price: p.price, line: p.line, page: e.label }))
            setFeed((f) => [...fresh.reverse(), ...f].slice(0, FEED))
          }
          pages.current.set(e.page, { label: e.label, heading: e.heading, parts: e.parts })
          if (pages.current.size > 12) pages.current.delete(pages.current.keys().next().value as number)
          latest.current = e.page
          const elapsed = (performance.now() - session.startedAt) / 1000
          if (elapsed > 1.5) setRate((e.page - session.from + 1) / elapsed)
          break
        }
        case 'saved':
          // The server's count is the true one; it catches up a batch behind.
          setParts((v) => Math.max(v, e.index.parts_found))
          setPrices((v) => Math.max(v, e.index.prices_found))
          break
        case 'done':
          setParts(e.index.parts_found)
          setPrices(e.index.prices_found)
          break
      }
    }

    const run = async () => {
      // Off the effect's own tick: state is only set from here on.
      await Promise.resolve()
      for (let i = 0; i < jobs.length; i++) {
        if (controller.signal.aborted) return
        const job = jobs[i]
        setAt(i)
        setPhase('download')
        setDownload(job.file ? 1 : 0)
        setShown(null)
        setFeed([])
        setHeading(null)
        setSections(0)
        setRate(null)
        pages.current.clear()
        headings.clear()
        latest.current = 0
        try {
          const index = await indexCatalog(job.catalog, { file: job.file, restart: job.restart, signal: controller.signal, onEvent: on })
          setResults((r) => [...r, { title: job.catalog.title, index }])
        } catch (e) {
          if (controller.signal.aborted) return
          setError(`${job.catalog.title}: ${e instanceof Error ? e.message : 'it could not be read.'}`)
          setPhase('error')
          return
        }
      }
      setPhase('done')
    }
    void run()

    return () => controller.abort()
  }, [jobs])

  // The page on show follows the reader, a few times a second, without holding it up.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const b = book.current
      const want = latest.current
      if (!b || drawing.current || want === 0 || want === shown?.page) return
      const read = pages.current.get(want)
      if (!read) return
      drawing.current = true
      b.render(want, PAGE_HEIGHT)
        .then((url) => setShown({ page: want, label: read.label, heading: read.heading, url, parts: read.parts }))
        .catch(() => {})
        .finally(() => {
          drawing.current = false
        })
    }, 280)
    return () => window.clearInterval(timer)
  }, [shown?.page])

  const job = jobs[at]
  const reading = phase === 'reading' || phase === 'saving'
  const pct = phase === 'done' ? 100 : pageCount > 0 ? Math.min(100, Math.round((page / pageCount) * 100)) : 0
  const left = rate && pageCount > page ? Math.round((pageCount - page) / rate) : null
  const finishedPages = results.reduce((s, r) => s + r.index.pages_done, 0)
  const finishedParts = results.reduce((s, r) => s + r.index.parts_found, 0)
  const finishedPrices = results.reduce((s, r) => s + r.index.prices_found, 0)

  const stop = () => {
    control.current?.abort()
    onClose(results.length)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cix-title">
      <div className="grid max-h-full w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl bg-navy-900 text-white shadow-2xl ring-1 ring-white/10 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:grid-rows-1">
        {/* The page being read. */}
        <div className="cix-grid relative flex min-h-56 items-center justify-center overflow-hidden px-6 py-6 md:min-h-[600px]">
          {phase === 'done' ? (
            <svg className="cix-check h-28 w-28 text-emerald-400" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="28" cy="28" r="26" />
              <path d="M17 29l7 7 15-16" />
            </svg>
          ) : shown ? (
            <figure className="m-0 flex flex-col items-center gap-3">
              <div className="relative h-52 md:h-[480px]">
                <div className="cix-sheet translate-x-3 translate-y-3 rotate-3 opacity-25" />
                <div className="cix-sheet translate-x-1.5 translate-y-1.5 rotate-[1.5deg] opacity-45" />
                <div className="relative h-full overflow-hidden rounded bg-white shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                  <img key={shown.page} src={shown.url} alt={`Page ${shown.label}`} className="cix-page-in block h-full w-auto" />
                  {shown.parts.slice(0, 80).map((p, i) => (
                    <span
                      key={`${shown.page}-${i}`}
                      className="cix-hit"
                      style={{
                        // A little room around the number, so the mark reads at this size.
                        left: `calc(${p.box.left * 100}% - 3px)`,
                        top: `calc(${p.box.top * 100}% - 2px)`,
                        width: `calc(${Math.max(p.box.width * 100, 1.5)}% + 6px)`,
                        height: `calc(${Math.max(p.box.height * 100, 1.2)}% + 4px)`,
                        animationDelay: `${Math.min(i * 28, 900)}ms`,
                      }}
                    />
                  ))}
                  {reading && <div className="cix-beam" />}
                </div>
              </div>
              <figcaption className="flex max-w-full items-center gap-2 text-xs text-navy-200">
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium tabular-nums text-white">p. {shown.label}</span>
                {shown.heading && <span className="truncate uppercase tracking-[0.12em]">{shown.heading}</span>}
                <span className="tabular-nums text-amber-300">{shown.parts.length} found</span>
              </figcaption>
            </figure>
          ) : (
            <div className="flex flex-col items-center gap-4 text-navy-200">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                  <circle
                    cx="18" cy="18" r="16" fill="none" stroke="rgb(251,191,36)" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray="100.5" strokeDashoffset={100.5 * (1 - (download ?? 0.15))}
                    style={{ transition: 'stroke-dashoffset 0.3s' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-white">
                  {phase === 'download' && download !== null ? `${Math.round(download * 100)}%` : '…'}
                </span>
              </div>
              <p className="text-sm">{phase === 'download' ? 'Fetching the book' : 'Opening the book'}</p>
            </div>
          )}
        </div>

        {/* What it has found. */}
        <div className="flex min-h-0 flex-col overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              {phase !== 'done' && phase !== 'error' && <span className="cix-pulse inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />}
              {phase === 'done' ? 'Searchable now' : 'Reading for search'}
              {jobs.length > 1 && <span className="text-navy-300">· {Math.min(at + 1, jobs.length)} of {jobs.length}</span>}
            </p>
            <button type="button" onClick={stop} aria-label="Close" className="rounded-md p-1 text-navy-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              <IconX size={18} />
            </button>
          </div>

          {phase === 'done' ? (
            <Finished
              pages={finishedPages}
              parts={finishedParts}
              prices={finishedPrices}
              titles={results.map((r) => r.title)}
              onOpen={(hit) => {
                openCatalogs({ documentId: hit.document_id, page: hit.page })
                onClose(results.length)
              }}
              onDone={() => onClose(results.length)}
            />
          ) : (
            <>
              <h2 id="cix-title" className="mt-2 text-2xl font-semibold [text-wrap:balance]">{job?.catalog.title}</h2>
              {job?.catalog.vendor && <p className="text-sm text-navy-300">{job.catalog.vendor}</p>}

              <p className="mt-4 min-h-5 text-sm text-navy-200">
                {phase === 'error' ? <span className="text-red-300">{error}</span>
                  : phase === 'download' ? 'Fetching the book to read it here…'
                  : phase === 'opening' ? 'Opening the book…'
                  : phase === 'saving' ? 'Saving the last pages…'
                  : <>Reading page <span className="tabular-nums text-white">{n(page)}</span> of <span className="tabular-nums">{n(pageCount)}</span>{heading && <> · <span className="text-amber-200">{heading}</span></>}</>}
              </p>
              <p className="sr-only" aria-live="polite">{Math.floor(pct / 10) * 10}% read</p>

              <div className="mt-5 flex items-end justify-between gap-4">
                <p className="text-6xl font-semibold leading-none tabular-nums">{pct}<span className="text-2xl text-navy-300">%</span></p>
                <p className="pb-1 text-right text-xs leading-5 text-navy-300">
                  {rate ? <>{rate.toFixed(rate < 10 ? 1 : 0)} pages a second<br /></> : null}
                  {left !== null ? (left > 90 ? `about ${Math.round(left / 60)} min left` : `about ${Math.max(1, left)} s left`) : ' '}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-300" style={{ width: `${pct}%` }}>
                  {reading && <div className="cix-sheen h-full w-full" />}
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ['Part numbers', parts],
                  ['Prices', prices],
                  ['Sections', sections],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-navy-300">{label}</dt>
                    <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{n(value as number)}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 min-h-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-300">Just found</p>
                {feed.length === 0 ? (
                  <p className="mt-2 text-sm text-navy-400">Part numbers show here as they turn up.</p>
                ) : (
                  <ul className="mt-2 list-none space-y-1.5 p-0">
                    {feed.map((f) => (
                      <li key={f.key} className="cix-feed-in flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-1.5">
                        <span className="shrink-0 font-mono text-sm text-amber-100">{f.code}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-navy-300">{f.line}</span>
                        {f.price ? (
                          <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-300">{money(f.price)}</span>
                        ) : null}
                        <span className="shrink-0 text-[11px] tabular-nums text-navy-400">p. {f.page}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="max-w-sm text-xs text-navy-300">
                  It reads in this tab. Close it and it carries on from page {n(Math.max(1, page))} next time.
                </p>
                <button type="button" onClick={stop} className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-100 ring-1 ring-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                  {phase === 'error' ? 'Close' : 'Stop'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Done: what was read, and a box to try it. */
function Finished({ pages, parts, prices, titles, onOpen, onDone }: {
  pages: number
  parts: number
  prices: number
  titles: string[]
  onOpen: (hit: CatalogHit) => void
  onDone: () => void
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<CatalogHit[] | null>(null)
  const [busy, setBusy] = useState(false)

  const search = async () => {
    if (q.trim().length < 2) return
    setBusy(true)
    try {
      setHits((await searchCatalogs(q.trim(), { limit: 6 })).hits)
    } catch {
      setHits([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 flex flex-1 flex-col">
      <h2 id="cix-title" className="text-2xl font-semibold [text-wrap:balance]">
        {titles.length === 1 ? `${titles[0]} is searchable` : `${titles.length} catalogs are searchable`}
      </h2>
      <p className="mt-2 text-sm text-navy-200">
        <span className="tabular-nums text-white">{n(pages)}</span> pages read · <span className="tabular-nums text-white">{n(parts)}</span> part numbers ·{' '}
        <span className="tabular-nums text-white">{n(prices)}</span> prices. Search finds them from the Catalogs page, and blueprints price from them.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); void search() }} className="mt-6 flex items-center gap-2 rounded-xl bg-white/5 px-3 ring-1 ring-white/15 focus-within:ring-amber-300">
        <IconSearch size={18} className="shrink-0 text-navy-300" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try it: a part number, or words like “satin closer”"
          aria-label="Search inside the catalogs"
          className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-navy-400 focus:outline-none"
        />
        <button type="submit" disabled={busy || q.trim().length < 2} className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-navy-900 hover:bg-amber-300 disabled:opacity-40">
          Find
        </button>
      </form>

      {hits !== null && (
        <ul className="mt-3 list-none space-y-1.5 p-0">
          {hits.length === 0 && <li className="text-sm text-navy-300">Nothing found for that.</li>}
          {hits.map((h) => (
            <li key={`${h.document_id}-${h.page}`}>
              <button type="button" onClick={() => onOpen(h)} className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-left hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                <span className="flex items-center gap-2 text-xs text-navy-300">
                  <span className="truncate">{h.title}</span>
                  <span className="shrink-0 tabular-nums">p. {h.page_label}</span>
                  {h.heading && <span className="truncate uppercase tracking-wider">{h.heading}</span>}
                  {h.part?.price_cents ? <span className="ml-auto shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 tabular-nums text-emerald-300">{money(h.part.price_cents)}</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-sm text-white"><Marked text={h.snippet ?? h.part?.code ?? ''} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex justify-end pt-6">
        <button type="button" onClick={onDone} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          Done
        </button>
      </div>
    </div>
  )
}

/** A snippet with the words it matched («like this») marked. */
export function Marked({ text, className }: { text: string; className?: string }) {
  const bits = text.split(/«|»/)
  return (
    <span className={className}>
      {bits.map((b, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-amber-300/30 px-0.5 text-inherit">{b}</mark> : <span key={i}>{b}</span>))}
    </span>
  )
}
