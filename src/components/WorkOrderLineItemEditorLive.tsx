import { useState } from 'react'
import {
  WorkOrderLineItemEditorCore,
  type EditableLine,
  type WorkOrderLineEditorAvailableAsset,
} from '@/components/WorkOrderLineItemEditorCore'
import {
  useLineItems,
  useCreateLineItem,
  useUpdateLineItem,
  useDeleteLineItem,
  useReorderLineItems,
} from '@/hooks/useWorkOrders'
import type { WorkOrderLineItemDraft } from '@/types/workOrderLineItem'
import type { CatalogItem } from '@/types/catalogItem'

interface WorkOrderLineItemEditorLiveProps {
  /** Rendered under the totals — see WorkOrderLineItemEditorCore. */
  footer?: React.ReactNode
  /** Server-side work order ID. Required — line items can't exist without a parent WO. */
  workOrderId: string

  /** Covered assets available for per-line tagging. */
  availableAssets?: WorkOrderLineEditorAvailableAsset[]
}

/**
 * WorkOrderLineItemEditorLive — live-mode line item editor.
 *
 * Lines from useLineItems (React Query). Each onChange fires updateMutation
 * directly — LineRow already debounces via blur, so onChange = "user finished
 * editing this field." No setTimeout buffer here.
 *
 * The mutation has optimistic cache updates (see useUpdateLineItem in
 * useWorkOrders.ts), so inputs don't flash back to old values during save.
 */
export function WorkOrderLineItemEditorLive({ workOrderId, availableAssets = [], footer }: WorkOrderLineItemEditorLiveProps) {
  const { data: lines = [], isLoading, error } = useLineItems(workOrderId)

  /**
   * Every mutation below used to be fire-and-forget — no onError anywhere. A
   * refused add did nothing at all: no row, no message, no clue. The server
   * has plenty to say in those cases (the invoice is paid and locked, the
   * asset is not on this job, write-ins are off for this shop) and all of it
   * was being thrown away, so the only symptom was a line item that never
   * appeared.
   *
   * ApiError already folds the server's message — or the first validation
   * error — into Error.message, so showing it is the whole fix.
   */
  const [failure, setFailure] = useState<string | null>(null)
  const onError = (e: unknown) =>
    setFailure(e instanceof Error ? e.message : 'That change could not be saved.')
  const onSuccess = () => setFailure(null)
  const report = { onError, onSuccess }
  const createMutation = useCreateLineItem()
  const defaultAssetId = availableAssets.length === 1 ? availableAssets[0].id : null
  const updateMutation = useUpdateLineItem()
  const deleteMutation = useDeleteLineItem()
  const reorderMutation = useReorderLineItems()

  const handleAdd = () => {
    createMutation.mutate({
      workOrderId,
      input: {
        description: 'New line item',
        quantity: 1,
        unit_label: 'each',
        customer_cost_cents: 0,
        is_taxable: false,
        tax_rate_pct: 0,
        asset_id: defaultAssetId,
      },
    }, report)
  }

  const handleAddFee = () => {
    createMutation.mutate({
      workOrderId,
      input: {
        line_type: 'fee',
        description: 'Fee',
        quantity: 1,
        unit_label: 'each',
        customer_cost_cents: 0,
        is_taxable: false,
        tax_rate_pct: 0,
      },
    }, report)
  }

  const handleAddDiscount = () => {
    createMutation.mutate({
      workOrderId,
      input: {
        line_type: 'discount',
        description: 'Discount',
        quantity: 1,
        unit_label: 'each',
        customer_cost_cents: 0,
        is_taxable: false,
        tax_rate_pct: 0,
        discount_kind: 'percent',
        discount_value: 0,
      },
    }, report)
  }

  const handleChange = (key: string, patch: Partial<WorkOrderLineItemDraft>) => {
    // LineRow commits on blur → patch is final. Fire mutation directly.
    // Optimistic update in useUpdateLineItem keeps the UI flicker-free.
    updateMutation.mutate({ workOrderId, lineItemId: key, input: patch }, report)
  }

  const handleDelete = (key: string) => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate({ workOrderId, lineItemId: key }, report)
  }

  const handleReorder = (orderedIds: string[]) => {
    reorderMutation.mutate({ workOrderId, order: orderedIds }, report)
  }

  const handlePickFromCatalog = (item: CatalogItem) => {
    createMutation.mutate({
      workOrderId,
      input: {
        description: item.name,
        quantity: item.default_quantity || 1,
        unit_label: item.unit_label || 'each',
        customer_cost_cents: item.pricing.customer_cost_cents,
        owner_cost_cents: item.pricing.owner_cost_cents,
        is_taxable: !!item.tax_class?.id,
        tax_rate_pct: 0,
        catalog_item_id: item.id,
        tax_class_id: item.tax_class?.id ?? null,
        asset_id: defaultAssetId,
      },
    }, report)
  }

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading line items...</div>
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Failed to load line items: {String(error)}
      </div>
    )
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending

  return (
    <>
      {failure && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex-1">{failure}</span>
          <button
            type="button"
            onClick={() => setFailure(null)}
            className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Dismiss
          </button>
        </div>
      )}
    <WorkOrderLineItemEditorCore
      footer={footer}
      lines={lines as EditableLine[]}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      onReorder={handleReorder}
      onPickFromCatalog={handlePickFromCatalog}
      availableAssets={availableAssets}
      saving={isSaving}
    />
    </>
  )
}
