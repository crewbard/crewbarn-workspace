import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  API_URL,
  apiRequest,
  getActingTenant,
  getFranchiseActAs,
  getStoredToken,
} from '@/lib/api'
import { money, specFor, type Bar, type Column, type ReportSpec } from '@/lib/reportSpecs'
import { ReportIcon } from './ReportIcon'

/**
 * One report, opened over the question grid.
 *
 * An overlay rather than a page because reading a report is a lookup, not a
 * destination — you check who is late, then you go back to the list and check
 * something else. A route change loses the grid, its scroll position and the
 * search you typed to find the card.
 *
 * The layout is the same for every report: the answer in a sentence, the shape
 * of it in a chart, then the rows. The rows are the detail rather than the
 * front page, which is the whole point — a table of 200 invoices does not tell
 * you that nine are late.
 */

interface Props {
  reportId: string
  onClose: () => void
}

type Any = Record<string, any>

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Period {
  key: string
  label: string
  range: () => { from: string; to: string }
}

// Calendar periods, built from local parts. Not toISOString — that is UTC, and
// after about 8pm Eastern it reports tomorrow.
const PERIODS: Period[] = [
  {
    key: 'today',
    label: 'Today',
    range: () => ({ from: isoDay(new Date()), to: isoDay(new Date()) }),
  },
  {
    key: 'week',
    label: 'This week',
    range: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
      return { from: isoDay(start), to: isoDay(now) }
    },
  },
  {
    key: 'month',
    label: 'This month',
    range: () => {
      const now = new Date()
      return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) }
    },
  },
  {
    key: 'quarter',
    label: 'Quarter',
    range: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3)
      return { from: isoDay(new Date(now.getFullYear(), q * 3, 1)), to: isoDay(now) }
    },
  },
  {
    key: 'ytd',
    label: 'Year',
    range: () => {
      const now = new Date()
      return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to: isoDay(now) }
    },
  },
]

/**
 * The same quick choices for a snapshot report.
 *
 * A range means nothing to A/R aging, but "what was outstanding at the end of
 * last month" is exactly what someone closing a month wants, so the pills
 * become dates rather than disappearing.
 */
const AS_OF_PERIODS: { key: string; label: string; day: () => string }[] = [
  { key: 'today', label: 'Today', day: () => isoDay(new Date()) },
  {
    key: 'week',
    label: 'Last week',
    day: () => {
      const n = new Date()
      return isoDay(new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay() - 1))
    },
  },
  {
    key: 'month',
    label: 'Last month',
    day: () => {
      const n = new Date()
      return isoDay(new Date(n.getFullYear(), n.getMonth(), 0))
    },
  },
  {
    key: 'quarter',
    label: 'Last quarter',
    day: () => {
      const n = new Date()
      return isoDay(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 0))
    },
  },
]

function fmt(value: unknown, kind: Column['kind']): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (kind) {
    case 'money':
      return money(Number(value) || 0)
    case 'number':
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    case 'pct':
      return `${(Number(value) || 0).toFixed(1)}%`
    case 'date':
      return String(value).slice(0, 10)
    default:
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      return String(value)
  }
}

/** Authenticated download — export endpoints stream a file, not JSON. */
async function download(url: string, filename: string): Promise<void> {
  const headers: Record<string, string> = { Accept: '*/*' }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const tenant = getActingTenant()
  if (tenant) headers['X-Act-As-Tenant'] = tenant
  const franchise = getFranchiseActAs()
  if (franchise) headers['X-Franchise-Act-As'] = franchise.id

  const res = await fetch(`${API_URL}${url}`, { headers })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  const href = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

function BarRow({ bar, max }: { bar: Bar; max: number }) {
  const pct = max > 0 ? Math.max(2, (Math.abs(bar.value) / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-[128px] shrink-0 truncate text-[13px] text-slate-600" title={bar.label}>
        {bar.label}
      </span>
      <span className="h-[13px] flex-1 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-[#E8902C]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-[104px] shrink-0 text-right font-mono text-[13px] tabular-nums text-slate-900">
        {bar.money ? money(bar.value) : Number(bar.value).toLocaleString('en-US')}
      </span>
    </div>
  )
}

export function ReportOverlay({ reportId, onClose }: Props) {
  const spec = specFor(reportId)
  const qc = useQueryClient()

  const initial = PERIODS[2].range()
  // The two pill sets share key names, so the default has to match the mode:
  // as-of opens on today, a range opens on this month. Seeding 'month' for both
  // lit "Last month" while the date said today.
  const [period, setPeriod] = useState<string>(spec?.dateMode === 'asOf' ? 'today' : 'month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [asOf, setAsOf] = useState(isoDay(new Date()))
  const [exportError, setExportError] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [visibleRows, setVisibleRows] = useState(25)

  // Esc closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prior
    }
  }, [onClose])

  const query = useMemo(() => {
    if (!spec) return ''
    const p = new URLSearchParams(spec.fixedParams ?? {})
    if (spec.dateMode === 'range') {
      p.set('from', from)
      p.set('to', to)
    } else if (spec.dateMode === 'asOf') {
      p.set('as_of', asOf)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [spec, from, to, asOf])

  const report = useQuery({
    queryKey: ['report-overlay', reportId, query],
    queryFn: () => apiRequest<{ data: Any }>(`${spec!.path}${query}`),
    enabled: Boolean(spec),
  })

  const pin = useMutation({
    mutationFn: () =>
      apiRequest('/v1/reports/presets', {
        method: 'POST',
        body: {
          name: spec!.title,
          report_key: spec!.id,
          filters: { from, to, asOf, layout: 'browser' },
          layout: 'browser',
        },
      }),
    onSuccess: () => {
      setPinned(true)
      void qc.invalidateQueries({ queryKey: ['reports', 'presets'] })
    },
  })

  if (!spec) return null

  const data = report.data?.data
  const rows: Any[] = Array.isArray(data?.rows) ? data!.rows : []
  const answer = data ? spec.answer(data) : null
  const chart = data && spec.chart ? spec.chart(data) : null
  const chartMax = chart ? Math.max(...chart.bars.map((b) => Math.abs(b.value)), 0) : 0

  const suffix = spec.dateMode === 'asOf' ? asOf : spec.dateMode === 'range' ? `${from}-${to}` : 'all'
  const exportUrl = (format: 'csv' | 'pdf') =>
    `${spec.path}${query}${query ? '&' : '?'}format=${format}`

  const doExport = (format: 'csv' | 'pdf') => {
    setExportError(null)
    download(exportUrl(format), `${spec.id}-${suffix}.${format}`).catch((e) =>
      setExportError(e instanceof Error ? e.message : 'Export failed.'),
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={spec.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="h-fit w-full max-w-[1180px] rounded-[16px] bg-[#F4F6FA] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-bold text-[#B4762A] hover:text-[#8a5a1f]"
            >
              &larr; All questions
            </button>
            <h2 className="mt-1 text-[26px] font-bold leading-tight text-[#0A1220]">{spec.title}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Built from{' '}
              {spec.builtFrom.map((b, i) => (
                <span key={b}>
                  {i > 0 && <span className="text-slate-300"> + </span>}
                  <span className="font-mono text-slate-600">{b}</span>
                </span>
              ))}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {spec.dateMode === 'range' && (
              <div className="flex rounded-[10px] bg-white p-1 shadow-sm">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      const r = p.range()
                      setPeriod(p.key)
                      setFrom(r.from)
                      setTo(r.to)
                    }}
                    className={`rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      period === p.key
                        ? 'bg-[#0F1A2E] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {spec.dateMode === 'asOf' && (
              <div className="flex rounded-[10px] bg-white p-1 shadow-sm">
                {AS_OF_PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPeriod(p.key)
                      setAsOf(p.day())
                    }}
                    className={`rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      period === p.key
                        ? 'bg-[#0F1A2E] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => pin.mutate()}
              disabled={pin.isPending || pinned}
              className="rounded-[10px] border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="flex items-center gap-1.5">
                <ReportIcon name="pin" />
                {pinned ? 'Pinned' : pin.isPending ? 'Pinning…' : 'Pin'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => doExport('csv')}
              className="rounded-[10px] border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => doExport('pdf')}
              className="rounded-[10px] border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-slate-500 shadow-sm hover:bg-slate-50"
            >
              <ReportIcon name="close" />
            </button>
          </div>
        </div>

        {/* Dates. The pills are the fast path; these are the exact one. */}
        {spec.dateMode !== 'none' && (
          <div className="flex flex-wrap items-end gap-3 px-6 pt-4">
            {spec.dateMode === 'range' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    From
                  </span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value)
                      setPeriod('custom')
                    }}
                    className="tnum rounded-[9px] border border-slate-300 bg-white px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    To
                  </span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value)
                      setPeriod('custom')
                    }}
                    className="tnum rounded-[9px] border border-slate-300 bg-white px-3 py-2 text-[13px]"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  As of
                </span>
                <input
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  className="tnum rounded-[9px] border border-slate-300 bg-white px-3 py-2 text-[13px]"
                />
                {/* Said plainly, because a From box that did nothing would be worse. */}
                <span className="mt-1 block text-[11.5px] text-slate-500">
                  This one is a snapshot, not a range — it shows what is open on that date.
                </span>
              </label>
            )}
          </div>
        )}

        <div className="space-y-4 px-6 pb-6 pt-4">
          {exportError && (
            <p className="rounded-[11px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700">
              {exportError}
            </p>
          )}

          {/* The answer */}
          <div className="rounded-[14px] bg-[#0F1A2E] px-7 py-6 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              The answer
            </p>
            {report.isLoading ? (
              <p className="mt-2 text-[20px] font-bold text-slate-300">Working it out…</p>
            ) : report.isError ? (
              <p className="mt-2 text-[16px] font-semibold text-rose-300">
                {(report.error as Error)?.message || 'That report could not be loaded.'}
              </p>
            ) : (
              <>
                <p className="mt-2 text-[26px] font-bold leading-snug">{answer?.headline}</p>
                {answer?.detail && (
                  <p className="mt-2 max-w-[820px] text-[14.5px] leading-relaxed text-slate-300">
                    {answer.detail}
                  </p>
                )}
              </>
            )}
          </div>

          {chart && chart.bars.length > 0 && (
            <div className="rounded-[14px] border border-slate-200 bg-white px-6 py-5">
              <h3 className="mb-2 text-[14px] font-bold text-[#0A1220]">{chart.title}</h3>
              {chart.bars.map((b, i) => (
                <BarRow key={`${b.label}-${i}`} bar={b} max={chartMax} />
              ))}
            </div>
          )}

          {/* The rows */}
          <div className="rounded-[14px] border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline gap-2 px-6 pt-5">
              <h3 className="text-[14px] font-bold text-[#0A1220]">The rows behind it</h3>
              <span className="text-[12.5px] text-slate-500">
                The detail, not the front page — export for the full set.
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    {spec.columns.map((c) => (
                      <th
                        key={c.key}
                        className={`px-6 py-2.5 font-semibold ${
                          c.kind === 'money' || c.kind === 'number' || c.kind === 'pct'
                            ? 'text-right'
                            : ''
                        }`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, visibleRows).map((r, i) => (
                    <tr key={r.id ?? r.invoice_id ?? r.payment_id ?? i}>
                      {spec.columns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-6 py-3 ${
                            c.kind === 'money' || c.kind === 'number' || c.kind === 'pct'
                              ? 'text-right font-mono tabular-nums text-slate-900'
                              : c.strong
                                ? 'font-semibold text-[#0A1220]'
                                : 'text-slate-600'
                          }`}
                        >
                          {fmt(r[c.key], c.kind)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!report.isLoading && rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={spec.columns.length}
                        className="px-6 py-10 text-center text-[13px] text-slate-500"
                      >
                        Nothing in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > visibleRows && (
              <div className="border-t border-slate-100 px-6 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleRows((n) => n + 100)}
                  className="text-[12.5px] font-bold text-[#B4762A] hover:text-[#8a5a1f]"
                >
                  Show more — {(rows.length - visibleRows).toLocaleString('en-US')} still hidden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export type { ReportSpec }
