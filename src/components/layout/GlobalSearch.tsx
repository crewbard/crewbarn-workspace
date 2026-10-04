import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import type { ReferenceCard } from '@/lib/referenceCards'
import { catalogsIn, matchCatalogs, openCatalogs } from '@/lib/catalogs'

/**
 * GlobalSearch — a command-palette style search in the top bar. This is the
 * non-AI way to find things: type a name / number and jump straight to a
 * customer, job, or estimate. Available in both layout themes.
 *
 * Renders its own trigger button (light-on-chrome, so it reads on the
 * colored top bar) plus the overlay. Open with the button or Cmd/Ctrl+K;
 * Esc closes; ↑/↓ move; Enter opens the highlighted row.
 *
 * Each entity list endpoint already supports `?q=` server-side search, so
 * we fan out to the three most-used ones in parallel and show the top hits
 * per group. Missing permission on any endpoint just yields no rows there.
 */

interface CustomerHit {
  id: string
  display_name?: string
  business_name?: string
  account_number?: number | string | null
  avatar_preset?: string | null
  avatar_url?: string | null
}
interface JobHit {
  id: string
  title?: string
  work_order_number?: number
  service_customer?: { display_name?: string } | null
}
interface EstimateHit {
  id: string
  estimate_number?: string
  title?: string | null
  status?: string
  customer?: { display_name?: string } | null
}

interface SearchResult {
  kind: 'customer' | 'job' | 'estimate' | 'catalog'
  id: string
  title: string
  subtitle?: string
  avatar_preset?: string | null
  avatar_url?: string | null
}

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  customer: 'Customers',
  job: 'Jobs',
  estimate: 'Estimates',
  catalog: 'Catalogs',
}

function pathFor(r: SearchResult): string {
  if (r.kind === 'customer') return `/customers/${r.id}`
  if (r.kind === 'job') return `/jobs/${r.id}`
  return `/estimates/${r.id}`
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+K opens from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus the input + reset state when opening.
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebounced('')
      setHighlighted(0)
      // next tick so the element exists
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  // Debounce the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220)
    return () => clearTimeout(t)
  }, [query])

  const enabled = debounced.length >= 2
  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    enabled: open && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const enc = encodeURIComponent(debounced)
      const [customers, jobs, estimates, cards] = await Promise.all([
        apiRequest<{ data: CustomerHit[] }>(`/v1/customers?q=${enc}&per_page=5`).catch(
          () => ({ data: [] as CustomerHit[] }),
        ),
        apiRequest<{ data: JobHit[] }>(`/v1/work-orders?q=${enc}&per_page=5`).catch(
          () => ({ data: [] as JobHit[] }),
        ),
        apiRequest<{ data: EstimateHit[] }>(`/v1/estimates?q=${enc}&per_page=5`).catch(
          () => ({ data: [] as EstimateHit[] }),
        ),
        // The catalogues by title: the same list, and the same cached copy, the Alt C launcher reads.
        queryClient.fetchQuery({
          queryKey: ['reference-cards'],
          queryFn: () => apiRequest<{ cards: ReferenceCard[] }>('/v1/reference-cards'),
          staleTime: 60_000,
        }).catch(() => ({ cards: [] as ReferenceCard[] })),
      ])
      return {
        customers: customers.data,
        jobs: jobs.data,
        estimates: estimates.data,
        catalogs: matchCatalogs(catalogsIn(cards.cards), debounced).slice(0, 5),
      }
    },
  })

  // Flatten into an ordered list for keyboard nav.
  const results = useMemo<SearchResult[]>(() => {
    if (!data) return []
    const out: SearchResult[] = []
    for (const c of data.customers ?? []) {
      out.push({
        kind: 'customer',
        id: c.id,
        title: c.display_name || c.business_name || 'Customer',
        subtitle: c.account_number != null ? `Acct #${c.account_number}` : undefined,
        avatar_preset: c.avatar_preset,
        avatar_url: c.avatar_url,
      })
    }
    for (const j of data.jobs ?? []) {
      out.push({
        kind: 'job',
        id: j.id,
        title: j.title || `Job #${j.work_order_number ?? ''}`.trim(),
        subtitle: [
          j.work_order_number != null ? `#${j.work_order_number}` : null,
          j.service_customer?.display_name ?? null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      })
    }
    for (const e of data.estimates ?? []) {
      out.push({
        kind: 'estimate',
        id: e.id,
        title: e.title || `Estimate ${e.estimate_number ?? ''}`.trim(),
        subtitle: [
          e.estimate_number ? `#${e.estimate_number}` : null,
          e.customer?.display_name ?? null,
          e.status ?? null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      })
    }
    for (const c of data.catalogs ?? []) {
      out.push({
        kind: 'catalog',
        id: c.document.id,
        title: c.document.title,
        subtitle: c.card.title !== c.document.title ? c.card.title : undefined,
      })
    }
    return out
  }, [data])

  // Keep highlight in range as results change.
  useEffect(() => {
    setHighlighted((h) => (results.length === 0 ? 0 : Math.min(h, results.length - 1)))
  }, [results])

  function go(r: SearchResult) {
    setOpen(false)
    // A catalogue opens over the page you are on, not on a page of its own.
    if (r.kind === 'catalog') openCatalogs({ documentId: r.id })
    else navigate(pathFor(r))
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[highlighted]
      if (r) go(r)
    }
  }

  // Group consecutive results for display while tracking the flat index.
  let flatIndex = -1

  return (
    <>
      {/* Trigger — light-on-chrome so it reads on the colored top bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-9 h-9 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        title="Search (Ctrl+K)"
        aria-label="Search"
      >
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
          <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
              <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-slate-400 shrink-0">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
                <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search customers, jobs, estimates, catalogs…"
                className="flex-1 py-3.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
              />
              {isFetching && (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 shrink-0"
              >
                Esc
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[55vh] overflow-y-auto py-1">
              {!enabled && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">
                  Type at least 2 characters to search.
                </p>
              )}
              {enabled && !isFetching && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">
                  No matches for “{debounced}”.
                </p>
              )}
              {(['customer', 'job', 'estimate', 'catalog'] as const).map((kind) => {
                const group = results.filter((r) => r.kind === kind)
                if (group.length === 0) return null
                return (
                  <div key={kind} className="mb-1">
                    <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                      {KIND_LABEL[kind]}
                    </div>
                    {group.map((r) => {
                      flatIndex += 1
                      const idx = flatIndex
                      const active = idx === highlighted
                      return (
                        <button
                          key={`${r.kind}-${r.id}`}
                          type="button"
                          onClick={() => go(r)}
                          onMouseEnter={() => setHighlighted(idx)}
                          className={[
                            'w-full text-left px-4 py-2 flex items-center gap-3 transition-colors',
                            active ? 'bg-amber-50' : 'hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {r.kind === 'customer' ? (
                            <Avatar name={r.title} colorKey={r.id} preset={r.avatar_preset} imageUrl={r.avatar_url} size={32} className="shrink-0" />
                          ) : (
                            <KindIcon kind={r.kind} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-navy-900 truncate">
                              {r.title}
                            </span>
                            {r.subtitle && (
                              <span className="block text-xs text-slate-500 truncate">
                                {r.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 flex items-center gap-3">
              <span>↑↓ to navigate</span>
              <span>↵ to open</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function KindIcon({ kind }: { kind: SearchResult['kind'] }) {
  const wrap = 'w-7 h-7 rounded-md flex items-center justify-center shrink-0'
  if (kind === 'customer') {
    return (
      <span className={`${wrap} bg-sky-100 text-sky-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 17a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'catalog') {
    return (
      <span className={`${wrap} bg-slate-100 text-slate-600`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M4 4.5A1.5 1.5 0 015.5 3H16v12H5.5A1.5 1.5 0 004 16.5v-12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4 16.5A1.5 1.5 0 005.5 18H16v-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'job') {
    return (
      <span className={`${wrap} bg-amber-100 text-amber-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <rect x="3" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 6V4.5A1.5 1.5 0 018.5 3h3A1.5 1.5 0 0113 4.5V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  return (
    <span className={`${wrap} bg-emerald-100 text-emerald-700`}>
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
