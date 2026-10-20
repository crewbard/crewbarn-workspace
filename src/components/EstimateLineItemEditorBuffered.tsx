import { useEffect, useRef, useState } from 'react'
import {
  EstimateLineItemEditorCore,
  computeEstimateMoney,
  computeEstimateTotals,
  type EditableEstimateLine,
  type LineEditorAvailableAsset,
} from '@/components/EstimateLineItemEditorCore'
import { EstimateTierBar } from '@/components/EstimateTierBar'
import type { EstimateLineItemDraft, EstimateOptionDraft } from '@/types/estimateLineItem'
import type { CatalogItem } from '@/types/catalogItem'
import { priceFromCost, usePricingRules } from '@/hooks/usePricingRules'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import type { PickedPart } from '@/lib/catalogOrders'
import { exactCatalogItemForPdfPart, openPdfCatalogForLine, pdfLineReviewNote, pdfPartLineDescription } from '@/lib/pdfCatalogLine'

interface EstimateLineItemEditorBufferedProps {
  drafts: EstimateLineItemDraft[]
  onChange: (drafts: EstimateLineItemDraft[]) => void
  /** Assets available for per-line tagging (parent's covered_assets). */
  availableAssets?: LineEditorAvailableAsset[]
  disabled?: boolean
  openPdfRequest?: number | null
  onPdfRequestHandled?: () => void
  /**
   * Good / better / best. Pass both to offer tiers on the form: options
   * is the tiers built so far, onTiersChange takes the lines and tiers
   * together (adding a tier copies lines, so they change at once).
   */
  options?: EstimateOptionDraft[]
  onTiersChange?: (next: { drafts: EstimateLineItemDraft[]; options: EstimateOptionDraft[] }) => void
}

function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** The names a new tier gets. The same list the server uses. */
const TIER_NAMES = ['Good', 'Better', 'Best']

function newTier(position: number): EstimateOptionDraft {
  return {
    key: `tier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: TIER_NAMES[position - 1] ?? `Option ${position}`,
    highlights: '',
    is_recommended: false,
  }
}


/**
 * What this catalog item should cost the customer on a line.
 *
 * The catalog price when there is one. When there is not, the shop's own
 * material markup applied to what the part cost — better than the $0 that
 * used to go out on the estimate. With no markup set it stays 0, because
 * inventing a price is worse than showing an obvious blank.
 */
function unitPriceFor(item: CatalogItem, markupPercent: number | null): number {
  const listed = item.pricing.customer_cost_cents
  if (listed > 0) return listed
  return priceFromCost(item.pricing.owner_cost_cents ?? 0, markupPercent) ?? listed
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
  options = [],
  onTiersChange,
  openPdfRequest = null,
  onPdfRequestHandled,
}: EstimateLineItemEditorBufferedProps) {
  // Good / better / best: the open tab's lines are the ones in the editor,
  // and new lines go into it.
  const tiered = options.length > 0
  const { has } = usePermissions()
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const active = options.find((o) => o.key === pickedKey) ?? options[0] ?? null
  const inActive = (d: EstimateLineItemDraft) => !active || !d.option_key || d.option_key === active.key
  const visible = drafts.filter(inActive)
  const tag = (d: EstimateLineItemDraft): EstimateLineItemDraft => (active ? { ...d, option_key: active.key } : d)
  const draftsRef = useRef(drafts)
  const pdfPickRef = useRef<(part: PickedPart) => Promise<string>>(async () => '')
  const mountedRef = useRef(true)
  const processedPdfRequestRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleAdd = () => {
    onChange([...drafts, tag(blankEstimateLineDraft())])
  }

  const handleAddFee = () => {
    onChange([...drafts, tag(feeEstimateDraft())])
  }

  const handleAddDiscount = () => {
    onChange([...drafts, tag(discountEstimateDraft())])
  }

  // A new tier starts as a copy of the open one. The first turns what is
  // there into Good and the copy into Better.
  const handleAddTier = () => {
    if (!onTiersChange) return
    if (!tiered) {
      const good = newTier(1)
      const better = newTier(2)
      onTiersChange({
        drafts: [
          ...drafts.map((d) => ({ ...d, option_key: good.key })),
          ...drafts.map((d) => ({ ...d, draft_id: generateDraftId(), option_key: better.key })),
        ],
        options: [good, better],
      })
      setPickedKey(better.key)
      return
    }
    if (!active || options.length >= 4) return
    const next = newTier(options.length + 1)
    const copies = drafts
      .filter((d) => d.option_key === active.key)
      .map((d) => ({ ...d, draft_id: generateDraftId(), option_key: next.key }))
    onTiersChange({ drafts: [...drafts, ...copies], options: [...options, next] })
    setPickedKey(next.key)
  }

  const setTiers = (nextOptions: EstimateOptionDraft[]) => onTiersChange?.({ drafts, options: nextOptions })

  const handleRemoveTier = (key: string) => {
    if (!onTiersChange) return
    const left = options.filter((o) => o.key !== key)
    const kept = drafts.filter((d) => d.option_key !== key)
    // One tier left is just the quote.
    onTiersChange(
      left.length <= 1
        ? { drafts: kept.map((d) => ({ ...d, option_key: null })), options: [] }
        : { drafts: kept, options: left },
    )
    setPickedKey(null)
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
    // With tiers only the open tab's lines moved: they take their new
    // order in the places they held, and every other line stays put.
    const moved = new Set(reordered.map((d) => d.draft_id))
    let i = 0
    onChange(drafts.map((d) => (moved.has(d.draft_id) ? reordered[i++] : d)))
  }

  const pricing = usePricingRules()

  const handlePickFromCatalog = (item: CatalogItem) => {
    const draft: EstimateLineItemDraft = {
      ...blankEstimateLineDraft(),
      type: item.type === 'product' ? 'product' : 'service',
      description: item.name,
      quantity: item.default_quantity || 1,
      unit_price_cents: unitPriceFor(item, pricing?.material_markup_percent ?? null),
      service_catalog_item_id: item.id,
      tax_class_id: item.tax_class?.id ?? null,
    }
    const money = computeEstimateMoney(draft)
    onChange([...drafts, tag({ ...draft, ...money })])
  }

  useEffect(() => {
    draftsRef.current = drafts
    pdfPickRef.current = async (part) => {
    if (!mountedRef.current || disabled || !has(PERM.CATALOG_VIEW)) throw new Error('This estimate is no longer editable. Reopen its line items when editing is available.')
    const item = await exactCatalogItemForPdfPart(part)
    if (!mountedRef.current || disabled || !has(PERM.CATALOG_VIEW)) throw new Error('This estimate is no longer editable. Reopen its line items when editing is available.')
    const draft: EstimateLineItemDraft = item ? {
      ...blankEstimateLineDraft(),
      type: item.type === 'product' ? 'product' : 'service',
      description: item.name,
      quantity: item.default_quantity || 1,
      unit_price_cents: unitPriceFor(item, pricing?.material_markup_percent ?? null),
      service_catalog_item_id: item.id,
      tax_class_id: item.tax_class?.id ?? null,
    } : {
      ...blankEstimateLineDraft(),
      type: 'product',
      description: pdfPartLineDescription(part),
      quantity: part.qty ?? 1,
      unit_price_cents: part.list_price_cents ?? 0,
    }
    const next = [...draftsRef.current, tag({ ...draft, ...computeEstimateMoney(draft) })]
    draftsRef.current = next
    onChange(next)
    return pdfLineReviewNote(!!item)
    }
  })

  useEffect(() => {
    if (!openPdfRequest) return
    if (processedPdfRequestRef.current === openPdfRequest) return
    processedPdfRequestRef.current = openPdfRequest
    if (!disabled && has(PERM.CATALOG_VIEW)) openPdfCatalogForLine((part) => pdfPickRef.current(part))
    onPdfRequestHandled?.()
  // Run once per request, after the picker callback is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPdfRequest])

  const tierBar = tiered && active ? (
    <EstimateTierBar
      tiers={options.map((o) => ({
        key: o.key,
        name: o.name,
        highlights: o.highlights,
        is_recommended: o.is_recommended,
        totalCents: computeEstimateTotals(drafts.filter((d) => !d.option_key || d.option_key === o.key)).total,
        ownLineCount: drafts.filter((d) => d.option_key === o.key).length,
      }))}
      activeKey={active.key}
      onSelect={setPickedKey}
      onRename={(key, name) => setTiers(options.map((o) => (o.key === key ? { ...o, name } : o)))}
      onHighlights={(key, highlights) => setTiers(options.map((o) => (o.key === key ? { ...o, highlights } : o)))}
      onRecommend={(key, recommended) =>
        setTiers(options.map((o) => ({ ...o, is_recommended: o.key === key ? recommended : recommended ? false : o.is_recommended })))}
      onRemove={handleRemoveTier}
      disabled={disabled}
    />
  ) : null

  return (
    <EstimateLineItemEditorCore
      lines={visible as EditableEstimateLine[]}
      tierBar={tierBar}
      onAddTier={onTiersChange && !disabled && options.length < 4 ? handleAddTier : undefined}
      addTierLabel={tiered ? '+ New tier' : '+ New tier (good / better / best)'}
      lineNote={tiered ? (line) => ((line as EstimateLineItemDraft).option_key ? null : 'In every tier') : undefined}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      dragMode={true}
      onReorder={handleReorder}
      availableAssets={availableAssets}
      onPickFromCatalog={handlePickFromCatalog}
      onOpenPdf={!disabled && has(PERM.CATALOG_VIEW) ? () => openPdfCatalogForLine((part) => pdfPickRef.current(part)) : undefined}
      disabled={disabled}
    />
  )
}
