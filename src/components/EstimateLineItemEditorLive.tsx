import {
  EstimateLineItemEditorCore,
  type EditableEstimateLine,
  type LineEditorAvailableAsset,
} from '@/components/EstimateLineItemEditorCore'
import {
  useEstimateLineItems,
  useCreateEstimateLineItem,
  useUpdateEstimateLineItem,
  useDeleteEstimateLineItem,
  useReorderEstimateLineItems,
} from '@/hooks/useEstimates'
import type { EstimateLineItemDraft } from '@/types/estimateLineItem'
import type { CatalogItem } from '@/types/catalogItem'

interface EstimateLineItemEditorLiveProps {
  estimateId: string
  /** Assets available for per-line tagging (parent's covered_assets). */
  availableAssets?: LineEditorAvailableAsset[]
}

/**
 * Live-mode editor used on the estimate detail page.
 *
 * Lines come from useEstimateLineItems (React Query). Each row commits
 * on blur, so onChange = "user finished editing" and we fire updateMutation.
 * Optimistic update in useUpdateEstimateLineItem keeps inputs flicker-free.
 *
 * 7b.2: drag-reorder enabled via dragMode={true}. Reorder uses optimistic
 * cache update - the new order shows immediately and rolls back on error.
 */
export function EstimateLineItemEditorLive({ estimateId, availableAssets }: EstimateLineItemEditorLiveProps) {
  const { data: lines = [], isLoading, error } = useEstimateLineItems(estimateId)
  const createMutation = useCreateEstimateLineItem()
  const updateMutation = useUpdateEstimateLineItem()
  const deleteMutation = useDeleteEstimateLineItem()
  const reorderMutation = useReorderEstimateLineItems()

  const handleAdd = () => {
    createMutation.mutate({
      estimateId,
      input: {
        type: 'service',
        description: 'New line item',
        quantity: 1,
        unit_price_cents: 0,
      },
    })
  }

  const handleAddFee = () => {
    createMutation.mutate({
      estimateId,
      input: {
        type: 'service',
        line_type: 'fee',
        description: 'Fee',
        quantity: 1,
        unit_price_cents: 0,
      },
    })
  }

  const handleAddDiscount = () => {
    createMutation.mutate({
      estimateId,
      input: {
        type: 'service',
        line_type: 'discount',
        description: 'Discount',
        quantity: 1,
        unit_price_cents: 0,
        discount_kind: 'percent',
        discount_value: 0,
      },
    })
  }

  const handleChange = (key: string, patch: Partial<EstimateLineItemDraft>) => {
    updateMutation.mutate({ estimateId, lineItemId: key, input: patch })
  }

  const handleDelete = (key: string) => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate({ estimateId, lineItemId: key })
  }

  const handleReorder = (newOrderIds: string[]) => {
    reorderMutation.mutate({ estimateId, order: newOrderIds })
  }

  const handlePickFromCatalog = (item: CatalogItem) => {
    createMutation.mutate({
      estimateId,
      input: {
        type: item.type === 'product' ? 'product' : 'service',
        description: item.name,
        quantity: item.default_quantity || 1,
        unit_price_cents: item.pricing.customer_cost_cents,
        service_catalog_item_id: item.id,
        tax_class_id: item.tax_class?.id ?? null,
      },
    })
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
    <EstimateLineItemEditorCore
      lines={lines as EditableEstimateLine[]}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      dragMode={true}
      onReorder={handleReorder}
      availableAssets={availableAssets}
      onPickFromCatalog={handlePickFromCatalog}
      saving={isSaving}
    />
  )
}