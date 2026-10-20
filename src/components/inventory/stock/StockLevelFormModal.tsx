import { useEffect, useState } from "react"
import { isDeleteCancelled } from "@/lib/api"
import { useCreateStockLevel, useUpdateStockLevel, useDeleteStockLevel } from "@/hooks/useInventoryStockLevels"
import { useCatalogItems, useCatalogItem } from "@/hooks/useCatalogItems"
import { EditModal as ProductCatalogEditModal } from "@/pages/ProductCatalogPage"
import { isCountableUnit, qtyStepFor } from "@/lib/unitsOfMeasure"
import { CatalogItemQuickCreate } from "@/components/CatalogItemQuickCreate"
import { BinTreePicker } from "@/components/BinTreePicker"
import { PERM, usePermissions } from "@/hooks/usePermissions"
import { PoOverrideBox } from "@/components/inventory/PoOverrideBox"
import { usePoOverrideGate } from "@/hooks/usePoOverride"
import { ModalShell, Footer, Field, ErrorBanner, ReturnSection, PrintQrSection } from "@/components/inventory/inventoryModalUi"
import { extractError } from "@/lib/inventoryErrors"
import type { InventoryStockLevel } from "@/types/inventoryStockLevel"
import type { CatalogItem as CatalogItemFull } from "@/types/catalogItem"
import type { InventoryLocation } from "@/types/inventoryLocation"
import type { InventoryBin } from "@/types/inventoryBin"

// ---------- Stock level create / edit modal ----------

export function StockLevelFormModal({
  stockLevel,
  locations,
  allBins,
  defaultLocationId,
  defaultBinId,
  onClose,
}: {
  stockLevel?: InventoryStockLevel
  locations: InventoryLocation[]
  allBins: InventoryBin[]
  /** Opened from a bin in the tree — land in that exact place. */
  defaultLocationId?: string
  defaultBinId?: string
  onClose: () => void
}) {
  const isEdit = !!stockLevel
  const [locationId, setLocationId] = useState(
    stockLevel?.location_id ?? defaultLocationId ?? locations[0]?.id ?? "",
  )
  const [binId, setBinId] = useState<string>(stockLevel?.bin_id ?? defaultBinId ?? "")
  const [catalogItemId, setCatalogItemId] = useState(stockLevel?.catalog_item_id ?? "")
  const [catalogQuery, setCatalogQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  /**
   * "+ New product" stacked modal. When the user can't find the
   * catalog item they need in the typeahead, they can create one
   * with full catalog fields (matches the Tool Shed → Product
   * Catalog form). On create, we auto-select it for this stock row.
   */
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [justCreatedItem, setJustCreatedItem] = useState<CatalogItemFull | null>(null)
  const [showBinPicker, setShowBinPicker] = useState(false)
  /**
   * Seeded from defaultBinId when opened from the tree's "+ Add stock".
   *
   * binId alone is not enough: "+ New product" only places stock when it
   * receives the picked bin OBJECT (its guard is `if (pickedBin)`), and it is
   * handed this state. With only the id set, the overlay created the product,
   * silently discarded the starting quantity, and left this modal open at 0 —
   * so the number the user typed simply vanished.
   */
  const [pickedBin, setPickedBin] = useState<InventoryBin | null>(
    () => allBins.find((b) => b.id === (stockLevel?.bin_id ?? defaultBinId)) ?? null,
  )
  // inventory_require_po_for_stock_add is enforced server-side on both create
  // and update; the override box (PoOverrideBox) says what an increase needs
  // up front instead of after Save.
  const originalQty = Number(stockLevel?.quantities.qty_on_hand ?? 0)

  const [qtyOnHand, setQtyOnHand] = useState(
    stockLevel?.quantities.qty_on_hand != null ? String(stockLevel.quantities.qty_on_hand) : "0"
  )
  const [qtyReserved, setQtyReserved] = useState(
    stockLevel?.quantities.qty_reserved != null ? String(stockLevel.quantities.qty_reserved) : "0"
  )
  // Empty string is a real value here: it means "no par", and it has to be
  // distinguishable from "0", which is a par of none.
  const [parQty, setParQty] = useState(
    stockLevel?.quantities.par_qty != null ? String(stockLevel.quantities.par_qty) : ""
  )
  const [error, setError] = useState<string | null>(null)

  // "Edit" button → opens the full Product Catalog edit form for the selected
  // item without leaving this Add-stock context. catalog.edit, matching what
  // the API enforces — the old is_platform_admin gate meant a tenant owner
  // could see the button's absence and conclude the feature did not exist.
  const canEditCatalog = usePermissions().has(PERM.CATALOG_EDIT)
  const [editingCatalogItemId, setEditingCatalogItemId] = useState<string | null>(null)
  const editingItemQuery = useCatalogItem(editingCatalogItemId ?? undefined)

  const createMutation = useCreateStockLevel()
  const updateMutation = useUpdateStockLevel()
  const deleteMutation = useDeleteStockLevel()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(catalogQuery.trim()), 200)
    return () => clearTimeout(t)
  }, [catalogQuery])

  const itemsQuery = useCatalogItems({
    q: debouncedQuery || undefined,
    type: 'product',
    active: true,
    per_page: 12,
  })
  const itemResults = itemsQuery.data?.data ?? []

  // Resolve the picked item's unit_label so the qty inputs can swap
  // between integer (each / pair / set) and decimal (lbs / gal / L / etc.).
  // Sources, in priority: just-created item → search results → existing
  // stock_level's catalog_item mini (when editing) → fallback to "each".
  const pickedUnit: string =
    (justCreatedItem?.id === catalogItemId && justCreatedItem?.unit_label) ||
    itemResults.find((it) => it.id === catalogItemId)?.unit_label ||
    stockLevel?.catalog_item?.unit_label ||
    'each'

  const initialItemName =
    stockLevel?.catalog_item?.name ?? null

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  // PO-only: an increase needs an override (or, when editing, a count
  // correction if the shop allows those). The box below says which.
  const override = usePoOverrideGate(Number(qtyOnHand || 0) > originalQty, isEdit)
  const canSave =
    !isPending && !!locationId && !!catalogItemId && qtyOnHand !== "" && override.ready

  async function handleSave() {
    setError(null)
    try {
      const payload = {
        location_id: locationId,
        bin_id: binId || null,
        catalog_item_id: catalogItemId,
        qty_on_hand: Number(qtyOnHand) || 0,
        qty_reserved: Number(qtyReserved) || 0,
        // Blank clears it. Number('') is 0, which would quietly turn "no par"
        // into "carry none" and start reporting the spot as stocked-to-par.
        par_qty: parQty.trim() === '' ? null : Number(parQty),
        ...override.body,
      }
      if (isEdit && stockLevel) {
        await updateMutation.mutateAsync({
          id: stockLevel.id,
          input: payload,
        })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleDelete() {
    if (!stockLevel) return
    // Confirmation handled by the global delete modal (password + reason).
    setError(null)
    try {
      await deleteMutation.mutateAsync(stockLevel.id)
      onClose()
    } catch (err) {
      if (!isDeleteCancelled(err)) setError(extractError(err))
    }
  }

  const binsForLocation = allBins.filter((b) => b.location_id === locationId)

  return (
    <ModalShell title={isEdit ? 'Edit stock' : 'Add stock'} onClose={onClose} tour="inv-stock-form">
      <div className="p-6 space-y-4">
        <div data-tour="inv-stock-form-item">
        <Field label="Item" required>
          {catalogItemId ? (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-2">
              <div className="text-sm text-slate-800">
                {justCreatedItem && justCreatedItem.id === catalogItemId
                  ? justCreatedItem.name
                  : initialItemName && stockLevel?.catalog_item_id === catalogItemId
                    ? initialItemName
                    : itemResults.find((it) => it.id === catalogItemId)?.name ?? catalogItemId}
              </div>
              <div className="flex items-center gap-3">
                {canEditCatalog && (
                  <button
                    type="button"
                    onClick={() => setEditingCatalogItemId(catalogItemId)}
                    className="text-xs text-slate-600 hover:text-amber-700 hover:underline"
                    title="Edit this product's catalog details (description, image, threshold, etc.)"
                  >
                    Edit
                  </button>
                )}
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogItemId("")
                      setJustCreatedItem(null)
                    }}
                    className="text-xs text-amber-700 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="search"
                  value={catalogQuery}
                  onChange={(e) => {
                    setCatalogQuery(e.target.value)
                    setShowPicker(true)
                  }}
                  onFocus={() => setShowPicker(true)}
                  onBlur={() => setTimeout(() => setShowPicker(false), 150)}
                  placeholder="Search catalog by name or SKU…"
                  className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewProduct(true)}
                  className="text-xs text-amber-700 hover:underline font-medium whitespace-nowrap"
                  title="Create a new catalog item without leaving this dialog"
                >
                  + New product
                </button>
              </div>
              {showPicker && debouncedQuery && (
                <div className="absolute z-10 mt-1 left-0 right-0 bg-white border border-slate-200 rounded shadow-lg max-h-60 overflow-y-auto">
                  {itemsQuery.isLoading && (
                    <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
                  )}
                  {itemsQuery.isError && (
                    <div role="alert" className="px-3 py-2 text-xs text-red-700">
                      Product search could not be loaded.
                      <button type="button" disabled={itemsQuery.isFetching} className="ml-2 underline disabled:opacity-50" onMouseDown={event => event.preventDefault()} onClick={() => void itemsQuery.refetch()}>Try again</button>
                    </div>
                  )}
                  {!itemsQuery.isLoading && !itemsQuery.isError && itemResults.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500 flex items-center justify-between">
                      <span>No matches.</span>
                      <button
                        type="button"
                        onMouseDown={() => {
                          setShowPicker(false)
                          setShowNewProduct(true)
                        }}
                        className="text-amber-700 hover:underline font-medium"
                      >
                        + Create &quot;{debouncedQuery}&quot;
                      </button>
                    </div>
                  )}
                  {!itemsQuery.isError && itemResults.map((it) => (
                    <button
                      type="button"
                      key={it.id}
                      onMouseDown={() => {
                        setCatalogItemId(it.id)
                        setCatalogQuery("")
                        setShowPicker(false)
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm"
                    >
                      <div className="font-medium text-slate-800">{it.name}</div>
                      {it.sku && (
                        <div className="font-mono text-xs text-slate-400">{it.sku}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        </div>

        <div data-tour="inv-stock-form-where" className="grid grid-cols-2 gap-3">
          <Field label="Location" required>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value)
                setBinId("")
              }}
              disabled={isEdit}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— Select —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bin (leaf only)">
            {(() => {
              const display = pickedBin
                ? pickedBin.path_label || pickedBin.name || pickedBin.bin_code
                : binId
                  ? binsForLocation.find((b) => b.id === binId)?.path_label || binId
                  : null
              const hasValue = !!display
              return (
                <div className="flex items-center gap-2">
                  <div
                    className={`flex-1 text-sm px-3 py-2 border rounded truncate ${
                      hasValue
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {hasValue ? (
                      <>📍 {display}</>
                    ) : (
                      <span className="italic text-slate-400">— None —</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBinPicker(true)}
                    disabled={isEdit || !locationId}
                    aria-label={hasValue ? 'Change bin' : 'Pick a bin'}
                    title={hasValue ? 'Change bin' : 'Pick a bin'}
                    className="text-base px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap leading-none"
                  >
                    🗂️
                  </button>
                  {!isEdit && hasValue && (
                    <button
                      type="button"
                      onClick={() => {
                        setBinId("")
                        setPickedBin(null)
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )
            })()}
          </Field>
        </div>

        <div data-tour="inv-stock-form-qty" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${stockLevel?.quantities.sn_tracked ? 'On hand (counted from units)' : 'On hand'}${isCountableUnit(pickedUnit) ? '' : ` (${pickedUnit})`}`} required>
            <input
              type="number"
              step={qtyStepFor(pickedUnit)}
              min="0"
              inputMode={isCountableUnit(pickedUnit) ? 'numeric' : 'decimal'}
              value={qtyOnHand}
              onChange={(e) => {
                const allow = isCountableUnit(pickedUnit)
                  ? e.target.value.replace(/[^0-9]/g, '')
                  : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
                setQtyOnHand(allow)
              }}
              disabled={stockLevel?.quantities.sn_tracked}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded text-right focus:outline-none focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-500"
              title={stockLevel?.quantities.sn_tracked
                ? "Computed from active SN units. Add/remove units to change this."
                : undefined}
            />
          </Field>
          <Field label={`Held for jobs${isCountableUnit(pickedUnit) ? '' : ` (${pickedUnit})`}`}>
            <input
              type="number"
              step={qtyStepFor(pickedUnit)}
              min="0"
              inputMode={isCountableUnit(pickedUnit) ? 'numeric' : 'decimal'}
              value={qtyReserved}
              onChange={(e) => {
                const allow = isCountableUnit(pickedUnit)
                  ? e.target.value.replace(/[^0-9]/g, '')
                  : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
                setQtyReserved(allow)
              }}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded text-right focus:outline-none focus:border-amber-500"
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Free to use = on hand − held for jobs.
          {stockLevel?.quantities.sn_tracked
            ? " On-hand is computed from active SN units — edit individual units to change it."
            : ""}
        </p>
        <PoOverrideBox gate={override} />
        </div>

        {/*
          What this spot should carry. Left blank it is not stocked here on
          purpose and nothing reports it as short; a van only shows up on its
          own restock list for items somebody decided it carries.
        */}
        <div data-tour="inv-stock-form-par">
        <Field label={`Keep at least${isCountableUnit(pickedUnit) ? '' : ` (${pickedUnit})`}`}>
          <input
            type="number"
            step={qtyStepFor(pickedUnit)}
            min="0"
            inputMode={isCountableUnit(pickedUnit) ? 'numeric' : 'decimal'}
            value={parQty}
            placeholder="Leave blank if this spot does not stock it"
            onChange={(e) => {
              const allow = isCountableUnit(pickedUnit)
                ? e.target.value.replace(/[^0-9]/g, '')
                : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
              setParQty(allow)
            }}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded text-right focus:outline-none focus:border-amber-500"
          />
          <p className="mt-1 text-[12px] text-slate-500">
            The number this van or shelf is meant to hold. Drop below it and it
            shows on this location&rsquo;s restock list. Blank means no target;
            0 means it should carry none.
          </p>
        </Field>
        </div>

        {isEdit && stockLevel?.catalog_item_id && (
          <PrintQrSection stockLevel={stockLevel} />
        )}

        {isEdit && stockLevel?.catalog_item_id && (
          <ReturnSection stockLevel={stockLevel} onClose={onClose} />
        )}

        {error && <ErrorBanner message={error} />}
      </div>

      <Footer tour="inv-stock-form-footer">
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50 mr-auto"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          data-tour="inv-stock-form-cancel"
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add stock'}
        </button>
      </Footer>

      {showNewProduct && (
        <CatalogItemQuickCreate
          defaultName={catalogQuery}
          defaultInitialQty={qtyOnHand}
          initialDefaultBinId={binId}
          initialDefaultPickedBin={pickedBin}
          onClose={() => setShowNewProduct(false)}
          onCreated={(item) => {
            // Auto-select the freshly-created product. Stash on a local
            // state so we can render its name without waiting for the
            // catalog list refetch.
            setJustCreatedItem(item)
            setCatalogItemId(item.id)
            setCatalogQuery("")
            setShowPicker(false)
            // If QuickCreate set a default bin and we don't already have
            // bin/location filled in the parent, inherit them. Saves the
            // user from picking the same bin twice when "+ New product"
            // didn't write stock (e.g. qty was 0).
            if (item.default_bin && !binId) {
              setLocationId(item.default_bin.location_id)
              setBinId(item.default_bin.id)
              const fromAll = allBins.find((b) => b.id === item.default_bin!.id)
              if (fromAll) setPickedBin(fromAll)
            }
          }}
          onStockCreated={() => {
            // QuickCreate already wrote the stock — close this whole
            // "+ Add stock" modal so the user doesn't accidentally create
            // a second stock_levels row by hitting Save here.
            onClose()
          }}
        />
      )}
      {showBinPicker && (
        <BinTreePicker
          isOpen={true}
          onClose={() => setShowBinPicker(false)}
          allowNoBin={true}
          defaultLocationId={locationId}
          title="Stock bin"
          highlightItemId={catalogItemId || undefined}
          onPick={(bin) => {
            setPickedBin(bin)
            setBinId(bin?.id ?? "")
            // If the picked bin's location is different from current, update.
            if (bin && bin.location_id !== locationId) {
              setLocationId(bin.location_id)
            }
          }}
        />
      )}
      {editingCatalogItemId && editingItemQuery.data && (
        <ProductCatalogEditModal
          item={editingItemQuery.data}
          onClose={() => setEditingCatalogItemId(null)}
        />
      )}
    </ModalShell>
  )
}
