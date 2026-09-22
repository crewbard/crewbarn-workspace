import { useState, useMemo, useEffect } from "react"
import {
  useCatalogItems,
  useCreateCatalogItem,
  useUploadCatalogItemImage,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from "@/hooks/useCatalogItems"
import { useProductCatalogCategories } from "@/hooks/useProductCatalogCategories"
import { useTaxClasses } from "@/hooks/useTaxClasses"
import { useAllInventoryBins } from "@/hooks/useInventoryBins"
import { useStockLevels } from "@/hooks/useInventoryStockLevels"
import { generateSku } from "@/lib/catalogSku"
import type { PartSource } from "@/types/catalogItem"
import { ApiError } from "@/lib/api"
import { PendingImagePicker } from "@/components/images/PendingImagePicker"
import { CategoryTiles } from "@/components/catalog/CategoryTiles"
import { StockWhereOverlay } from "@/components/catalog/StockWhereOverlay"
import { CatalogItemImageUploader } from "@/components/CatalogItemImageUploader"
import { InlineCreateProductCategoryModal } from "@/components/InlineCreateProductCategoryModal"
import { UnitOfMeasurePicker } from "@/components/UnitOfMeasurePicker"
import { isCountableUnit, formatQty } from "@/lib/unitsOfMeasure"
import { PERM, usePermissions } from "@/hooks/usePermissions"
import { useInventorySettings } from "@/hooks/useInventorySettings"
import type { CatalogItem, CatalogItemInput } from "@/types/catalogItem"
import type { ProductCatalogCategory } from "@/types/productCatalogCategory"
import type { TaxClass } from "@/types/taxClass"

// ---------- Page ----------

export function ProductCatalogPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  // viewing: read-only details overlay (every signed-in user can open this).
  // editing: full edit form (gated by canEdit — admins / platform admins only).
  // Only one of {viewing, editing, creating} is non-null at a time.
  const [viewing, setViewing] = useState<CatalogItem | null>(null)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [creating, setCreating] = useState(false)

  // The RBAC check the previous comment here promised once roles shipped. They
  // have, so this is it: gating on is_platform_admin meant no tenant could edit
  // their own catalog — not even the owner — while the API accepted the write
  // perfectly well. The hidden button was the only thing stopping them.
  const { has } = usePermissions()
  const canEdit = has(PERM.CATALOG_EDIT)
  const { data: invSettings } = useInventorySettings()
  const showSnUi = !!invSettings?.inventory_show_sn_tracking

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // null = the All products view. Picking a tile narrows the same table rather
  // than opening a different screen, so the search box and the row actions stay
  // exactly where they were.
  const [category, setCategory] = useState<ProductCatalogCategory | null>(null)
  // Which item's "where is it" overlay is open.
  const [whereItem, setWhereItem] = useState<{ id: string; name: string; unit: string } | null>(null)

  const { data, isLoading, isError, error } = useCatalogItems({
    type: "product",
    q: debouncedSearch || undefined,
    product_category_id: category?.id,
    per_page: 50,
  })

  const items = data?.data ?? []
  const meta = data?.meta

  // Stock + location info — always fetched so the catalog list can show
  // techs where to find a part. Per-item show_stock_in_catalog still gates
  // whether numbers display in each row; the tenant-wide toggle is no longer
  // used to hide the column itself (kept on the model for now in case we need
  // a "really hide everything" master override later).
  const stockQuery = useStockLevels({ has_stock: false, per_page: 500 })
  // Aggregate per-placement (location + bin) so the table can show the
  // full path a tech needs to walk to: "Main Melbourne / Shelf 1-B (8)".
  type ItemStock = { qty: number; byPlacement: Map<string, { label: string; qty: number }> }
  const stockByItem = useMemo(() => {
    const m = new Map<string, ItemStock>()
    for (const sl of stockQuery.data?.data ?? []) {
      const entry = m.get(sl.catalog_item_id) ?? { qty: 0, byPlacement: new Map() }
      entry.qty += sl.quantities.qty_on_hand
      // path_label already includes the location name as its first segment,
      // so use it as-is. Only fall back to manual concat when path_label
      // is missing (no bin or bin without computed path).
      let label: string
      if (sl.bin?.path_label) {
        label = sl.bin.path_label
      } else if (sl.bin?.name || sl.bin?.bin_code) {
        label = `${sl.location?.name ?? '—'} / ${sl.bin?.name || sl.bin?.bin_code}`
      } else {
        label = sl.location?.name ?? '—'
      }
      const key = `${sl.location_id}|${sl.bin_id ?? ''}`
      const existing = entry.byPlacement.get(key)
      entry.byPlacement.set(key, {
        label,
        qty: (existing?.qty ?? 0) + sl.quantities.qty_on_hand,
      })
      m.set(sl.catalog_item_id, entry)
    }
    return m
  }, [stockQuery.data])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        search={search}
        onSearchChange={setSearch}
        onNew={() => setCreating(true)}
        canEdit={canEdit}
      />

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load catalog items.
            {error instanceof Error ? ` ${error.message}` : ""}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded mb-6" />
          <div className="space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        </div>
      )}

      <CategoryTiles onPick={setCategory} />

      {category && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            Showing <strong className="text-slate-900">{category.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="text-amber-700 hover:underline"
          >
            Show all products
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <ItemsTable
            items={items}
            onView={setViewing}
            stockByItem={stockByItem}
            showSnUi={showSnUi}
            onShowWhere={(id, name, unit) => setWhereItem({ id, name, unit })}
          />
          {meta && (
            <div className="text-xs text-slate-500 text-right">
              Showing {items.length} of {meta.total} products
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
            </div>
          )}
        </>
      )}

      {whereItem && (
        <StockWhereOverlay
          itemId={whereItem.id}
          itemName={whereItem.name}
          unitLabel={whereItem.unit}
          onClose={() => setWhereItem(null)}
        />
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} />}
      {viewing && (
        <ProductViewModal
          item={viewing}
          canEdit={canEdit}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
          }}
        />
      )}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PageHeader({
  search,
  onSearchChange,
  onNew,
  canEdit,
}: {
  search: string
  onSearchChange: (s: string) => void
  onNew: () => void
  canEdit: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Product Catalog</h1>
          <p className="text-sm text-slate-600 mt-1">
            Physical products you sell or use - keys, locks, hardware. Stock levels are managed in Inventory.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onNew}
            className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex-shrink-0"
          >
            + New Product
          </button>
        )}
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search products by name, SKU, or part number..."
        className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />
    </div>
  )
}

// ---------- Table ----------

function ItemsTable({
  items,
  onView,
  stockByItem,
  showSnUi,
  onShowWhere,
}: {
  items: CatalogItem[]
  onView: (item: CatalogItem) => void
  stockByItem: Map<string, { qty: number; byPlacement: Map<string, { label: string; qty: number }> }>
  onShowWhere: (id: string, name: string, unit: string) => void
  showSnUi: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">No products in the catalog.</p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 w-14"></th>
            <th className="text-left px-6 py-3 font-medium">Name / SKU</th>
            <th className="text-left px-6 py-3 font-medium">Category</th>
            <th className="text-right px-6 py-3 font-medium">Price</th>
            <th className="text-left px-6 py-3 font-medium">Tax</th>
            <th className="text-right px-6 py-3 font-medium" title="Total qty_on_hand and where it's stored">
              Stock
            </th>
            {showSnUi && (
              <th className="text-center px-6 py-3 font-medium">SN</th>
            )}
            <th className="text-center px-6 py-3 font-medium">Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr
              key={item.id}
              className="hover:bg-slate-50 cursor-pointer"
              onClick={() => onView(item)}
            >
              <td className="px-4 py-3 w-14">
                {item.images.thumb_url || item.images.medium_url ? (
                  <img
                    src={item.images.thumb_url ?? item.images.medium_url ?? ''}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-slate-200 bg-slate-50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 text-base">
                    📷
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="font-medium text-slate-900">{item.name}</div>
                {item.sku && (
                  <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                )}
              </td>
              <td className="px-6 py-4 text-slate-700 text-xs">
                {item.product_category?.name || "-"}
              </td>
              <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                {item.pricing.customer_cost_formatted}
              </td>
              <td className="px-6 py-4 text-slate-700">
                {item.tax_class ? (
                  <span className="text-xs">
                    {item.tax_class.name}
                    <span className="text-slate-400 ml-1">
                      ({Number(item.tax_class.rate_pct).toFixed(2)}%)
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No tax</span>
                )}
              </td>
              <td className="px-6 py-4 text-right tabular-nums align-top">
                {/* Stock shows on every STOCKED product now — no per-item opt-in.
                    Non-stocked products (services-as-products, the Write In
                    bucket) have no count, so they show a dash. */}
                {item.is_stocked_item ? (() => {
                  const entry = stockByItem.get(item.id)
                  const qty = entry?.qty ?? 0
                  const threshold = item.inventory.reorder_threshold
                  const low = threshold != null && threshold > 0 && qty <= threshold
                  const placements = entry ? Array.from(entry.byPlacement.values()) : []
                  placements.sort((a, b) => b.qty - a.qty)
                  const top = placements.slice(0, 2)
                  const moreCount = placements.length - top.length
                  return (
                    <div className="flex flex-col items-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => onShowWhere(item.id, item.name, item.unit_label || 'each')}
                        className={`text-sm underline decoration-dotted underline-offset-2 hover:decoration-solid ${low ? 'text-red-700 font-semibold' : 'text-slate-700'}`}
                        title={low ? `At or below reorder threshold (${threshold}) — click to see where` : 'Click to see where these are'}
                      >
                        {formatQty(qty, item.unit_label)}
                      </button>
                      {top.length > 0 && (
                        <span
                          className="text-[11px] text-slate-500 leading-tight text-right"
                          title={placements.map((p) => `${p.label}: ${p.qty}`).join('\n')}
                        >
                          📍 {top.map((p) => p.label).join(', ')}
                          {moreCount > 0 && ` +${moreCount}`}
                        </span>
                      )}
                    </div>
                  )
                })() : (
                  <span className="text-xs text-slate-300" title="Not a stocked item.">
                    —
                  </span>
                )}
              </td>
              {showSnUi && (
                <td className="px-6 py-4 text-center">
                  {item.sn_tracking.enabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded font-mono">
                      SN
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">-</span>
                  )}
                </td>
              )}
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  {item.active ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                      Inactive
                    </span>
                  )}
                  <a
                    href={`/catalog-items/${item.id}/labels`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Print QR label"
                    className="text-xs text-amber-700 hover:text-amber-900 hover:underline whitespace-nowrap"
                  >
                    Print QR
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Form state ----------

interface ProductFormState {
  name: string
  sku: string
  part_source: '' | PartSource
  barcode: string
  qr_code_value: string
  product_category_id: string
  description: string
  internal_description: string
  internal_notes: string
  short_description: string
  default_bin_id: string
  unit_label: string
  default_quantity: string
  customer_cost_dollars: string
  owner_cost_dollars: string
  tax_class_id: string
  reorder_threshold: string
  reorder_quantity: string
  supplier_name: string
  supplier_sku: string
  sn_tracking_enabled: boolean
  sn_format_prefix: string
  active: boolean
  show_stock_in_catalog: boolean
  is_stocked_item: boolean
  manufacturer_warranty_days: string
  company_warranty_days: string
  labor_warranty_days: string
  is_warranty_extension: boolean
  warranty_extension_kind: '' | 'mfr' | 'co' | 'labor'
  warranty_extension_days: string
}

const emptyForm: ProductFormState = {
  name: "",
  sku: "",
  part_source: "",
  barcode: "",
  qr_code_value: "",
  product_category_id: "",
  description: "",
  internal_description: "",
  internal_notes: "",
  short_description: "",
  default_bin_id: "",
  unit_label: "each",
  default_quantity: "1",
  customer_cost_dollars: "",
  owner_cost_dollars: "",
  tax_class_id: "",
  reorder_threshold: "",
  reorder_quantity: "",
  supplier_name: "",
  supplier_sku: "",
  sn_tracking_enabled: false,
  sn_format_prefix: "",
  active: true,
  show_stock_in_catalog: false,
  is_stocked_item: true,
  manufacturer_warranty_days: "",
  company_warranty_days: "",
  labor_warranty_days: "",
  is_warranty_extension: false,
  warranty_extension_kind: "",
  warranty_extension_days: "",
}

function formStateFromItem(item: CatalogItem): ProductFormState {
  return {
    name: item.name,
    sku: item.sku ?? "",
    part_source: item.part_source ?? "",
    barcode: item.barcode ?? "",
    qr_code_value: item.qr_code_value ?? "",
    product_category_id: item.product_category_id ?? "",
    description: item.description ?? "",
    internal_description: item.internal_description ?? "",
    internal_notes: item.internal_notes ?? "",
    short_description: item.short_description ?? "",
    default_bin_id: item.default_bin_id ?? "",
    unit_label: item.unit_label,
    default_quantity: String(item.default_quantity),
    customer_cost_dollars: (item.pricing.customer_cost_cents / 100).toFixed(2),
    owner_cost_dollars: (item.pricing.owner_cost_cents / 100).toFixed(2),
    tax_class_id: item.pricing.tax_class_id ?? "",
    reorder_threshold:
      item.inventory.reorder_threshold !== null
        ? String(item.inventory.reorder_threshold)
        : "",
    reorder_quantity:
      item.inventory.reorder_quantity !== null
        ? String(item.inventory.reorder_quantity)
        : "",
    supplier_name: item.inventory.supplier_name ?? "",
    supplier_sku: item.inventory.supplier_sku ?? "",
    sn_tracking_enabled: item.sn_tracking.enabled,
    sn_format_prefix: item.sn_tracking.format_prefix ?? "",
    active: item.active,
    show_stock_in_catalog: item.show_stock_in_catalog,
    is_stocked_item: item.is_stocked_item,
    manufacturer_warranty_days:
      item.warranty?.manufacturer_days != null ? String(item.warranty.manufacturer_days) : "",
    company_warranty_days:
      item.warranty?.company_days != null ? String(item.warranty.company_days) : "",
    labor_warranty_days:
      item.warranty?.labor_days != null ? String(item.warranty.labor_days) : "",
    is_warranty_extension: !!item.warranty?.is_extension,
    warranty_extension_kind: (item.warranty?.extension_kind ?? "") as '' | 'mfr' | 'co' | 'labor',
    warranty_extension_days:
      item.warranty?.extension_days != null ? String(item.warranty.extension_days) : "",
  }
}

function formStateToInput(form: ProductFormState): CatalogItemInput {
  // Auto-generate SKU on save if user left it blank — products require it.
  const sku = form.sku.trim() || generateSku(form.name, form.part_source || null)
  return {
    type: "product",
    name: form.name.trim(),
    sku,
    part_source: form.part_source || null,
    barcode: form.barcode.trim() || null,
    qr_code_value: form.qr_code_value.trim() || null,
    product_category_id: form.product_category_id || null,
    description: form.description.trim() || null,
    internal_description: form.internal_description.trim() || null,
    internal_notes: form.internal_notes.trim() || null,
    short_description: form.short_description.trim() || null,
    default_bin_id: form.default_bin_id || null,
    unit_label: form.unit_label.trim() || "each",
    default_quantity: Number(form.default_quantity) || 1,
    customer_cost_cents: Math.round((Number(form.customer_cost_dollars) || 0) * 100),
    owner_cost_cents: Math.round((Number(form.owner_cost_dollars) || 0) * 100),
    tax_class_id: form.tax_class_id || null,
    reorder_threshold:
      form.reorder_threshold.trim() === ""
        ? null
        : parseInt(form.reorder_threshold, 10),
    reorder_quantity:
      form.reorder_quantity.trim() === ""
        ? null
        : parseInt(form.reorder_quantity, 10),
    supplier_name: form.supplier_name.trim() || null,
    supplier_sku: form.supplier_sku.trim() || null,
    sn_tracking_enabled: form.sn_tracking_enabled,
    sn_format_prefix: form.sn_format_prefix.trim() || null,
    active: form.active,
    show_stock_in_catalog: form.show_stock_in_catalog,
    is_stocked_item: form.is_stocked_item,
    manufacturer_warranty_days:
      form.manufacturer_warranty_days.trim() === "" ? null : parseInt(form.manufacturer_warranty_days, 10),
    company_warranty_days:
      form.company_warranty_days.trim() === "" ? null : parseInt(form.company_warranty_days, 10),
    labor_warranty_days:
      form.labor_warranty_days.trim() === "" ? null : parseInt(form.labor_warranty_days, 10),
    is_warranty_extension: form.is_warranty_extension,
    warranty_extension_kind: form.warranty_extension_kind || null,
    warranty_extension_days:
      form.warranty_extension_days.trim() === "" ? null : parseInt(form.warranty_extension_days, 10),
  }
}

// ---------- Create modal ----------

function CreateModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const createMutation = useCreateCatalogItem()
  const uploadImage = useUploadCatalogItemImage()
  // Chosen and cropped before the product exists; uploaded the moment it does.
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // SKU is required for products
  const canSave =
    form.name.trim().length > 0 &&
    form.sku.trim().length > 0 &&
    !createMutation.isPending &&
    !uploadImage.isPending

  const handleSave = () => {
    createMutation.mutate(formStateToInput(form), {
      onSuccess: async (created) => {
        if (!pendingImage) {
          onClose()
          return
        }
        try {
          await uploadImage.mutateAsync({ id: created.id, file: pendingImage })
          onClose()
        } catch (err) {
          // The PRODUCT was created — closing now would hide that and leave
          // the user thinking nothing saved. Stay open, say what failed, and
          // let them retry the image alone.
          setImageError(
            err instanceof ApiError ? err.message
              : err instanceof Error ? err.message
                : 'The product was created, but the image failed to upload.',
          )
        }
      },
    })
  }

  const serverError =
    createMutation.isError
      ? createMutation.error instanceof ApiError
        ? createMutation.error.message
        : "Failed to create product."
      : null

  return (
    <ModalShell title="New Product" onClose={onClose}>
      <ProductForm
        form={form}
        onChange={setForm}
        pendingImage={pendingImage}
        onPendingImageChange={setPendingImage}
      />
      {imageError && (
        <div className="px-6 pt-4">
          <ErrorBanner message={imageError} />
        </div>
      )}
      {serverError && (
        <div className="px-6 pb-2">
          <ErrorBanner message={serverError} />
        </div>
      )}
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {createMutation.isPending ? "Creating..." : "Create product"}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Edit modal ----------

export function EditModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [form, setForm] = useState<ProductFormState>(formStateFromItem(item))
  const initial = useMemo(() => formStateFromItem(item), [item])

  const updateMutation = useUpdateCatalogItem()
  const deleteMutation = useDeleteCatalogItem()

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const canSave =
    form.name.trim().length > 0 &&
    form.sku.trim().length > 0 &&
    dirty &&
    !updateMutation.isPending

  const handleSave = () => {
    updateMutation.mutate(
      { id: item.id, input: formStateToInput(form) },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(item.id, { onSuccess: () => onClose() })
  }

  const serverError =
    updateMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : "Failed to save."
      : null

  return (
    <ModalShell title={`Edit: ${item.name}`} onClose={onClose}>
      <ProductForm form={form} onChange={setForm} existingItem={item} />
      {serverError && (
        <div className="px-6 pb-2">
          <ErrorBanner message={serverError} />
        </div>
      )}
      <ModalFooter>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-sm px-3 py-2 text-red-600 hover:text-red-800 disabled:opacity-50 mr-auto"
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

// ---------- Product form ----------

function ProductForm({
  form,
  onChange,
  existingItem,
  pendingImage = null,
  onPendingImageChange,
}: {
  form: ProductFormState
  onChange: (next: ProductFormState) => void
  /** Present in edit mode, undefined in create. Drives the image uploader:
   *  upload needs a saved item id, so create mode holds the file instead and
   *  the parent sends it as soon as the product has one. */
  existingItem?: CatalogItem
  pendingImage?: File | null
  onPendingImageChange?: (file: File | null) => void
}) {
  const { data: categoriesData } = useProductCatalogCategories({ active: true })
  const { data: taxClassesData } = useTaxClasses({ active: true, per_page: 100 })
  const { data: binsData } = useAllInventoryBins({})
  const { data: invSettings } = useInventorySettings()
  const showSnUi = !!invSettings?.inventory_show_sn_tracking

  const categories: ProductCatalogCategory[] = categoriesData?.data ?? []
  const taxClasses: TaxClass[] = taxClassesData?.data ?? []
  const bins = binsData?.data ?? []

  const set = <K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K]
  ) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="p-6 space-y-4">
      <Field label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Schlage Primus cylinder"
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide">
              SKU <span className="text-red-500 ml-1">*</span>
            </label>
            <button
              type="button"
              onClick={() => set("sku", generateSku(form.name, form.part_source || null))}
              disabled={!form.name.trim()}
              className="text-[11px] text-amber-700 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
              title="Auto-generate from name + part source. Format: 3 chars + A/O/X + 6 random digits."
            >
              Generate
            </button>
          </div>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => set("sku", e.target.value)}
            placeholder="Auto-generated on save if blank"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
        <Field label="Part source">
          <select
            value={form.part_source}
            onChange={(e) => set("part_source", e.target.value as PartSource | "")}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">— Unspecified —</option>
            <option value="aftermarket">Aftermarket (A)</option>
            <option value="oem">OEM (O)</option>
          </select>
        </Field>
        <CategoryFieldWithAdd
          value={form.product_category_id}
          onChange={(v) => set("product_category_id", v)}
          categories={categories}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Barcode">
          <input
            type="text"
            value={form.barcode}
            onChange={(e) => set("barcode", e.target.value)}
            placeholder="UPC/EAN, e.g. 0048256712345"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </Field>
        <Field label="QR code value">
          <input
            type="text"
            value={form.qr_code_value}
            onChange={(e) => set("qr_code_value", e.target.value)}
            placeholder="Custom QR token (optional)"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </Field>
      </div>

      <Field label="Customer description (long — optional, for product catalog detail pages)">
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Optional extended customer-facing detail. The Short description below covers most cases."
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <Field label="Short description (customer-facing — invoices, sticker, max 100 chars)">
        <input
          type="text"
          value={form.short_description}
          onChange={(e) => set("short_description", e.target.value)}
          maxLength={100}
          placeholder='e.g. "Schlage L9080 Mortise Lock"'
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
        />
      </Field>

      <Field label="Default bin (where this lives by default)">
        <select
          value={form.default_bin_id}
          onChange={(e) => set("default_bin_id", e.target.value)}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
        >
          <option value="">— None (set on receive) —</option>
          {bins.map((b) => (
            <option key={b.id} value={b.id}>
              {b.path_label || b.name || b.bin_code || b.id}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Long description (internal — searchable: vehicle fitment, FCC IDs, crossover part #s, alt names)">
        <textarea
          value={form.internal_description}
          onChange={(e) => set("internal_description", e.target.value)}
          placeholder='e.g. "2021 Ford F150 / FCC ID M3N-A2C31243800 / Schlage L9080 / L-9080 / 9080-PD"'
          rows={3}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <Field label="Manager notes (internal)">
        <textarea
          value={form.internal_notes}
          onChange={(e) => set("internal_notes", e.target.value)}
          placeholder="Anything you want to remember about this product"
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Unit of measure">
          <UnitOfMeasurePicker
            value={form.unit_label}
            onChange={(v) => set("unit_label", v)}
          />
        </Field>
        <Field label="Default quantity">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.default_quantity}
            onChange={(e) => set("default_quantity", e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
          />
        </Field>
        <Field label="Active">
          <div className="flex items-center h-[38px]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">
                {form.active ? "Active" : "Inactive"}
              </span>
            </label>
          </div>
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Pricing
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Customer price">
            <DollarInput
              value={form.customer_cost_dollars}
              onChange={(v) => set("customer_cost_dollars", v)}
            />
          </Field>
          <Field label="Owner cost (optional)">
            <DollarInput
              value={form.owner_cost_dollars}
              onChange={(v) => set("owner_cost_dollars", v)}
            />
          </Field>
          <Field label="Tax class">
            <select
              value={form.tax_class_id}
              onChange={(e) => set("tax_class_id", e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">- No tax -</option>
              {taxClasses.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name} ({Number(tc.rate_pct).toFixed(2)}%)
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Stock & Reordering
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Reorder threshold">
            <input
              type="number"
              min="0"
              step="1"
              value={form.reorder_threshold}
              onChange={(e) => set("reorder_threshold", e.target.value)}
              placeholder="Alert when on-hand drops below"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
          <Field label="Reorder quantity">
            <input
              type="number"
              min="0"
              step="1"
              value={form.reorder_quantity}
              onChange={(e) => set("reorder_quantity", e.target.value)}
              placeholder="Typical reorder amount"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Supplier
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier name">
            <input
              type="text"
              value={form.supplier_name}
              onChange={(e) => set("supplier_name", e.target.value)}
              placeholder="e.g. ABC Distributors"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <Field label="Supplier SKU">
            <input
              type="text"
              value={form.supplier_sku}
              onChange={(e) => set("supplier_sku", e.target.value)}
              placeholder="Vendor part number"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Warranty defaults (days)
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Days of coverage applied when this item is sold on an invoice. Blank = none.
          Labor override wins over the tenant labor rule.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Manufacturer">
            <input
              type="number"
              min="0"
              value={form.manufacturer_warranty_days}
              onChange={(e) => set("manufacturer_warranty_days", e.target.value)}
              placeholder="e.g. 365"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <Field label="Company">
            <input
              type="number"
              min="0"
              value={form.company_warranty_days}
              onChange={(e) => set("company_warranty_days", e.target.value)}
              placeholder="e.g. 90"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <Field label="Labor (override)">
            <input
              type="number"
              min="0"
              value={form.labor_warranty_days}
              onChange={(e) => set("labor_warranty_days", e.target.value)}
              placeholder="e.g. 180"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
        </div>

        {/* Sellable warranty-extension flag.
            When checked, this item doesn't get its OWN warranty when sold —
            instead it extends the warranties of OTHER items on the same
            invoice (filtered by kind). Use case: "1-year extended labor
            warranty — $99". */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_warranty_extension}
              onChange={(e) => set("is_warranty_extension", e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              This is a <strong>warranty extension</strong> (sold separately to extend other items&apos; coverage)
            </span>
          </label>
          {form.is_warranty_extension && (
            <div className="mt-3 grid grid-cols-2 gap-4 pl-6 border-l-2 border-amber-200">
              <Field label="Extends">
                <select
                  value={form.warranty_extension_kind}
                  onChange={(e) => set("warranty_extension_kind", e.target.value as '' | 'mfr' | 'co' | 'labor')}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
                >
                  <option value="">— Pick a kind —</option>
                  <option value="mfr">Manufacturer warranty</option>
                  <option value="co">Company warranty</option>
                  <option value="labor">Labor warranty</option>
                </select>
              </Field>
              <Field label="Extension days">
                <input
                  type="number"
                  min="1"
                  value={form.warranty_extension_days}
                  onChange={(e) => set("warranty_extension_days", e.target.value)}
                  placeholder="e.g. 365"
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                />
              </Field>
              <p className="col-span-2 text-xs text-slate-500">
                When sold on an invoice, every matching-kind warranty on that
                same invoice gets its expiry extended by this many days. If
                the line targets a specific asset, only warranties for that
                asset are extended.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Catalog Visibility
        </h3>
        <label className="inline-flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_stocked_item}
            onChange={(e) => set("is_stocked_item", e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-slate-700">
            Stocked item
            <span className="block text-xs text-slate-500 mt-0.5">
              On by default. Off for one-off / custom-order parts the
              shop catalogs but doesn't reorder. Off-items don't appear
              in the PO "+ Low stock" picker.
            </span>
          </span>
        </label>

      </div>

      {showSnUi && (
      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">
          Serial Number Tracking
        </h3>
        <div className="space-y-3">
          <label className={`inline-flex items-center gap-2 cursor-pointer ${!isCountableUnit(form.unit_label) ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              checked={form.sn_tracking_enabled && isCountableUnit(form.unit_label)}
              disabled={!isCountableUnit(form.unit_label)}
              onChange={(e) => set("sn_tracking_enabled", e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              Track each unit individually by serial number
              {!isCountableUnit(form.unit_label) && (
                <span className="block text-xs text-slate-500 mt-0.5">
                  Unavailable — measured units (e.g. {form.unit_label}) can't be serialized.
                </span>
              )}
            </span>
          </label>
          {form.sn_tracking_enabled && isCountableUnit(form.unit_label) && (
            <div className="pl-6">
              <Field label="SN format prefix">
                <input
                  type="text"
                  value={form.sn_format_prefix}
                  onChange={(e) => set("sn_format_prefix", e.target.value)}
                  placeholder='e.g. "AC" generates AC-000001, AC-000002, ...'
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
                />
              </Field>
              <p className="text-xs text-slate-500 mt-2">
                Each unit gets a unique SN at receive time.
                Cannot be disabled once units exist.
              </p>
            </div>
          )}
        </div>
      </div>
      )}
      {existingItem ? (
        <CatalogItemImageUploader item={existingItem} />
      ) : onPendingImageChange ? (
        <PendingImagePicker value={pendingImage} onChange={onPendingImageChange} />
      ) : null}
    </div>
  )
}

// ---------- Category field with inline create ----------

function CategoryFieldWithAdd({
  value,
  onChange,
  categories,
}: {
  value: string
  onChange: (id: string) => void
  categories: ProductCatalogCategory[]
}) {
  const [showInline, setShowInline] = useState(false)

  const handleCreated = (newCategory: ProductCatalogCategory) => {
    onChange(newCategory.id)
    setShowInline(false)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-slate-700 uppercase tracking-wide">
          Category
        </label>
        <button
          type="button"
          onClick={() => setShowInline(true)}
          className="text-xs text-amber-600 hover:underline font-medium"
        >
          + Add new
        </button>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
      >
        <option value="">- No category -</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {showInline && (
        <InlineCreateProductCategoryModal
          onCreated={handleCreated}
          onClose={() => setShowInline(false)}
        />
      )}
    </div>
  )
}

// ---------- Reusable bits ----------

function DollarInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v === '' || isNaN(Number(v))) return
          onChange(Number(v).toFixed(2))
        }}
        placeholder="0.00"
        className="w-full text-sm pl-7 pr-3 py-2 border border-slate-200 rounded font-mono focus:outline-none focus:border-amber-500"
      />
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            x
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
      {children}
    </div>
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 bg-red-50 border border-red-100 rounded">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}

// ---------- View modal (read-only) ----------

/**
 * Read-only catalog item details. Default overlay when any user clicks a row;
 * non-admin users can only see this and never reach the edit form. Admins see
 * an "Edit" button at the bottom that flips into the existing edit modal.
 */
function ProductViewModal({
  item,
  canEdit,
  onClose,
  onEdit,
}: {
  item: CatalogItem
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const partSourceLabel =
    item.part_source === 'aftermarket' ? 'Aftermarket'
      : item.part_source === 'oem' ? 'OEM'
        : null

  const previewUrl = item.images.medium_url ?? item.images.full_url ?? item.images.thumb_url

  const { data: invSettings } = useInventorySettings()
  const showSnUi = !!invSettings?.inventory_show_sn_tracking

  // Pull this item's stock placements so we can show on-hand here.
  const stockLevelsQuery = useStockLevels({ catalog_item_id: item.id, per_page: 100 })
  const placements = stockLevelsQuery.data?.data ?? []
  const totalOnHand = placements.reduce((sum, sl) => sum + sl.quantities.qty_on_hand, 0)
  const threshold = item.inventory.reorder_threshold
  const isLow = threshold != null && threshold > 0 && totalOnHand <= threshold
  // Inventory value at owner cost (what it cost the shop, not retail)
  const inventoryValueCents = totalOnHand * item.pricing.owner_cost_cents
  const inventoryValueFormatted = `$${(inventoryValueCents / 100).toFixed(2)}`
  const hasOwnerCost = item.pricing.owner_cost_cents > 0

  return (
    <ModalShell title={item.name} onClose={onClose}>
      <div className="px-6 py-5 space-y-5">
        <div className="flex gap-5">
          <div className="flex-shrink-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={item.name}
                className="w-48 h-48 rounded-lg object-cover border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="w-48 h-48 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 text-5xl">
                📷
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <div className="text-2xl font-semibold text-slate-900">{item.name}</div>
              {item.sku && (
                <div className="text-sm text-slate-500 font-mono mt-0.5">{item.sku}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!item.active && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                  Inactive
                </span>
              )}
              {partSourceLabel && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded">
                  {partSourceLabel}
                </span>
              )}
              {showSnUi && item.sn_tracking.enabled && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded font-mono">
                  SN-tracked
                </span>
              )}
              {item.product_category?.name && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded">
                  {item.product_category.name}
                </span>
              )}
            </div>
            <div className="text-2xl font-semibold text-amber-700 mt-2">
              {item.pricing.customer_cost_formatted}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-baseline justify-between">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              In stock
            </div>
            {threshold != null && threshold > 0 && (
              <div className="text-xs text-slate-500">
                Reorder at {threshold} {item.unit_label}
                {item.inventory.reorder_quantity != null && ` · order ${item.inventory.reorder_quantity}`}
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span
              className={`text-3xl font-semibold tabular-nums ${isLow ? 'text-red-700' : 'text-slate-900'}`}
              title={isLow ? `At or below reorder threshold (${threshold})` : undefined}
            >
              {stockLevelsQuery.isLoading ? '…' : formatQty(totalOnHand, undefined, { showUnit: false })}
            </span>
            <span className="text-sm text-slate-500">{item.unit_label} total</span>
            {isLow && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded font-medium">
                Low stock
              </span>
            )}
            {hasOwnerCost && totalOnHand > 0 && (
              <span
                className="ml-auto text-sm text-slate-700"
                title={`${totalOnHand} × ${(item.pricing.owner_cost_cents / 100).toFixed(2)} owner cost`}
              >
                Value: <span className="font-semibold text-slate-900 font-mono">{inventoryValueFormatted}</span>
              </span>
            )}
          </div>
          {placements.length > 0 && (
            <ul className="mt-2 text-sm text-slate-700 space-y-0.5">
              {placements.map((sl) => (
                <li key={sl.id} className="flex justify-between">
                  <span className="truncate">
                    📍 {sl.bin?.path_label ?? sl.location?.name ?? '—'}
                  </span>
                  <span className="tabular-nums font-medium">{formatQty(sl.quantities.qty_on_hand, item.unit_label)}</span>
                </li>
              ))}
            </ul>
          )}
          {!stockLevelsQuery.isLoading && placements.length === 0 && (
            <p className="text-sm text-slate-500 italic mt-1">
              No stock recorded anywhere yet.
            </p>
          )}
        </div>

        {item.short_description && (
          <ViewBlock label="Description">
            <p className="text-sm text-slate-700">{item.short_description}</p>
          </ViewBlock>
        )}

        {item.internal_description && (
          <ViewBlock label="Internal notes (vehicle fitment / FCC IDs / crossover part #s)">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.internal_description}</p>
          </ViewBlock>
        )}

        <div className="grid grid-cols-2 gap-4">
          {item.inventory.supplier_name && (
            <ViewKV label="Supplier" value={item.inventory.supplier_name} />
          )}
          {item.inventory.supplier_sku && (
            <ViewKV label="Supplier SKU" value={item.inventory.supplier_sku} mono />
          )}
          {item.default_bin && (
            <ViewKV label="Default bin" value={item.default_bin.name} />
          )}
        </div>
      </div>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Close
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
          >
            Edit
          </button>
        )}
      </ModalFooter>
    </ModalShell>
  )
}

function ViewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  )
}

function ViewKV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm text-slate-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}





