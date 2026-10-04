import { useState } from 'react'
import {
  useInventoryReconciliations,
  useResolveInventoryReconciliation,
} from '@/hooks/useInventoryReconciliations'
import { ApiError } from '@/lib/api'
import { formatQty } from '@/lib/unitsOfMeasure'
import { useTheme } from '@/hooks/useTheme'
import { EasyActionCards } from '@/components/easy/EasyActionCards'
import type {
  InventoryReconciliation,
  InventoryReconciliationStatus,
  ReconciliationResolveAction,
} from '@/types/inventoryReconciliation'

/**
 * Inventory Reconciliations queue. Lists the shortfalls logged when an
 * outgoing movement (issue / install / etc.) would have made stock go
 * negative AND the tenant has `inventory_allow_unrecorded_stock` on.
 *
 * Each pending row gets two resolve options:
 *   - Retroactive receive ("we had it, just didn't track the receive")
 *   - Write off          ("we lost it, accept the loss")
 *
 * Resolution is documentary only — it does not touch stock_levels. The
 * originating movement already floored stock at 0 when the negative
 * happened. This page records WHY for the audit trail.
 */
export function InventoryReconciliationsPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [status, setStatus] = useState<InventoryReconciliationStatus>('pending')
  const query = useInventoryReconciliations({ status, per_page: 100 })
  const rows: InventoryReconciliation[] = query.data?.data ?? []
  const meta = query.data?.meta

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Reconciliations</h1>
        <p className="text-sm text-slate-600 mt-1">
          Stock shortfalls flagged when outgoing movements went below zero.
          Resolve each with the explanation that fits — receive (we had it,
          just didn't log it) or write-off (we lost it). Resolution is
          documentary; stock is already adjusted.
        </p>
      </div>

      {easy ? <EasyActionCards label="Review stock shortfalls" actions={[
        { key: 'pending', title: 'Needs an explanation', description: 'Review shortfalls still waiting for reconciliation.' },
        { key: 'resolved_received', title: 'Receive recorded', description: 'Review shortfalls resolved as unrecorded receipts.' },
        { key: 'resolved_writeoff', title: 'Write-off recorded', description: 'Review shortfalls resolved as losses.' },
      ].map(action => ({ ...action, active: status === action.key, onClick: () => setStatus(action.key as InventoryReconciliationStatus) }))} /> : <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">Status</span>
        {(['pending', 'resolved_received', 'resolved_writeoff'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`text-xs px-3 py-1.5 rounded font-medium ${
              status === s
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {labelForStatus(s)}
          </button>
        ))}
      </div>}

      {query.isError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Reconciliations could not be loaded. The queue may be incomplete.
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="ml-2 underline disabled:opacity-50">Retry</button>
      </div>}
      {query.isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      {!query.isLoading && !query.isError && rows.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <p className="text-sm text-slate-600">
            {status === 'pending'
              ? '✓ No pending reconciliations. All shortfalls are resolved.'
              : 'No reconciliations in this state.'}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${easy ? 'overflow-x-auto' : 'overflow-hidden'}`}>
          <table className={`w-full text-sm ${easy ? 'min-w-[720px]' : ''}`}>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">When</th>
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Where</th>
                <th className="text-right px-4 py-3 font-medium">Shortfall</th>
                <th className="text-left px-4 py-3 font-medium">Trigger</th>
                <th className="text-left px-4 py-3 font-medium">Status / Resolve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <ReconciliationRow key={r.id} r={r} />
              ))}
            </tbody>
          </table>
          {meta && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200">
              Showing {rows.length} of {meta.total}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function labelForStatus(s: InventoryReconciliationStatus): string {
  switch (s) {
    case 'pending': return 'Pending'
    case 'resolved_received': return 'Resolved – Received'
    case 'resolved_writeoff': return 'Resolved – Write-off'
    case 'resolved_other': return 'Resolved – Other'
  }
}

/** Exact cents — money is never rounded away. */
function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ReconciliationRow({ r }: { r: InventoryReconciliation }) {
  const [resolving, setResolving] = useState<ReconciliationResolveAction | null>(null)
  const resolveMutation = useResolveInventoryReconciliation()

  const when = r.created_at ? new Date(r.created_at).toLocaleString() : '—'
  const itemName = r.catalog_item?.name ?? '(deleted item)'
  const sku = r.catalog_item?.sku
  const where = r.location?.name ?? '—'
  const triggerType = r.movement?.type ?? '—'
  const triggerRef = r.movement?.reference_number

  const isPending = r.status === 'pending'

  async function resolve(action: ReconciliationResolveAction) {
    let catalogItemName: string | null = null
    if (action === 'convert_to_stock') {
      // Prefill with the write-in's description so the manager can tidy it into
      // a clean product name (e.g. "Kwikset 660 deadbolt").
      const suggested = r.movement_id ? (r.catalog_item?.name ?? '') : ''
      const name = window.prompt(
        'Name the new catalog product (future jobs will add/scan it):',
        suggested === 'Write In' ? '' : suggested,
      )
      if (name === null) return // cancelled
      if (!name.trim()) {
        alert('A product name is required.')
        return
      }
      catalogItemName = name.trim()
    }
    const label =
      action === 'retroactive_receive'
        ? 'Retroactive receive'
        : action === 'convert_to_stock'
          ? 'Convert to stock'
          : 'Write off'
    const notes = window.prompt(`${label} — optional notes (or leave blank):`)
    if (notes === null) return // cancelled
    setResolving(action)
    try {
      await resolveMutation.mutateAsync({
        id: r.id,
        input: { action, notes: notes.trim() || null, ...(catalogItemName ? { catalog_item_name: catalogItemName } : {}) },
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err)
      alert(`Failed to resolve: ${msg}`)
    } finally {
      setResolving(null)
    }
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{when}</td>
      <td className="px-4 py-3">
        <div className="text-slate-900">{itemName}</div>
        {sku && <div className="text-[11px] font-mono text-slate-400">{sku}</div>}
        {r.is_write_in && (
          <div className="mt-1 space-y-0.5">
            <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Write-in{r.work_order?.work_order_number ? ` · Job #${r.work_order.work_order_number}` : ''}
            </span>
            {r.receipts.length > 0 ? (
              <div className="text-[11px] text-emerald-700">
                📎 {r.receipts.length} receipt{r.receipts.length === 1 ? '' : 's'} ·{' '}
                {formatMoney(r.receipts.reduce((s, x) => s + x.amount_cents, 0))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">No receipt uploaded yet</div>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">{where}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-700">
        {formatQty(r.shortfall_qty, r.catalog_item?.unit_label)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <span className="capitalize">{triggerType}</span>
        {triggerRef && <span className="ml-1 text-slate-400">({triggerRef})</span>}
      </td>
      <td className="px-4 py-3">
        {isPending ? (
          <div className="flex items-center gap-2">
            {r.is_write_in && (
              <button
                type="button"
                onClick={() => resolve('convert_to_stock')}
                disabled={!!resolving}
                className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-50"
                title="Start carrying this as a catalog product"
              >
                {resolving === 'convert_to_stock' ? '…' : 'Convert to stock'}
              </button>
            )}
            <button
              type="button"
              onClick={() => resolve('retroactive_receive')}
              disabled={!!resolving}
              className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium disabled:opacity-50"
              title="We had it, just didn't track the receive"
            >
              {resolving === 'retroactive_receive' ? '…' : 'Retroactive receive'}
            </button>
            <button
              type="button"
              onClick={() => resolve('write_off')}
              disabled={!!resolving}
              className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50"
              title="We lost it, accept the loss"
            >
              {resolving === 'write_off' ? '…' : 'Write off'}
            </button>
          </div>
        ) : (
          <div className="text-xs">
            <div className="text-slate-700 font-medium">{labelForStatus(r.status)}</div>
            {r.resolution.notes && (
              <div className="text-slate-500 mt-0.5 italic truncate max-w-xs" title={r.resolution.notes}>
                "{r.resolution.notes}"
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
