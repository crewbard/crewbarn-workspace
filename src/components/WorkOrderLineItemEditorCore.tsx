import { useState, useEffect, useRef, memo } from 'react'
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
import { isCountableUnit, qtyStepFor } from '@/lib/unitsOfMeasure'
import type {
  WorkOrderLineItem,
  WorkOrderLineItemDraft,
} from '@/types/workOrderLineItem'
import { CatalogItemPickerModal } from '@/components/CatalogItemPickerModal'
import { CatalogDescriptionInput } from '@/components/CatalogDescriptionInput'
import type { LineType } from '@/types/workOrderLineItem'
import { ScanToAddLineItem } from '@/components/ScanToAddLineItem'

/**
 * Unified row shape for the editor — either a server line item OR a draft.
 * Drafts have draft_id; server lines have id.
 */
export type EditableLine = WorkOrderLineItem | WorkOrderLineItemDraft

export interface WorkOrderLineEditorAvailableAsset {
  id: string
  name: string | null
  asset_code?: string | null
}

export function isDraft(line: EditableLine): line is WorkOrderLineItemDraft {
  return 'draft_id' in line
}

export function getLineKey(line: EditableLine): string {
  return isDraft(line) ? line.draft_id : line.id
}

/** Row kind, defaulting to 'item' for legacy lines without the field. */
export function lineTypeOf(line: EditableLine): LineType {
  return ((line as { line_type?: LineType }).line_type ?? 'item')
}

/**
 * Compute money fields client-side for buffer-mode preview.
 * Mirrors the server-side recalculateMoney() logic in WorkOrderLineItem.php.
 */
/**
 * Line discount in cents. Mirrors WorkOrderLineItem::computeDiscountCents on
 * the server: percent (0–100) or fixed dollars, clamped to [0, subtotal].
 */
export function computeLineDiscountCents(
  subtotalCents: number,
  kind: 'percent' | 'fixed' | null | undefined,
  value: number
): number {
  if (subtotalCents <= 0 || !value || value <= 0 || !kind) return 0
  const amount =
    kind === 'percent'
      ? Math.round((subtotalCents * Math.min(value, 100)) / 100)
      : Math.round(value * 100)
  return Math.max(0, Math.min(amount, subtotalCents))
}

export function computeMoney(input: {
  quantity: number
  customer_cost_cents: number
  owner_cost_cents: number
  is_taxable: boolean
  tax_rate_pct: number
  discount_kind?: 'percent' | 'fixed' | null
  discount_value?: number
}) {
  const qty = Number(input.quantity) || 0
  const customerCost = Number(input.customer_cost_cents) || 0
  const ownerCost = Number(input.owner_cost_cents) || 0
  const subtotal = Math.round(qty * customerCost)
  const discount = computeLineDiscountCents(subtotal, input.discount_kind ?? null, Number(input.discount_value) || 0)
  const discounted = subtotal - discount
  const taxAmount = input.is_taxable
    ? Math.round((discounted * Number(input.tax_rate_pct)) / 100)
    : 0
  const total = discounted + taxAmount
  const margin = discounted - Math.round(qty * ownerCost)
  return {
    subtotal_cents: subtotal,
    discount_amount_cents: discount,
    tax_amount_cents: taxAmount,
    total_cents: total,
    margin_cents: margin,
  }
}

export function formatCents(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}

// ---------- Component props ----------

export interface WorkOrderLineItemEditorCoreProps {
  /** Lines to render. Either drafts (buffer mode) or server lines (live mode). */
  lines: EditableLine[]

  /** Called when "Add line" clicked. Parent decides what kind of line to add. */
  onAdd: () => void

  /** Add a discount row (line_type='discount'). Omit to hide the button. */
  onAddDiscount?: () => void

  /** Add a fee row (line_type='fee'). Omit to hide the button. */
  onAddFee?: () => void

  /** Called when a row's field changes. Parent applies the patch. */
  onChange: (key: string, patch: Partial<WorkOrderLineItemDraft>) => void

  /** Rendered under the totals — e.g. "charge this on the terminal". */
  footer?: React.ReactNode

  /** Called when a row's delete clicked. Parent removes it. */
  onDelete: (key: string) => void

  /** Optional: disabled state (e.g., during a save). */
  disabled?: boolean

  /** Optional: show "saving..." indicator. */
  saving?: boolean

  /** Optional: called when user drags a line item to reorder. Parent persists the new order. */
  onReorder?: (orderedIds: string[]) => void

  /** Optional: renders a "+ Search catalog" button. Parent turns the picked
   *  CatalogItem into a real line. Omit to hide. */
  onPickFromCatalog?: (item: import('@/types/catalogItem').CatalogItem) => void

  /** Assets available for per-line tagging from the parent job's covered assets. */
  availableAssets?: WorkOrderLineEditorAvailableAsset[]
}

// ---------- Component ----------

/**
 * WorkOrderLineItemEditorCore — pure presentational line item editor.
 *
 * Renders a table-like grid of editable rows + an "Add line" button + totals row.
 * Delegates all state ownership to the parent component (buffered or live).
 *
 * Visual design: spreadsheet-like inline editing, similar to ServiceFusion's
 * Products & Services section. Each row has: description / qty / unit / rate /
 * tax flag / total / margin / asset chip / delete.
 *
 * Tracking-only lines (asset_id set + cost = 0) render with the $ column
 * showing a dash and a small "Tracking" pill.
 */
export function WorkOrderLineItemEditorCore({
  lines,
  onAdd,
  onAddDiscount,
  onAddFee,
  onChange,
  onDelete,
  onReorder,
  onPickFromCatalog,
  availableAssets = [],
  disabled = false,
  saving = false,
  footer,
}: WorkOrderLineItemEditorCoreProps) {
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  // DnD sensors — pointer (mouse/touch) + keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px before drag starts — prevents accidental drags
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const oldIndex = lines.findIndex((l) => getLineKey(l) === active.id)
    const newIndex = lines.findIndex((l) => getLineKey(l) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(lines, oldIndex, newIndex).map((l) => getLineKey(l))
    onReorder(newOrder)
  }
  // Totals — items + fees build the base; discount rows are separate.
  // Tax scales by (base - discount)/base (pro-rata allocation across taxable
  // lines), mirroring the server's recalculateTotals. Each discount row's
  // computed amount is stashed so its row can render the live figure.
  const itemLines = lines.filter((l) => lineTypeOf(l) !== 'discount')
  const discountLines = lines.filter((l) => lineTypeOf(l) === 'discount')

  const base = itemLines.reduce((s, l) => s + (isDraft(l) ? l : l.money).subtotal_cents, 0)
  const fullTax = itemLines.reduce((s, l) => s + (isDraft(l) ? l : l.money).tax_amount_cents, 0)
  const itemMargin = itemLines.reduce((s, l) => s + (isDraft(l) ? l : l.money).margin_cents, 0)

  const discountAmounts = new Map<string, number>()
  let discountRunning = 0
  for (const d of discountLines) {
    const m = isDraft(d) ? d : d.money
    const amt = computeLineDiscountCents(base - discountRunning, m.discount_kind ?? null, Number(m.discount_value) || 0)
    discountAmounts.set(getLineKey(d), amt)
    discountRunning += amt
  }
  const discountTotal = discountRunning
  const taxAfter = base > 0 ? Math.round((fullTax * (base - discountTotal)) / base) : 0
  const totals = {
    subtotal: base,
    discount: discountTotal,
    tax: taxAfter,
    total: base - discountTotal + taxAfter,
    margin: itemMargin - discountTotal,
  }

  return (
    <div className="space-y-4">
      {/* Global "Show images" toggle — sets show_image_on_doc on EVERY
          line at once. The flag is "on" when any line has images on,
          off only when all lines have images off (mass-set both ways
          on click). Replaces the old per-line "Image on/off" pill. */}
      <ShowImagesToggle
        lines={lines}
        onSetAll={(value) => {
          lines.forEach((line) => {
            const current = line.show_image_on_doc ?? true
            if (current !== value) {
              onChange(getLineKey(line), { show_image_on_doc: value } as Partial<WorkOrderLineItemDraft>)
            }
          })
        }}
        disabled={disabled || lines.length === 0}
      />

      {/* Header row — 14 columns: handle(1) desc(4) qty(1) rate(2) cost(2) tax(2) total(1) del(1) = 14 */}
      <div className="grid grid-cols-14 gap-2 text-xs font-medium text-slate-600 px-2">
        <div className="col-span-1"></div>
        <div className="col-span-4">Description</div>
        <div className="col-span-1 text-right">Qty</div>
        <div className="col-span-2 text-right">Rate</div>
        <div className="col-span-2 text-right">Cost</div>
        <div className="col-span-2 text-center">Tax</div>
        <div className="col-span-1 text-right">Total</div>
        <div className="col-span-1"></div>
      </div>

      {/* Lines */}
      {lines.length === 0 ? (
        <div className="text-sm text-slate-500 italic px-2 py-4">
          No line items yet. Click "Add line item" to start.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lines.map((l) => getLineKey(l))}
            strategy={verticalListSortingStrategy}
          >
            {lines.map((line) =>
              lineTypeOf(line) === 'discount' ? (
                <DiscountRow
                  key={getLineKey(line)}
                  line={line}
                  amountCents={discountAmounts.get(getLineKey(line)) ?? 0}
                  onChange={(patch) => onChange(getLineKey(line), patch)}
                  onDelete={() => onDelete(getLineKey(line))}
                  disabled={disabled}
                />
              ) : (
                <LineRow
                  key={getLineKey(line)}
                  line={line}
                  onChange={(patch) => onChange(getLineKey(line), patch)}
                  onDelete={() => onDelete(getLineKey(line))}
                  availableAssets={availableAssets}
                  disabled={disabled}
                />
              ),
            )}
          </SortableContext>
        </DndContext>
      )}

      {/* Add buttons */}
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
        {saving && (
          <span className="text-xs text-slate-500">Saving...</span>
        )}
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
          <div className="flex justify-end gap-8 text-xs text-emerald-700">
            <span>Margin:</span>
            <span className="font-medium tabular-nums w-24 text-right">
              {formatCents(totals.margin)}
            </span>
          </div>
          {footer && <div className="mt-4 flex justify-end">{footer}</div>}
        </div>
      )}
    </div>
  )
}

// ---------- Single row component ----------

interface LineRowProps {
  line: EditableLine
  onChange: (patch: Partial<WorkOrderLineItemDraft>) => void
  onDelete: () => void
  availableAssets: WorkOrderLineEditorAvailableAsset[]
  disabled: boolean
}

const LineRow = memo(function LineRow({ line, onChange, onDelete, availableAssets, disabled }: LineRowProps) {
  const money = isDraft(line) ? line : line.money
  const isTrackingOnly = !!line.asset_id && money.subtotal_cents === 0
  const isFee = lineTypeOf(line) === 'fee'
  const lineKey = getLineKey(line)
  const assetId = line.asset_id ?? ''
  const hasAssetOption = availableAssets.some((asset) => asset.id === assetId)
  const showOrphanAssetOption = !!assetId && !hasAssetOption
  const showAssetPicker = availableAssets.length > 0 || showOrphanAssetOption

  // DnD sortable bindings
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lineKey })

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  // Local state for inputs — keeps typing smooth, commits to parent on blur or after debounce
  const [descLocal, setDescLocal] = useState(line.description)
  const [qtyLocal, setQtyLocal] = useState(String(line.quantity))
  const [rateLocal, setRateLocal] = useState((money.customer_cost_cents / 100).toFixed(2))
  const [costLocal, setCostLocal] = useState((money.owner_cost_cents / 100).toFixed(2))

  // Sync local back to prop when line changes externally (e.g., parent reloads from server)
  // BUT only if we're not actively focused on that field, otherwise it'd snap our cursor away
  const focusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (focusedRef.current !== 'description') setDescLocal(line.description)
  }, [line.description])
  useEffect(() => {
    if (focusedRef.current !== 'quantity') setQtyLocal(String(line.quantity))
  }, [line.quantity])
  useEffect(() => {
    if (focusedRef.current !== 'rate') setRateLocal((money.customer_cost_cents / 100).toFixed(2))
  }, [money.customer_cost_cents])
  useEffect(() => {
    if (focusedRef.current !== 'cost') setCostLocal((money.owner_cost_cents / 100).toFixed(2))
  }, [money.owner_cost_cents])

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`grid grid-cols-14 gap-2 items-center px-2 py-2 rounded border ${
        isTrackingOnly ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle — actual DnD bindings */}
      <div
        className="col-span-1 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing select-none touch-none"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <span className="text-base leading-none">≡</span>
      </div>

      {/* Description */}
      <div className="col-span-4">
        <div className="flex min-w-0 items-center gap-2">
        <CatalogDescriptionInput
          onPick={item => { focusedRef.current = null; const description = item.description || item.name; setDescLocal(description); onChange({ description, catalog_item_id: item.id, customer_cost_cents: item.pricing.customer_cost_cents, owner_cost_cents: item.pricing.owner_cost_cents, tax_class_id: item.pricing.tax_class_id }) }}
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
        {isFee && (
          <span className="inline-flex shrink-0 items-center text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
            Fee
          </span>
        )}
        </div>
        {showAssetPicker && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
              For asset
            </span>
            <select
              value={assetId}
              onChange={(e) => onChange({ asset_id: e.target.value || null })}
              disabled={disabled}
              className="max-w-full rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              <option value="">No asset</option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name || asset.asset_code || asset.id}
                </option>
              ))}
              {showOrphanAssetOption && (
                <option value={assetId}>Existing asset ({assetId})</option>
              )}
            </select>
            {isTrackingOnly && (
              <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                Tracking only
              </span>
            )}
          </div>
        )}

      </div>

      {/* Quantity — step + input-mode driven by the unit on the line so
          weight/volume items (lbs, gal, oz) allow fractional sales like
          0.5 lb of refrigerant pulled from a 5 lb tank. Countable items
          (each, pair, set) stay integer. */}
      <div className="col-span-1">
        <input
          type="number"
          step={qtyStepFor(line.unit_label ?? 'each')}
          inputMode={isCountableUnit(line.unit_label ?? 'each') ? 'numeric' : 'decimal'}
          min="0"
          value={qtyLocal}
          onChange={(e) => {
            const isCountable = isCountableUnit(line.unit_label ?? 'each')
            const allow = isCountable
              ? e.target.value.replace(/[^0-9]/g, '')
              : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
            setQtyLocal(allow)
          }}
          onFocus={() => { focusedRef.current = 'quantity' }}
          onBlur={() => {
            focusedRef.current = null
            const parsed = parseFloat(qtyLocal) || 0
            if (parsed !== line.quantity) onChange({ quantity: parsed })
            setQtyLocal(String(parsed))
          }}
          disabled={disabled}
          title={line.unit_label ? `Unit: ${line.unit_label}` : undefined}
          className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      {/* Rate — what you charge customer */}
      <div className="col-span-2">
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-500">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rateLocal}
            onChange={(e) => setRateLocal(e.target.value)}
            onFocus={() => { focusedRef.current = 'rate' }}
            onBlur={() => {
              focusedRef.current = null
              const dollars = parseFloat(rateLocal) || 0
              const cents = Math.round(dollars * 100)
              if (cents !== money.customer_cost_cents) onChange({ customer_cost_cents: cents })
              setRateLocal((cents / 100).toFixed(2))
            }}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Cost — what you paid (drives margin calculation). Fees have no cost. */}
      <div className="col-span-2">
        {isFee ? (
          <div className="text-xs text-slate-400 text-center py-1">—</div>
        ) : (
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-500">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={costLocal}
            onChange={(e) => setCostLocal(e.target.value)}
            onFocus={() => { focusedRef.current = 'cost' }}
            onBlur={() => {
              focusedRef.current = null
              const dollars = parseFloat(costLocal) || 0
              const cents = Math.round(dollars * 100)
              if (cents !== money.owner_cost_cents) onChange({ owner_cost_cents: cents })
              setCostLocal((cents / 100).toFixed(2))
            }}
            disabled={disabled}
            className="w-full px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            title="Your cost (drives margin calculation)"
          />
        </div>
        )}
      </div>

      {/* Tax class dropdown — placeholder UI, real backend lands in Session 7 */}
      <div className="col-span-2 flex flex-col items-stretch gap-1">
        <select
          value={
            !money.is_taxable || money.tax_rate_pct === 0
              ? 'none'
              : money.tax_rate_pct === 7
              ? 'standard'
              : 'custom'
          }
          onChange={(e) => {
            const v = e.target.value
            if (v === 'none') {
              onChange({ is_taxable: false, tax_rate_pct: 0 })
            } else if (v === 'standard') {
              onChange({ is_taxable: true, tax_rate_pct: 7 })
            } else if (v === 'custom') {
              // Switching to custom: keep existing rate or default to a non-zero placeholder
              onChange({ is_taxable: true, tax_rate_pct: money.tax_rate_pct > 0 ? money.tax_rate_pct : 1 })
            }
          }}
          disabled={disabled}
          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          title="Tax class — managed in Tool Shed → Tax Classes (coming soon)"
        >
          <option value="none">No tax</option>
          <option value="standard">Standard (7%)</option>
          <option value="custom">Custom rate...</option>
        </select>
        {money.is_taxable && money.tax_rate_pct !== 7 && money.tax_rate_pct !== 0 && (
          <input
            type="number"
            step="0.001"
            min="0"
            max="100"
            value={money.tax_rate_pct}
            onChange={(e) => onChange({ tax_rate_pct: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="%"
            className="w-full px-1 py-0.5 text-xs text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        )}
      </div>

      {/* Total — line subtotal (Qty × Rate), no tax. Tax is summed in footer. */}
      <div className="col-span-1 text-right tabular-nums">
        <div className="text-sm font-medium text-slate-900">
          {isTrackingOnly ? '—' : formatCents(money.subtotal_cents)}
        </div>
      </div>

      {/* Delete button */}
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
  )
})

// ---------- Discount row ----------

interface DiscountRowProps {
  line: EditableLine
  amountCents: number
  onChange: (patch: Partial<WorkOrderLineItemDraft>) => void
  onDelete: () => void
  disabled: boolean
}

/**
 * A document-level discount row. Reuses the line's discount_kind /
 * discount_value fields; the computed amount (passed in by the editor,
 * which knows the item subtotal) renders in the Total column as negative.
 */
const DiscountRow = memo(function DiscountRow({
  line,
  amountCents,
  onChange,
  onDelete,
  disabled,
}: DiscountRowProps) {
  const money = isDraft(line) ? line : line.money
  const kind: 'percent' | 'fixed' = money.discount_kind === 'fixed' ? 'fixed' : 'percent'
  const lineKey = getLineKey(line)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lineKey })
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  const [descLocal, setDescLocal] = useState(line.description || 'Discount')
  const [valueLocal, setValueLocal] = useState(String(Number(money.discount_value) || 0))
  const focusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (focusedRef.current !== 'desc') setDescLocal(line.description || 'Discount')
  }, [line.description])
  useEffect(() => {
    if (focusedRef.current !== 'value') setValueLocal(String(Number(money.discount_value) || 0))
  }, [money.discount_value])

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`grid grid-cols-14 gap-2 items-center px-2 py-2 rounded border border-rose-200 bg-rose-50/40 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div
        className="col-span-1 flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing select-none touch-none"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <span className="text-base leading-none">≡</span>
      </div>

      {/* Label */}
      <div className="col-span-4">
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

      {/* Kind + value */}
      <div className="col-span-7 flex items-center gap-2">
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
              if (parsed !== Number(money.discount_value)) onChange({ discount_value: parsed })
              setValueLocal(String(parsed))
            }}
            disabled={disabled}
            className="w-24 px-2 py-1 text-sm text-right border border-slate-300 rounded tabular-nums focus:ring-1 focus:ring-rose-400 focus:border-rose-400"
          />
          {kind === 'percent' && <span className="text-sm text-slate-500">%</span>}
        </div>
      </div>

      {/* Computed amount (negative) */}
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
  )
})

// ---------- Section-level "Show images" toggle ----------

/**
 * Single switch at the top of the line items section that controls
 * whether catalog images render on the customer-facing PDF for every
 * line. Underlying data is per-line (each line has its own
 * show_image_on_doc), so this acts as a mass-set: ON → set every
 * line's flag to true; OFF → set every line's flag to false.
 *
 * Display rule:
 *   - all lines ON  → toggle reads ON
 *   - all lines OFF → toggle reads OFF
 *   - mixed         → reads ON, click sets all OFF (typical case is the user wants to turn them all off)
 */
function ShowImagesToggle({
  lines,
  onSetAll,
  disabled,
}: {
  lines: EditableLine[]
  onSetAll: (value: boolean) => void
  disabled: boolean
}) {
  const total = lines.length
  const onCount = lines.filter((l) => (l.show_image_on_doc ?? true)).length
  const allOff = total > 0 && onCount === 0
  const mixed = total > 0 && onCount > 0 && onCount < total
  const checked = !allOff // ON when at least one line has images on

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
