import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CustomerAssetsPickerModal } from '@/components/CustomerAssetsPickerModal'
import { apiRequest } from '@/lib/api'
import { workOrderKeys } from '@/hooks/useWorkOrders'
import type { WorkOrder } from '@/types/workOrder'

export function WorkOrderCustomerAssetsPanel({ wo }: { wo: WorkOrder }) {
  const qc = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => (wo.covered_assets ?? []).map((asset) => asset.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedIds((wo.covered_assets ?? []).map((asset) => asset.id))
  }, [wo.covered_assets])

  async function updateSelection(nextIds: string[]) {
    if (saving) return
    const previousIds = selectedIds
    const previous = new Set(previousIds)
    const next = new Set(nextIds)
    const added = nextIds.filter((id) => !previous.has(id))
    const removed = previousIds.filter((id) => !next.has(id))

    setSelectedIds(nextIds)
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        ...added.map((assetId) => apiRequest(`/v1/work-orders/${wo.id}/covered-assets`, {
          method: 'POST',
          body: { asset_id: assetId },
        })),
        ...removed.map((assetId) => apiRequest(`/v1/work-orders/${wo.id}/covered-assets/${assetId}`, {
          method: 'DELETE',
        })),
      ])
      await qc.invalidateQueries({ queryKey: workOrderKeys.detail(wo.id) })
    } catch (err) {
      setSelectedIds(previousIds)
      setError(err instanceof Error ? err.message : 'Could not update the job assets.')
    } finally {
      setSaving(false)
    }
  }

  const coveredAssets = wo.covered_assets ?? []

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Customer Assets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Attach the equipment or physical items serviced by this job.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={saving || !wo.service_customer_id}
          className="self-start rounded-md border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {coveredAssets.length > 0 ? 'Edit assets' : '+ Add customer asset'}
        </button>
      </header>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {saving && <div className="mb-4 text-xs font-medium text-amber-700">Saving asset changes...</div>}

        {coveredAssets.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-md border border-dashed border-slate-300 px-4 py-10 text-center hover:border-amber-400 hover:bg-amber-50/40"
          >
            <span className="block text-sm font-semibold text-slate-800">No customer assets attached</span>
            <span className="mt-1 block text-xs text-slate-500">Select an existing asset or create one for this service location.</span>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coveredAssets.map((asset) => (
              <div key={asset.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/assets?id=${asset.id}`} className="font-semibold text-slate-900 hover:text-amber-700 hover:underline">
                      {asset.name || asset.asset_code || 'Customer asset'}
                    </Link>
                    {asset.asset_code && <div className="mt-1 font-mono text-xs text-slate-500">{asset.asset_code}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void updateSelection(selectedIds.filter((id) => id !== asset.id))}
                    disabled={saving}
                    className="text-xs font-medium text-slate-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <CustomerAssetsPickerModal
          isOpen
          onClose={() => setPickerOpen(false)}
          customerId={wo.service_customer_id}
          serviceLocationId={wo.service_location_id}
          selectedAssetIds={selectedIds}
          onChange={(ids) => void updateSelection(ids)}
        />
      )}
    </section>
  )
}
