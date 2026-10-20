import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { PlanRequestsTab } from '@/components/contracts/PlanRequestsTab'
import { usePermissions } from '@/hooks/usePermissions'

/**
 * Service agreements.
 *
 * Its own section rather than a tab inside Customers: a contract commits
 * the shop to a year of work and the customer to a year of money, and the
 * questions people bring to it — what is due, what renews next, whose is
 * it — are not customer questions.
 */

type Contract = {
  id: string
  title: string
  status: string
  customer_id: string
  starts_on: string | null
  ends_on: string | null
  billing_amount_cents: number
  billing_interval_unit: string
  billing_interval_count: number
  visits_count: number | null
  services: { id: string; name: string }[]
  /** Shown when the server includes it. */
  customer?: { display_name?: string | null; name?: string | null } | null
}

// Same format as the agreement detail tabs and the new-agreement summary.
const money = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

// The same words the agreement detail page uses for each status.
const STATUS_LABEL: Record<string, string> = {
  draft: 'Not started',
  pending_signature: 'Waiting to be signed',
  active: 'Running',
  paused: 'Paused',
  expired: 'Ended',
  cancelled: 'Cancelled',
}
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ')

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600',
  pending_signature: 'bg-amber-50 text-amber-800',
  paused: 'bg-slate-100 text-slate-500',
  expired: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-rose-50 text-rose-700',
}

export default function MaintenanceContractsPage() {
  const navigate = useNavigate()
  const { has } = usePermissions()
  const canEdit = has('contracts.edit')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tab, setTab] = useState<'agreements' | 'requests'>('agreements')

  /*
   * Counted here rather than inside the tab, so the badge is right
   * before anybody opens it. A request nobody has answered is the one
   * thing on this page with a clock on it.
   */
  const waiting = useQuery({
    queryKey: ['service-plan-requests'],
    queryFn: () => apiRequest<{ data: unknown[]; waiting: number }>('/v1/service-plan-requests'),
  })
  const waitingCount = waiting.data?.waiting ?? 0

  const term = search.trim()
  const params = new URLSearchParams()
  if (term) params.set('q', term)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params}` : ''

  const contracts = useQuery({
    queryKey: ['maintenance-contracts', { term, status }],
    queryFn: () => apiRequest<{ data: Contract[] }>(`/v1/maintenance-contracts${qs}`),
  })


  const rows = contracts.data?.data ?? []

  return (
    <div data-focus-page="agreements" className="relative w-full min-w-0 px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div data-tour="contracts-header">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-950">Service agreements</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Work you have agreed to do on a schedule. Each contract books its own visits and bills on
            its own cadence.
          </p>
        </div>
        {canEdit && <Link
          to="/maintenance-contracts/new"
          data-tour="contracts-new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
        >
          <IconPlus size={15} /> New service agreement
        </Link>}
      </div>

      <div data-tour="contracts-tabs" className="mt-5 flex gap-1 border-b border-slate-200">
        <button
          type="button"
          data-tour="contracts-tab-agreements"
          aria-selected={tab === 'agreements'}
          onClick={() => setTab('agreements')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-bold ${
            tab === 'agreements'
              ? 'border-amber-500 text-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Agreements
        </button>
        <button
          type="button"
          data-tour="contracts-requests"
          aria-selected={tab === 'requests'}
          onClick={() => setTab('requests')}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-bold ${
            tab === 'requests'
              ? 'border-amber-500 text-navy-950'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Plan requests
          {waitingCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {waitingCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'requests' && <PlanRequestsTab />}

      {tab === 'agreements' && (
        <>
      <div data-tour="contracts-filters" className="mt-5 flex flex-wrap items-center gap-3">
        <div data-tour="contracts-search" className="relative min-w-[16rem] flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contracts"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <select
          data-tour="contracts-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <option value="">Any status</option>
          {['draft', 'pending_signature', 'active', 'paused', 'expired', 'cancelled'].map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {contracts.isPending && <p className="mt-6 text-sm text-slate-500">Loading contracts…</p>}

      {contracts.isError && rows.length === 0 && (
        <div role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Couldn't load service agreements.
          <button
            type="button"
            disabled={contracts.isFetching}
            onClick={() => void contracts.refetch()}
            className="ml-2 font-semibold underline disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {!contracts.isPending && !contracts.isError && rows.length === 0 && (
        <p data-tour="contracts-empty" className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          {term || status ? 'No service agreements match your filters.' : <>No service agreements yet. One is work you have agreed to do on a schedule — a set number
          of visits a year, for a fee — and it books its own jobs.</>}
        </p>
      )}

      <div data-tour="contracts-list" className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            data-tour="contracts-row"
            onClick={() => navigate(`/maintenance-contracts/${c.id}`)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-amber-300 hover:shadow-sm"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold text-navy-950">{c.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {statusLabel(c.status)}
              </span>
            </span>
            {(c.customer?.display_name || c.customer?.name) && (
              <span className="mt-0.5 block text-xs font-semibold text-slate-700">
                {c.customer?.display_name || c.customer?.name}
              </span>
            )}
            <span className="mt-1 block text-xs text-slate-500">
              {c.starts_on}{c.ends_on ? ` to ${c.ends_on}` : ''}
            </span>
            <span className="mt-2 block text-xs text-slate-600">
              {c.services.length > 0 ? c.services.map((s) => s.name).join(' · ') : 'Nothing covered yet'}
            </span>
            <span className="mt-2 block text-sm font-bold text-navy-950">
              {money(c.billing_amount_cents)}
              <span className="font-normal text-slate-500">
                {' '}every {c.billing_interval_count} {c.billing_interval_unit}
                {c.billing_interval_count === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        ))}
      </div>
        </>
      )}
    </div>
  )
}
