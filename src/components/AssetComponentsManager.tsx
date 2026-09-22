import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  useAssetComponents,
  useInstallAssetComponent,
  useUninstallAssetComponent,
} from "@/hooks/useAssetComponents"
import { useInventorySettings } from "@/hooks/useInventorySettings"
import { useAuth } from "@/hooks/useAuth"
import { apiRequest, ApiError } from "@/lib/api"
import type { AssetComponent } from "@/types/assetComponent"

/**
 * AssetComponentsManager - list + install + uninstall for SN-tracked
 * inventory components on an asset.
 *
 * SLICE-6a (initial) + Slice 13c follow-up (picker + permission gate).
 *
 * Wired to:
 *   GET    /v1/assets/{id}/components
 *   POST   /v1/assets/{id}/components       body: { serial_number, notes? }
 *   DELETE /v1/assets/{id}/components/{unitId}
 *   GET    /v1/inventory-units?status=available&q=...    (picker source)
 *
 * Default install path is the inventory unit picker (typeahead by serial,
 * SKU, or notes; results scoped to status=available). Picker is ALWAYS
 * shown.
 *
 * Manual free-text serial install is gated:
 *   - Tenant setting `inventory_allow_serial_freetext_install` (default
 *     true) controls visibility for non-admin users
 *   - Platform admins ALWAYS see the free-text input regardless of the
 *     tenant setting (override safety net)
 *
 * Tenant admins toggle the setting in Settings -> Inventory.
 *
 * NOT YET (deferred):
 *   - Non-SN-tracked components like weatherstripping qty (Slice 6b)
 *   - Inventory movement audit row on install/uninstall (waits on C3c-2/3)
 */

const itemIcon = "🔧"

export function AssetComponentsManager({ assetId }: { assetId: string }) {
  const { data: components = [], isLoading } = useAssetComponents(assetId)
  const installMutation = useInstallAssetComponent(assetId)
  const uninstallMutation = useUninstallAssetComponent(assetId)
  const { data: invSettings } = useInventorySettings()
  const { account } = useAuth()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Free-text fallback visibility:
  // - Platform admin: always
  // - Otherwise: tenant setting controls
  const showFreetext =
    account?.is_platform_admin === true ||
    invSettings?.inventory_allow_serial_freetext_install !== false

  const installBySerial = async (serial: string) => {
    setErrorMessage(null)
    const trimmed = serial.trim()
    if (!trimmed) {
      setErrorMessage("Enter a serial number to install.")
      return
    }
    try {
      await installMutation.mutateAsync({ serial_number: trimmed })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Install failed."
      setErrorMessage(msg)
    }
  }

  const handleRemove = async (unitId: string, label: string) => {
    setErrorMessage(null)
    if (!confirm(`Remove "${label}" from this asset?`)) return
    try {
      await uninstallMutation.mutateAsync({ unitId })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Remove failed."
      setErrorMessage(msg)
    }
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : components.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">
          No components installed yet.
        </p>
      ) : (
        <ComponentList
          components={components}
          onRemove={handleRemove}
          isRemoving={uninstallMutation.isPending}
        />
      )}

      <InventoryUnitPicker
        onPick={(unit) => installBySerial(unit.serial_number)}
        disabled={installMutation.isPending}
      />

      {showFreetext && (
        <FreetextSerialInstall
          onInstall={installBySerial}
          isPending={installMutation.isPending}
          isPlatformOverride={account?.is_platform_admin === true && invSettings?.inventory_allow_serial_freetext_install === false}
        />
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Inventory unit picker (typeahead by serial / SKU / notes)
// ============================================================

interface UnitListItem {
  id: string
  serial_number: string
  status: string
  catalog_item: { name: string | null; sku: string | null } | null
  location: { name: string | null } | null
}

interface UnitListResponse {
  data: UnitListItem[]
}

function InventoryUnitPicker({
  onPick,
  disabled,
}: {
  onPick: (unit: UnitListItem) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(handle)
  }, [query])

  // Always fetch up to 10 available units. When query is empty, this
  // shows the most-recent ten so a tech with a small inventory doesn't
  // have to type to see anything. Larger inventories effectively REQUIRE
  // typing to narrow down.
  const unitsQuery = useQuery({
    queryKey: ["inventory-units", "picker", debouncedQuery],
    queryFn: () => {
      const params = new URLSearchParams({
        status: "available",
        per_page: "10",
      })
      if (debouncedQuery) params.set("q", debouncedQuery)
      return apiRequest<UnitListResponse>(`/v1/inventory-units?${params.toString()}`)
    },
  })

  const units = unitsQuery.data?.data ?? []
  const isLoading = unitsQuery.isFetching
  const isEmpty = !isLoading && units.length === 0

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-slate-700">
          Install component from inventory
        </label>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          Available units
        </span>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by serial, SKU, or notes..."
        className="w-full text-sm px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        disabled={disabled}
      />
      {isLoading && (
        <div className="text-xs text-slate-500 text-center py-2">Searching…</div>
      )}
      {isEmpty && (
        <div className="text-xs text-slate-500 text-center py-2">
          {debouncedQuery
            ? `No available units match "${debouncedQuery}".`
            : "No available units in inventory."}
        </div>
      )}
      {!isLoading && units.length > 0 && (
        <ul className="border border-slate-200 rounded bg-white divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {units.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onPick(u)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50 text-left disabled:opacity-50"
              >
                <span className="text-xl flex-shrink-0">{itemIcon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {u.catalog_item?.name ?? "(unknown item)"}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {u.serial_number}
                    {u.catalog_item?.sku ? ` · ${u.catalog_item.sku}` : ""}
                    {u.location?.name ? ` · ${u.location.name}` : ""}
                  </div>
                </div>
                <span className="text-amber-600 text-xs flex-shrink-0">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================
// Free-text serial install (fallback / admin override)
// ============================================================

function FreetextSerialInstall({
  onInstall,
  isPending,
  isPlatformOverride,
}: {
  onInstall: (serial: string) => void
  isPending: boolean
  isPlatformOverride: boolean
}) {
  const [serialInput, setSerialInput] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    onInstall(serialInput)
    setSerialInput("")
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-slate-700 underline"
      >
        Manual entry: type a serial number{isPlatformOverride && " (platform-admin override)"}
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-slate-700">
          Manual serial entry
        </label>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setSerialInput("")
          }}
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Hide
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={serialInput}
          onChange={(e) => setSerialInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. SCH-L9080-000042"
          disabled={isPending}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60 font-mono"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !serialInput.trim()}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? "Installing..." : "Install"}
        </button>
      </div>
      {isPlatformOverride && (
        <p className="text-xs text-amber-700">
          ⚠ This tenant has free-text install disabled for non-admins. You see
          this because you're a platform admin.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Existing list rendering
// ============================================================

function ComponentList({
  components,
  onRemove,
  isRemoving,
}: {
  components: AssetComponent[]
  onRemove: (unitId: string, label: string) => void
  isRemoving: boolean
}) {
  return (
    <ul className="divide-y divide-slate-200 border border-slate-200 rounded">
      {components.map((c) => (
        <ComponentRow
          key={c.inventory_unit_id}
          c={c}
          onRemove={onRemove}
          isRemoving={isRemoving}
        />
      ))}
    </ul>
  )
}

function ComponentRow({
  c,
  onRemove,
  isRemoving,
}: {
  c: AssetComponent
  onRemove: (unitId: string, label: string) => void
  isRemoving: boolean
}) {
  const catalogName = c.catalog_item?.name ?? "(unknown item)"
  const catalogSku = c.catalog_item?.sku ?? null
  const installedDate = c.installed_at
    ? new Date(c.installed_at).toLocaleDateString()
    : null
  const label = catalogName + " (" + c.serial_number + ")"

  const meta: string[] = []
  if (catalogSku) meta.push(catalogSku)
  meta.push(c.serial_number)
  if (installedDate) meta.push("installed " + installedDate)

  const removeClass =
    "text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 px-2 py-1 rounded disabled:opacity-50"

  return (
    <li className="px-3 py-2 hover:bg-slate-50 flex items-center gap-3">
      <div className="text-2xl flex-shrink-0 leading-none">{itemIcon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-slate-900 truncate">
          {catalogName}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {meta.join(" · ")}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(c.inventory_unit_id, label)}
        disabled={isRemoving}
        className={removeClass}
        title="Remove (uninstall) this component"
      >
        Remove
      </button>
    </li>
  )
}
