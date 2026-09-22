import {
  WorkOrderLineItemEditorCore,
  computeMoney,
  isDraft,
  type EditableLine,
  type WorkOrderLineEditorAvailableAsset,
} from '@/components/WorkOrderLineItemEditorCore'
import type { WorkOrderLineItemDraft } from '@/types/workOrderLineItem'
import type { CatalogItem } from '@/types/catalogItem'

interface WorkOrderLineItemEditorBufferedProps {
  /** Drafts held in parent component state. */
  drafts: WorkOrderLineItemDraft[]

  /** Called when drafts change. Parent updates its state. */
  onChange: (drafts: WorkOrderLineItemDraft[]) => void

  /** Covered assets available for per-line tagging. */
  availableAssets?: WorkOrderLineEditorAvailableAsset[]

  /** Optional: disabled state during parent submit. */
  disabled?: boolean
}

/**
 * Generate a stable local-only ID for a new draft row.
 * Format: `draft_<timestamp>_<random>` to avoid collisions.
 */
function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Create a blank draft with sensible defaults.
 */
function blankDraft(assetId: string | null = null): WorkOrderLineItemDraft {
  return {
    draft_id: generateDraftId(),
    line_type: 'item',
    description: '',
    quantity: 1,
    unit_label: 'each',
    customer_cost_cents: 0,
    owner_cost_cents: 0,
    is_taxable: true,
    tax_rate_pct: 0,
    notes: null,
    show_image_on_doc: true,
    asset_id: assetId,
    catalog_item_id: null,
    tax_class_id: null,
    discount_id: null,
    discount_kind: null,
    discount_value: 0,
    subtotal_cents: 0,
    tax_amount_cents: 0,
    total_cents: 0,
    margin_cents: 0,
    discount_amount_cents: 0,
  }
}

/** A fee row — a flat charge with no cost/margin. */
function feeDraft(): WorkOrderLineItemDraft {
  return { ...blankDraft(), line_type: 'fee', description: 'Fee', is_taxable: false, tax_rate_pct: 0 }
}

/** A discount row — percent by default. */
function discountDraft(): WorkOrderLineItemDraft {
  return {
    ...blankDraft(),
    line_type: 'discount',
    description: 'Discount',
    is_taxable: false,
    tax_rate_pct: 0,
    discount_kind: 'percent',
    discount_value: 0,
  }
}

/**
 * WorkOrderLineItemEditorBuffered — buffer-mode line item editor.
 *
 * Used on the create form. Lines are held in parent React state until the
 * parent work order is saved, then POSTed sequentially via createLineItem.
 *
 * Money fields are computed client-side on every change (computeMoney mirrors
 * the server-side recalculateMoney logic). This gives instant preview without
 * any network round-trip.
 */
export function WorkOrderLineItemEditorBuffered({
  drafts,
  onChange,
  availableAssets = [],
  disabled = false,
}: WorkOrderLineItemEditorBufferedProps) {
  const defaultAssetId = availableAssets.length === 1 ? availableAssets[0].id : null

  const handleAdd = () => {
    onChange([...drafts, blankDraft(defaultAssetId)])
  }

  const handleAddFee = () => {
    onChange([...drafts, feeDraft()])
  }

  const handleAddDiscount = () => {
    onChange([...drafts, discountDraft()])
  }

  const handleChange = (key: string, patch: Partial<WorkOrderLineItemDraft>) => {
    onChange(
      drafts.map((draft) => {
        if (draft.draft_id !== key) return draft
        const merged = { ...draft, ...patch }
        const money = computeMoney(merged)
        return { ...merged, ...money }
      })
    )
  }

  const handleDelete = (key: string) => {
    onChange(drafts.filter((draft) => draft.draft_id !== key))
  }

  // Reorder by drag-and-drop. Rebuild the drafts array from the new
  // id sequence so the new order persists in local state immediately.
  // No server round-trip — these are drafts that haven't been POSTed
  // to the WO yet.
  const handleReorder = (newOrderIds: string[]) => {
    const byKey = new Map(drafts.map((d) => [d.draft_id, d]))
    const reordered = newOrderIds
      .map((id) => byKey.get(id))
      .filter((d): d is WorkOrderLineItemDraft => d !== undefined)
    onChange(reordered)
  }

  const handlePickFromCatalog = (item: CatalogItem) => {
    const draft: WorkOrderLineItemDraft = {
      ...blankDraft(defaultAssetId),
      description: item.name,
      quantity: item.default_quantity || 1,
      unit_label: item.unit_label || 'each',
      customer_cost_cents: item.pricing.customer_cost_cents,
      owner_cost_cents: item.pricing.owner_cost_cents,
      is_taxable: !!item.tax_class?.id,
      // Carry the catalog + tax-class refs (mirrors the Live editor) so the
      // saved line is taxed — the backend inherits the rate from the class.
      catalog_item_id: item.id,
      tax_class_id: item.tax_class?.id ?? null,
    }
    const money = computeMoney(draft)
    onChange([...drafts, { ...draft, ...money }])
  }

  return (
    <WorkOrderLineItemEditorCore
      lines={drafts as EditableLine[]}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      onReorder={handleReorder}
      onPickFromCatalog={handlePickFromCatalog}
      availableAssets={availableAssets}
      disabled={disabled}
    />
  )
}

export { isDraft, blankDraft }
