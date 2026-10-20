import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { CatalogItemQuickCreate } from '@/components/CatalogItemQuickCreate'
import { useCatalogItems } from '@/hooks/useCatalogItems'
import { useUpdatePurchaseOrderItem } from '@/hooks/usePurchaseOrders'
import type { CatalogItem } from '@/types/catalogItem'
import type { InventoryBin } from '@/types/inventoryBin'

/** The few facts about a PO line this needs (a full PurchaseOrderItem or a receivable line). */
export interface PoLineForProduct {
  id: string
  description: string
  part_number?: string | null
  unit_cost_cents?: number | null
}

/**
 * A purchase-order line that is not in the catalog yet: make it a product,
 * or link one that exists. Saving links the product to the line
 * (PATCH /v1/purchase-orders/{po}/items/{item}), then onLinked lets the
 * caller go straight back to receiving that line.
 *
 * One flow for the PO page and the Bins "Add from a purchase order" window.
 * "Create" is the same New product window as everywhere else
 * (CatalogItemQuickCreate), prefilled from the line: name, description,
 * the vendor as supplier, the line price as owner cost, the vendor part
 * number as SKU, and the bin it is being received into as its Default Bin.
 * The stock itself comes in by receiving the line, so the window asks for
 * no starting quantity (PO-only rules stay intact).
 *
 * Moved here from PurchaseOrderDetailPage, whose own copy of the product
 * form is gone.
 */
export function LinkOrCreateCatalogItemModal({
  poId,
  line,
  vendorLabel,
  defaultBin = null,
  onClose,
  onLinked,
  defaultStocked,
}: {
  poId: string
  line: PoLineForProduct
  vendorLabel: string | null
  /** Where the line is being received: becomes the new product's Default Bin. */
  defaultBin?: InventoryBin | null
  onClose: () => void
  onLinked?: (item: CatalogItem) => void
  /** False = the new product starts as Not stocked (receive overlay). */
  defaultStocked?: boolean
}) {
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [error, setError] = useState<string | null>(null)
  const updateLine = useUpdatePurchaseOrderItem(poId)
  // The New product window closes itself right after it saves; stay open
  // until the line is linked, so a failed link is not lost.
  const made = useRef(false)

  const [query, setQuery] = useState(line.description ?? '')
  const [debounced, setDebounced] = useState(query.trim())
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query])
  const pickerResults = useCatalogItems({ q: debounced || undefined, type: 'product', active: true, per_page: 12 })

  async function link(item: CatalogItem) {
    setError(null)
    try {
      await updateLine.mutateAsync({ itemId: line.id, input: { catalog_item_id: item.id } })
      onLinked?.(item)
      onClose()
    } catch (err) {
      // The product exists either way; say so, and keep the window open to retry.
      setError(`${err instanceof Error ? err.message : String(err)} The product "${item.name}" is saved; pick it under "Link an existing product" to try again.`)
      setMode('link')
    }
  }

  if (mode === 'create') {
    return (
      <CatalogItemQuickCreate
        title={`New product for "${line.description}"`}
        defaultName={line.description}
        defaultLongDescription={line.part_number ? `Vendor part number: ${line.part_number}` : ''}
        defaultSku={line.part_number ?? ''}
        defaultSupplierName={vendorLabel ?? ''}
        defaultUnitCostCents={line.unit_cost_cents ?? 0}
        initialDefaultBinId={defaultBin?.id ?? ''}
        initialDefaultPickedBin={defaultBin}
        stockComesFromPo
        defaultStocked={defaultStocked}
        onCreated={(item) => { made.current = true; void link(item) }}
        onClose={() => { if (!made.current) onClose() }}
        extraFooter={
          <button type="button" data-link-existing onClick={() => setMode('link')}
            className="mr-auto px-3 py-2 text-sm font-medium text-slate-700 underline hover:text-slate-900">
            Link an existing product instead
          </button>
        }
      />
    )
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`Link a product to "${line.description}"`} size="lg">
      <Modal.Body>
        <div data-tour="po-detail-link" className="space-y-3">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder="Search the catalog by name or SKU…" aria-label="Search the catalog"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
            {pickerResults.isLoading && <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>}
            {pickerResults.isError && (
              <div role="alert" className="px-3 py-2 text-xs text-red-700">
                Product search could not be loaded.
                <button type="button" disabled={pickerResults.isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void pickerResults.refetch()}>Try again</button>
              </div>
            )}
            {!pickerResults.isLoading && !pickerResults.isError && (pickerResults.data?.data ?? []).length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">{debounced ? 'No matches.' : 'Start typing to search.'}</div>
            )}
            {!pickerResults.isError && (pickerResults.data?.data ?? []).map((it) => (
              <button key={it.id} type="button" onClick={() => void link(it)} disabled={updateLine.isPending}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-amber-50 disabled:opacity-50">
                <div className="font-medium text-slate-800">{it.name}</div>
                {it.sku && <div className="font-mono text-xs text-slate-500">{it.sku}</div>}
              </button>
            ))}
          </div>
          {error && <div role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={() => setMode('create')} className="mr-auto px-3 py-2 text-sm font-medium text-slate-700 underline">Create a new product instead</button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancel</button>
      </Modal.Footer>
    </Modal>
  )
}
