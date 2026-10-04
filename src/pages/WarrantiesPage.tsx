import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useWarranties, useVoidWarranty, useClaimWarranty } from '@/hooks/useWarranties'
import type { WarrantyRow, WarrantyStatus } from '@/lib/warranties'
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
import { EasyActionCards } from '@/components/easy/EasyActionCards'
import { CONNECT_URL } from '@/lib/workspaceScope'

/**
 * Warranties list — full read-only browse view. Filterable by:
 *   - status (active / expired / voided / claimed)
 *   - customer / asset id (via URL params for deep-link)
 *   - free-text search across customer name + catalog item
 *
 * Status comes from the URL `?status=` so the dashboard panel + asset
 * filters can deep-link cleanly. Write actions (void / claim) are
 * deferred to round 3 extended-warranty work.
 */
export function WarrantiesPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as WarrantyStatus | null) ?? null
  const customerId = params.get('customer_id') ?? undefined
  const assetId = params.get('asset_id') ?? undefined
  const expiringWithin = params.get('expiring_within')
    ? parseInt(params.get('expiring_within')!, 10) || undefined
    : undefined

  const [searchQuery, setSearchQuery] = useState('')
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const voidMutation = useVoidWarranty()
  const claimMutation = useClaimWarranty()

  const { data, isLoading, isError, error, refetch } = useWarranties({
    status: status ?? undefined,
    customer_id: customerId,
    asset_id: assetId,
    expiring_within: expiringWithin,
    per_page: 200,
  })

  const filtered = useMemo(() => {
    const rows = data ?? []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const hay = [
        r.customer?.display_name,
        r.catalog_item_name,
        r.asset?.name,
        r.asset?.asset_code,
        r.source_invoice?.invoice_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [data, searchQuery])

  function setStatusFilter(next: WarrantyStatus | null) {
    if (next === null) {
      params.delete('status')
    } else {
      params.set('status', next)
    }
    setParams(params)
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString()
  }

  function daysUntil(iso: string | null): number | null {
    if (!iso) return null
    const ms = new Date(iso).getTime() - Date.now()
    return Math.round(ms / 86_400_000)
  }

  return (
    <div className={easy ? 'w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6' : 'max-w-6xl mx-auto px-6 py-8'}>
      <div className={easy ? 'mb-6 w-full min-w-0' : 'flex items-center justify-between mb-6 flex-wrap gap-3'}>
        <div className={easy ? 'w-full min-w-0' : undefined}>
          {easy ? <EasyPageHeading title="Warranties" description="Find a customer's coverage, check expiry dates, and open the source invoice. Claim and void actions keep their existing confirmations." /> : <h1 className="text-2xl font-bold text-navy-900">Warranties</h1>}
          <p className="text-sm text-slate-600 mt-1">
            Coverage rows written when an invoice is sent;
            warranty issuance is automatic. Configure rules in{' '}
            <a href={new URL('/tool-shed/warranty-settings', CONNECT_URL).href} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline">
              CrewBarn Connect → Warranty settings (new tab)
            </a>
            .
          </p>
        </div>
      </div>
      {easy && <EasyActionCards label="Review coverage" actions={[
        { key: 'all', title: 'All coverage', description: 'Browse all statuses with your current customer and asset filters.', active: status === null, onClick: () => setStatusFilter(null) },
        { key: 'active', title: 'Active coverage', description: 'Find coverage still in effect.', active: status === 'active', onClick: () => setStatusFilter('active') },
        { key: 'expired', title: 'Expired coverage', description: 'Review warranties past their coverage period.', active: status === 'expired', onClick: () => setStatusFilter('expired') },
        { key: 'claimed', title: 'Claimed coverage', description: 'Review recorded warranty claims.', active: status === 'claimed', onClick: () => setStatusFilter('claimed') },
      ]} />}

      {/* Filters */}
      <div data-easy-list-toolbar className={easy ? 'bg-white border border-slate-200 rounded-lg p-4 mb-4 grid min-w-0 gap-3' : 'bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3'}>
        <div className={easy ? 'min-w-0' : 'flex-1 min-w-[200px]'}>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Search
          </label>
          <input
            type="search"
            aria-label="Search warranties"
            placeholder="Customer, item, asset, invoice #…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
            Status
          </label>
          <div className={easy ? 'flex w-fit max-w-full flex-wrap rounded-md border border-slate-300 text-xs' : 'inline-flex rounded-md border border-slate-300 overflow-hidden text-xs'}>
            {([null, 'active', 'expired', 'voided', 'claimed'] as const).map((s) => {
              const label = s ?? 'All'
              const active = status === s
              return (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={active}
                  className={`px-3 py-2 capitalize ${
                    active ? 'bg-amber-500 text-white font-medium' : 'bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {(customerId || assetId || expiringWithin) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="text-slate-500">Filtering by:</span>
          {customerId && (
            <FilterChip
              label={`customer = ${customerId.slice(0, 12)}…`}
              onClear={() => { params.delete('customer_id'); setParams(params) }}
            />
          )}
          {assetId && (
            <FilterChip
              label={`asset = ${assetId.slice(0, 12)}…`}
              onClear={() => { params.delete('asset_id'); setParams(params) }}
            />
          )}
          {expiringWithin && (
            <FilterChip
              label={`expiring within ${expiringWithin}d`}
              onClear={() => { params.delete('expiring_within'); setParams(params) }}
            />
          )}
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-sm">
          Loading…
        </div>
      )}
      {isError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Failed to load warranties.
          {error instanceof Error ? ` ${error.message}` : ''}
          <button type="button" className="ml-3 underline" onClick={() => void refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-sm">
          No warranties match these filters.
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Item</th>
                <th className="text-left px-4 py-2 font-medium">Customer / Asset</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Starts</th>
                <th className="text-left px-4 py-2 font-medium">Mfr expires</th>
                <th className="text-left px-4 py-2 font-medium">Co expires</th>
                <th className="text-left px-4 py-2 font-medium">Labor expires</th>
                <th className="text-left px-4 py-2 font-medium">Invoice</th>
                <th className="text-right px-4 py-2 font-medium">Extensions paid</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <WarrantyRowDisplay
                  key={w.id}
                  row={w}
                  fmtDate={fmtDate}
                  daysUntil={daysUntil}
                  onVoid={() => setVoidingId(w.id)}
                  onClaim={async () => {
                    if (!window.confirm('Record a warranty claim against this row?')) return
                    try {
                      await claimMutation.mutateAsync(w.id)
                    } catch (e) {
                      alert('Failed to record claim: ' + String(e))
                    }
                  }}
                  busy={claimMutation.isPending && claimMutation.variables === w.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {voidingId && (
        <VoidWarrantyModal
          isOpen
          onClose={() => setVoidingId(null)}
          onSubmit={async (reason) => {
            try {
              await voidMutation.mutateAsync({ id: voidingId, reason })
              setVoidingId(null)
            } catch (e) {
              alert('Failed to void: ' + String(e))
            }
          }}
          submitting={voidMutation.isPending}
        />
      )}
    </div>
  )
}

function VoidWarrantyModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  submitting: boolean
}) {
  const [reason, setReason] = useState('')
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 mb-2">Void warranty</h3>
        <p className="text-xs text-slate-600 mb-3">
          Voiding marks this warranty as no longer in force. Reason is recorded
          for audit (e.g. "Customer broke the unit", "Sold under wrong terms").
        </p>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for voiding"
          className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-4 py-2 text-slate-700 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim())}
            disabled={submitting || reason.trim() === ''}
            className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Voiding…' : 'Void warranty'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WarrantyRowDisplay({
  row,
  fmtDate,
  daysUntil,
  onVoid,
  onClaim,
  busy,
}: {
  row: WarrantyRow
  fmtDate: (iso: string | null) => string
  daysUntil: (iso: string | null) => number | null
  onVoid: () => void
  onClaim: () => void
  busy: boolean
}) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{row.catalog_item_name}</div>
        {row.manufacturer_serial && (
          <div className="text-[11px] font-mono text-slate-400">S/N {row.manufacturer_serial}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <div>{row.customer?.display_name ?? '—'}</div>
        {row.asset && (
          <div className="text-slate-400 mt-0.5">
            {row.asset.name}
            {row.asset.asset_code && <span className="font-mono ml-1">{row.asset.asset_code}</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(row.starts_at)}</td>
      <ExpiryCell iso={row.mfr_expires_at}   extendedDays={row.extended_mfr_days}   fmtDate={fmtDate} daysUntil={daysUntil} status={row.status} />
      <ExpiryCell iso={row.co_expires_at}    extendedDays={row.extended_co_days}    fmtDate={fmtDate} daysUntil={daysUntil} status={row.status} />
      <ExpiryCell iso={row.labor_expires_at} extendedDays={row.extended_labor_days} fmtDate={fmtDate} daysUntil={daysUntil} status={row.status} />
      <td className="px-4 py-3 text-xs">
        {row.source_invoice ? (
          <Link to={`/invoices/${row.source_invoice.id}`} className="text-amber-700 hover:underline font-mono">
            {row.source_invoice.invoice_number}
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-right">
        {row.extended_paid_cents && row.extended_paid_cents > 0 ? (
          <span className="text-emerald-700 font-mono font-medium">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.extended_paid_cents / 100)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {row.status === 'active' && (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClaim}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded border border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {busy ? '…' : 'Claim'}
            </button>
            <button
              type="button"
              onClick={onVoid}
              className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
            >
              Void
            </button>
          </div>
        )}
        {row.claim_count > 0 && row.status !== 'active' && (
          <span className="text-[11px] text-slate-500">
            {row.claim_count} claim{row.claim_count === 1 ? '' : 's'}
          </span>
        )}
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: WarrantyStatus }) {
  const cls: Record<WarrantyStatus, string> = {
    active:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
    expired: 'bg-slate-100 text-slate-500',
    voided:  'bg-slate-100 text-slate-500',
    claimed: 'bg-amber-50 text-amber-700 border border-amber-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] uppercase font-medium tracking-wide ${cls[status]}`}>
      {status}
    </span>
  )
}

function ExpiryCell({
  iso,
  extendedDays,
  fmtDate,
  daysUntil,
  status,
}: {
  iso: string | null
  extendedDays?: number | null
  fmtDate: (iso: string | null) => string
  daysUntil: (iso: string | null) => number | null
  status: WarrantyStatus
}) {
  if (!iso) {
    return <td className="px-4 py-3 text-xs text-slate-300">—</td>
  }
  const days = daysUntil(iso)
  const stillActive = status === 'active'
  const urgent = stillActive && days !== null && days >= 0 && days <= 7
  const expired = days !== null && days < 0
  return (
    <td className="px-4 py-3 text-xs">
      <div className={expired ? 'text-slate-400' : 'text-slate-700'}>{fmtDate(iso)}</div>
      {extendedDays != null && extendedDays > 0 && (
        <div className="mt-0.5 text-[10px] text-emerald-700 font-medium">
          +{extendedDays}d extended
        </div>
      )}
      {stillActive && days !== null && (
        <div className={`mt-0.5 ${urgent ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
          {days < 0 ? `${-days}d ago`
            : days === 0 ? 'today'
            : days === 1 ? 'tomorrow'
            : `${days}d left`}
        </div>
      )}
    </td>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 text-slate-700">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="text-slate-400 hover:text-red-700"
        aria-label="Clear"
      >
        ✕
      </button>
    </span>
  )
}
