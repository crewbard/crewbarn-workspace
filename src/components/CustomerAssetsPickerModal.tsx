import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useAssets } from '@/hooks/useAssets'
import { useCustomer } from '@/hooks/useCustomers'
import { NewAssetWizardModal } from '@/components/NewAssetWizardModal'
import type { Asset } from '@/types/asset'

/**
 * CustomerAssetsPickerModal - multi-select picker scoped to one customer's assets.
 *
 * Used by EstimateForm Stage 1 (covered-assets attachment per
 * CREWBARN-ASSET-LIFECYCLE-DESIGN.md). Same shape will work for
 * WorkOrderForm + InvoiceForm covered-assets sections when those land.
 *
 * Backend: GET /v1/assets?customer_id=... (customer_id filter shipped Day 15).
 *
 * UX: search input (filters client-side over the full result set), then a
 * checkbox-list of assets. Selection commits on each click via onChange,
 * so the parent always has the latest selection. "Done" just closes.
 */

interface CustomerAssetsPickerModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  serviceLocationId?: string
  selectedAssetIds: string[]
  onChange: (ids: string[], assets: Asset[]) => void
}

export function CustomerAssetsPickerModal({
  isOpen,
  onClose,
  customerId,
  serviceLocationId,
  selectedAssetIds,
  onChange,
}: CustomerAssetsPickerModalProps) {
  const { data, isLoading, isError } = useAssets(
    isOpen
      ? serviceLocationId
        ? { customer_service_location_id: serviceLocationId, per_page: 200 }
        : { customer_id: customerId, per_page: 200 }
      : undefined
  )
  const assets = data?.data ?? []
  const customerQuery = useCustomer(isOpen ? customerId : undefined)
  const customer = customerQuery.data ?? null
  const initialLocation = customer?.service_locations?.find((location) => location.id === serviceLocationId) ?? null

  const [query, setQuery] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setWizardOpen(false)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) => {
      const haystack = [
        a.name,
        a.asset_code,
        a.serial_number,
        a.asset_type?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [assets, query])

  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds])

  function toggle(asset: Asset) {
    let nextIds: string[]
    if (selectedSet.has(asset.id)) {
      nextIds = selectedAssetIds.filter((id) => id !== asset.id)
    } else {
      nextIds = [...selectedAssetIds, asset.id]
    }
    // Carry the asset shape so parent can render labels without extra fetch
    const nextAssets = nextIds
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is Asset => !!a)
    onChange(nextIds, nextAssets)
  }

  function selectAllVisible() {
    const visibleIds = filtered.map((a) => a.id)
    const merged = Array.from(new Set([...selectedAssetIds, ...visibleIds]))
    const nextAssets = merged
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is Asset => !!a)
    onChange(merged, nextAssets)
  }

  function clearAll() {
    onChange([], [])
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pick assets to cover"
      subtitle={`${selectedAssetIds.length} selected`}
      size="lg"
    >
      <Modal.Body>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, type…"
              className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="text-sm px-3 py-2 rounded-md border border-amber-500 text-amber-700 hover:bg-amber-50 whitespace-nowrap font-medium"
            >
              + Add new asset
            </button>
          </div>

          {isLoading && (
            <div className="text-sm text-slate-500 py-4 text-center">Loading…</div>
          )}
          {isError && (
            <div className="text-sm text-red-600 py-4">Failed to load assets.</div>
          )}

          {!isLoading && !isError && assets.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8">
              This customer has no assets yet.{' '}
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="text-amber-700 hover:underline font-medium"
              >
                Add the first one
              </button>
              .
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {filtered.length} of {assets.length} assets
                  {query ? ` match "${query}"` : ''}
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-amber-700 hover:underline"
                  >
                    Select all{query ? ' visible' : ''}
                  </button>
                  {selectedAssetIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <ul className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {filtered.map((asset) => {
                  const checked = selectedSet.has(asset.id)
                  return (
                    <li key={asset.id}>
                      <label
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-amber-50 ${
                          checked ? 'bg-amber-50/60' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(asset)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {asset.name}
                            {asset.is_secured && (
                              <span className="ml-2 text-xs">🔒</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {[
                              asset.asset_type?.name,
                              asset.asset_code,
                              asset.serial_number,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'No metadata'}
                          </div>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {!isLoading && assets.length > 0 && filtered.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-6">
              No assets match "{query}".
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white"
        >
          Done
        </button>
      </Modal.Footer>

      {wizardOpen && customer && (
        <NewAssetWizardModal
          isOpen
          onClose={() => setWizardOpen(false)}
          initialCustomer={customer}
          initialLocation={initialLocation}
          onCreated={(newAssetId) => {
            // Auto-select the just-created asset so it's already attached
            // when the user clicks Done. Asset object isn't in `assets`
            // yet (the list query refetches async); we'll re-resolve once
            // useAssets returns the new row.
            const nextIds = Array.from(new Set([...selectedAssetIds, newAssetId]))
            const nextAssets = nextIds
              .map((id) => assets.find((a) => a.id === id))
              .filter((a): a is Asset => !!a)
            onChange(nextIds, nextAssets)
            setWizardOpen(false)
          }}
        />
      )}
    </Modal>
  )
}
