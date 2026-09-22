import {
  EstimateLineItemEditorCore,
  computeEstimateMoney,
  type EditableEstimateLine,
  type LineEditorAvailableAsset,
} from '@/components/EstimateLineItemEditorCore'
import type { EstimateLineItemDraft } from '@/types/estimateLineItem'
import type { CatalogItem } from '@/types/catalogItem'

interface EstimateLineItemEditorBufferedProps {
  drafts: EstimateLineItemDraft[]
  onChange: (drafts: EstimateLineItemDraft[]) => void
  /** Assets available for per-line tagging (parent's covered_assets). */
  availableAssets?: LineEditorAvailableAsset[]
  disabled?: boolean
}

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function blankEstimateLineDraft(): EstimateLineItemDraft {
  return {
    draft_id: generateDraftId(),
    type: 'service',
    line_type: 'item',
    description: '',
    quantity: 1,
    unit_price_cents: 0,
    service_catalog_item_id: null,
    tax_class_id: null,
    asset_id: null,
    show_image_on_doc: true,
    discount_id: null,
    discount_kind: null,
    discount_value: 0,
    line_total_cents: 0,
    tax_amount_cents: 0,
    total_cents: 0,
    discount_amount_cents: 0,
  }
}

/** A fee row — a plain charge labeled as a fee. */
function feeEstimateDraft(): EstimateLineItemDraft {
  return { ...blankEstimateLineDraft(), line_type: 'fee', description: 'Fee' }
}

/** A discount row — percent by default. */
function discountEstimateDraft(): EstimateLineItemDraft {
  return {
    ...blankEstimateLineDraft(),
    line_type: 'discount',
    description: 'Discount',
    discount_kind: 'percent',
    discount_value: 0,
  }
}

/**
 * Buffer-mode editor used on the estimate create form.
 * Drafts live in parent React state until the parent estimate is saved,
 * then get POSTed sequentially via createLineItem.
 */
export function EstimateLineItemEditorBuffered({
  drafts,
  onChange,
  availableAssets,
  disabled = false,
}: EstimateLineItemEditorBufferedProps) {
  const handleAdd = () => {
    onChange([...drafts, blankEstimateLineDraft()])
  }

  const handleAddFee = () => {
    onChange([...drafts, feeEstimateDraft()])
  }

  const handleAddDiscount = () => {
    onChange([...drafts, discountEstimateDraft()])
  }

  const handleChange = (key: string, patch: Partial<EstimateLineItemDraft>) => {
    onChange(
      drafts.map((draft) => {
        if (draft.draft_id !== key) return draft
        const merged = { ...draft, ...patch }
        const money = computeEstimateMoney(merged)
        return { ...merged, ...money }
      })
    )
  }

  const handleDelete = (key: string) => {
    onChange(drafts.filter((draft) => draft.draft_id !== key))
  }

  // Reorder by drag-and-drop. Each call hands us the new id sequence —
  // we rebuild the drafts array in that order so the local state
  // persists immediately (no server round-trip; this is the create
  // form, no rows exist on the server yet).
  const handleReorder = (newOrderIds: string[]) => {
    const byKey = new Map(drafts.map((d) => [d.draft_id, d]))
    const reordered = newOrderIds
      .map((id) => byKey.get(id))
      .filter((d): d is EstimateLineItemDraft => d !== undefined)
    onChange(reordered)
  }

  const handlePickFromCatalog = (item: CatalogItem) => {
    const draft: EstimateLineItemDraft = {
      ...blankEstimateLineDraft(),
      type: item.type === 'product' ? 'product' : 'service',
      description: item.name,
      quantity: item.default_quantity || 1,
      unit_price_cents: item.pricing.customer_cost_cents,
      service_catalog_item_id: item.id,
      tax_class_id: item.tax_class?.id ?? null,
    }
    const money = computeEstimateMoney(draft)
    onChange([...drafts, { ...draft, ...money }])
  }

  return (
    <EstimateLineItemEditorCore
      lines={drafts as EditableEstimateLine[]}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      dragMode={true}
      onReorder={handleReorder}
      availableAssets={availableAssets}
      onPickFromCatalog={handlePickFromCatalog}
      disabled={disabled}
    />
  )
}