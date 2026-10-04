import { useState, useEffect, useRef, memo, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  EstimateLineItem,
  EstimateLineItemDraft,
  EstimateLineItemType,
  LineType,
} from '@/types/estimateLineItem'
import { CatalogItemPickerModal } from '@/components/CatalogItemPickerModal'
import { CatalogDescriptionInput } from '@/components/CatalogDescriptionInput'
import { useTaxClasses } from '@/hooks/useTaxClasses'
import { ScanToAddLineItem } from '@/components/ScanToAddLineItem'
import { usePricingRules } from '@/hooks/usePricingRules'

/**
 * Unified row shape for the editor - either a server line item OR a draft.
 * Drafts have draft_id; server lines have id.
 */
export type EditableEstimateLine = EstimateLineItem | EstimateLineItemDraft

export function isEstimateDraft(line: EditableEstimateLine): line is EstimateLineItemDraft {
  return 'draft_id' in line
}

export function getEstimateLineKey(line: EditableEstimateLine): string {
  return isEstimateDraft(line) ? line.draft_id : line.id
}

/** Row kind, defaulting to 'item' for legacy lines. */
export function estimateLineTypeOf(line: EditableEstimateLine): LineType {
  return ((line as { line_type?: LineType }).line_type ?? 'item')
}

/** Discount in cents — percent (0–100) or fixed dollars, clamped to [0, base]. */
function computeDiscountCents(
  baseCents: number,
  kind: 'percent' | 'fixed' | null | undefined,
  value: number,
): number {
  if (baseCents <= 0 || !value || value <= 0 || !kind) return 0
  const amount =
    kind === 'percent'
      ? Math.round((baseCents * Math.min(value, 100)) / 100)
      : Math.round(value * 100)
  return Math.max(0, Math.min(amount, baseCents))
}

/**
 * Compute money fields client-side for buffer-mode preview.
 * Tax always 0 client-side - server recalculates from tax_class_id on save.
 */
export function computeEstimateMoney(input: {
  quantity: number
  unit_price_cents: number
  discount_kind?: 'percent' | 'fixed' | null
  discount_value?: number
}) {
  const qty = Number(input.quantity) || 0
  const unitPrice = Number(input.unit_price_cents) || 0
  const lineTotal = Math.round(qty * unitPrice)

  // Mirrors EstimateLineItem::computeDiscountCents (percent 0–100 or fixed
  // dollars, clamped to [0, lineTotal]). Tax is computed server-side from the
  // tax_class, so client preview keeps tax at 0.
  const kind = input.discount_kind ?? null
  const value = Number(input.discount_value) || 0
  let discount = 0
  if (lineTotal > 0 && value > 0 && kind) {
    discount =
      kind === 'percent'
        ? Math.round((lineTotal * Math.min(value, 100)) / 100)
        : Math.round(value * 100)
    discount = Math.max(0, Math.min(discount, lineTotal))
  }

  return {
    line_total_cents: lineTotal,
    discount_amount_cents: discount,
    tax_amount_cents: 0,
    total_cents: lineTotal - discount,
  }
}

export function formatCents(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

// ---------- Component props ----------

/**
 * Minimal shape for an asset shown in the per-line "For asset" dropdown.
 * Sourced from the parent estimate's covered_assets list (Stage 2 of
 * CREWBARN-ASSET-LIFECYCLE-DESIGN.md).
 */
export interface LineEditorAvailableAsset {
  id: string
  name: string | null
}

export interface EstimateLineItemEditorCoreProps {
  lines: EditableEstimateLine[]
  onAdd: () => void
  /** Add a fee row (line_type='fee'). Omit to hide. */
  onAddFee?: () => void
  /** Add a discount row (line_type='discount'). Omit to hide. */
  onAddDiscount?: () => void
  onChange: (key: string, patch: Partial<EstimateLineItemDraft>) => void
  onDelete: (key: string) => void
  /**
   * If true, lines are wrapped in a sortable DnD context with drag handles.
   * Pair with onReorder. Only meaningful for live mode (real line ids).
   */
  dragMode?: boolean
  onReorder?: (newOrderIds: string[]) => void
  /**
   * Slice 13c follow-up Phase 1 #3: assets covered by the parent estimate.
   * When non-empty, each line row gets a "For asset" dropdown scoped to
   * this list so a tech can tag each line to a specific asset. Empty
   * array hides the dropdown entirely (no estimate-level coverage yet).
   */
  availableAssets?: LineEditorAvailableAsset[]
  /**
   * Renders a "+ Search catalog" button next to "+ Add line item". When
   * the user picks an item, parent's handler turns it into a new draft.
   * Omit to hide the button entirely (back-compat with older callers).
   */
  onPickFromCatalog?: (item: import('@/types/catalogItem').CatalogItem) => void
  disabled?: boolean
  saving?: boolean
}

// ---------- Component ----------

export function EstimateLineItemEditorCore({
  lines,
  onAdd,
  onAddFee,
  onAddDiscount,
  onChange,
  onDelete,
  dragMode = false,
  onReorder,
  availableAssets = [],
  onPickFromCatalog,
  disabled = false,
  saving = false,
}: EstimateLineItemEditorCoreProps) {
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const oldIndex = lines.findIndex((l) => getEstimateLineKey(l) === active.id)
    const newIndex = lines.findIndex((l) => getEstimateLineKey(l) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(lines, oldIndex, newIndex)
    onReorder(reordered.map(getEstimateLineKey))
  }

  // Items + fees build the base; discount rows are separate. Tax is computed
  // server-side from tax classes, so client preview keeps tax at 0 (the
  // server scales it by the post-discount fraction on save).
  const lineTotalOf = (l: EditableEstimateLine) =>
    isEstimateDraft(l) ? l.line_total_cents : l.money.line_total_cents
  const taxOf = (l: EditableEstimateLine) =>
    isEstimateDraft(l) ? l.tax_amount_cents : l.money.tax_amount_cents
  const discountFieldsOf = (l: EditableEstimateLine) =>
    isEstimateDraft(l)
      ? { kind: l.discount_kind, value: l.discount_value }
      : { kind: l.money.discount_kind, value: l.money.discount_value }

  const itemLines = lines.filter((l) => estimateLineTypeOf(l) !== 'discount')
  const discountLines = lines.filter((l) => estimateLineTypeOf(l) === 'discount')

  const base = itemLines.reduce((s, l) => s + lineTotalOf(l), 0)
  const fullTax = itemLines.reduce((s, l) => s + taxOf(l), 0)

  const discountAmounts = new Map<string, number>()
  let discountRunning = 0
  for (const d of discountLines) {
    const { kind, value } = discountFieldsOf(d)
    const amt = computeDiscountCents(base - discountRunning, kind ?? null, Number(value) || 0)
    discountAmounts.set(getEstimateLineKey(d), amt)
    discountRunning += amt
  }
  const discountTotal = discountRunning
  const taxAfter = base > 0 ? Math.round((fullTax * (base - discountTotal)) / base) : 0
  const totals = {
    subtotal: base,
    discount: discountTotal,
    tax: taxAfter,
    total: base - discountTotal + taxAfter,
  }

  /*
   * Is this estimate under the minimum the shop said it would turn out for?
   *
   * Only once there is something on it — an empty estimate is not under
   * anything, it is just empty — and only when a minimum has been set.
   */
  const pricing = usePricingRules()
  const floor = pricing?.minimum_service_call ?? null
  const belowFloor =
    floor !== null && floor > 0 && totals.total > 0 && totals.total < Math.round(floor * 100)
      ? floor
      : null

  // 14-col grid:
  //   With drag handle:  drag(1) desc(4) type(2) qty(1) unit-price(2) tax(2) total(1) del(1)
  //   Without:           desc(5) type(2) qty(1) unit-price(2) tax(2) total(1) del(1)

  const renderRow = (line: EditableEstimateLine, dragHandle?: ReactNode) =>
    estimateLineTypeOf(line) === 'discount' ? (
      <EstimateDiscountRow
        line={line}
        amountCents={discountAmounts.get(getEstimateLineKey(line)) ?? 0}
        onChange={(patch) => onChange(getEstimateLineKey(line), patch)}
        onDelete={() => onDelete(getEstimateLineKey(line))}
        disabled={disabled}
        dragHandle={dragHandle}
      />
    ) : (
      <EstimateLineRow
        line={line}
        onChange={(patch) => onChange(getEstimateLineKey(line), patch)}
        onDelete={() => onDelete(getEstimateLineKey(line))}
        availableAssets={availableAssets}
        disabled={disabled}
        dragHandle={dragHandle}
      />
    )

  return (
    <div className="space-y-4">
      {/* Global "Show images" toggle — mirrors the WO line items
          editor. Mass-sets show_image_on_doc on every line so the
          tenant doesn't have to toggle per-line. */}
      <ShowImagesToggle
        lines={lines}
        onSetAll={(value) => {
          lines.forEach((line) => {
            const current = line.show_image_on_doc ?? true
            if (current !== value) {
              onChange(getEstimateLineKey(line), { show_image_on_doc: value })
            }
          })
        }}
        disabled={disabled || lines.length === 0}
      />

      {/* Header row */}
      <div className="grid grid-cols-14 gap-2 text-xs font-medium text-slate-600 px-2">
        {dragMode && <div className="col-span-1"></div>}
        <div className={dragMode ? 'col-span-4' : 'col-span-5'}>Description</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-1 text-right">Qty</div>
        <div className="col-span-2 text-right">Unit Price</div>
        <div className="col-span-2 text-center">Tax</div>
        <div className="col-span-1 text-right">Total</div>
        <div className="col-span-1"></div>
      </div>

      {/* Lines */}
      {lines.length === 0 ? (
        <div className="text-sm text-slate-500 italic px-2 py-4">
          No line items yet. Click "Add line item" to start.
        </div>
      ) : dragMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lines.map(getEstimateLineKey)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {lines.map((line) => (
                <SortableLineWrapper
                  key={getEstimateLineKey(line)}
                  id={getEstimateLineKey(line)}
                  renderRow={renderRow}
                  line={line}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={getEstimateLineKey(line)}>{renderRow(line)}</div>
          ))}
        </div>
      )}

      {/* Add buttons + saving indicator */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="text-sm font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
        >
          + Add blank line
        </button>
        {onPickFromCatalog && (
          <button
            type="button"
            onClick={() => setCatalogPickerOpen(true)}
            disabled={disabled}
            className="text-sm font-medium px-3 py-1.5 rounded border border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            + Search catalog
          </button>
        )}
        {onPickFromCatalog && (
          <ScanToAddLineItem onPick={onPickFromCatalog} disabled={disabled} />
        )}
        {onAddFee && (
          <button
            type="button"
            onClick={onAddFee}
            disabled={disabled}
            className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            + Add fee
          </button>
        )}
        {onAddDiscount && (
          <button
            type="button"
            onClick={onAddDiscount}
            disabled={disabled}
            className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
          >
            + Add discount
          </button>
        )}
        {saving && <span className="text-xs text-slate-500">Saving...</span>}
      </div>

      {onPickFromCatalog && catalogPickerOpen && (
        <CatalogItemPickerModal
          isOpen
          onClose={() => setCatalogPickerOpen(false)}
          onPick={(item) => onPickFromCatalog(item)}
        />
      )}

      {/* Totals footer */}
      {lines.length > 0 && (
        <div className="border-t border-slate-200 pt-4 mt-4 space-y-1 text-sm">
          <div className="flex justify-end gap-8">
            <span className="text-slate-600">Subtotal:</span>
            <span className="font-medium tabular-nums w-24 text-right">
              {formatCents(totals.subtotal)}
            </span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-end gap-8 text-rose-600">
              <span>Discount:</span>
              <span className="font-medium tabular-nums w-24 text-right">
                −{formatCents(totals.discount)}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-8">
            <span className="text-slate-600">Tax:</span>
            <span className="font-medium tabular-nums w-24 text-right">
              {formatCents(totals.tax)}
            </span>
          </div>
          <div className="flex justify-end gap-8 text-base">
            <span className="font-semibold text-slate-900">Total:</span>
            <span className="font-bold tabular-nums w-24 text-right">
              {formatCents(totals.total)}
            </span>
          </div>

          {/* The floor the shop set in its cost model, said once, quietly.
              Not a block: there are good reasons to go under it, and the
              person doing it knows them better than a rule does. It is
              worth saying out loud BEFORE the estimate goes out rather
              than working it out afterwards. */}
          {belowFloor !== null && (
            <p className="mt-2 text-right text-xs font-semibold text-amber-700">
              Under your {formatCents(Math.round(belowFloor * 100))} minimum service call.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Sortable wrapper for a single row ----------

interface SortableLineWrapperProps {
  id: string
  line: EditableEstimateLine
  renderRow: (line: EditableEstimateLine, dragHandle: ReactNode) => ReactNode
}

function SortableLineWrapper({ id, line, renderRow }: SortableLineWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
  }

  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 select-none px-1"
      title="Drag to reorder"
      aria-label="Drag to reorder"
    >
      ⠿
    </button>
  )

  return (
    <div ref={setNodeRef} style={style}>
      {renderRow(line, handle)}
    </div>
  )
}

// ---------- Row component ----------

interface EstimateLineRowProps {
  line: EditableEstimateLine
  onChange: (patch: Partial<EstimateLineItemDraft>) => void
  onDelete: () => void
  availableAssets: LineEditorAvailableAsset[]
  disabled: boolean
  dragHandle?: ReactNode
}

const TYPES: { value: EstimateLineItemType; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'product', label: 'Product' },
]

const EstimateLineRow = memo(function EstimateLineRow({
  line,
  onChange,
  onDelete,
  availableAssets,
  disabled,
  dragHandle,
}: EstimateLineRowProps) {
  const unitPriceCents = isEstimateDraft(line)
    ? line.unit_price_cents
    : line.money.unit_price_cents
  const lineTotalCents = isEstimateDraft(line)
    ? line.line_total_cents
    : line.money.line_total_cents
  // Tax classes for this tenant — used to populate the per-line Tax
  // dropdown. Cached 5min via useTaxClasses; effectively free to call
  // from every row.
  const { data: taxClassesData } = useTaxClasses({ active: true })
  const taxClasses = taxClassesData?.data ?? []
  const currentTaxClassId = line.tax_class_id ?? ''

  const [descLocal, setDescLocal] = useState(line.description)
  const [qtyLocal, setQtyLocal] = useState(String(line.quantity))
  const [priceLocal, setPriceLocal] = useState((unitPriceCents / 100).toFixed(2))

  const focusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (focusedRef.current !== 'description') setDescLocal(line.description)
  }, [line.description])
  useEffect(() => {
    if (focusedRef.current !== 'quantity') setQtyLocal(String(line.quantity))
  }, [line.quantity])
  useEffect(() => {
    if (focusedRef.current !== 'unit_price') setPriceLocal((unitPriceCents / 100).toFixed(2))
  }, [unitPriceCents])

  // Slice 13c #3: surface asset_id whether the line is a draft or a server line.
  const assetId = line.asset_id ?? ''
  // If the line has an asset_id that isn't in availableAssets (e.g., it was
  // removed from the estimate's covered list, or is legacy data), surface
  // it anyway so the user can see + clear it.
  const showOrphanOption =
    assetId && !availableAssets.some((a) => a.id === assetId)

  return (
    <div className="rounded border border-slate-200 bg-white">
    <div className="grid grid-cols-14 gap-2 items-center px-2 py-2">
      {dragHandle && (
        <div className="col-span-1 flex justify-center">{dragHandle}</div>
      )}

      <div className={`${dragHandle ? 'col-span-4' : 'col-span-5'} flex min-w-0 items-center gap-2`}>
        <CatalogDescriptionInput
          onPick={item => { focusedRef.current = null; const description = item.description || item.name; setDescLocal(description); onChange({ description, service_catalog_item_id: item.id, unit_price_cents: item.pricing.customer_cost_cents, tax_class_id: item.pricing.tax_class_id }) }}
          type="text"
          value={descLocal}
          onChange={(e) => setDescLocal(e.target.value)}
          onFocus={() => { focusedRef.current = 'description' }}
          onBlur={() => {
            focusedRef.current = null
            if (descLocal !== line.description) onChange({ description: descLocal })
          }}
          disabled={disabled}
          placeholder="Item description"
          className="min-w-0 flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        {estimateLineTypeOf(line) === 'fee' && (
          <span className="inline-flex shrink-0 items-center text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
            Fee
          </span>
        )}
      </div>

      <div className="col-span-2">
        <select
          value={line.type}
          onChange={(e) => onChange({ type: e.target.value as EstimateLineItemType })}
          disabled={disabled}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="col-span-1">
        <input
          type="number"
          step="any"
          inputMode="decimal"
          min="0"
          value={qtyLocal}
          onChange={(e) => {
            // Allow decimals (estimate qty for liquids / weight items
            // like "1.5 lbs freon" — no unit gating on estimates).
            const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
            setQtyLocal(v)
          }}
          onFocus={() => { focusedRef.current = 'quantity' }}
          onBlur={() => {
            focusedRef.current = null
            const parsed = parseFloat(qtyLocal) || 0
            if (parsed !== line.quantity) onChange({ quantity: parsed })
            setQtyLocal(String(parsed))
          }}
          disabled={disabled}
          className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <div className="col-span-2">
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-500">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceLocal}
            onChange={(e) => setPriceLocal(e.target.value)}
            onFocus={() => { focusedRef.current = 'unit_price' }}
            onBlur={() => {
              focusedRef.current = null
              const dollars = parseFloat(priceLocal) || 0
              const cents = Math.round(dollars * 100)
              if (cents !== unitPriceCents) onChange({ unit_price_cents: cents })
              setPriceLocal((cents / 100).toFixed(2))
            }}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Tax — pick a tax_class for this line (or "No tax" → null).
          Tax classes are tenant-managed under Tool Shed → Tax Classes.
          If none exist yet, only "No tax" is available. */}
      <div className="col-span-2">
        <select
          value={currentTaxClassId}
          onChange={(e) => onChange({ tax_class_id: e.target.value || null })}
          disabled={disabled}
          title="Tax class for this line (manage classes in Tool Shed → Tax Classes)"
          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        >
          <option value="">No tax</option>
          {taxClasses.map((tc) => (
            <option key={tc.id} value={tc.id}>
              {tc.name} ({tc.rate_pct}%)
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-1 text-right tabular-nums text-sm font-medium text-slate-900">
        {formatCents(lineTotalCents)}
      </div>

      <div className="col-span-1 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="text-slate-400 hover:text-red-600 disabled:opacity-50"
          title="Delete line item"
        >
          ✕
        </button>
      </div>
    </div>

      {/* Asset selector sub-row — only when parent has covered assets */}
      {availableAssets.length > 0 && (
        <div className="px-2 pb-2 pt-0 flex items-center gap-2 border-t border-slate-100">
          <span className="text-xs text-slate-500 flex-shrink-0">For asset:</span>
          <select
            value={assetId}
            onChange={(e) => onChange({ asset_id: e.target.value || null })}
            disabled={disabled}
            className="text-xs px-2 py-1 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 max-w-xs"
          >
            <option value="">— Not tied to a specific asset —</option>
            {availableAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? '(unnamed)'}
              </option>
            ))}
            {showOrphanOption && (
              <option value={assetId}>
                ⚠ {assetId} (not in this estimate's covered assets)
              </option>
            )}
          </select>
        </div>
      )}
    </div>
  )
})

// ---------- Discount row ----------

interface EstimateDiscountRowProps {
  line: EditableEstimateLine
  amountCents: number
  onChange: (patch: Partial<EstimateLineItemDraft>) => void
  onDelete: () => void
  disabled: boolean
  dragHandle?: ReactNode
}

const EstimateDiscountRow = memo(function EstimateDiscountRow({
  line,
  amountCents,
  onChange,
  onDelete,
  disabled,
  dragHandle,
}: EstimateDiscountRowProps) {
  const dv = isEstimateDraft(line) ? line.discount_value : line.money.discount_value
  const dk = isEstimateDraft(line) ? line.discount_kind : line.money.discount_kind
  const kind: 'percent' | 'fixed' = dk === 'fixed' ? 'fixed' : 'percent'

  const [descLocal, setDescLocal] = useState(line.description || 'Discount')
  const [valueLocal, setValueLocal] = useState(String(Number(dv) || 0))
  const focusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (focusedRef.current !== 'desc') setDescLocal(line.description || 'Discount')
  }, [line.description])
  useEffect(() => {
    if (focusedRef.current !== 'value') setValueLocal(String(Number(dv) || 0))
  }, [dv])

  return (
    <div className="rounded border border-rose-200 bg-rose-50/40">
      <div className="grid grid-cols-14 gap-2 items-center px-2 py-2">
        {dragHandle && <div className="col-span-1 flex justify-center">{dragHandle}</div>}

        <div className={dragHandle ? 'col-span-4' : 'col-span-5'}>
          <input
            type="text"
            value={descLocal}
            onChange={(e) => setDescLocal(e.target.value)}
            onFocus={() => { focusedRef.current = 'desc' }}
            onBlur={() => {
              focusedRef.current = null
              if (descLocal !== line.description) onChange({ description: descLocal })
            }}
            disabled={disabled}
            placeholder="Discount label"
            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-rose-400 focus:border-rose-400"
          />
        </div>

        <div className="col-span-5 flex items-center gap-2">
          <select
            value={kind}
            onChange={(e) => onChange({ discount_kind: e.target.value as 'percent' | 'fixed' })}
            disabled={disabled}
            className="px-2 py-1 text-sm border border-slate-300 rounded bg-white focus:ring-1 focus:ring-rose-400 focus:border-rose-400"
          >
            <option value="percent">Percent %</option>
            <option value="fixed">Fixed $</option>
          </select>
          <div className="flex items-center gap-1">
            {kind === 'fixed' && <span className="text-sm text-slate-500">$</span>}
            <input
              type="number"
              step={kind === 'percent' ? '0.1' : '0.01'}
              min="0"
              max={kind === 'percent' ? '100' : undefined}
              value={valueLocal}
              onChange={(e) => setValueLocal(e.target.value)}
              onFocus={() => { focusedRef.current = 'value' }}
              onBlur={() => {
                focusedRef.current = null
                const parsed = parseFloat(valueLocal) || 0
                if (parsed !== Number(dv)) onChange({ discount_value: parsed })
                setValueLocal(String(parsed))
              }}
              disabled={disabled}
              className="w-24 px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-rose-400 focus:border-rose-400"
            />
            {kind === 'percent' && <span className="text-sm text-slate-500">%</span>}
          </div>
        </div>

        <div className="col-span-1 text-right tabular-nums text-sm font-medium text-rose-600">
          −{formatCents(amountCents)}
        </div>

        <div className="col-span-1 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="text-slate-400 hover:text-red-600 disabled:opacity-50"
            title="Remove discount"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
})

// ---------- Section-level "Show images" toggle ----------

/**
 * Mirrors the WorkOrderLineItemEditor's ShowImagesToggle: one switch
 * at the top of the section that mass-applies show_image_on_doc to
 * every line. Mixed state is treated as ON (clicking once switches
 * everything to OFF).
 */
function ShowImagesToggle({
  lines,
  onSetAll,
  disabled,
}: {
  lines: EditableEstimateLine[]
  onSetAll: (value: boolean) => void
  disabled: boolean
}) {
  const total = lines.length
  const onCount = lines.filter((l) => (l.show_image_on_doc ?? true)).length
  const allOff = total > 0 && onCount === 0
  const mixed = total > 0 && onCount > 0 && onCount < total
  const checked = !allOff

  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-slate-800">
          🖼 Show line-item images on customer doc
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {mixed
            ? `Mixed — ${onCount} of ${total} lines show images. Toggle to mass-apply.`
            : checked
              ? 'Images render in the merge tag {{products.table_with_images}}.'
              : 'No images on customer doc. Tag {{products.table}} (no image column) renders cleanly.'}
        </div>
      </div>
      <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer select-none">
        <span className={checked ? 'text-amber-700 text-xs font-medium' : 'text-slate-500 text-xs font-medium'}>
          {checked ? 'ON' : 'OFF'}
        </span>
        <button
          type="button"
          onClick={() => onSetAll(!checked)}
          disabled={disabled}
          aria-pressed={checked}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            checked ? 'bg-amber-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    </div>
  )
}
