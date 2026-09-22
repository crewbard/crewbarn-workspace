import { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { isDeleteCancelled } from "@/lib/api"
import { QRCodeCanvas } from "qrcode.react"
import {
  useInventoryLocations,
  useCreateInventoryLocation,
  useUpdateInventoryLocation,
  useDeleteInventoryLocation,
} from "@/hooks/useInventoryLocations"
import { Link } from "react-router-dom"
import {
  useAllInventoryBins,
  useBinStockRollup,
  useBinContents,
  useCreateInventoryBin,
  useUpdateInventoryBin,
  useDeleteInventoryBin,
} from "@/hooks/useInventoryBins"
import {
  useStockLevels,
  useCreateStockLevel,
  useUpdateStockLevel,
  useDeleteStockLevel,
  useCleanupOrphanStockLevels,
} from "@/hooks/useInventoryStockLevels"
import { useAuth } from "@/hooks/useAuth"
import { useCatalogItems, useCatalogItem } from "@/hooks/useCatalogItems"
import { EditModal as ProductCatalogEditModal } from "@/pages/ProductCatalogPage"
import { InventoryUnitsPage } from "@/pages/InventoryUnitsPage"
import { InventoryMovementsPage } from "@/pages/InventoryMovementsPage"
import { InventoryReconciliationsPage } from "@/pages/InventoryReconciliationsPage"
import { InventorySettingsPanel } from "@/pages/SettingsInventoryPage"
import { TransferStockModal } from "@/components/TransferStockModal"
import { isCountableUnit, qtyStepFor, formatQty } from "@/lib/unitsOfMeasure"
import { useInventorySettings } from "@/hooks/useInventorySettings"
import { CatalogItemQuickCreate } from "@/components/CatalogItemQuickCreate"
import { BinTreePicker } from "@/components/BinTreePicker"
import { useHardwareScanner } from "@/hooks/useHardwareScanner"
import { QrScanButton } from "@/components/QrScanButton"
import { resolveScan } from "@/lib/scanResolve"
import { PERM, usePermissions } from "@/hooks/usePermissions"
import { StockWhereOverlay } from "@/components/catalog/StockWhereOverlay"
import { InventoryStructureBuilder } from "@/components/inventory/InventoryStructureBuilder"
import { ReceiveStockModal } from "@/components/inventory/ReceiveStockModal"
import { GlobalInventorySearch } from "@/components/inventory/GlobalInventorySearch"
import { useInventoryReconciliations } from "@/hooks/useInventoryReconciliations"
import { ReturnFormModal } from "@/components/ReturnFormModal"
import type { InventoryStockLevel } from "@/types/inventoryStockLevel"
import type { CatalogItem as CatalogItemFull } from "@/types/catalogItem"
import { ApiError } from "@/lib/api"
import type { BinStockRollup } from "@/lib/inventoryBins"
import type {
  InventoryLocation,
  InventoryLocationType,
} from "@/types/inventoryLocation"
import { INVENTORY_LOCATION_TYPES, INVENTORY_LOCATION_TYPE_LABELS } from "@/types/inventoryLocation"
import type { InventoryBin, InventoryBinInput } from "@/types/inventoryBin"
import { BIN_KIND_OPTIONS } from "@/types/inventoryBin"

// ---------- Tab definitions ----------

type TabKey = "locations" | "bins" | "stock" | "units" | "movements" | "reconciliation" | "settings"

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "locations", label: "Locations" },
  { key: "bins", label: "Bins" },
  { key: "stock", label: "Stock Levels" },
  { key: "units", label: "Units" },
  { key: "movements", label: "Movements" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "settings", label: "Settings" },
]

// ---------- Page ----------

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as TabKey | null
  const activeTab: TabKey = tabParam && TABS.some(t => t.key === tabParam) ? tabParam : "locations"

  const setActiveTab = (tab: TabKey) => {
    setSearchParams({ tab })
  }

  // Locations data drives the Locations tab AND the tab badge count
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locationCount = locationsData?.meta?.total ?? 0

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Header
        onOpenQueue={() => setActiveTab('reconciliation')}
        defaultLocationId={locationsData?.data?.[0]?.id}
      />
      <GlobalInventorySearch onGoToTab={setActiveTab} />
      <TabNav active={activeTab} onChange={setActiveTab} locationCount={locationCount} />
      <TabContent active={activeTab} />
    </div>
  )
}

// ---------- Header ----------

function Header({
  onOpenQueue,
  defaultLocationId,
}: {
  onOpenQueue: () => void
  defaultLocationId?: string
}) {
  const [receiving, setReceiving] = useState(false)
  // Badge the queue so it reads as work rather than a page. An empty queue is
  // the normal state, so the count only shows when there is something in it.
  const { data: queueData } = useInventoryReconciliations({ status: 'pending', per_page: 1 })
  const pendingCount = queueData?.meta?.total ?? 0

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-600 mt-1">
          Where stock lives, what's in stock, what's moved.
        </p>
      </div>
      <div className="flex gap-2 items-start flex-shrink-0">
        <button
          type="button"
          onClick={onOpenQueue}
          title="Stock events recorded as owed but not yet reconciled"
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Reconciliation queue
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-800">
              {pendingCount.toLocaleString('en-US')}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setReceiving(true)}
          className="mt-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          + Receive stock
        </button>
      </div>

      <ReceiveStockModal
        isOpen={receiving}
        onClose={() => setReceiving(false)}
        defaultLocationId={defaultLocationId}
      />
    </div>
  )
}


// ---------- Tab navigation ----------

function TabNav({
  active,
  onChange,
  locationCount,
}: {
  active: TabKey
  onChange: (tab: TabKey) => void
  locationCount: number
}) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const isActive = tab.key === active
          const count = tab.key === "locations" ? locationCount : null
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                isActive
                  ? "text-amber-600 border-amber-500"
                  : "text-slate-600 hover:text-amber-600 border-transparent"
              }`}
            >
              {tab.label}
              {count !== null && (
                <span className="ml-1 text-xs text-slate-400 font-mono">({count})</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Tab content router ----------

function TabContent({ active }: { active: TabKey }) {
  if (active === "locations") return <LocationsTab />
  if (active === "bins") return <BinsTab />
  if (active === "stock") return <StockLevelsTab />
  if (active === "units") return <InventoryUnitsPage />
  if (active === "movements") return <InventoryMovementsPage />
  if (active === "reconciliation") return <InventoryReconciliationsPage />
  if (active === "settings") return <InventorySettingsPanel />
  return null
}

// =================================================================
// LOCATIONS TAB
// =================================================================

function LocationsTab() {
  const { data, isLoading, isError, error } = useInventoryLocations({ per_page: 200 })
  const [editing, setEditing] = useState<InventoryLocation | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const locations = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Inventory locations</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Warehouses, trucks, and other stocking locations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
          >
            + New Location
          </button>
        </div>

        {isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load locations.{error instanceof Error ? ` ${error.message}` : ""}
          </div>
        )}

        {isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}

        {!isLoading && !isError && <LocationsTable locations={locations} onEdit={setEditing} />}
      </div>

      {showCreate && <CreateLocationModal onClose={() => setShowCreate(false)} />}
      {editing && <EditLocationModal location={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function LocationsTable({
  locations,
  onEdit,
}: {
  locations: InventoryLocation[]
  onEdit: (loc: InventoryLocation) => void
}) {
  if (locations.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-slate-600">
          No locations yet. Click "+ New Location" to add a warehouse, truck, or other stocking location.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm min-w-[720px]">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="text-left px-6 py-3 font-medium">Type</th>
          <th className="text-left px-6 py-3 font-medium">Name</th>
          <th className="text-left px-6 py-3 font-medium">Assigned Tech</th>
          <th className="text-left px-6 py-3 font-medium">Address</th>
          <th className="text-right px-6 py-3 font-medium">Bins</th>
          <th className="text-right px-6 py-3 font-medium" title="Quantity on hand x your cost, same as the valuation report">Stock value</th>
          <th className="text-center px-6 py-3 font-medium">Active</th>
          <th className="px-6 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {locations.map((loc) => (
          <tr key={loc.id} className="hover:bg-slate-50">
            <td className="px-6 py-4">
              <TypeBadge type={loc.type} />
            </td>
            <td className="px-6 py-4 font-medium text-slate-900">{loc.name}</td>
            <td className="px-6 py-4 text-slate-700">
              {loc.assigned_tech?.display_name ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-6 py-4 text-slate-700 text-xs">
              {formatAddress(loc) || <span className="text-slate-400">—</span>}
            </td>
            {/* Counted server-side over every bin at any depth, and stock value
                on the same definition the valuation report uses. Absent (rather
                than 0) means the endpoint didn't aggregate, which is worth
                showing differently from an empty location. */}
            <td className="px-6 py-4 text-right text-sm tabular-nums text-slate-700">
              {loc.bins_count === undefined
                ? <span className="text-slate-300 text-xs">—</span>
                : loc.bins_count.toLocaleString('en-US')}
            </td>
            <td className="px-6 py-4 text-right text-sm tabular-nums text-slate-700">
              {loc.stock_value_cents === undefined
                ? <span className="text-slate-300 text-xs">—</span>
                : (loc.stock_value_cents / 100).toLocaleString('en-US', {
                    style: 'currency', currency: 'USD',
                    minimumFractionDigits: 2, maximumFractionDigits: 2,
                  })}
            </td>
            <td className="px-6 py-4 text-center">
              {loc.active ? (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">Active</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">Inactive</span>
              )}
            </td>
            <td className="px-6 py-4 text-right">
              <button
                type="button"
                onClick={() => onEdit(loc)}
                className="text-sm text-slate-600 hover:text-amber-600"
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

function TypeBadge({ type }: { type: InventoryLocationType }) {
  const colors: Record<InventoryLocationType, string> = {
    warehouse: "bg-blue-50 text-blue-700",
    truck: "bg-amber-50 text-amber-700",
    other: "bg-slate-100 text-slate-700",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${colors[type]}`}>
      {INVENTORY_LOCATION_TYPE_LABELS[type]}
    </span>
  )
}

function formatAddress(loc: InventoryLocation): string {
  const parts = [loc.address.city, loc.address.region].filter(Boolean)
  return parts.join(", ")
}

// ---------- Form state ----------

type LocationFormState = {
  name: string
  type: InventoryLocationType
  street_address: string
  city: string
  region: string
  postal_code: string
  notes: string
  active: boolean
}

const emptyForm: LocationFormState = {
  name: "",
  type: "warehouse",
  street_address: "",
  city: "",
  region: "",
  postal_code: "",
  notes: "",
  active: true,
}

function formStateFromLocation(loc: InventoryLocation): LocationFormState {
  return {
    name: loc.name,
    type: loc.type,
    street_address: loc.address.street_address ?? "",
    city: loc.address.city ?? "",
    region: loc.address.region ?? "",
    postal_code: loc.address.postal_code ?? "",
    notes: loc.notes ?? "",
    active: loc.active,
  }
}

function formStateToInput(form: LocationFormState) {
  return {
    name: form.name.trim(),
    type: form.type,
    street_address: form.street_address.trim() || null,
    city: form.city.trim() || null,
    region: form.region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    notes: form.notes.trim() || null,
    active: form.active,
  }
}

// ---------- Create modal ----------

function CreateLocationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<LocationFormState>(emptyForm)
  const createMutation = useCreateInventoryLocation()

  const canSave = form.name.trim().length > 0 && !createMutation.isPending

  const handleSave = () => {
    createMutation.mutate(formStateToInput(form), { onSuccess: () => onClose() })
  }

  const errorMsg = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Failed to create location."
    : null

  return (
    <ModalShell title="New Location" onClose={onClose}>
      <LocationForm form={form} onChange={setForm} />
      {errorMsg && <div className="px-6 pb-2"><ErrorBanner message={errorMsg} /></div>}
      <Footer>
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
          {createMutation.isPending ? "Creating..." : "Create location"}
        </button>
      </Footer>
    </ModalShell>
  )
}

// ---------- Edit modal ----------

function EditLocationModal({
  location,
  onClose,
}: {
  location: InventoryLocation
  onClose: () => void
}) {
  const [form, setForm] = useState<LocationFormState>(formStateFromLocation(location))
  const initial = useMemo(() => formStateFromLocation(location), [location])

  const updateMutation = useUpdateInventoryLocation()
  const deleteMutation = useDeleteInventoryLocation()

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const canSave = form.name.trim().length > 0 && isDirty && !updateMutation.isPending

  const handleSave = () => {
    updateMutation.mutate(
      { id: location.id, input: formStateToInput(form) },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(location.id, { onSuccess: () => onClose() })
  }

  const errorMsg = updateMutation.isError
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Failed to save."
    : deleteMutation.isError
    ? deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : "Failed to delete."
    : null

  return (
    <ModalShell title={`Edit: ${location.name}`} onClose={onClose}>
      <LocationForm form={form} onChange={setForm} />
      {errorMsg && <div className="px-6 pb-2"><ErrorBanner message={errorMsg} /></div>}
      <Footer>
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
      </Footer>
    </ModalShell>
  )
}

// ---------- Form fields ----------

function LocationForm({
  form,
  onChange,
}: {
  form: LocationFormState
  onChange: (form: LocationFormState) => void
}) {
  const set = (key: keyof LocationFormState, value: unknown) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Main Warehouse, Truck 1"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            autoFocus
          />
        </Field>
        <Field label="Type" required>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as InventoryLocationType)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            {INVENTORY_LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {INVENTORY_LOCATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">Address (optional)</h3>
        <div className="space-y-3">
          <Field label="Street address">
            <input
              type="text"
              value={form.street_address}
              onChange={(e) => set("street_address", e.target.value)}
              placeholder="e.g. 123 Industrial Way"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              />
            </Field>
            <Field label="State / Region">
              <input
                type="text"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="FL"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              />
            </Field>
            <Field label="Postal code">
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
              />
            </Field>
          </div>
        </div>
      </div>

      <Field label="Notes (internal)">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any details about this location"
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <div className="flex items-center">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-slate-700">{form.active ? "Active" : "Inactive"}</span>
        </label>
      </div>

      <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
        Stock value is quantity on hand times your cost, matching the inventory valuation report.
      </p>
    </div>
  )
}

// ---------- Modal infrastructure ----------

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 26, 46, 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

/**
 * "Return / RMA" trigger inside the Edit Stock modal. Opens the
 * ReturnFormModal stacked on top, which writes the return record + a
 * TYPE_WRITE_OFF movement and redirects to the 4×6 supplier-label print
 * page on success.
 */
function ReturnSection({
  stockLevel,
  onClose,
}: {
  stockLevel: InventoryStockLevel
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  if (!stockLevel.catalog_item_id) return null

  return (
    <>
      <div className="border-t border-slate-100 pt-4 mt-2">
        <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
          Return to vendor
        </div>
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-600">
            Damage, defective, recall, or RMA? Create a return — stock decrements and the supplier label is printable at 4×6.
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium whitespace-nowrap"
          >
            Return
          </button>
        </div>
      </div>
      {open && (
        <ReturnFormModal
          stockLevel={stockLevel}
          onClose={() => setOpen(false)}
          onSavedRedirectTo={(returnId) => {
            setOpen(false)
            onClose()
            window.open(`/inventory-returns/${returnId}/labels`, '_blank')
          }}
        />
      )}
    </>
  )
}

/**
 * QR-code preview + Print button shown inside the Edit Stock modal.
 * The QR encodes the deep-link to the catalog item; clicking Print opens
 * the configurable label page in a new tab pre-populated with the bin
 * label + on-hand qty (long-form layout).
 */
function PrintQrSection({ stockLevel }: { stockLevel: InventoryStockLevel }) {
  const itemId = stockLevel.catalog_item_id
  if (!itemId) return null

  const qrUrl = `${window.location.origin}/catalog/products/${itemId}`
  const binLabel = stockLevel.bin?.path_label || stockLevel.bin?.name || ''
  const qty = stockLevel.quantities.qty_on_hand ?? ''
  // One label per physical unit, not N copies of one code. Four on hand is
  // four items, each carrying its own fingerprint — identical labels would
  // give a tech no way to scan the one in their hand.
  const printHref =
    `/catalog-items/${itemId}/labels` +
    `?detail=long` +
    `&per_unit=1` +
    `&location_id=${stockLevel.location_id ?? ''}` +
    `&bin_id=${stockLevel.bin_id ?? ''}` +
    `&bin_label=${encodeURIComponent(binLabel)}` +
    `&qty=${qty}`

  return (
    <div className="border-t border-slate-100 pt-4 mt-2">
      <div className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
        Print QR code
      </div>
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded p-3">
        <div className="flex-shrink-0 bg-white p-2 rounded border border-slate-200">
          <QRCodeCanvas value={qrUrl} size={96} level="H" includeMargin />
        </div>
        <div className="flex-1 min-w-0 text-xs text-slate-600 space-y-0.5">
          <div>One QR per unit on hand — each scans as that exact item.</div>
          {binLabel && <div>📍 {binLabel}</div>}
          {qty != null && <div>On hand: {String(qty)}</div>}
        </div>
        <a
          href={printHref}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium whitespace-nowrap"
        >
          Print QR
        </a>
      </div>
    </div>
  )
}

// =================================================================
// BINS TAB
// =================================================================

function BinsTab() {
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const [filterLocationId, setFilterLocationId] = useState<string>("")
  const [filterKind, setFilterKind] = useState<string>("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // ALL pages, not the first. The tree draws every branch, so a single page
  // silently hid entire locations: with 754 bins the first 200 were all one
  // location and the other three rendered empty, which read as bins vanishing.
  const { data, isLoading, isError, error } = useAllInventoryBins({
    location_id: filterLocationId || undefined,
    kind: filterKind || undefined,
    q: debouncedSearch || undefined,
  })
  const bins = data?.data ?? []
  const binsTruncated = data?.truncated ?? false

  const [editing, setEditing] = useState<InventoryBin | null>(null)
  const [viewing, setViewing] = useState<InventoryBin | null>(null)
  /**
   * "+ Add stock" target. Setting up a shop for the first time means walking
   * the rack putting items into bins, and doing that from the Stock Levels tab
   * means picking the location and the bin by hand for every single row — the
   * tree already knows both.
   */
  const [addStockBin, setAddStockBin] = useState<InventoryBin | null>(null)
  // Server refuses manual stock adds when this is on, so the action is hidden
  // rather than offered and then rejected.
  // What is actually in each bin, so every level of the tree can say how much
  // it holds. Direct counts; the subtree total is summed as the tree renders.
  const { data: stockRollup } = useBinStockRollup(filterLocationId || undefined)
  const { data: binTabInvSettings } = useInventorySettings()
  const requirePoForStock = !!binTabInvSettings?.inventory_require_po_for_stock_add
  /**
   * "Create new bin" intent. null = closed. When non-null, holds the
   * default location id to land in. Empty string = falls back to current
   * filter or first location. Decoupled from filterLocationId so that
   * '+ Add root bin' on a location row doesn't trip the filter and
   * collapse the tree into flat mode.
   */
  const [createInLocationId, setCreateInLocationId] = useState<string | null>(null)
  /**
   * When non-null, opens BinFormModal pre-loaded as a child of this bin
   * (clicked the "+ Add child" inline button on a tree node).
   */
  const [addingChildOf, setAddingChildOf] = useState<InventoryBin | null>(null)
  /** Set of bin/location ids that are expanded in the tree view. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function expandAll() {
    setExpanded(new Set([...locations.map((l) => l.id), ...bins.map((b) => b.id)]))
  }
  function collapseAll() {
    setExpanded(new Set())
  }

  // Tree mode applies when no filter is active. Otherwise show a flat list
  // of matches (the search/filter result is intrinsically scoped, the tree
  // would just hide rows the user is hunting for).
  const filtersActive = !!(debouncedSearch || filterLocationId || filterKind)

  const noLocations = !locationsData || locations.length === 0

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Bins</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Containers within locations. Stock and SN units live in bins.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSetupWizard(true)}
              disabled={noLocations}
              title={noLocations ? "Create a location first" : "Describe your storage shape and create it"}
              className="text-sm px-4 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-amber-800 rounded-md font-medium transition-colors"
            >
              Build structure
            </button>
            <button
              type="button"
              onClick={() => setCreateInLocationId(filterLocationId || "")}
              disabled={noLocations}
              title={noLocations ? "Create a location first" : undefined}
              className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
            >
              + New Bin
            </button>
          </div>
        </div>

        {noLocations && (
          <div className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
            Create a location first — bins live inside locations.
          </div>
        )}

        <div className="px-6 py-3 border-b border-slate-100 flex gap-3 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, code, barcode..."
            className="flex-1 max-w-sm text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          <select
            value={filterLocationId}
            onChange={(e) => setFilterLocationId(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">All kinds</option>
            {BIN_KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load bins.{error instanceof Error ? ` ${error.message}` : ""}
          </div>
        )}

        {isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}

        {!isLoading && !isError && bins.length === 0 && !filtersActive && locations.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-600">
              No bins yet. Click "+ New Bin" to create one.
            </p>
          </div>
        )}
        {!isLoading && !isError && bins.length === 0 && filtersActive && (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-600">No bins match those filters.</p>
          </div>
        )}

        {/* Expand-all / collapse-all toolbar — tree mode only */}
        {!isLoading && !isError && !filtersActive && locations.length > 0 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={expandAll}
              className="text-slate-600 hover:text-amber-700"
            >
              Expand all
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-slate-600 hover:text-amber-700"
            >
              Collapse all
            </button>
          </div>
        )}

        {/* A tree that silently stops short is indistinguishable from missing
            data — which is exactly how the page-limit bug presented. If we ever
            hit the ceiling again, say so instead of drawing a short tree. */}
        {binsTruncated && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-900">
            Showing the first 5,000 bins — this location has more. Filter by location or
            search to narrow it down.
          </div>
        )}

        {/* Tree view — when no filters are active */}
        {!isLoading && !isError && !filtersActive && locations.length > 0 && (
          <div className="divide-y divide-slate-100">
            {locations.map((loc) => (
              <LocationTreeNode
                key={loc.id}
                location={loc}
                allBins={bins}
                expanded={expanded}
                onToggle={toggleExpanded}
                onEdit={setEditing}
                onView={setViewing}
                onAddChild={setAddingChildOf}
                onAddStock={requirePoForStock ? undefined : setAddStockBin}
                rollup={stockRollup ?? {}}
                onAddRoot={() => setCreateInLocationId(loc.id)}
              />
            ))}
          </div>
        )}

        {/* Flat list — when search/filter is active */}
        {!isLoading && !isError && filtersActive && bins.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Path</th>
                <th className="text-left px-6 py-3 font-medium">Kind</th>
                <th className="text-left px-6 py-3 font-medium">Code</th>
                <th className="text-left px-6 py-3 font-medium">Barcode</th>
                <th className="text-center px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bins.map((b) => {
                const loc = locations.find((l) => l.id === b.location_id)
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">
                        {b.path_label || b.name || b.bin_code || b.id}
                      </div>
                      {loc && (
                        <div className="text-xs text-slate-500">📍 {loc.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {b.kind ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded font-medium">
                          {b.kind}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-600">
                      {b.bin_code || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-600">
                      {b.barcode || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {b.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setViewing(b)}
                        className="text-sm text-slate-600 hover:text-amber-600 mr-3"
                        title="View everything stored in this bin and its descendants"
                      >
                        Contents
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        className="text-sm text-slate-600 hover:text-amber-600"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {createInLocationId !== null && (
        <BinFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={createInLocationId || filterLocationId || ""}
          onClose={() => setCreateInLocationId(null)}
        />
      )}
      {editing && (
        <BinFormModal
          bin={editing}
          locations={locations}
          allBins={bins}
          onClose={() => setEditing(null)}
        />
      )}
      {addingChildOf && (
        <BinFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={addingChildOf.location_id}
          defaultParentBinId={addingChildOf.id}
          onClose={() => setAddingChildOf(null)}
        />
      )}
      {viewing && (
        <BinContentsModal bin={viewing} onClose={() => setViewing(null)} />
      )}
      {addStockBin && (
        <StockLevelFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={addStockBin.location_id}
          defaultBinId={addStockBin.id}
          onClose={() => setAddStockBin(null)}
        />
      )}
      {/* Structure builder — describe the storage shape in the shop's own words,
          any depth, and read the codes before committing. Replaces the fixed
          rack/shelf/bin/section wizard; the old endpoints still exist. */}
      {showSetupWizard && (
        <div
          className="fixed inset-0 z-[120] flex justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Build a storage structure"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSetupWizard(false) }}
        >
          <div className="h-fit w-full max-w-[1400px] rounded-2xl bg-[#F4F6FA] p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-[#0A1220]">Build a storage structure</h2>
                <p className="mt-0.5 text-[13px] text-slate-600">
                  Pick a place, describe its shape, and see every code before you create it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupWizard(false)}
                aria-label="Close"
                className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-50"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <InventoryStructureBuilder
              locations={locations}
              initialLocationId={filterLocationId || ""}
              onClose={() => setShowSetupWizard(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Location + bin tree nodes ----------

/**
 * Everything held by this bin AND every bin beneath it.
 *
 * The rollup endpoint returns DIRECT contents per bin, because a recursive
 * total per node would be one query per bin. Stock sits in the leaves, so
 * without summing the subtree a rack always reads as empty — the count is only
 * useful if "what is on this rack" answers with the rack's whole contents.
 */
function subtreeStock(
  binId: string,
  allBins: InventoryBin[],
  rollup: BinStockRollup,
): { items: number; qty: number; units: number } {
  const own = rollup[binId] ?? { items: 0, qty: 0, units: 0 }
  let items = own.items
  let qty = own.qty
  let units = own.units
  for (const child of allBins) {
    if (child.parent_bin_id !== binId) continue
    const sub = subtreeStock(child.id, allBins, rollup)
    items += sub.items
    qty += sub.qty
    units += sub.units
  }
  return { items, qty, units }
}

/** Compact "12 items · 48" badge, or null when the bin is empty. */
function StockCount({ total }: { total: { items: number; qty: number; units: number } }) {
  if (total.items === 0 && total.units === 0) return null
  return (
    <span
      className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800"
      title={`${total.items} distinct item(s), ${total.qty} on hand${total.units ? `, ${total.units} tracked unit(s)` : ''}`}
    >
      {total.items > 0 && `${total.items} item${total.items === 1 ? '' : 's'}`}
      {total.items > 0 && total.qty > 0 && ` · ${total.qty}`}
      {total.items === 0 && total.units > 0 && `${total.units} unit${total.units === 1 ? '' : 's'}`}
    </span>
  )
}

function LocationTreeNode({
  location,
  allBins,
  expanded,
  onToggle,
  onEdit,
  onView,
  onAddChild,
  onAddStock,
  onAddRoot,
  rollup,
}: {
  location: InventoryLocation
  allBins: InventoryBin[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (b: InventoryBin) => void
  onView: (b: InventoryBin) => void
  onAddChild: (b: InventoryBin) => void
  /** Undefined hides the action — set only when manual stock adds are allowed. */
  onAddStock?: (b: InventoryBin) => void
  onAddRoot: () => void
  rollup: BinStockRollup
}) {
  const isOpen = expanded.has(location.id)
  const binsHere = allBins.filter((b) => b.location_id === location.id)
  const rootBins = binsHere.filter((b) => !b.parent_bin_id)
  const totalCount = binsHere.length

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(location.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(location.id)
          }
        }}
        className="px-6 py-3 flex items-center gap-2 hover:bg-slate-50 cursor-pointer select-none"
      >
        <span className="text-slate-400 text-sm w-4 text-center">
          {isOpen ? '▾' : '▸'}
        </span>
        <span className="text-base">📍</span>
        <span className="font-semibold text-slate-900">{location.name}</span>
        <span className="text-xs text-slate-500 font-mono">({totalCount})</span>
        <StockCount
          total={allBins
            .filter((b) => b.location_id === location.id && !b.parent_bin_id)
            .reduce(
              (acc, root) => {
                const sub = subtreeStock(root.id, allBins, rollup)
                return {
                  items: acc.items + sub.items,
                  qty: acc.qty + sub.qty,
                  units: acc.units + sub.units,
                }
              },
              { items: 0, qty: 0, units: 0 },
            )}
        />
        <span className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAddRoot()
            }}
            className="text-xs text-amber-700 hover:underline font-medium"
          >
            + Add root bin
          </button>
        </span>
      </div>
      {isOpen && rootBins.length === 0 && (
        <div className="px-12 pb-3 text-xs text-slate-500 italic">
          No bins in this location yet.
        </div>
      )}
      {isOpen &&
        rootBins.map((b) => (
          <BinTreeNode
            key={b.id}
            bin={b}
            allBins={binsHere}
            depth={1}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onView={onView}
            onAddChild={onAddChild}
            onAddStock={onAddStock}
            rollup={rollup}
          />
        ))}
    </div>
  )
}

function BinTreeNode({
  bin,
  allBins,
  depth,
  expanded,
  onToggle,
  onEdit,
  onView,
  onAddChild,
  onAddStock,
  rollup,
}: {
  bin: InventoryBin
  allBins: InventoryBin[]
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (b: InventoryBin) => void
  onView: (b: InventoryBin) => void
  onAddChild: (b: InventoryBin) => void
  /** Undefined hides the action — set only when manual stock adds are allowed. */
  onAddStock?: (b: InventoryBin) => void
  rollup: BinStockRollup
}) {
  const children = allBins.filter((b) => b.parent_bin_id === bin.id)
  const hasChildren = children.length > 0
  const isOpen = expanded.has(bin.id)
  const indentPx = 24 + depth * 24

  return (
    <div>
      <div
        className="py-2 flex items-center gap-2 hover:bg-slate-50 group"
        style={{ paddingLeft: indentPx, paddingRight: 24 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(bin.id)}
            className="text-slate-400 hover:text-slate-700 text-sm w-4 text-center"
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="font-medium text-slate-800 truncate">
          {bin.name || bin.bin_code || bin.id}
        </span>
        {bin.kind && (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wide">
            {bin.kind}
          </span>
        )}
        {bin.bin_code && bin.name && (
          <span className="font-mono text-xs text-slate-400">{bin.bin_code}</span>
        )}
        {hasChildren && (
          <span className="text-xs text-slate-400">
            ({children.length} child{children.length === 1 ? '' : 'ren'})
          </span>
        )}
        <StockCount total={subtreeStock(bin.id, allBins, rollup)} />
        {!bin.active && (
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
            Inactive
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onAddChild(bin)}
            className="text-xs text-amber-700 hover:underline font-medium"
            title="Add a child container under this one"
          >
            + Add child
          </button>
          {/* Only where stock can physically sit, and only while the shop
              allows manual adds — with "require purchase orders" on, the server
              refuses this and the button would exist purely to produce a 422.
              This is the first-setup path: walk the rack, put items in bins. */}
          {onAddStock && (bin.holds_stock ?? !hasChildren) && (
            <button
              type="button"
              onClick={() => onAddStock(bin)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800"
              title="Put a catalog item in this bin"
            >
              + Add stock
            </button>
          )}
          {/* ONE link. There used to be three (Print / + items / All), each
              pre-setting a different combination on the labels page — which has
              those same choices as toggles in its own toolbar. Three links into
              one screen read as three different reports, and "+ items" was
              taken to mean "add items" rather than "print item labels". */}
          <Link
            to={`/inventory-bins/${bin.id}/labels`}
            target="_blank"
            className="text-xs text-slate-600 hover:text-amber-700"
            title="Print QR stickers — this bin, its contents, or everything under it"
          >
            🏷 Labels
          </Link>
          <button
            type="button"
            onClick={() => onView(bin)}
            className="text-xs text-slate-600 hover:text-amber-700"
            title="View what's stored in this bin and below"
          >
            Contents
          </button>
          <button
            type="button"
            onClick={() => onEdit(bin)}
            className="text-xs text-slate-600 hover:text-amber-700"
          >
            Edit
          </button>
        </span>
      </div>
      {isOpen &&
        children.map((c) => (
          <BinTreeNode
            key={c.id}
            bin={c}
            allBins={allBins}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onView={onView}
            onAddChild={onAddChild}
            onAddStock={onAddStock}
            rollup={rollup}
          />
        ))}
    </div>
  )
}

// ---------- Bin contents modal ----------

function BinContentsModal({
  bin,
  onClose,
}: {
  bin: InventoryBin
  onClose: () => void
}) {
  const { data, isLoading, isError, error } = useBinContents(bin.id)
  const subBins = (data?.bins ?? []).filter((b) => b.id !== bin.id)
  const units = data?.units ?? []
  const stockLevels = data?.stock_levels ?? []

  // Group units + stock by catalog item for a cleaner read
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        catalogId: string
        name: string
        sku: string | null
        unitCount: number
        stockQty: number
        unitsByBin: Map<string, number>
      }
    >()
    for (const u of units) {
      const id = u.catalog_item_id
      const name = u.catalog_item?.name ?? '—'
      const sku = u.catalog_item?.sku ?? null
      if (!map.has(id)) {
        map.set(id, { catalogId: id, name, sku, unitCount: 0, stockQty: 0, unitsByBin: new Map() })
      }
      const row = map.get(id)!
      row.unitCount += 1
      const binPath = u.bin?.path_label ?? '(no bin)'
      row.unitsByBin.set(binPath, (row.unitsByBin.get(binPath) ?? 0) + 1)
    }
    for (const s of stockLevels) {
      const id = s.catalog_item_id
      const name = s.catalog_item?.name ?? '—'
      const sku = s.catalog_item?.sku ?? null
      if (!map.has(id)) {
        map.set(id, { catalogId: id, name, sku, unitCount: 0, stockQty: 0, unitsByBin: new Map() })
      }
      const row = map.get(id)!
      row.stockQty += Number(s.quantities?.qty_on_hand) || 0
      // Non-SN stock has a bin too. Only tracked units were recording one, so
      // "Where" was blank for ordinary stock — the common case. The number in
      // brackets is "how many are here", which is the unit count for tracked
      // items and the quantity for everything else.
      const stockBin = s.bin?.path_label ?? '(no bin)'
      const stockQty = Number(s.quantities?.qty_on_hand) || 0
      if (stockQty > 0) {
        row.unitsByBin.set(stockBin, (row.unitsByBin.get(stockBin) ?? 0) + stockQty)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [units, stockLevels])

  return (
    <ModalShell title={`Contents — ${bin.path_label || bin.name || bin.bin_code}`} onClose={onClose}>
      <div className="p-6 space-y-5">
        {isLoading && (
          <div className="text-sm text-slate-500 py-8 text-center">Loading bin contents…</div>
        )}
        {isError && (
          <ErrorBanner
            message={`Failed to load contents.${error instanceof Error ? ` ${error.message}` : ''}`}
          />
        )}

        {!isLoading && !isError && (
          <>
            {/* Sub-bins */}
            {subBins.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">
                  Sub-bins ({subBins.length})
                </h3>
                <div className="border border-slate-200 rounded overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Path</th>
                        <th className="text-left px-4 py-2 font-medium">Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subBins.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-800">
                            {b.path_label || b.name || b.bin_code}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-slate-500">
                            {b.bin_code || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Items */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Items in this {subBins.length > 0 ? 'subtree' : 'bin'} ({grouped.length})
                </h3>
                <div className="text-xs text-slate-500">
                  {units.length} SN unit{units.length === 1 ? '' : 's'} ·{' '}
                  {stockLevels.length} stock row{stockLevels.length === 1 ? '' : 's'}
                </div>
              </div>
              {grouped.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center border border-slate-200 rounded">
                  Nothing stored here yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Item</th>
                        <th className="text-right px-4 py-2 font-medium">SN units</th>
                        <th className="text-right px-4 py-2 font-medium">Stock qty</th>
                        <th className="text-left px-4 py-2 font-medium">Where</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grouped.map((row) => (
                        <tr key={row.catalogId} className="hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-slate-800">{row.name}</div>
                            {row.sku && (
                              <div className="font-mono text-xs text-slate-400">{row.sku}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {row.unitCount > 0 ? row.unitCount : '—'}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {row.stockQty > 0 ? row.stockQty : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-600">
                            {Array.from(row.unitsByBin.entries())
                              .map(([path, n]) => `${path} (${n})`)
                              .join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <Footer>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Close
        </button>
      </Footer>
    </ModalShell>
  )
}

// ---------- Bin form modal (create + edit) ----------

function blankBinInput(locationId: string): InventoryBinInput {
  return {
    location_id: locationId,
    parent_bin_id: null,
    bin_code: null,
    name: null,
    kind: null,
    barcode: null,
    qr_code_value: null,
    notes: null,
    sort_order: 0,
    active: true,
  }
}

function inputFromBin(b: InventoryBin): InventoryBinInput {
  return {
    location_id: b.location_id,
    parent_bin_id: b.parent_bin_id,
    bin_code: b.bin_code,
    name: b.name,
    kind: b.kind,
    barcode: b.barcode,
    qr_code_value: b.qr_code_value,
    notes: b.notes,
    sort_order: b.sort_order,
    active: b.active,
  }
}

function BinFormModal({
  bin,
  locations,
  allBins,
  defaultLocationId,
  defaultParentBinId,
  onClose,
}: {
  bin?: InventoryBin
  locations: InventoryLocation[]
  allBins: InventoryBin[]
  defaultLocationId?: string
  /** When opening from a tree node's "+ Add child" button, pre-set the parent. */
  defaultParentBinId?: string
  onClose: () => void
}) {
  const isEdit = !!bin
  const [form, setForm] = useState<InventoryBinInput>(() => {
    if (bin) return inputFromBin(bin)
    const blank = blankBinInput(defaultLocationId ?? "")
    if (defaultParentBinId) {
      blank.parent_bin_id = defaultParentBinId
      const parent = allBins.find((b) => b.id === defaultParentBinId)
      // Auto-suggest kind based on the parent's kind (same logic as pickParent below).
      const parentKind = (parent?.kind ?? "").toLowerCase()
      if (parentKind === "shelf" || parentKind === "rack" || parentKind === "cabinet") {
        blank.kind = "Bin"
      } else if (parentKind === "bin" || parentKind === "drawer") {
        blank.kind = "Section"
        // For sections specifically, inherit parent's name so siblings
        // (DCJ1-A, DCJ1-B, ...) share the family identifier; user just
        // types the bin_code suffix. Doesn't apply for shelves/bins
        // where each one has its own distinct name.
        blank.name = parent?.name || parent?.bin_code || null
      }
    }
    return blank
  })
  const [error, setError] = useState<string | null>(null)
  /**
   * When the user clicks "Save & add child", we save the current bin
   * and stash it here so the parent dropdown shows it as a labeled
   * option even before the bins-list refetch completes.
   */
  const [lastSavedBin, setLastSavedBin] = useState<InventoryBin | null>(null)
  const [showInlineLocation, setShowInlineLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const [newLocationType, setNewLocationType] = useState<InventoryLocationType>("warehouse")
  const [newLocationError, setNewLocationError] = useState<string | null>(null)
  const createMutation = useCreateInventoryBin()
  const updateMutation = useUpdateInventoryBin()
  const deleteMutation = useDeleteInventoryBin()
  const createLocation = useCreateInventoryLocation()

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const canSave =
    !isPending &&
    !!form.location_id &&
    ((form.name ?? "").trim().length > 0 || (form.bin_code ?? "").trim().length > 0)

  function set<K extends keyof InventoryBinInput>(key: K, value: InventoryBinInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Parent bin choices: same location, and not the current bin
  // (backend also enforces tree-cycle prevention). Includes the
  // last-saved bin so it appears with its full label even before
  // the list query refetches.
  const parentBinChoices = (() => {
    const list = [...allBins]
    if (lastSavedBin && !list.some((b) => b.id === lastSavedBin.id)) {
      list.push(lastSavedBin)
    }
    return list.filter(
      (b) => b.location_id === form.location_id && (!bin || b.id !== bin.id)
    )
  })()

  // Suggest a kind based on the chosen parent's kind. Only fires when the
  // user hasn't already explicitly picked a kind (or when on a fresh form).
  const userTouchedKind = (form.kind ?? "").length > 0
  function pickParent(newParentId: string | null) {
    set("parent_bin_id", newParentId)
    if (userTouchedKind) return
    if (!newParentId) {
      set("kind", "Shelf")
      return
    }
    const parent = allBins.find((b) => b.id === newParentId)
    const parentKind = (parent?.kind ?? "").toLowerCase()
    if (parentKind === "shelf" || parentKind === "rack" || parentKind === "cabinet") {
      set("kind", "Bin")
    } else if (parentKind === "bin" || parentKind === "drawer") {
      set("kind", "Section")
    }
  }

  async function handleSave() {
    setError(null)
    try {
      if (isEdit && bin) {
        await updateMutation.mutateAsync({ id: bin.id, input: form })
      } else {
        await createMutation.mutateAsync(form)
      }
      onClose()
    } catch (err) {
      setError(extractError(err))
    }
  }

  /**
   * Save the current bin, then keep the modal open with a fresh child
   * of the just-saved bin pre-selected as parent. Lets the user build
   * a deep tree (Rack → Shelf → Bin → Section) without closing/reopening
   * the modal.
   */
  async function handleSaveAndAddChild() {
    setError(null)
    if (isEdit) return
    try {
      const created = await createMutation.mutateAsync(form)
      setLastSavedBin(created)
      // Reset form to add a child of what we just saved.
      const parentKind = (created.kind ?? "").toLowerCase()
      const childIsSection = parentKind === "bin" || parentKind === "drawer"
      const childKind =
        parentKind === "shelf" || parentKind === "rack" || parentKind === "cabinet"
          ? "Bin"
          : childIsSection
            ? "Section"
            : ""
      setForm({
        location_id: created.location_id,
        parent_bin_id: created.id,
        bin_code: null,
        // Sections inherit the parent's name (DCJ1-A, DCJ1-B, ...).
        // Bins/Shelves don't — they have distinct names.
        name: childIsSection ? (created.name || created.bin_code || null) : null,
        kind: childKind || null,
        barcode: null,
        qr_code_value: null,
        notes: null,
        sort_order: 0,
        active: true,
      })
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleDelete() {
    if (!bin) return
    // Confirmation handled by the global delete modal (password + reason).
    setError(null)
    try {
      await deleteMutation.mutateAsync({ id: bin.id })
      onClose()
      return
    } catch (err) {
      if (isDeleteCancelled(err)) return

      // The server refuses a parent by default. Rather than making someone
      // delete several hundred bins from the leaves up — which is what tearing
      // down a structure-builder rack used to mean — offer the whole subtree in
      // one go. It still refuses if anything inside holds stock.
      if (err instanceof ApiError && err.code === 'has_children') {
        // Counted from the tree already loaded on this page rather than from
        // the error body — apiRequest only forwards `details`/`errors`, and
        // the page holds every bin anyway.
        let n = 0
        const stack = [bin.id]
        while (stack.length) {
          const id = stack.pop()!
          for (const b of allBins) {
            if (b.parent_bin_id === id) { n++; stack.push(b.id) }
          }
        }
        const ok = window.confirm(
          `"${bin.name || bin.bin_code || 'This bin'}" has ${n} bin${n === 1 ? '' : 's'} inside it.\n\n` +
          `Delete it and all ${n} of them? This cannot be undone.\n\n` +
          `Anything still holding stock will stop the delete.`,
        )
        if (!ok) return
        try {
          await deleteMutation.mutateAsync({ id: bin.id, cascade: true })
          onClose()
          return
        } catch (cascadeErr) {
          if (!isDeleteCancelled(cascadeErr)) setError(extractError(cascadeErr))
          return
        }
      }

      setError(extractError(err))
    }
  }

  async function handleCreateInlineLocation() {
    setNewLocationError(null)
    if (!newLocationName.trim()) {
      setNewLocationError("Location name required.")
      return
    }
    try {
      const created = await createLocation.mutateAsync({
        name: newLocationName.trim(),
        type: newLocationType,
        active: true,
      })
      // Auto-select the freshly-created location for this bin.
      set("location_id", created.id)
      // Reset/close the inline form.
      setShowInlineLocation(false)
      setNewLocationName("")
      setNewLocationType("warehouse")
    } catch (err) {
      setNewLocationError(extractError(err))
    }
  }

  // Breadcrumb of where the new bin will land. Shows the location +
  // any parent bin path. Drives the "Adding under: …" banner and gives
  // users a clear sense of depth as they chain Save & add child.
  const currentLocation = locations.find((l) => l.id === form.location_id)
  const currentParent = parentBinChoices.find((b) => b.id === form.parent_bin_id)
  const breadcrumbText = (() => {
    if (!currentLocation) return null
    if (currentParent) {
      return `${currentLocation.name} → ${currentParent.path_label || currentParent.name || currentParent.bin_code}`
    }
    return `Top of ${currentLocation.name}`
  })()

  return (
    <ModalShell title={isEdit ? `Edit: ${bin?.path_label ?? "Bin"}` : "New Bin"} onClose={onClose}>
      <div className="p-6 space-y-4">
        {!isEdit && breadcrumbText && (
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            <span className="uppercase tracking-wide font-medium mr-1">Adding under:</span>
            {breadcrumbText}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location" required>
            <select
              value={form.location_id}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setShowInlineLocation(true)
                  return
                }
                const nextLocationId = e.target.value
                setForm((f) => ({
                  ...f,
                  location_id: nextLocationId,
                  // Any parent belonged to the OLD location and cannot come
                  // along. Left in place this submits a bin whose parent lives
                  // in another warehouse — the backend's location cascade only
                  // walks DOWN from the bin being moved, so it would never
                  // repair the split. The bin lands at the top of the new
                  // location; nest it there afterwards.
                  parent_bin_id:
                    nextLocationId === f.location_id ? f.parent_bin_id : null,
                }))
              }}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— Select —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
              {!isEdit && (
                <option value="__new__">+ New location…</option>
              )}
            </select>
          </Field>
          <Field label="Kind (what is this physically?)">
            <select
              value={form.kind ?? ""}
              onChange={(e) => set("kind", e.target.value || null)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— Unspecified —</option>
              {BIN_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isEdit && (
          <Field label="Inside of (parent) — used to move this bin">
            <select
              value={form.parent_bin_id ?? ""}
              onChange={(e) => pickParent(e.target.value || null)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
              disabled={!form.location_id}
            >
              <option value="">
                — Top of {(locations.find((l) => l.id === form.location_id)?.name) || 'location'} —
              </option>
              {parentBinChoices.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.path_label || b.name || b.bin_code)}
                  {b.kind ? ` · ${b.kind}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Picking a different parent moves this bin (and its descendants). To create a new bin in a specific spot, use "+ Add child" / "+ Add root bin" on the tree.
            </p>
            {isEdit && bin && form.location_id !== bin.location_id && (
              <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                Everything inside this moves to{' '}
                {locations.find((l) => l.id === form.location_id)?.name ?? 'the new location'} with it,
                and it lands at the top rather than inside another bin.
              </p>
            )}
          </Field>
        )}

        {showInlineLocation && (
          <div className="border border-amber-200 bg-amber-50/50 rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                New location
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInlineLocation(false)
                  setNewLocationError(null)
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" required>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder='e.g. "Main Warehouse"'
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </Field>
              <Field label="Type" required>
                <select
                  value={newLocationType}
                  onChange={(e) => setNewLocationType(e.target.value as InventoryLocationType)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
                >
                  {INVENTORY_LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INVENTORY_LOCATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {newLocationError && <ErrorBanner message={newLocationError} />}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCreateInlineLocation}
                disabled={createLocation.isPending || !newLocationName.trim()}
                className="text-sm px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium"
              >
                {createLocation.isPending ? "Creating…" : "Add location"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Address + notes can be filled in later under Tool Shed → Inventory → Locations.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value || null)}
              placeholder='e.g. "Top Shelf", "Drawer A"'
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </Field>
          <Field label="Bin code">
            <input
              type="text"
              value={form.bin_code ?? ""}
              onChange={(e) => set("bin_code", e.target.value || null)}
              placeholder='e.g. "A1-03"'
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Need name OR code, ideally both. Code is short for picking lists; name is human label.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Barcode">
            <input
              type="text"
              value={form.barcode ?? ""}
              onChange={(e) => set("barcode", e.target.value || null)}
              placeholder="Scannable bin barcode (optional)"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
          <Field label="QR code value">
            <input
              type="text"
              value={form.qr_code_value ?? ""}
              onChange={(e) => set("qr_code_value", e.target.value || null)}
              placeholder="QR sticker value (optional)"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            rows={2}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm pt-2 border-t border-slate-100">
          <input
            type="checkbox"
            checked={!!form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>{form.active ? "Active" : "Inactive"}</span>
        </label>

        {error && <ErrorBanner message={error} />}
      </div>

      <Footer>
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
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          {isEdit ? "Cancel" : "Done"}
        </button>
        {!isEdit && (
          <button
            type="button"
            onClick={handleSaveAndAddChild}
            disabled={!canSave}
            className="text-sm px-4 py-2 rounded-md border border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            title="Save this and immediately start adding what's inside it"
          >
            {isPending ? "Saving…" : "Save & add child"}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Save & close"}
        </button>
      </Footer>
    </ModalShell>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    // Surface field-level validation errors (422) — Laravel returns
    // them under details.errors.{field}: ["message", ...]. The default
    // err.message is the generic "The given data was invalid"; the
    // useful info is one level deeper.
    const details = err.details as
      | { errors?: Record<string, string[]> }
      | undefined
    const errors = details?.errors
    if (errors && Object.keys(errors).length > 0) {
      const lines: string[] = []
      for (const [field, msgs] of Object.entries(errors)) {
        const label = field.replace(/_/g, ' ')
        for (const m of msgs) {
          lines.push(`${label}: ${m}`)
        }
      }
      return lines.join(' · ')
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

// =================================================================
// STOCK LEVELS TAB
// =================================================================

function StockLevelsTab() {
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  const [filterLocationId, setFilterLocationId] = useState<string>("")
  const [filterBinId, setFilterBinId] = useState<string>("")
  const [hasStock, setHasStock] = useState<boolean>(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [search])

  /**
   * A barcode gun anywhere on this tab filters the list to what was scanned.
   *
   * Three label types reach this bench and a person cannot tell them apart by
   * looking, so the payload is decoded rather than trusted:
   *   CBSTK:v:unitId:hash  — a stock unit; the id is the discriminating part
   *   .../catalog/products/ID — a product label printed from this page
   *   anything else — a supplier barcode or SKU, which the text filter handles
   *
   * It sets the search box rather than navigating: the row stays on screen with
   * its Edit button, which is what someone at a receiving bench wants next.
   */
  // Which item's "where is it" overlay is open. A row here is ONE bin, so the
  // figures answer "how many here" — this answers "where else", which is the
  // question a dispatcher actually has when a van comes up short.
  const [whereItem, setWhereItem] = useState<{ id: string; name: string; unit: string } | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  // Set by scanning a container. Filters to that bin AND everything under it,
  // which is what "show me this rack" has to mean.
  const [scanSubtree, setScanSubtree] = useState<{ id: string; label: string } | null>(null)

  /**
   * One handler for the barcode gun AND the camera, so a label means the same
   * thing whichever way it was read.
   *
   * A stock unit used to dead-end here — the payload is a fingerprint with no
   * words in it, so there was nothing to search on and it just printed the id.
   * Resolving it server-side gets the catalog item and the bin it is sitting
   * in, which is the actual question ("what is this and where does it live").
   */
  const handleScan = useCallback(async (payload: string) => {
    const result = await resolveScan(payload)
    setScanNote(result.label)

    if (result.kind === 'stock_unit') {
      const item = result.unit.catalog_item
      setSearch(item?.sku || item?.name || '')
      // Both, because the bin filter is applied within a location — setting
      // one without the other silently returns nothing.
      if (result.unit.current_location_id) setFilterLocationId(result.unit.current_location_id)
      if (result.unit.current_bin_id) setFilterBinId(result.unit.current_bin_id)
    } else if (result.kind === 'product') {
      setSearch(result.productId)
    } else if (result.kind === 'bin') {
      // Scanning a container asks "what is in here", and that has to mean
      // EVERYTHING under it. Stock never sits on a rack — it sits in bins
      // several levels below — so an exact bin match shows an empty list for
      // every container above the leaf, which reads as "the rack is empty".
      if (result.bin.location_id) setFilterLocationId(result.bin.location_id)
      setFilterBinId('')
      setScanSubtree({ id: result.bin.id, label: result.bin.path_label || result.bin.name || 'bin' })
      setSearch('')
    } else if (result.kind === 'text') {
      setSearch(result.text)
    }

    window.setTimeout(() => setScanNote(null), 4000)
  }, [])

  useHardwareScanner((payload) => { void handleScan(payload) })

  const { data: binsData } = useAllInventoryBins(
    filterLocationId ? { location_id: filterLocationId } : {}
  )
  const bins = binsData?.data ?? []

  const stockQuery = useStockLevels({
    location_id: filterLocationId || undefined,
    bin_id: filterBinId || undefined,
    in_bin_subtree: scanSubtree?.id || undefined,
    has_stock: hasStock || undefined,
    per_page: 200,
  })

  const allLevels = stockQuery.data?.data ?? []
  // Client-side text search across catalog item name/sku, location, bin path.
  const levels = useMemo(() => {
    if (!debouncedSearch) return allLevels
    return allLevels.filter((sl) => {
      const sluggable = [
        sl.catalog_item?.name,
        sl.catalog_item?.sku,
        sl.location?.name,
        sl.bin?.path_label,
        sl.bin?.bin_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return sluggable.includes(debouncedSearch)
    })
  }, [allLevels, debouncedSearch])

  const [editing, setEditing] = useState<InventoryStockLevel | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const cleanupMutation = useCleanupOrphanStockLevels()
  const noLocations = locations.length === 0
  // Maintenance action — only platform admins see it. SaaS tenants never
  // need this since orphans are auto-filtered from the list anyway.
  const { account } = useAuth()
  const isPlatformAdmin = account?.is_platform_admin === true
  // Tenant admin toggle — when on, manual '+ Add stock' is disabled
  // and stock can only arrive via PO receive.
  const { data: invSettings } = useInventorySettings()
  const requirePo = !!invSettings?.inventory_require_po_for_stock_add

  async function handleCleanup() {
    if (!confirm('Delete all stock-level rows whose item / location / bin has been removed? This is safe — those rows can\'t be edited or used.')) return
    try {
      const n = await cleanupMutation.mutateAsync()
      alert(`Cleaned up ${n} orphan row${n === 1 ? '' : 's'}.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Stock levels</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              How much of each item is in each bin. Adjust counts here or
              create new rows when stock arrives somewhere new.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPlatformAdmin && (
              <button
                type="button"
                onClick={handleCleanup}
                disabled={cleanupMutation.isPending}
                className="text-sm px-3 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-md font-medium disabled:opacity-50"
                title="Platform admin: delete rows whose catalog item / location / bin has been removed (orphans)"
              >
                {cleanupMutation.isPending ? 'Cleaning…' : '🧹 Clean up orphans'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowTransfer(true)}
              disabled={noLocations}
              title={noLocations ? "Create a location first" : "Move stock from one location/bin to another"}
              className="text-sm px-3 py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-md font-medium disabled:opacity-50"
            >
              ⇄ Transfer stock
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              disabled={noLocations || requirePo}
              title={
                noLocations
                  ? "Create a location first"
                  : requirePo
                    ? "Stock-add via PO is required (admin setting). Receive a PO to add stock."
                    : undefined
              }
              className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-md font-medium"
            >
              + Add stock
            </button>
          </div>
        </div>

        {noLocations && (
          <div className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
            No inventory locations yet. Add one in the Locations tab first.
          </div>
        )}

        {scanNote && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-900">
            {scanNote}
          </div>
        )}
        {/* A subtree filter hides most of the list, so it has to announce
            itself and be one click to escape — otherwise the next person to
            walk up sees an inexplicably short inventory. */}
        {scanSubtree && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 text-[13px] text-slate-700 flex items-center gap-3">
            <span>Showing everything inside <strong>{scanSubtree.label}</strong></span>
            <button
              type="button"
              onClick={() => setScanSubtree(null)}
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        <div className="px-6 py-3 border-b border-slate-100 flex gap-3 items-center flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by item, location, bin… or just scan"
            className="flex-1 min-w-[200px] max-w-sm text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          {/* The gun needs no button — it types. This is for the laptop or
              phone that doesn't have one, and it decodes identically. */}
          <QrScanButton
            onScan={(code) => { void handleScan(code) }}
            buttonLabel="📷 Scan"
            buttonClassName="text-sm px-3 py-2 border border-slate-200 rounded bg-white hover:border-amber-400 hover:bg-amber-50 font-medium text-slate-700"
          />
          <select
            value={filterLocationId}
            onChange={(e) => {
              setFilterLocationId(e.target.value)
              setFilterBinId("")
            }}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={filterBinId}
            onChange={(e) => setFilterBinId(e.target.value)}
            disabled={!filterLocationId}
            className="text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All bins</option>
            {bins
              .filter((b) => !filterLocationId || b.location_id === filterLocationId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.path_label || b.name || b.bin_code}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hasStock}
              onChange={(e) => setHasStock(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Only rows with qty &gt; 0
          </label>
        </div>

        {stockQuery.isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load stock levels.{stockQuery.error instanceof Error ? ` ${stockQuery.error.message}` : ""}
          </div>
        )}

        {stockQuery.isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}

        {!stockQuery.isLoading && !stockQuery.isError && levels.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-600">
              {debouncedSearch || filterLocationId || filterBinId || hasStock
                ? "No stock levels match those filters."
                : "No stock levels yet. Click \"+ Add stock\" to record what's where."}
            </p>
          </div>
        )}

        {!stockQuery.isLoading && !stockQuery.isError && levels.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Item</th>
                <th className="text-left px-6 py-3 font-medium">Where</th>
                <th className="text-right px-6 py-3 font-medium">On hand</th>
                <th className="text-right px-6 py-3 font-medium">Reserved</th>
                <th className="text-right px-6 py-3 font-medium">Available</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {levels.map((sl) => (
                <tr key={sl.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">
                      {sl.catalog_item?.name ?? (
                        <span className="text-slate-400 italic">
                          (no item name — id: <span className="font-mono">{sl.catalog_item_id}</span>)
                        </span>
                      )}
                    </div>
                    {sl.catalog_item?.sku && (
                      <div className="font-mono text-xs text-slate-400">{sl.catalog_item.sku}</div>
                    )}
                    {sl.quantities.sn_tracked && (
                      <div className="text-[10px] text-blue-700 mt-0.5 uppercase tracking-wide">
                        SN-tracked (count = active units)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-700">
                    <div className="font-medium">
                      📍 {sl.location?.name ?? (
                        <span className="text-slate-400 italic">
                          (no location — id: <span className="font-mono">{sl.location_id}</span>)
                        </span>
                      )}
                    </div>
                    {sl.bin_id && (
                      sl.bin ? (
                        <div className="text-slate-500">
                          📦 {sl.bin.path_label || sl.bin.name || sl.bin.bin_code}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic">
                          📦 (no bin — id: <span className="font-mono">{sl.bin_id}</span>)
                        </div>
                      )
                    )}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        sl.catalog_item_id &&
                        setWhereItem({
                          id: sl.catalog_item_id,
                          name: sl.catalog_item?.name ?? 'Item',
                          unit: sl.catalog_item?.unit_label || 'each',
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="See every place this item is, and which units"
                    >
                      {formatQty(sl.quantities.qty_on_hand, sl.catalog_item?.unit_label)}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-slate-500">
                    {formatQty(sl.quantities.qty_reserved, sl.catalog_item?.unit_label)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-emerald-700 font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        sl.catalog_item_id &&
                        setWhereItem({
                          id: sl.catalog_item_id,
                          name: sl.catalog_item?.name ?? 'Item',
                          unit: sl.catalog_item?.unit_label || 'each',
                        })
                      }
                      className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title="See every place this item is, and which units"
                    >
                      {formatQty(sl.quantities.qty_available, sl.catalog_item?.unit_label)}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(sl)}
                        className="text-sm text-slate-600 hover:text-amber-600"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <StockLevelFormModal
          locations={locations}
          allBins={bins}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <StockLevelFormModal
          stockLevel={editing}
          locations={locations}
          allBins={bins}
          onClose={() => setEditing(null)}
        />
      )}
      {whereItem && (
        <StockWhereOverlay
          itemId={whereItem.id}
          itemName={whereItem.name}
          unitLabel={whereItem.unit}
          onClose={() => setWhereItem(null)}
        />
      )}
      {showTransfer && (
        <TransferStockModal onClose={() => setShowTransfer(false)} />
      )}
    </div>
  )
}

// ---------- Stock level create / edit modal ----------

function StockLevelFormModal({
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
  // and update, but only after Save — so typing a bigger number and pressing
  // the button was the only way to discover the rule. Say it up front.
  const { data: stockRules } = useInventorySettings()
  const poRequired = !!stockRules?.inventory_require_po_for_stock_add
  const originalQty = Number(stockLevel?.quantities.qty_on_hand ?? 0)

  const [qtyOnHand, setQtyOnHand] = useState(
    stockLevel?.quantities.qty_on_hand != null ? String(stockLevel.quantities.qty_on_hand) : "0"
  )
  const [qtyReserved, setQtyReserved] = useState(
    stockLevel?.quantities.qty_reserved != null ? String(stockLevel.quantities.qty_reserved) : "0"
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
  const canSave =
    !isPending && !!locationId && !!catalogItemId && qtyOnHand !== ""

  async function handleSave() {
    setError(null)
    try {
      const payload = {
        location_id: locationId,
        bin_id: binId || null,
        catalog_item_id: catalogItemId,
        qty_on_hand: Number(qtyOnHand) || 0,
        qty_reserved: Number(qtyReserved) || 0,
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
    <ModalShell title={isEdit ? 'Edit stock' : 'Add stock'} onClose={onClose}>
      <div className="p-6 space-y-4">
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
                  {!itemsQuery.isLoading && itemResults.length === 0 && (
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
                  {itemResults.map((it) => (
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

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
          <Field label={`${stockLevel?.quantities.sn_tracked ? 'Qty on hand (computed)' : 'Qty on hand'}${isCountableUnit(pickedUnit) ? '' : ` (${pickedUnit})`}`} required>
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
            {poRequired && Number(qtyOnHand || 0) > originalQty && (
              <p className="mt-1 text-[12px] text-rose-700">
                This shop only takes stock in through a received purchase order,
                so this increase will be refused. Receive a PO instead, or turn
                off &ldquo;Require PO before adding stock&rdquo; in Inventory settings.
              </p>
            )}
          </Field>
          <Field label={`Qty reserved${isCountableUnit(pickedUnit) ? '' : ` (${pickedUnit})`}`}>
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
          Available = on hand − reserved.
          {stockLevel?.quantities.sn_tracked
            ? " On-hand is computed from active SN units — edit individual units to change it."
            : ""}
        </p>

        {isEdit && stockLevel?.catalog_item_id && (
          <PrintQrSection stockLevel={stockLevel} />
        )}

        {isEdit && stockLevel?.catalog_item_id && (
          <ReturnSection stockLevel={stockLevel} onClose={onClose} />
        )}

        {error && <ErrorBanner message={error} />}
      </div>

      <Footer>
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
