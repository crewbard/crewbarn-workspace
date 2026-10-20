import { useEffect, useRef, useState } from 'react'
import {
  EstimateLineItemEditorCore,
  type EditableEstimateLine,
  type LineEditorAvailableAsset,
} from '@/components/EstimateLineItemEditorCore'
import { EstimateTierBar } from '@/components/EstimateTierBar'
import {
  useEstimate,
  useEstimateLineItems,
  useCreateEstimateLineItem,
  useUpdateEstimateLineItem,
  useDeleteEstimateLineItem,
  useReorderEstimateLineItems,
  useAddEstimateOption,
  useUpdateEstimateOption,
  useRemoveEstimateOption,
} from '@/hooks/useEstimates'
import type { EstimateLineItemDraft } from '@/types/estimateLineItem'
import type { CatalogItem } from '@/types/catalogItem'
import { priceFromCost, usePricingRules } from '@/hooks/usePricingRules'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import type { PickedPart } from '@/lib/catalogOrders'
import { exactCatalogItemForPdfPart, openPdfCatalogForLine, pdfLineReviewNote, pdfPartLineDescription } from '@/lib/pdfCatalogLine'

interface EstimateLineItemEditorLiveProps {
  estimateId: string
  /** Assets available for per-line tagging (parent's covered_assets). */
  availableAssets?: LineEditorAvailableAsset[]
  /** Read-only for people who can't edit estimates. */
  disabled?: boolean
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

export function EstimateLineItemEditorLive({ estimateId, availableAssets, disabled = false }: EstimateLineItemEditorLiveProps) {
  const { has } = usePermissions()
  const { data: allLines = [], isLoading, error } = useEstimateLineItems(estimateId)
  const { data: estimate } = useEstimate(estimateId)
  const createMutation = useCreateEstimateLineItem()
  const updateMutation = useUpdateEstimateLineItem()
  const deleteMutation = useDeleteEstimateLineItem()
  const reorderMutation = useReorderEstimateLineItems()
  const addOption = useAddEstimateOption()
  const updateOption = useUpdateEstimateOption()
  const removeOption = useRemoveEstimateOption()

  /*
   * Editing and reordering roll back on failure, and because their hooks
   * declare an onError for that, the app-wide "not saved" banner stays
   * quiet — so the line just snapped back with no word why. Same fix as
   * the work order editor: show the server's message here.
   */
  const [failure, setFailure] = useState<string | null>(null)
  const report = {
    onError: (e: unknown) => setFailure(e instanceof Error ? e.message : 'That change could not be saved.'),
    onSuccess: () => setFailure(null),
  }

  /*
   * Good / better / best. With options, the editor shows the open tab's
   * lines (its own plus any in every option), new lines go into that tab,
   * and "+ New tier" adds a copy of it. Options only change while the
   * estimate is a draft or waiting for an answer.
   */
  const options = estimate?.options ?? []
  const tiered = options.length > 0
  const [pickedTier, setPickedTier] = useState<string | null>(null)
  const activeTier = options.find((o) => o.id === pickedTier) ?? options[0] ?? null
  const optionsOpen = !estimate || estimate.status === 'draft' || estimate.status === 'sent'
  const lines = activeTier
    ? allLines.filter((l) => !l.estimate_option_id || l.estimate_option_id === activeTier.id)
    : allLines
  const inTier = activeTier ? { estimate_option_id: activeTier.id } : {}

  const handleAddTier = () => {
    addOption.mutate(
      { estimateId, input: activeTier ? { copy_from_option_id: activeTier.id } : {} },
      {
        onSuccess: (est) => {
          const added = est.options ?? []
          setPickedTier(added[added.length - 1]?.id ?? null)
        },
        onError: (err) => {
          const e = err as { details?: { reason?: string }; message?: string }
          alert(e?.details?.reason ?? e?.message ?? 'Could not add a tier.')
        },
      },
    )
  }

  const handleAdd = () => {
    createMutation.mutate({
      estimateId,
      input: {
        ...inTier,
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
        ...inTier,
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
        ...inTier,
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
    updateMutation.mutate({ estimateId, lineItemId: key, input: patch }, report)
  }

  const handleDelete = (key: string) => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate({ estimateId, lineItemId: key })
  }

  const handleReorder = (newOrderIds: string[]) => {
    reorderMutation.mutate({ estimateId, order: newOrderIds }, report)
  }

  const pricing = usePricingRules()
  const pdfPickRef = useRef<(part: PickedPart) => Promise<string>>(async () => '')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handlePickFromCatalog = (item: CatalogItem) => {
    createMutation.mutate({
      estimateId,
      input: {
        ...inTier,
        type: item.type === 'product' ? 'product' : 'service',
        description: item.name,
        quantity: item.default_quantity || 1,
        unit_price_cents: unitPriceFor(item, pricing?.material_markup_percent ?? null),
        service_catalog_item_id: item.id,
        tax_class_id: item.tax_class?.id ?? null,
      },
    })
  }

  useEffect(() => {
    pdfPickRef.current = async (part) => {
    if (!mountedRef.current || disabled || !optionsOpen || !has(PERM.CATALOG_VIEW)) throw new Error('This estimate is no longer editable. Reopen its line items when editing is available.')
    const item = await exactCatalogItemForPdfPart(part)
    if (!mountedRef.current || disabled || !optionsOpen || !has(PERM.CATALOG_VIEW)) throw new Error('This estimate is no longer editable. Reopen its line items when editing is available.')
    await createMutation.mutateAsync({
      estimateId,
      input: {
        ...inTier,
        type: item ? (item.type === 'product' ? 'product' : 'service') : 'product',
        description: item?.name ?? pdfPartLineDescription(part),
        quantity: item?.default_quantity || part.qty || 1,
        unit_price_cents: item
          ? unitPriceFor(item, pricing?.material_markup_percent ?? null)
          : part.list_price_cents ?? 0,
        service_catalog_item_id: item?.id ?? null,
        tax_class_id: item?.tax_class?.id ?? null,
      },
    })
    return pdfLineReviewNote(!!item)
    }
  })

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
    reorderMutation.isPending ||
    addOption.isPending ||
    updateOption.isPending ||
    removeOption.isPending

  const tierBar = tiered && activeTier ? (
    <EstimateTierBar
      tiers={options.map((o) => ({
        key: o.id,
        name: o.name,
        highlights: o.highlights ?? '',
        is_recommended: o.is_recommended,
        totalCents: o.money.total_cents,
        ownLineCount: allLines.filter((l) => l.estimate_option_id === o.id).length,
      }))}
      activeKey={activeTier.id}
      onSelect={setPickedTier}
      onRename={(key, name) => updateOption.mutate({ estimateId, optionId: key, input: { name } })}
      onHighlights={(key, highlights) =>
        updateOption.mutate({ estimateId, optionId: key, input: { highlights: highlights || null } })}
      onRecommend={(key, recommended) =>
        updateOption.mutate({ estimateId, optionId: key, input: { is_recommended: recommended } })}
      onRemove={(key) => {
        removeOption.mutate({ estimateId, optionId: key })
        setPickedTier(null)
      }}
      disabled={disabled || !optionsOpen}
    />
  ) : null

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
    <EstimateLineItemEditorCore
      lines={lines as EditableEstimateLine[]}
      tierBar={tierBar}
      onAddTier={!disabled && optionsOpen && options.length < 4 ? handleAddTier : undefined}
      addTierLabel={tiered ? '+ New tier' : '+ New tier (good / better / best)'}
      lineNote={tiered ? (line) => ('estimate_option_id' in line && !line.estimate_option_id ? 'In every tier' : null) : undefined}
      onAdd={handleAdd}
      onAddFee={handleAddFee}
      onAddDiscount={handleAddDiscount}
      onChange={handleChange}
      onDelete={handleDelete}
      dragMode={true}
      onReorder={handleReorder}
      availableAssets={availableAssets}
      onPickFromCatalog={handlePickFromCatalog}
      onOpenPdf={!disabled && optionsOpen && has(PERM.CATALOG_VIEW) ? () => openPdfCatalogForLine((part) => pdfPickRef.current(part)) : undefined}
      saving={isSaving}
      disabled={disabled}
    />
    </>
  )
}
