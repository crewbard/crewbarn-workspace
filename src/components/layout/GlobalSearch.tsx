import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiRequest } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import { CATALOGS_KEY, loadCatalogs, matchCatalogs, openCatalogs, type Catalog } from '@/lib/catalogs'
import { aiHelpAvailable, openAiHelp } from '@/lib/aiHelp'
import { OPEN_PALETTE_EVENT } from '@/lib/shortcutBus'
import { SHORTCUTS, firstOpenRoute } from '@/lib/shortcuts'
import { allEntries, canSeeEntry } from '@/connect/sections'
import { CONNECT_URL, isCompanySetting } from '@/lib/workspaceScope'
import { useShortcutLabel } from '@/hooks/useShortcuts'
import { usePermissions } from '@/hooks/usePermissions'
import { useModuleVisibility } from '@/hooks/useModuleVisibility'
import { useSettingsInWorkspace } from '@/hooks/useSettingsInWorkspace'

/**
 * GlobalSearch — the command palette in the top bar. The non-AI way to
 * find things: type a name or number and jump straight to a customer,
 * job, estimate, invoice, catalog, page or setting. The last row hands
 * what was typed to CBI instead. Available in every layout.
 *
 * Renders its own trigger button (light-on-chrome, so it reads on the
 * colored top bar) plus the overlay. Opens with the button or the Search
 * everything shortcut (Ctrl/⌘ K unless the person changed it; the keyboard
 * shortcuts send OPEN_PALETTE_EVENT). Esc closes; ↑/↓ move; Enter opens
 * the highlighted row.
 *
 * Each record list endpoint already supports `?q=` server-side search, so
 * we fan out to them in parallel and show the top hits per group. Missing
 * permission on any endpoint just yields no rows there. Pages and settings
 * are matched here, from the same lists the menus are built from.
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

interface InvoiceHit {
  id: string
  display_number?: string | null
  status?: string
  customer?: { display_name?: string } | null
  work_order?: { title?: string | null } | null
}

interface MessageHit {
  id: string
  customer_name?: string | null
  external_number?: string | null
  external_email?: string | null
  subject?: string | null
  last_message_preview?: string | null
}

interface FileHit {
  id: string
  title: string
  subtitle: string
  to: string
}

interface SearchResult {
  kind: 'customer' | 'job' | 'estimate' | 'invoice' | 'message' | 'file' | 'catalog' | 'page' | 'setting' | 'cbi'
  id: string
  title: string
  subtitle?: string
  avatar_preset?: string | null
  avatar_url?: string | null
  /** Pages and settings: where it goes. */
  to?: string
  /** A setting that lives on Connect: opens there, in a new tab. */
  external?: boolean
}

const KIND_ORDER: SearchResult['kind'][] = ['customer', 'job', 'estimate', 'invoice', 'message', 'file', 'catalog', 'page', 'setting', 'cbi']

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  customer: 'Customers',
  job: 'Jobs',
  estimate: 'Estimates',
  invoice: 'Invoices',
  message: 'Messages',
  file: 'Files',
  catalog: 'Catalogs',
  page: 'Pages',
  setting: 'Settings',
  cbi: 'CBI',
}

function pathFor(r: SearchResult): string {
  if (r.to) return r.to
  if (r.kind === 'customer') return `/customers/${r.id}`
  if (r.kind === 'job') return `/jobs/${r.id}`
  if (r.kind === 'invoice') return `/invoices/${r.id}`
  return `/estimates/${r.id}`
}

/** Pages anyone may look for here, beyond the Go to and New shortcuts. */
const EXTRA_PAGES: Array<{ id: string; label: string; to: string; words?: string }> = [
  { id: 'keyboard-shortcuts', label: 'Keyboard shortcuts', to: '/me/keyboard-shortcuts', words: 'keys hotkeys' },
  { id: 'my-account', label: 'My account', to: '/me/account', words: 'password profile photo' },
  { id: 'my-time-off', label: 'My time off', to: '/my-time-off', words: 'vacation holiday' },
  { id: 'feedback', label: 'Bugs & Ideas', to: '/feedback', words: 'feedback report problem' },
]

/** Every word typed is somewhere in the text. */
function matchesWords(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  const hay = text.toLowerCase()
  return words.every((w) => hay.includes(w))
}

export function GlobalSearch({ prominent = false }: { prominent?: boolean } = {}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyLabel = useShortcutLabel('palette')
  const { has, hasAny } = usePermissions()
  const { isRouteVisibleInWork } = useModuleVisibility()
  const { show: settingsInWorkspace } = useSettingsInWorkspace()

  // The Search everything shortcut (Ctrl/⌘ K unless changed) opens it from anywhere.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
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
      // One source failing must not sink the rest, so each still falls back
      // to nothing — but a failure is noted, so an empty group isn't passed
      // off as "no matches". No permission or plan (403/402) isn't a failure.
      const failed = new Set<SearchResult['kind']>()
      const orEmpty = <T,>(kind: SearchResult['kind'], request: Promise<T>, empty: T): Promise<T> =>
        request.catch((e: unknown) => {
          if (!(e instanceof ApiError && (e.status === 403 || e.status === 402))) failed.add(kind)
          return empty
        })
      const [customers, jobs, estimates, invoices, messages, files, books] = await Promise.all([
        orEmpty('customer', apiRequest<{ data: CustomerHit[] }>(`/v1/customers?q=${enc}&per_page=5`), { data: [] }),
        orEmpty('job', apiRequest<{ data: JobHit[] }>(`/v1/work-orders?q=${enc}&per_page=5`), { data: [] }),
        orEmpty('estimate', apiRequest<{ data: EstimateHit[] }>(`/v1/estimates?q=${enc}&per_page=5`), { data: [] }),
        orEmpty('invoice', apiRequest<{ data: InvoiceHit[] }>(`/v1/invoices?q=${enc}&per_page=5`), { data: [] }),
        orEmpty(
          'message',
          apiRequest<{ data: MessageHit[] }>(`/v1/comms/conversations?q=${enc}&include_linked=1&limit=5`),
          { data: [] },
        ),
        orEmpty('file', apiRequest<{ data: FileHit[] }>(`/v1/search/files?q=${enc}`), { data: [] }),
        // The catalogues by title: the same list, and the same cached copy, the Alt C launcher reads.
        orEmpty(
          'catalog',
          queryClient.fetchQuery({
            queryKey: CATALOGS_KEY,
            queryFn: loadCatalogs,
            staleTime: 60_000,
          }),
          { catalogs: [] as Catalog[] },
        ),
      ])
      return {
        failed: KIND_ORDER.filter((k) => failed.has(k)).map((k) => KIND_LABEL[k].toLowerCase()),
        customers: customers.data,
        jobs: jobs.data,
        estimates: estimates.data,
        invoices: invoices.data,
        messages: messages.data,
        files: files.data,
        catalogs: matchCatalogs(books.catalogs, debounced).slice(0, 5),
      }
    },
  })

  const failedSources = data?.failed ?? []

  // Pages and settings are matched here, as you type.
  const typed = query.trim()
  const pagesAndSettings = useMemo<SearchResult[]>(() => {
    if (!typed) return []
    const out: SearchResult[] = []
    const canOpen = (r: { to: string; anyOf?: string[] }) =>
      (!r.anyOf || r.anyOf.length === 0 || hasAny(r.anyOf)) && isRouteVisibleInWork(r.to.split('?')[0])
    const pages = [
      ...SHORTCUTS.filter((s) => s.group === 'goto' || s.group === 'new').map((s) => ({
        id: s.id, label: s.label, to: firstOpenRoute(s, canOpen), words: s.page ?? '',
      })),
      ...EXTRA_PAGES,
    ]
    for (const p of pages) {
      if (!p.to || !matchesWords(`${p.label} ${p.words ?? ''}`, typed)) continue
      out.push({ kind: 'page', id: p.id, title: p.label, to: p.to })
      if (out.length >= 5) break
    }
    let settings = 0
    for (const e of allEntries()) {
      if (settings >= 5) break
      if (!canSeeEntry(e, has)) continue
      if (!matchesWords([e.label, e.blurb ?? '', e.group ?? '', e.sectionLabel, ...(e.keywords ?? [])].join(' '), typed)) continue
      const onConnectOnly = isCompanySetting(e.to.split('#')[0].split('?')[0]) && !settingsInWorkspace
      out.push({
        kind: 'setting',
        id: `${e.section}:${e.to}`,
        title: e.label,
        subtitle: onConnectOnly ? `${e.sectionLabel} · opens on Connect` : e.sectionLabel,
        to: onConnectOnly ? `${CONNECT_URL}${e.to}` : e.to,
        external: onConnectOnly,
      })
      settings += 1
    }
    return out
    // has / hasAny / isRouteVisibleInWork are new functions each render; the
    // inputs they read are what changes, and typing re-runs this anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, settingsInWorkspace])

  // Flatten into an ordered list for keyboard nav (same order as drawn).
  const results = useMemo<SearchResult[]>(() => {
    const out: SearchResult[] = []
    for (const c of data?.customers ?? []) {
      out.push({
        kind: 'customer',
        id: c.id,
        title: c.display_name || c.business_name || 'Customer',
        subtitle: c.account_number != null ? `Acct #${c.account_number}` : undefined,
        avatar_preset: c.avatar_preset,
        avatar_url: c.avatar_url,
      })
    }
    for (const j of data?.jobs ?? []) {
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
    for (const e of data?.estimates ?? []) {
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
    for (const inv of data?.invoices ?? []) {
      out.push({
        kind: 'invoice',
        id: inv.id,
        title: inv.work_order?.title || `Invoice ${inv.display_number ?? ''}`.trim(),
        subtitle: [
          inv.display_number ? `#${inv.display_number}` : null,
          inv.customer?.display_name ?? null,
          inv.status ?? null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      })
    }
    for (const message of data?.messages ?? []) {
      out.push({
        kind: 'message',
        id: message.id,
        title: message.customer_name || message.subject || message.external_number || message.external_email || 'Conversation',
        subtitle: message.last_message_preview || message.subject || undefined,
        // The inbox lives at /communications (there is no /comms route, and an
        // unknown path lands on the dashboard); it opens ?conversation=<id>.
        to: `/communications?conversation=${encodeURIComponent(message.id)}`,
      })
    }
    for (const file of data?.files ?? []) {
      out.push({ kind: 'file', ...file })
    }
    for (const c of data?.catalogs ?? []) {
      out.push({
        kind: 'catalog',
        id: c.id,
        title: c.title,
        subtitle: c.vendor ?? undefined,
      })
    }
    out.push(...pagesAndSettings)
    // Last: hand what was typed to CBI.
    if (typed && aiHelpAvailable()) {
      out.push({ kind: 'cbi', id: 'ask', title: `Ask CBI: ${typed}`, subtitle: 'CBI answers in its panel, beside the page' })
    }
    return out
  }, [data, pagesAndSettings, typed])

  // Keep highlight in range as results change.
  useEffect(() => {
    setHighlighted((h) => (results.length === 0 ? 0 : Math.min(h, results.length - 1)))
  }, [results])

  function go(r: SearchResult) {
    setOpen(false)
    // A catalogue opens over the page you are on, not on a page of its own.
    if (r.kind === 'catalog') openCatalogs({ documentId: r.id })
    else if (r.kind === 'cbi') openAiHelp(typed, typed)
    else if (r.external && r.to) window.open(r.to, '_blank', 'noopener,noreferrer')
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
        data-tour="topbar-search"
        className={prominent
          ? 'flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors md:h-10 md:min-w-0 md:w-full md:max-w-[430px] md:justify-start md:gap-2 md:border md:border-white/25 md:bg-white/10 md:px-3 md:text-left md:hover:bg-white/15'
          : 'flex items-center justify-center w-9 h-9 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors'}
        title={keyLabel ? `Search (${keyLabel})` : 'Search'}
        aria-label="Search"
      >
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.75" />
          <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        {prominent && <><span className="hidden min-w-0 flex-1 truncate text-sm md:block">Search jobs, people, addresses, invoices…</span>{keyLabel && <kbd className="hidden shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white/60 lg:inline">{keyLabel}</kbd>}</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search everything">
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
                placeholder="Search jobs, customers, messages, files, estimates…"
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
              {!typed && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">
                  Type a name, a number, a page or a setting. Or a question for CBI.
                </p>
              )}
              {typed && !isFetching && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">
                  No matches for “{typed}”.
                </p>
              )}
              {typed && !isFetching && failedSources.length > 0 && (
                <p role="status" className="px-4 py-2 text-xs text-rose-700">
                  Some results couldn't load ({failedSources.join(', ')}).
                </p>
              )}
              {KIND_ORDER.map((kind) => {
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
  if (kind === 'message') {
    return (
      <span className={`${wrap} bg-sky-100 text-sky-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M3 4h14v10H8l-4 3v-3H3V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 8h8M6 11h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'file') {
    return (
      <span className={`${wrap} bg-slate-100 text-slate-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M5 2.5h7l3 3V17H5V2.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 2.5V6h3M7.5 10h5M7.5 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'cbi') {
    return (
      <span className={`${wrap} bg-amber-500 text-[#0B1220] text-[9px] font-extrabold tracking-tight`}>CBI</span>
    )
  }
  if (kind === 'page') {
    return (
      <span className={`${wrap} bg-slate-100 text-slate-600`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (kind === 'setting') {
    return (
      <span className={`${wrap} bg-violet-100 text-violet-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M4 6h12M4 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="6" r="1.8" fill="white" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="13" cy="14" r="1.8" fill="white" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
    )
  }
  if (kind === 'invoice') {
    return (
      <span className={`${wrap} bg-rose-100 text-rose-700`}>
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 7h4M8 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
