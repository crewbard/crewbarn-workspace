import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { useCreateCatalogItem } from '@/hooks/useCatalogItems'
import { useAllInventoryBins } from '@/hooks/useInventoryBins'
import { useProductCatalogCategories } from '@/hooks/useProductCatalogCategories'
import { useInventorySettings } from '@/hooks/useInventorySettings'
import { useTaxClasses } from '@/hooks/useTaxClasses'
import { ApiError } from '@/lib/api'
import { uploadCatalogItemImage } from '@/lib/catalogItems'
import { createStockLevel } from '@/lib/inventoryStockLevels'
import { stockLevelKeys } from '@/hooks/useInventoryStockLevels'
import { createInventoryUnit } from '@/lib/inventoryUnits'
import { inventoryUnitKeys } from '@/hooks/useInventoryUnits'
import { generateSku } from '@/lib/catalogSku'
import { BinTreePicker } from '@/components/BinTreePicker'
import { InlineCreateProductCategoryModal } from '@/components/InlineCreateProductCategoryModal'
import { UnitOfMeasurePicker } from '@/components/UnitOfMeasurePicker'
import { isCountableUnit, qtyStepFor } from '@/lib/unitsOfMeasure'
import type { InventoryBin } from '@/types/inventoryBin'
import type { CatalogItem, PartSource } from '@/types/catalogItem'

/**
 * Inline "+ New product" overlay used by every picker that needs to
 * also support creating a catalog item on the fly (Stock Levels add,
 * PO line add, etc.). Returns the created CatalogItem via onCreated
 * so the caller can auto-select it.
 *
 * Mirrors the field set on the full Tool Shed → Product Catalog form
 * so users don't lose anything by creating from here:
 *   name (required), sku
 *   short_description (customer-facing, 100 char cap)
 *   long_description / internal_description (FTS-indexed, vehicle
 *     fitment / FCC IDs / crossover part numbers)
 *   default_bin (where this item lives by default)
 *   supplier_name
 *   customer_cost ($) + tax_class — what the customer is charged
 *   owner_cost ($)
 *   reorder_threshold + reorder_quantity
 *   sn_tracking + sn_format_prefix
 */
export function CatalogItemQuickCreate({
  defaultName = '',
  defaultUnitCostCents = 0,
  defaultSupplierName = '',
  initialDefaultBinId = '',
  initialDefaultPickedBin = null,
  defaultInitialQty = '',
  onCreated,
  onStockCreated,
  onClose,
}: {
  defaultName?: string
  defaultUnitCostCents?: number
  defaultSupplierName?: string
  /** Pre-fill the Default Bin from the calling form. The parent's bin is
   *  treated here as both the catalog item's default_bin and the placement
   *  location for the initial stock_levels row — one bin to rule them all,
   *  to prevent the "set 1-A on top, accidentally save 1-B from below" bug. */
  initialDefaultBinId?: string
  initialDefaultPickedBin?: InventoryBin | null
  defaultInitialQty?: string
  onCreated: (item: CatalogItem) => void
  /** Fires after the stock_levels row is written so the parent (Add Stock)
   *  can auto-close without writing a duplicate row from its own Save. */
  onStockCreated?: (item: CatalogItem) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const createMutation = useCreateCatalogItem()
  const { data: binsData } = useAllInventoryBins({})
  const bins = binsData?.data ?? []
  const { data: categoriesData } = useProductCatalogCategories({ active: true })
  const categories = categoriesData?.data ?? []
  const { data: invSettings } = useInventorySettings()
  const { data: taxClassesData } = useTaxClasses({ active: true, per_page: 100 })
  const taxClasses = taxClassesData?.data ?? []
  const showSnUi = !!invSettings?.inventory_show_sn_tracking

  const [name, setName] = useState(defaultName)
  const [sku, setSku] = useState('')
  const [partSource, setPartSource] = useState<PartSource | ''>('')
  const [unitLabel, setUnitLabel] = useState('each')
  const [productCategoryId, setProductCategoryId] = useState('')
  const [showInlineCategory, setShowInlineCategory] = useState(false)
  const [shortDescription, setShortDescription] = useState('')
  const [longDescription, setLongDescription] = useState('')
  const [defaultBinId, setDefaultBinId] = useState(initialDefaultBinId)
  const [pickedBin, setPickedBin] = useState<InventoryBin | null>(initialDefaultPickedBin)
  const [showBinPicker, setShowBinPicker] = useState(false)
  const [supplierName, setSupplierName] = useState(defaultSupplierName)
  const [ownerCostDollars, setOwnerCostDollars] = useState(
    defaultUnitCostCents ? (defaultUnitCostCents / 100).toFixed(2) : ''
  )
  /**
   * Customer price and tax class were both missing here, despite the note
   * above claiming parity with the full Product Catalog form. The cost of
   * leaving them out is not cosmetic: a job line inherits its tax class from
   * the catalog item (WorkOrderLineItem::inheritFromCatalogItem), so a product
   * created from this overlay could never be taxed on any job it was added to
   * — and with no customer price it billed at zero. Neither failure announces
   * itself; the line just quietly reads $0.00 with no tax.
   */
  const [customerCostDollars, setCustomerCostDollars] = useState('')
  const [taxClassId, setTaxClassId] = useState('')
  const [reorderThreshold, setReorderThreshold] = useState('')
  const [reorderQuantity, setReorderQuantity] = useState('')
  const [snTracking, setSnTracking] = useState(false)
  const [snPrefix, setSnPrefix] = useState('')
  const [isStockedItem, setIsStockedItem] = useState(true)

  // Stock placement — driven by the Default Bin above. Picking a bin in the
  // Default Bin field both sets the catalog item's default_bin_id AND tells
  // us where to write the starting stock_levels row. One field, one source
  // of truth — no chance of saving "Shelf 1-A" as the default while
  // simultaneously saving "Shelf 1-B" as the placement.
  const [initialQty, setInitialQty] = useState(defaultInitialQty)
  const [creatingStock, setCreatingStock] = useState(false)

  // Image picked here is buffered locally — upload runs in handleSave AFTER
  // the catalog item is created (the upload endpoint needs the new item id).
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function clearImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    // Auto-generate SKU on save if user left it blank — products require
    // it. User can always edit before/after saving.
    const finalSku = sku.trim() || generateSku(name, partSource || null)
    try {
      const created = await createMutation.mutateAsync({
        type: 'product',
        name: name.trim(),
        sku: finalSku,
        part_source: partSource || null,
        unit_label: unitLabel.trim() || 'each',
        product_category_id: productCategoryId || null,
        short_description: shortDescription.trim() || null,
        internal_description: longDescription.trim() || null,
        default_bin_id: defaultBinId || null,
        supplier_name: supplierName.trim() || null,
        customer_cost_cents: customerCostDollars
          ? Math.round(Number(customerCostDollars) * 100) || 0
          : 0,
        tax_class_id: taxClassId || null,
        owner_cost_cents: ownerCostDollars
          ? Math.round(Number(ownerCostDollars) * 100) || 0
          : 0,
        reorder_threshold: reorderThreshold ? Number(reorderThreshold) : null,
        reorder_quantity: reorderQuantity ? Number(reorderQuantity) : null,
        sn_tracking_enabled: snTracking,
        sn_format_prefix: snTracking && snPrefix.trim() ? snPrefix.trim() : null,
        is_stocked_item: isStockedItem,
        active: true,
      })

      // If the user picked an image, upload it now that we have an item id.
      // A failed upload doesn't roll the item back — the product is real,
      // we just surface the error and let them add the image from Catalog.
      let final: CatalogItem = created
      if (imageFile) {
        setUploadingImage(true)
        try {
          final = await uploadCatalogItemImage(created.id, imageFile)
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message
            : uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
          alert(`Product was created, but image upload failed: ${msg}\n\nYou can add the image from Tool Shed → Product Catalog.`)
        } finally {
          setUploadingImage(false)
        }
      }

      // Optional initial stock. Same fail-soft policy as image upload —
      // catalog item is already created, so we surface stocking errors via
      // alert and continue to close. User can finish stocking from the
      // Stock Levels tab.
      const qtyN = Number(initialQty) || 0
      let stockWasCreated = false
      // Trigger is the Default Bin being set — that's our single source of
      // truth for "where this lives". Qty=0 still registers the placement
      // (the row shows up in Stock Levels and can be adjusted later).
      if (pickedBin) {
        const placementLocationId = pickedBin.location_id
        const placementBinId = pickedBin.id
        setCreatingStock(true)
        try {
          if (snTracking && qtyN > 0) {
            // SN-tracked with qty > 0 → mint N units. Each unit-create
            // triggers ensureStockLevelRow on the backend, so the
            // stock_levels row at this location/bin shows up automatically.
            // Sequential awaits because sn_next_sequence increments per call.
            for (let i = 0; i < qtyN; i++) {
              await createInventoryUnit({
                catalog_item_id: created.id,
                location_id: placementLocationId,
                bin_id: placementBinId,
              })
            }
          } else {
            // Non-SN (any qty) OR SN with qty=0 → write the stock_levels
            // row directly. SN with qty=0 is just a placement registration —
            // qty_on_hand stays 0, future receives will mint units there.
            await createStockLevel({
              catalog_item_id: created.id,
              location_id: placementLocationId,
              bin_id: placementBinId,
              qty_on_hand: snTracking ? 0 : qtyN,
              qty_reserved: 0,
            })
          }
          stockWasCreated = true
          // We bypassed the cache-invalidating mutation hooks (called the
          // lib functions directly) — refresh the relevant lists by hand.
          queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() })
      // Bin counts on the tree derive from stock levels.
      queryClient.invalidateQueries({ queryKey: ['inventory-bins', 'stock-rollup'] })
          queryClient.invalidateQueries({ queryKey: inventoryUnitKeys.lists() })
        } catch (stockErr) {
          const msg = stockErr instanceof ApiError ? stockErr.message
            : stockErr instanceof Error ? stockErr.message : String(stockErr)
          alert(`Product was created, but stock placement failed: ${msg}\n\nYou can add stock from the Stock Levels tab.`)
        } finally {
          setCreatingStock(false)
        }
      }

      onCreated(final)
      if (stockWasCreated) onStockCreated?.(final)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  const isPending = createMutation.isPending || uploadingImage || creatingStock
  const canSave = !isPending && name.trim().length > 0

  return (
    <Modal isOpen={true} onClose={onClose} title="New product" size="lg">
      <Modal.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass()}
                autoFocus
              />
            </Field>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineCategory(true)}
                  className="text-[11px] text-amber-700 hover:underline font-medium"
                >
                  + Add new
                </button>
              </div>
              <select
                value={productCategoryId}
                onChange={(e) => setProductCategoryId(e.target.value)}
                className={inputClass()}
              >
                <option value="">— No category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide">
                  SKU
                </label>
                <button
                  type="button"
                  onClick={() => setSku(generateSku(name, partSource || null))}
                  disabled={!name.trim()}
                  className="text-[11px] text-amber-700 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                  title="Auto-generate from name + part source. Format: 3 chars + A/O/X + 6 random digits."
                >
                  Generate
                </button>
              </div>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className={inputClass() + ' font-mono'}
                placeholder="Auto-generated on save if blank"
              />
            </div>
            <Field label="Part source">
              <select
                value={partSource}
                onChange={(e) => setPartSource(e.target.value as PartSource | '')}
                className={inputClass()}
              >
                <option value="">— Unspecified —</option>
                <option value="aftermarket">Aftermarket (A)</option>
                <option value="oem">OEM (O)</option>
              </select>
            </Field>
          </div>

          <Field label="Unit of measure (each / lbs / gal / ...)">
            <UnitOfMeasurePicker value={unitLabel} onChange={setUnitLabel} />
          </Field>

          <Field label="Short description (customer-facing — invoices, sticker, max 100)">
            <input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={100}
              className={inputClass()}
              placeholder='e.g. "Schlage L9080 Mortise Lock"'
            />
          </Field>

          <Field label="Long description (internal — searchable: vehicle fitment, FCC IDs, crossover part #s, alt names)">
            <textarea
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              rows={3}
              className={inputClass() + ' resize-y'}
              placeholder='e.g. "2021 Ford F150 / FCC ID M3N-A2C31243800 / Schlage L9080 / L-9080 / 9080-PD"'
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Default bin (where this lives — drives auto-receive)">
              {(() => {
                const display = pickedBin
                  ? pickedBin.path_label || pickedBin.name || pickedBin.bin_code
                  : defaultBinId
                    ? bins.find((b) => b.id === defaultBinId)?.path_label || defaultBinId
                    : null
                const hasValue = !!display
                return (
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex-1 text-sm px-3 py-2 border rounded truncate ${
                        hasValue
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                          : 'bg-slate-50 border-slate-300 text-slate-700'
                      }`}
                    >
                      {hasValue ? (
                        <>📍 {display}</>
                      ) : (
                        <span className="italic text-slate-400">— None (set on receive) —</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBinPicker(true)}
                      aria-label={hasValue ? 'Change bin' : 'Pick a bin'}
                      title={hasValue ? 'Change bin' : 'Pick a bin'}
                      className="text-base px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap leading-none"
                    >
                      🗂️
                    </button>
                    {hasValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultBinId('')
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
            <Field label="Supplier">
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={inputClass()}
                placeholder="(free text)"
              />
            </Field>
          </div>

          {/* What the customer pays. Kept together and ahead of owner cost
              so the two prices are not mistaken for each other. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer price ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={customerCostDollars}
                onChange={(e) => setCustomerCostDollars(e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === '' || isNaN(Number(v))) return
                  setCustomerCostDollars(Number(v).toFixed(2))
                }}
                className={inputClass()}
                placeholder="0.00"
              />
            </Field>
            <Field label="Tax class">
              <select
                value={taxClassId}
                onChange={(e) => setTaxClassId(e.target.value)}
                className={inputClass()}
              >
                <option value="">- No tax -</option>
                {taxClasses.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name} ({Number(tc.rate_pct).toFixed(2)}%)
                  </option>
                ))}
              </select>
              {/* Say where this lands, because the consequence shows up much
                  later and somewhere else entirely. */}
              <p className="mt-1 text-[11px] text-slate-500">
                Job and invoice lines for this product inherit this. Leave it on
                &ldquo;No tax&rdquo; and they are never taxed.
              </p>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Owner cost ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={ownerCostDollars}
                onChange={(e) => setOwnerCostDollars(e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === '' || isNaN(Number(v))) return
                  setOwnerCostDollars(Number(v).toFixed(2))
                }}
                className={inputClass()}
                placeholder="0.00"
              />
            </Field>
            <Field label="Reorder threshold">
              <input
                type="number"
                min="0"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                className={inputClass()}
                placeholder="When stock <=, low-stock"
              />
            </Field>
            <Field label="Reorder quantity">
              <input
                type="number"
                min="0"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                className={inputClass()}
                placeholder="Default re-order qty"
              />
            </Field>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handlePickImage}
              className="hidden"
            />
            {imagePreviewUrl ? (
              <div className="flex items-start gap-3">
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="w-20 h-20 object-cover rounded border border-slate-200 bg-slate-50"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                    className="text-xs px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={isPending}
                    className="text-xs px-2.5 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                className="w-full border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-colors disabled:opacity-50"
              >
                <span className="text-xl block mb-1">📷</span>
                Click to add image — JPG/PNG/WebP/HEIC up to 10 MB
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
              Starting qty (optional)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              How many do you have on hand right now? Saved at the Default Bin
              picked above. Leave 0 if you just want to register the placement.
              {snTracking && ' SN-tracked items mint one unit per qty (auto-generated SNs).'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label={`Qty${isCountableUnit(unitLabel) ? '' : ` (${unitLabel})`}`}>
                <input
                  type="number"
                  min="0"
                  step={qtyStepFor(unitLabel)}
                  inputMode={isCountableUnit(unitLabel) ? 'numeric' : 'decimal'}
                  value={initialQty}
                  onChange={(e) => {
                    // Filter to digits only for countable units; allow
                    // digits + a single decimal for measured ones.
                    const allow = isCountableUnit(unitLabel)
                      ? e.target.value.replace(/[^0-9]/g, '')
                      : e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')
                    setInitialQty(allow)
                  }}
                  className={inputClass()}
                  placeholder="0"
                />
              </Field>
            </div>
            {Number(initialQty) > 0 && !pickedBin && (
              <p className="text-xs text-amber-700 mt-2">
                Pick a Default Bin above so we know where this stock lives.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm pt-2 border-t border-slate-100">
            <input
              type="checkbox"
              checked={isStockedItem}
              onChange={(e) => setIsStockedItem(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span>
              Stocked item
              <span className="block text-xs text-slate-500">
                On by default. Off for one-off / custom-order parts the
                shop catalogs but doesn't reorder. Off-items don't show
                up in the PO "+ Low stock" picker.
              </span>
            </span>
          </label>


          {showSnUi && (
            <label className={`flex items-center gap-2 text-sm ${!isCountableUnit(unitLabel) ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={snTracking && isCountableUnit(unitLabel)}
                disabled={!isCountableUnit(unitLabel)}
                onChange={(e) => setSnTracking(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                SN-tracked (mints individual units on receive)
                {!isCountableUnit(unitLabel) && (
                  <span className="block text-xs text-slate-500">
                    Unavailable — measured units (e.g. {unitLabel}) can't be serialized.
                  </span>
                )}
              </span>
            </label>
          )}
          {showSnUi && snTracking && (
            <Field label="SN prefix">
              <input
                value={snPrefix}
                onChange={(e) => setSnPrefix(e.target.value.toUpperCase())}
                className={inputClass()}
                maxLength={20}
                placeholder="Defaults to SKU if blank"
              />
            </Field>
          )}

          {error && (
            <div className="text-xs text-red-600 px-3 py-2 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>

        {showBinPicker && (
          <BinTreePicker
            isOpen={true}
            onClose={() => setShowBinPicker(false)}
            allowNoBin={true}
            title="Default bin"
            onPick={(bin) => {
              setPickedBin(bin)
              setDefaultBinId(bin?.id ?? '')
            }}
          />
        )}
        {showInlineCategory && (
          <InlineCreateProductCategoryModal
            onCreated={(cat) => {
              setProductCategoryId(cat.id)
              setShowInlineCategory(false)
            }}
            onClose={() => setShowInlineCategory(false)}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {creatingStock ? 'Adding stock…' : uploadingImage ? 'Uploading image…' : createMutation.isPending ? 'Creating…' : 'Create product'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function inputClass(): string {
  return 'w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
}
