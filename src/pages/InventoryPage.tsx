import { useState, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { isDeleteCancelled } from "@/lib/api"
import {
  useInventoryLocations,
  useCreateInventoryLocation,
  useUpdateInventoryLocation,
  useDeleteInventoryLocation,
} from "@/hooks/useInventoryLocations"
import {
  useAllInventoryBins,
  useBinStockRollup,
  useBinContents,
  useCreateInventoryBin,
  useUpdateInventoryBin,
  useDeleteInventoryBin,
} from "@/hooks/useInventoryBins"
import { useCatalogItem } from "@/hooks/useCatalogItems"
import { EditModal as ProductCatalogEditModal, ProductViewModal } from "@/pages/ProductCatalogPage"
import { InventoryUnitsPage } from "@/pages/InventoryUnitsPage"
import { InventoryMovementsPage } from "@/pages/InventoryMovementsPage"
import { InventoryReconciliationsPage } from "@/pages/InventoryReconciliationsPage"
import { InventorySettingsPanel } from "@/pages/SettingsInventoryPage"
import { formatQty } from "@/lib/unitsOfMeasure"
import { PERM, usePermissions } from "@/hooks/usePermissions"
import { InventoryStructureBuilder } from "@/components/inventory/InventoryStructureBuilder"
import { BinsExplorer, type AddChildDefaults } from "@/components/inventory/bins/BinsExplorer"
import { useStockInRules } from "@/hooks/usePoOverride"
import { GlobalInventorySearch } from "@/components/inventory/GlobalInventorySearch"
import { useInventoryReconciliations } from "@/hooks/useInventoryReconciliations"
import { useStockLevels } from "@/hooks/useInventoryStockLevels"
import { chipCounts } from "@/lib/stockRows"
import type { CatalogItem as CatalogItemFull } from "@/types/catalogItem"
import { ApiError } from "@/lib/api"
import type {
  InventoryLocation,
  InventoryLocationType,
} from "@/types/inventoryLocation"
import { INVENTORY_LOCATION_TYPES, INVENTORY_LOCATION_TYPE_LABELS } from "@/types/inventoryLocation"
import type { InventoryBin, InventoryBinInput } from "@/types/inventoryBin"
import { BIN_KIND_OPTIONS } from "@/types/inventoryBin"
import { useTheme } from '@/hooks/useTheme'
import { ModalShell, Footer, Field, ErrorBanner } from "@/components/inventory/inventoryModalUi"
import { extractError } from "@/lib/inventoryErrors"
import { StockInButton, type InventoryTabKey } from "@/components/inventory/StockInButton"
import { StockTab } from "@/components/inventory/stock/StockTab"
import { StockLevelFormModal } from "@/components/inventory/stock/StockLevelFormModal"
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'

// ---------- Tab definitions ----------

type TabKey = InventoryTabKey

// Day-to-day first (Patrick's order): Stock is what people open the page for;
// Locations and Settings are set up once.
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "stock", label: "Stock" },
  { key: "bins", label: "Bins" },
  { key: "units", label: "Units" },
  { key: "movements", label: "Movements" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "locations", label: "Locations" },
  { key: "settings", label: "Settings" },
]

// ---------- Page ----------

export function InventoryPage() {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as TabKey | null
  const activeTab: TabKey = tabParam && TABS.some(t => t.key === tabParam) ? tabParam : "stock"

  const setActiveTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  // Locations data drives the Locations tab AND the tab badge count
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locationCount = locationsData?.meta?.total ?? 0

  return (
    <div data-focus-page="inventory" className={easy ? 'w-full min-w-0 p-6 space-y-6' : 'max-w-7xl mx-auto p-6 space-y-6'}>
      {easy && <EasyPageHeading title="Parts & inventory" description="Find stock, organize where it lives, and follow what moved. Receiving and reconciliation stay in the same workspace." />}
      <Header
        easy={easy}
        onOpenQueue={() => setActiveTab('reconciliation')}
        defaultLocationId={locationsData?.data?.[0]?.id}
      />
      <div data-tour="inv-global-search"><GlobalInventorySearch onGoToTab={setActiveTab} /></div>
      <div className={easy ? 'grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]' : 'space-y-6'}>
        <TabNav active={activeTab} onChange={setActiveTab} locationCount={locationCount} easy={easy} />
        <div className={easy ? 'min-w-0' : ''}><TabContent active={activeTab} /></div>
      </div>
    </div>
  )
}

// ---------- Header ----------

function Header({
  easy = false,
  onOpenQueue,
  defaultLocationId,
}: {
  easy?: boolean
  onOpenQueue: () => void
  defaultLocationId?: string
}) {
  // Badge the queue so it reads as work rather than a page. An empty queue is
  // the normal state, so the count only shows when there is something in it.
  const { data: queueData } = useInventoryReconciliations({ status: 'pending', per_page: 1 })
  const pendingCount = queueData?.meta?.total ?? 0

  return (
    <div data-tour="inv-header" className={easy ? 'flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4' : 'flex flex-wrap items-start justify-between gap-6'}>
      <div>
        {easy ? <h2 className="font-semibold text-slate-900">Stock operations</h2> : <h1 className="text-3xl font-semibold text-slate-900">Inventory</h1>}
        <p className="text-sm text-slate-600 mt-1">
          Where stock lives, what's in stock, what's moved.
        </p>
      </div>
      <div className={easy ? 'flex flex-wrap gap-2 items-start' : 'flex gap-2 items-start flex-shrink-0'}>
        <button
          type="button"
          onClick={onOpenQueue}
          data-tour="inv-queue-button"
          data-pending={pendingCount > 0 ? 'yes' : 'no'}
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
        <div className="mt-2"><StockInButton tour="inv-receive-button" defaultLocationId={defaultLocationId} /></div>
      </div>
    </div>
  )
}


// ---------- Tab navigation ----------

function TabNav({
  easy = false,
  active,
  onChange,
  locationCount,
}: {
  easy?: boolean
  active: TabKey
  onChange: (tab: TabKey) => void
  locationCount: number
}) {
  // Badges: rows that are Low or Out (the Stock tab's own rule and the same
  // read as its default view, so the number matches its chips), and the
  // reconciliation queue (the same read as the header button).
  const stockRead = useStockLevels({ per_page: 200 })
  const stockCounts = chipCounts(stockRead.data?.data ?? [])
  const needsLook = stockCounts.low + stockCounts.out
  const { data: queueData } = useInventoryReconciliations({ status: 'pending', per_page: 1 })
  const pending = queueData?.meta?.total ?? 0
  const badge = (key: TabKey): { n: number; title: string; warn: boolean } | null => {
    if (key === 'locations') return { n: locationCount, title: `${locationCount} locations`, warn: false }
    if (key === 'stock' && needsLook > 0) return { n: needsLook, title: `${stockCounts.low} low, ${stockCounts.out} out`, warn: true }
    if (key === 'reconciliation' && pending > 0) return { n: pending, title: `${pending} waiting to be explained`, warn: true }
    return null
  }
  return (
    <div data-tour="inv-tabs" className={easy ? 'rounded-xl border border-slate-200 bg-white p-2' : 'border-b border-slate-200 overflow-x-auto'}>
      <div aria-label="Inventory sections" role="group" className={easy ? 'grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1' : 'flex gap-1'}>
        {TABS.map((tab) => {
          const isActive = tab.key === active
          const b = badge(tab.key)
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              data-tour={`inv-tab-${tab.key}`}
              className={easy ? `rounded-lg px-3 py-3 text-left text-sm font-medium ${isActive ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-amber-50'}` : `px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                isActive
                  ? "text-amber-600 border-amber-500"
                  : "text-slate-600 hover:text-amber-600 border-transparent"
              }`}
            >
              {tab.label}
              {b && (b.warn ? (
                <span data-tab-badge={tab.key} title={b.title} className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${isActive && easy ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'}`}>{b.n.toLocaleString('en-US')}</span>
              ) : (
                <span data-tab-badge={tab.key} title={b.title} className={`ml-1 text-xs font-mono ${isActive && easy ? 'text-white/80' : 'text-slate-400'}`}>({b.n})</span>
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Tab content router ----------

// Each tab's body carries its own guided-tour marker, written out so the
// markers can be found by searching for them.
function TabContent({ active }: { active: TabKey }) {
  if (active === "locations") return <div data-tour="inv-locations"><LocationsTab /></div>
  if (active === "bins") return <div data-tour="inv-bins"><BinsTab /></div>
  if (active === "stock") return <div data-tour="inv-stock-levels"><StockTab /></div>
  if (active === "units") return <div data-tour="inv-units"><InventoryUnitsPage embedded /></div>
  if (active === "movements") return <div data-tour="inv-movements"><InventoryMovementsPage embedded /></div>
  if (active === "reconciliation") return <div data-tour="inv-reconciliation"><InventoryReconciliationsPage embedded /></div>
  if (active === "settings") return <div data-tour="inv-settings"><InventorySettingsPanel /></div>
  return null
}

// =================================================================
// LOCATIONS TAB
// =================================================================

function LocationsTab() {
  const { data, isLoading, isFetching, isError, error, refetch } = useInventoryLocations({ per_page: 200 })
  const [editing, setEditing] = useState<InventoryLocation | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const canEdit = usePermissions().has(PERM.INVENTORY_EDIT)

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
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              data-tour="inv-location-new"
              className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
            >
              + New Location
            </button>
          )}
        </div>

        {isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load locations.{error instanceof Error ? ` ${error.message}` : ""}
            <button type="button" disabled={isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void refetch()}>Try again</button>
          </div>
        )}

        {isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}

        {!isLoading && !isError && <LocationsTable locations={locations} onEdit={canEdit ? setEditing : undefined} />}
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
  onEdit?: (loc: InventoryLocation) => void
}) {
  if (locations.length === 0) {
    return (
      <div data-tour="inv-locations-empty" className="p-12 text-center">
        <p className="text-sm text-slate-600">
          No locations yet. Click "+ New Location" to add a warehouse, truck, or other stocking location.
        </p>
      </div>
    )
  }

  return (
    <div data-tour="inv-locations-table" className="overflow-x-auto">
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
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(loc)}
                  className="text-sm text-slate-600 hover:text-amber-600"
                >
                  Edit
                </button>
              )}
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
    <ModalShell title="New Location" onClose={onClose} tour="inv-location-form">
      <LocationForm form={form} onChange={setForm} />
      {errorMsg && <div className="px-6 pb-2"><ErrorBanner message={errorMsg} /></div>}
      <Footer tour="inv-location-footer">
        <button
          type="button"
          onClick={onClose}
          data-tour="inv-location-cancel"
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
      <div data-tour="inv-location-basics" className="grid grid-cols-2 gap-4">
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

      <div data-tour="inv-location-address" className="border-t border-slate-100 pt-4">
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
                placeholder="e.g. NY"
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

      <div data-tour="inv-location-more" className="space-y-4">
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
      </div>

      <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
        Stock value is quantity on hand times your cost, matching the inventory valuation report.
      </p>
    </div>
  )
}

// =================================================================
// BINS TAB
// =================================================================

function BinsTab() {
  const { data: locationsData } = useInventoryLocations({ per_page: 200 })
  const locations = locationsData?.data ?? []
  // ALL pages, not the first. The tree draws every branch, so a single page
  // silently hid entire locations. Searching and filtering happen on the
  // screen now, so the list is always the whole shop.
  const { data, isLoading, isFetching, isError, error, refetch } = useAllInventoryBins({})
  const bins = data?.data ?? []
  const binsTruncated = data?.truncated ?? false
  // What is in each bin (direct counts); the tree adds up each branch.
  const { data: stockRollup } = useBinStockRollup(undefined)
  // The server refuses direct stock adds when this is on; the screen says so.
  const requirePoForStock = useStockInRules().poRequired
  const canEditBins = usePermissions().has(PERM.INVENTORY_EDIT)

  const [editing, setEditing] = useState<InventoryBin | null>(null)
  const [viewing, setViewing] = useState<InventoryBin | null>(null)
  const [addStockAt, setAddStockAt] = useState<{ bin: InventoryBin | null; locationId: string | null } | null>(null)
  /** "+ New Bin" / "+ Add root bin": the location to land in ("" = first). */
  const [createInLocationId, setCreateInLocationId] = useState<string | null>(null)
  /** "Add row" and friends: the parent, with the tree's suggestions. */
  const [addingChild, setAddingChild] = useState<{ parent: InventoryBin; defaults: AddChildDefaults } | null>(null)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const noLocations = !locationsData || locations.length === 0

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Bins</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Where everything is kept: racks, shelves, bins and rows in each location.
            </p>
          </div>
          {canEditBins && <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSetupWizard(true)}
              data-tour="inv-bins-build"
              disabled={noLocations}
              title={noLocations ? "Create a location first" : "Describe your storage shape and create it"}
              className="text-sm px-4 py-2.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-amber-800 rounded-md font-medium transition-colors"
            >
              Build structure
            </button>
            <button
              type="button"
              onClick={() => setCreateInLocationId("")}
              data-tour="inv-bins-new"
              disabled={noLocations}
              title={noLocations ? "Create a location first" : undefined}
              className="text-sm px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
            >
              + New Bin
            </button>
          </div>}
        </div>

        {noLocations && (
          <div data-tour="inv-bins-nolocations" className="px-6 py-4 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
            Create a location first — bins live inside locations.
          </div>
        )}
        {isError && (
          <div className="px-6 py-4 text-sm text-red-700 bg-red-50">
            Failed to load bins.{error instanceof Error ? ` ${error.message}` : ""}
            <button type="button" disabled={isFetching} className="ml-2 underline disabled:opacity-50" onClick={() => void refetch()}>Try again</button>
          </div>
        )}
        {/* A tree that silently stops short reads as missing data. */}
        {binsTruncated && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-900">
            Showing the first 5,000 bins. Some places are not on this screen.
          </div>
        )}
        {isLoading && (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-slate-100 rounded" />
            <div className="h-12 bg-slate-100 rounded" />
          </div>
        )}
        {!isLoading && !isError && locations.length > 0 && (
          <BinsExplorer
            locations={locations}
            bins={bins}
            rollup={stockRollup ?? {}}
            canEdit={canEditBins}
            poRequired={requirePoForStock}
            onEdit={setEditing}
            onAddChild={(parent, defaults) => setAddingChild({ parent, defaults })}
            onAddRoot={(locId) => setCreateInLocationId(locId)}
            onOpenCatalog={setViewing}
            onAddStock={setAddStockAt}
          />
        )}
      </div>

      {createInLocationId !== null && (
        <BinFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={createInLocationId || locations[0]?.id || ""}
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
      {addingChild && (
        <BinFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={addingChild.parent.location_id}
          defaultParentBinId={addingChild.parent.id}
          defaultBinCode={addingChild.defaults.code}
          defaultKind={addingChild.defaults.kind}
          defaultName={addingChild.defaults.name}
          defaultSortOrder={addingChild.defaults.sortOrder}
          defaultHoldsStock={addingChild.defaults.holdsStock}
          defaultCapacity={addingChild.defaults.capacity}
          onClose={() => setAddingChild(null)}
        />
      )}
      {viewing && (
        <BinContentsModal bin={viewing} onClose={() => setViewing(null)} />
      )}
      {/* Bins "Add product" (row, top button, detail panel, and "without a PO"
          for whoever may override) opens the original Add stock window: pick or
          make the product (+ New product has the photo upload), bin filled in.
          Its save is POST /v1/inventory-stock-levels, which the server books as a
          "Stock received" movement (2c3864ad3), so nothing goes in unlogged.
          With PO-only on, Bins sends this to the add-from-PO window instead. */}
      {addStockAt && (
        <StockLevelFormModal
          locations={locations}
          allBins={bins}
          defaultLocationId={addStockAt.bin?.location_id ?? addStockAt.locationId ?? undefined}
          defaultBinId={addStockAt.bin?.id}
          onClose={() => setAddStockAt(null)}
        />
      )}
      {/* Structure builder — describe the storage shape in the shop's own words,
          any depth, and read the codes before committing. */}
      {showSetupWizard && (
        <div
          className="fixed inset-0 z-[120] flex justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Build a storage structure"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSetupWizard(false) }}
        >
          <div className="h-fit w-full max-w-[1400px] rounded-2xl bg-slate-100 p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-slate-900">Build a storage structure</h2>
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
              initialLocationId=""
              onClose={() => setShowSetupWizard(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BinContentsModal({
  bin,
  onClose,
}: {
  bin: InventoryBin
  onClose: () => void
}) {
  const { data, isLoading, isFetching, isError, error, refetch } = useBinContents(bin.id)
  const [catalogSearch, setCatalogSearch] = useState('')
  // "View product" opens the product over this catalog instead of leaving it.
  const { has } = usePermissions()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<CatalogItemFull | null>(null)
  const viewingItem = useCatalogItem(viewingId ?? undefined)
  const [scope, setScope] = useState<'subtree' | 'bin'>('subtree')
  const subBins = (data?.bins ?? []).filter((b) => b.id !== bin.id)
  const units = useMemo(() => (data?.units ?? []).filter((unit) =>
    (scope === 'subtree' || unit.bin_id === bin.id) &&
    (unit.status === 'available' || unit.status === 'reserved'),
  ), [data, scope, bin.id])
  const stockLevels = useMemo(() => (data?.stock_levels ?? []).filter((level) =>
    scope === 'subtree' || level.bin_id === bin.id,
  ), [data, scope, bin.id])

  // Group units + stock by catalog item for a cleaner read
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        catalogId: string
        name: string
        sku: string | null
        imageUrl: string | null
        unitLabel: string | null
        unitCount: number
        stockQty: number
        unitsByBin: Map<string, number>
      }
    >()
    for (const u of units) {
      const id = u.catalog_item_id
      const name = u.catalog_item?.name ?? '—'
      const sku = u.catalog_item?.sku ?? null
      const imageUrl = u.catalog_item?.images?.thumb_url ?? u.catalog_item?.images?.medium_url ?? null
      if (!map.has(id)) {
        map.set(id, { catalogId: id, name, sku, imageUrl, unitLabel: u.catalog_item?.unit_label ?? null, unitCount: 0, stockQty: 0, unitsByBin: new Map() })
      }
      const row = map.get(id)!
      row.imageUrl ||= imageUrl
      row.unitCount += 1
      const binPath = u.bin?.path_label ?? '(no bin)'
      row.unitsByBin.set(binPath, (row.unitsByBin.get(binPath) ?? 0) + 1)
    }
    for (const s of stockLevels) {
      const id = s.catalog_item_id
      const name = s.catalog_item?.name ?? '—'
      const sku = s.catalog_item?.sku ?? null
      const imageUrl = s.catalog_item?.images?.thumb_url ?? s.catalog_item?.images?.medium_url ?? null
      if (!map.has(id)) {
        map.set(id, { catalogId: id, name, sku, imageUrl, unitLabel: s.catalog_item?.unit_label ?? null, unitCount: 0, stockQty: 0, unitsByBin: new Map() })
      }
      const row = map.get(id)!
      row.imageUrl ||= imageUrl
      row.unitLabel ||= s.catalog_item?.unit_label ?? null
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

  const visibleItems = grouped.filter((row) =>
    `${row.name} ${row.sku ?? ''}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()),
  )

  return (
    <>
    {/* Escape closes the product on top first, then the catalog. */}
    <ModalShell title={`Bin catalog — ${bin.path_label || bin.name || bin.bin_code}`} onClose={() => (editingProduct ? undefined : viewingId ? setViewingId(null) : onClose())} tour="inv-bin-contents-modal" wide>
      <div className="p-4 sm:p-6 space-y-5">
        {isLoading && (
          <div className="text-sm text-slate-500 py-8 text-center">Loading bin contents…</div>
        )}
        {isError && (
          <ErrorBanner
            message={`Failed to load contents.${error instanceof Error ? ` ${error.message}` : ''}`}
            onRetry={() => void refetch()}
            busy={isFetching}
          />
        )}

        {!isLoading && !isError && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{grouped.length} products</span>
              <span>{stockLevels.length} stock rows</span>
              <span>{units.length} serial-tracked units</span>
              {subBins.length > 0 && <span>{subBins.length} sub-bins</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                aria-label="Search this bin catalog"
                placeholder="Find a product or SKU in this bin…"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              {subBins.length > 0 && (
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Bin catalog scope">
                  <button type="button" onClick={() => setScope('subtree')} aria-pressed={scope === 'subtree'} className={`rounded-md px-3 py-1.5 ${scope === 'subtree' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}>This bin + below</button>
                  <button type="button" onClick={() => setScope('bin')} aria-pressed={scope === 'bin'} className={`rounded-md px-3 py-1.5 ${scope === 'bin' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}>This bin only</button>
                </div>
              )}
            </div>
            {visibleItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                {grouped.length === 0 ? 'No products are stored here yet.' : 'No products match that search.'}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map((row) => (
                  <article key={row.catalogId} className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400">
                      <span aria-hidden>Image unavailable</span>
                      {row.imageUrl && <img src={row.imageUrl} alt={row.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain bg-white" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="line-clamp-2 text-sm font-semibold text-slate-900" title={row.name}>{row.name}</div>
                      {row.sku && <div className="truncate font-mono text-xs text-slate-500" title={row.sku}>{row.sku}</div>}
                      <div className="mt-2 text-lg font-bold tabular-nums text-slate-900">{formatQty(row.stockQty + row.unitCount, row.unitLabel)} <span className="text-xs font-medium text-slate-500">on hand</span></div>
                      {row.unitCount > 0 && <div className="text-xs text-slate-500">{row.unitCount} serial-tracked</div>}
                      <div className="mt-auto pt-2 text-xs text-slate-600" title={Array.from(row.unitsByBin.entries()).map(([path, n]) => `${path} (${formatQty(n, row.unitLabel)})`).join(' · ')}>
                        {Array.from(row.unitsByBin.entries()).map(([path, n]) => `${path} (${formatQty(n, row.unitLabel)})`).join(' · ')}
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingId(row.catalogId)}
                        className="mt-2 self-start text-xs font-semibold text-amber-700 hover:underline"
                      >
                        {viewingId === row.catalogId && viewingItem.isLoading ? 'Opening…' : 'View product'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Footer>
        <button
          type="button"
          onClick={onClose}
          data-tour="inv-bin-contents-close"
          className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
        >
          Close
        </button>
      </Footer>
    </ModalShell>
    {viewingId && viewingItem.data && !editingProduct && (
      <ProductViewModal
        item={viewingItem.data}
        canEdit={has(PERM.CATALOG_EDIT)}
        onClose={() => setViewingId(null)}
        onEdit={() => setEditingProduct(viewingItem.data ?? null)}
      />
    )}
    {editingProduct && <ProductCatalogEditModal item={editingProduct} onClose={() => setEditingProduct(null)} />}
    </>
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
    capacity: null,
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
    capacity: b.capacity ?? null,
    holds_stock: b.holds_stock ?? true,
  }
}

function BinFormModal({
  bin,
  locations,
  allBins,
  defaultLocationId,
  defaultParentBinId,
  defaultBinCode,
  defaultKind,
  defaultName,
  defaultSortOrder,
  defaultHoldsStock,
  defaultCapacity,
  onClose,
}: {
  bin?: InventoryBin
  locations: InventoryLocation[]
  allBins: InventoryBin[]
  defaultLocationId?: string
  /** When opening from a tree node's "+ Add child" button, pre-set the parent. */
  defaultParentBinId?: string
  /** Suggested by the tree from the siblings ("Add row" after A, B -> C). */
  defaultBinCode?: string | null
  defaultKind?: string | null
  defaultName?: string | null
  /** After the last sibling, like the structure builder numbers them. */
  defaultSortOrder?: number
  /** Copied from the siblings, so a new row behaves like the rows beside it. */
  defaultHoldsStock?: boolean
  defaultCapacity?: number | null
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
    // The tree's suggestion follows what is already there, so it wins.
    if (defaultKind) blank.kind = defaultKind
    if (defaultName !== undefined) blank.name = defaultName
    if (defaultBinCode) blank.bin_code = defaultBinCode
    if (defaultSortOrder !== undefined) blank.sort_order = defaultSortOrder
    if (defaultHoldsStock !== undefined) blank.holds_stock = defaultHoldsStock
    if (defaultCapacity) blank.capacity = defaultCapacity
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
        capacity: null,
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
    <ModalShell title={isEdit ? `Edit: ${bin?.path_label ?? "Bin"}` : "New Bin"} onClose={onClose} tour="inv-bin-form">
      <div className="p-6 space-y-4">
        {!isEdit && breadcrumbText && (
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            <span className="uppercase tracking-wide font-medium mr-1">Adding under:</span>
            {breadcrumbText}
          </div>
        )}
        <div data-tour="inv-bin-form-where" className="grid grid-cols-2 gap-3">
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
              {/* The structure builder writes the shop's own words (Row,
                  Level…). Without this the dropdown showed them as blank and
                  saving cleared them. */}
              {form.kind && !(BIN_KIND_OPTIONS as readonly string[]).includes(form.kind) && (
                <option value={form.kind}>{form.kind}</option>
              )}
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
              Address + notes can be filled in later on the Locations tab of this page.
            </p>
          </div>
        )}

        <div data-tour="inv-bin-form-names" className="grid grid-cols-2 gap-3">
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

        <div data-tour="inv-bin-form-codes" className="grid grid-cols-2 gap-3">
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

        <Field label="Capacity (units that fit here)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.capacity ?? ""}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value))
              set("capacity", e.target.value === "" || !Number.isFinite(n) || n < 1 ? null : n)
            }}
            placeholder="Leave blank if it doesn't matter"
            data-tour="inv-bin-form-capacity"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Lets the tree show how full it is. A rack or shelf without one adds up the places inside it.
          </p>
        </Field>

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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.holds_stock ?? true}
            onChange={(e) => set("holds_stock", e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Stock can sit directly in this {(form.kind || "bin").toLowerCase()}</span>
          <span className="text-xs text-slate-500">(off for a rack or shelf that only holds other places)</span>
        </label>

        {error && <ErrorBanner message={error} />}
      </div>

      <Footer tour="inv-bin-form-footer">
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
          data-tour="inv-bin-form-close"
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
