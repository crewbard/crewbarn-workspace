import { useState, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router-dom"
import {
  useAssets,
  useUpdateAsset,
  useDeleteAsset,
  useLookupAssetByCode,
} from "@/hooks/useAssets"
import { useAssetTypes } from "@/hooks/useAssetTypes"
import { useAssetDocuments } from "@/hooks/useAssetDocuments"
import { useAssetHistory } from "@/hooks/useAssetHistory"
import { useAssetPhotos } from "@/hooks/useAssetPhotos"
import { useAssetComponents } from "@/hooks/useAssetComponents"
import { ApiError, apiRequest } from "@/lib/api"
import { AssetComponentsManager } from "@/components/AssetComponentsManager"
import { AssetDocumentUploader } from "@/components/AssetDocumentUploader"
import { AssetPhotoUploader } from "@/components/AssetPhotoUploader"
import { AssetQrCard } from "@/components/AssetQrCard"
import { AssetGroupTreePicker } from "@/components/AssetGroupTreePicker"
import { AssetGroupManagerModal } from "@/components/AssetGroupManagerModal"
import { AssetHistoryTimeline } from "@/components/AssetHistoryTimeline"
import { AssetNoteBox } from '@/components/AssetNoteBox'
import { AssetCustomFieldsForm, assetCustomFieldsAreValid, normalizeAssetCustomFields } from "@/components/AssetCustomFieldsForm"
import { NewAssetWizardModal } from "@/components/NewAssetWizardModal"
import type { Asset, AssetServiceLocation } from "@/types/asset"
import type { AssetType, InspectionCadence } from "@/types/assetType"
import type { CustomerServiceLocation } from "@/types/customer"
import { INSPECTION_CADENCES, INSPECTION_CADENCE_LABELS } from "@/types/assetType"
import { QrScanButton } from "@/components/QrScanButton"
import { assetDocumentCategory, assetDocumentKindLabel, assetDocumentStatusLabel, assetDocumentVisibilityLabel } from "@/lib/assetDocumentLabels"

// ---------- Page ----------

/**
 * Mirrors Asset::PUBLIC_FIELDS. Gate codes are absent on purpose — they live
 * in secured_data, are never public under any setting, and only open through
 * an approved access request.
 */
const PUBLIC_FIELD_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'report', label: 'Inspection status', hint: 'Due date, cadence, and service history — what an inspector came for' },
  { key: 'physical', label: 'Make & model', hint: 'Manufacturer, model, serial, install date' },
  { key: 'location', label: 'Where it is', hint: 'Building and area path' },
  { key: 'documents', label: 'Shared documents', hint: 'Only files already marked shared' },
  { key: 'photos', label: 'Shared photos', hint: 'Only photos already marked shared' },
]

export function AssetsPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterTypeId, setFilterTypeId] = useState<string>("")
  const [filterLocationId, setFilterLocationId] = useState<string>("")
  const [filterGroupId, setFilterGroupId] = useState<string>("")
  const [filterGroupName, setFilterGroupName] = useState<string>("")
  const [editing, setEditing] = useState<Asset | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const lookupByCode = useLookupAssetByCode()

  // SLICE-2.5: scan handler — try direct lookup via the cache-aware hook.
  // Found → open the edit modal. Not found / error → put scanned value in
  // search box so the user can confirm what they scanned, plus toast.
  async function handleScan(code: string) {
    setScanError(null)
    try {
      const asset = await lookupByCode.mutateAsync(code)
      setEditing(asset)
    } catch (err) {
      setSearch(code)
      const message = err instanceof Error ? err.message : "Lookup failed"
      setScanError(`Scanned "${code}" — ${message}`)
      setTimeout(() => setScanError(null), 4000)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading, isError, error } = useAssets({
    asset_type_id: filterTypeId || undefined,
    customer_service_location_id: filterLocationId.trim() || undefined,
    asset_group_id: filterGroupId || undefined,
    q: debouncedSearch || undefined,
    per_page: 100,
  })

  const { data: typesData } = useAssetTypes({ active: true, per_page: 200 })
  const types = typesData?.data ?? []

  const assets = data?.data ?? []
  const meta = data?.meta

  // Deep-link support: `/assets?id={asset_id}` auto-opens that asset's
  // edit modal once data lands. Used by the Units page's "Installed at"
  // link (we don't have a dedicated /assets/:id detail route yet).
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkId = searchParams.get('id')
  useEffect(() => {
    if (!deepLinkId || editing) return
    const match = assets.find((a) => a.id === deepLinkId)
    if (match) {
      setEditing(match)
      // Strip the query so a back-then-forward doesn't keep re-opening it.
      const next = new URLSearchParams(searchParams)
      next.delete('id')
      setSearchParams(next, { replace: true })
    }
  }, [deepLinkId, assets, editing, searchParams, setSearchParams])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Header onNew={() => setShowCreate(true)} onScan={handleScan} hasTypes={types.length > 0} />
      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
          <p className="text-sm text-red-700">{scanError}</p>
        </div>
      )}

      <FiltersBar
        search={search}
        onSearchChange={setSearch}
        types={types}
        filterTypeId={filterTypeId}
        onFilterTypeChange={setFilterTypeId}
        filterLocationId={filterLocationId}
        onFilterLocationChange={(v) => {
          setFilterLocationId(v)
          // Group filter is location-scoped — clear it when location changes
          setFilterGroupId("")
          setFilterGroupName("")
        }}
        filterGroupId={filterGroupId}
        filterGroupName={filterGroupName}
        onFilterGroupChange={(id, name) => {
          setFilterGroupId(id ?? "")
          setFilterGroupName(name ?? "")
        }}
      />

      {types.length === 0 && !isLoading && <NoTypesNotice />}

      {isError && (
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-700">
            Failed to load assets.{error instanceof Error ? ` ${error.message}` : ""}
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

      {!isLoading && !isError && (
        <>
          {(() => {
            const filtersActive = !!(
              debouncedSearch ||
              filterTypeId ||
              filterLocationId ||
              filterGroupId
            )
            return filtersActive ? (
              <AssetsTable assets={assets} onEdit={setEditing} />
            ) : (
              <AssetsTree assets={assets} onEdit={setEditing} />
            )
          })()}
          {meta && (
            <div className="text-xs text-slate-500 text-right">
              Showing {assets.length} of {meta.total} assets
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
              {/*
                Of the ones SHOWN, deliberately: this counts what is on
                the page, and claiming a figure for the whole list from
                one page of it would be wrong in the direction that
                matters.
              */}
              {assets.some((a) => !a.verified_at) && (
                <span className="text-amber-700">
                  {" "}
                  · {assets.filter((a) => !a.verified_at).length} of these not confirmed on site
                </span>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <NewAssetWizardModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <EditAssetModal asset={editing} types={types} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

// ---------- Header ----------

function Header({ onNew, onScan, hasTypes }: { onNew: () => void; onScan: (code: string) => void; hasTypes: boolean }) {
  const { theme } = useTheme()
  const easy = theme === 'easy-side' || theme === 'easy-top'
  return (
    <div className={easy ? 'flex w-full min-w-0 flex-col items-stretch gap-4' : 'flex items-start justify-between gap-6'}>
      <div className={easy ? 'w-full min-w-0' : undefined}>
        {easy ? <EasyPageHeading title="Customer equipment & assets" description="Find or scan equipment, open its service history, or add an asset using the existing controls." /> : <h1 className="text-3xl font-semibold text-slate-900">Assets</h1>}
        <p className="text-sm text-slate-600 mt-1">
          Physical things at customer locations - doors, extinguishers, safes, AC units. Tracked across years.
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <QrScanButton
          onScan={onScan}
          buttonLabel="📷 Scan asset"
          buttonClassName="text-sm px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium transition-colors"
        />
        <button
          type="button"
          onClick={onNew}
          disabled={!hasTypes}
          title={!hasTypes ? "Create an asset type first" : ""}
          className="text-sm px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
        >
          + New Asset
        </button>
      </div>
    </div>
  )
}

// ---------- No Types Notice ----------

function NoTypesNotice() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <p className="text-sm text-amber-900">
        <strong>No asset types defined yet.</strong> Asset types are categories like "Fire Door" or "Extinguisher" - they define what custom fields each asset has. Create types in <a href="/asset-types" className="font-medium underline hover:text-amber-700">Asset Types</a> before adding assets.
      </p>
    </div>
  )
}

// ---------- Filters bar ----------

function FiltersBar({
  search,
  onSearchChange,
  types,
  filterTypeId,
  onFilterTypeChange,
  filterLocationId,
  onFilterLocationChange,
  filterGroupId,
  filterGroupName,
  onFilterGroupChange,
}: {
  search: string
  onSearchChange: (v: string) => void
  types: AssetType[]
  filterTypeId: string
  onFilterTypeChange: (v: string) => void
  filterLocationId: string
  onFilterLocationChange: (v: string) => void
  filterGroupId: string
  filterGroupName: string
  onFilterGroupChange: (id: string | null, name: string | null) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const trimmedLoc = filterLocationId.trim()
  const locReady = trimmedLoc.length > 0

  return (
    <div className="space-y-2">
      <div data-easy-list-toolbar className="flex gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, code, or serial number..."
          className="flex-1 text-sm px-4 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        />
        <select
          value={filterTypeId}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 bg-white min-w-[180px]"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon ? `${t.icon} ` : ""}{t.name}
            </option>
          ))}
        </select>
      </div>
      <div data-easy-list-toolbar className="flex gap-3 items-center">
        <input
          type="text"
          value={filterLocationId}
          onChange={(e) => onFilterLocationChange(e.target.value)}
          placeholder="Filter by location id (loc_xxx) — required to filter by group"
          className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:border-amber-500 font-mono"
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={!locReady}
          title={!locReady ? "Paste a location id first" : ""}
          className="text-sm px-3 py-2 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white min-w-[180px] text-left truncate"
        >
          {filterGroupId
            ? `Group: ${filterGroupName || filterGroupId}`
            : "All groups"}
        </button>
        {filterGroupId && (
          <button
            type="button"
            onClick={() => onFilterGroupChange(null, null)}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          disabled={!locReady}
          title={!locReady ? "Paste a location id first" : "Manage this location's groups"}
          className="text-xs text-amber-700 hover:text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Manage…
        </button>
      </div>

      {locReady && (
        <>
          <AssetGroupTreePicker
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            customerServiceLocationId={trimmedLoc}
            selectedGroupId={filterGroupId || null}
            onSelect={(id, group) => onFilterGroupChange(id, group?.name ?? null)}
            onManageClick={() => {
              setPickerOpen(false)
              setManagerOpen(true)
            }}
          />
          <AssetGroupManagerModal
            isOpen={managerOpen}
            onClose={() => setManagerOpen(false)}
            customerServiceLocationId={trimmedLoc}
          />
        </>
      )}
    </div>
  )
}

// ---------- Table ----------

function AssetsTable({ assets, onEdit }: { assets: Asset[]; onEdit: (a: Asset) => void }) {
  if (assets.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">
          No assets yet. Click "+ New Asset" to add one.
        </p>
      </div>
    )
  }

  return (
    <>
    {/* Mobile cards */}
    <div className="md:hidden space-y-2">
      {assets.map((asset) => (
        <div key={asset.id} className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-900 break-words">{asset.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                {asset.asset_type && (
                  <span className="inline-flex items-center gap-1">
                    {asset.asset_type.icon && <span>{asset.asset_type.icon}</span>}
                    {asset.asset_type.name}
                  </span>
                )}
                {asset.asset_code && (
                  <span className="font-mono">· {asset.asset_code}</span>
                )}
                {!asset.verified_at && <NotConfirmed />}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatLocation(asset.service_location)}
                {asset.asset_group?.name && <span> · {asset.asset_group.name}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {asset.is_secured && <span className="text-xs">🔒</span>}
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] rounded ${
                  asset.active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {asset.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {asset.service_location && (
              <Link
                to={`/estimates/new?customer_id=${asset.service_location.customer_id}&customer_service_location_id=${asset.customer_service_location_id}&asset_id=${asset.id}`}
                className="text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded hover:bg-amber-50"
              >
                + Estimate
              </Link>
            )}
            <button
              type="button"
              onClick={() => onEdit(asset)}
              className="text-xs px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
            >
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* Desktop table */}
    <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-6 py-3 font-medium">Type</th>
            <th className="text-left px-6 py-3 font-medium">Name</th>
            <th className="text-left px-6 py-3 font-medium">Code</th>
            <th className="text-left px-6 py-3 font-medium">Location</th>
            <th className="text-left px-6 py-3 font-medium">Group</th>
            <th className="text-left px-6 py-3 font-medium">Cadence</th>
            <th className="text-center px-6 py-3 font-medium" title="Coming with Slice 9 (secured assets)">Secured</th>
            <th className="text-center px-6 py-3 font-medium">Active</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => (
            <tr key={asset.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                {asset.asset_type ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-100 rounded">
                    {asset.asset_type.icon && <span>{asset.asset_type.icon}</span>}
                    <span>{asset.asset_type.name}</span>
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">-</span>
                )}
              </td>
              <td className="px-6 py-4 font-medium text-slate-900">
                <span className="inline-flex items-center gap-2">
                  {asset.name}
                  {!asset.verified_at && <NotConfirmed />}
                </span>
              </td>
              <td className="px-6 py-4 text-xs font-mono text-slate-600">
                {asset.asset_code || <span className="text-slate-300">-</span>}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">
                {formatLocation(asset.service_location)}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">
                {asset.asset_group?.name ?? <span className="text-slate-300">-</span>}
              </td>
              <td className="px-6 py-4 text-xs text-slate-600">
                {asset.inspection_cadence ? INSPECTION_CADENCE_LABELS[asset.inspection_cadence] : <span className="text-slate-300">-</span>}
              </td>
              <td className="px-6 py-4 text-center">
                {asset.is_secured ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded font-medium" title="SLICE-9: secured asset variant">🔒</span>
                ) : (
                  <span className="text-slate-300 text-xs">-</span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                {asset.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">Inactive</span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  {asset.service_location && (
                    <Link
                      to={`/estimates/new?customer_id=${asset.service_location.customer_id}&customer_service_location_id=${asset.customer_service_location_id}&asset_id=${asset.id}`}
                      className="text-sm text-amber-600 hover:text-amber-700"
                      title="Create new estimate for this asset"
                    >
                      + Estimate
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(asset)}
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
    </div>
    </>
  )
}

/**
 * Nobody has stood in front of this one.
 *
 * The tree builder turns "3 floors, 8 units each, 2 per unit" into
 * forty-eight rows in a second, and none of them corresponds to anything
 * until a tech records a condition against it. Unmarked, those rows are
 * indistinguishable from equipment somebody logged by hand — and they
 * are what a Schedule A is built from, what a report counts, and what a
 * customer is billed to visit.
 *
 * Marked on what is UNCONFIRMED rather than ticking what is confirmed:
 * on a property that has been walked this shows nothing at all, and the
 * few rows that need a second look are the ones that stand out.
 */
function NotConfirmed() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 rounded font-medium uppercase tracking-wide"
      title="Nobody has recorded a condition against this on site yet, so it may not be there."
    >
      Not confirmed
    </span>
  )
}

function formatLocation(loc: AssetServiceLocation | null): string {
  if (!loc) return "-"
  const parts = [loc.nickname, loc.city, loc.state].filter(Boolean)
  return parts.join(", ") || "-"
}

// ---------- Tree view ----------

/**
 * AssetsTree — mirrors the inventory bins tree.
 *
 *   📍 Service Location
 *     📦 Asset Group [GROUP]   (recursive — group can contain sub-groups)
 *       📦 Sub Group
 *         🚪 Asset
 *       🚪 Asset (direct in group)
 *     🚪 Asset (no group, direct at location)
 *
 * Built from the loaded assets array — each asset.service_location and
 * asset.asset_group provide enough info to assemble the tree client-side
 * without extra fetches. Empty groups (no assets) don't appear; manage
 * those via Manage… on the filter bar.
 */
function AssetsTree({
  assets,
  onEdit,
}: {
  assets: Asset[]
  onEdit: (a: Asset) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function expandAll() {
    const ids = new Set<string>()
    for (const a of assets) {
      if (a.service_location?.id) ids.add(a.service_location.id)
      if (a.asset_group?.id) ids.add(a.asset_group.id)
    }
    setExpanded(ids)
  }
  function collapseAll() {
    setExpanded(new Set())
  }

  // Bucket assets by service_location_id, then by asset_group_id (or null).
  const byLocation = useMemo(() => {
    const map = new Map<
      string,
      {
        location: AssetServiceLocation
        groups: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>
        ungrouped: Asset[]
      }
    >()
    for (const a of assets) {
      const loc = a.service_location
      if (!loc) continue
      let bucket = map.get(loc.id)
      if (!bucket) {
        bucket = { location: loc, groups: new Map(), ungrouped: [] }
        map.set(loc.id, bucket)
      }
      if (a.asset_group) {
        let g = bucket.groups.get(a.asset_group.id)
        if (!g) {
          g = { group: a.asset_group, assets: [] }
          bucket.groups.set(a.asset_group.id, g)
        }
        g.assets.push(a)
      } else {
        bucket.ungrouped.push(a)
      }
    }
    return map
  }, [assets])

  if (assets.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
        <p className="text-sm text-slate-600">
          No assets yet. Click "+ New Asset" to add one.
        </p>
      </div>
    )
  }

  const locations = Array.from(byLocation.values()).sort((a, b) =>
    (a.location.nickname ?? a.location.street_address ?? a.location.id).localeCompare(
      b.location.nickname ?? b.location.street_address ?? b.location.id
    )
  )

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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

      <div className="divide-y divide-slate-100">
        {locations.map((loc) => (
          <AssetLocationNode
            key={loc.location.id}
            location={loc.location}
            groups={loc.groups}
            ungrouped={loc.ungrouped}
            expanded={expanded}
            onToggle={toggle}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}

function AssetLocationNode({
  location,
  groups,
  ungrouped,
  expanded,
  onToggle,
  onEdit,
}: {
  location: AssetServiceLocation
  groups: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>
  ungrouped: Asset[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (a: Asset) => void
}) {
  const isOpen = expanded.has(location.id)
  const totalCount =
    Array.from(groups.values()).reduce((sum, g) => sum + g.assets.length, 0) +
    ungrouped.length

  // Build the recursive group tree from the groups Map. Roots = groups
  // whose parent_id is null OR whose parent group isn't in our map
  // (orphans bubble up to root). Each rendered tree node carries its
  // direct assets; children are looked up by parent_id.
  const groupArr = Array.from(groups.values())
  const knownIds = new Set(groupArr.map((g) => g.group.id))
  const roots = groupArr.filter(
    (g) => !g.group.parent_id || !knownIds.has(g.group.parent_id)
  )

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
        className="px-6 py-3 flex items-center gap-2 hover:bg-slate-50 cursor-pointer select-none group"
      >
        <span className="text-slate-400 text-sm w-4 text-center">
          {isOpen ? '▾' : '▸'}
        </span>
        <span className="text-base">📍</span>
        <span className="font-semibold text-slate-900">
          {location.nickname || location.street_address || location.id}
        </span>
        {(location.city || location.state) && (
          <span className="text-xs text-slate-500">
            {[location.city, location.state].filter(Boolean).join(', ')}
          </span>
        )}
        <span className="text-xs text-slate-500 font-mono">({totalCount})</span>
        {totalCount > 0 && (
          <span className="ml-auto flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              to={`/assets/labels?ids=${collectAllLocationAssetIds(groups, ungrouped).join(',')}&title=${encodeURIComponent(location.nickname || location.street_address || 'Location')}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-amber-700 hover:underline font-medium"
              title={`Print labels for all ${totalCount} asset${totalCount === 1 ? '' : 's'} at this location`}
            >
              🏷 Print all ({totalCount})
            </Link>
          </span>
        )}
      </div>

      {isOpen && (
        <>
          {roots.map((g) => (
            <AssetGroupNode
              key={g.group.id}
              group={g}
              groupsMap={groups}
              depth={1}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
          {ungrouped.map((a) => (
            <AssetLeafNode
              key={a.id}
              asset={a}
              depth={1}
              onEdit={onEdit}
            />
          ))}
        </>
      )}
    </div>
  )
}

function AssetGroupNode({
  group,
  groupsMap,
  depth,
  expanded,
  onToggle,
  onEdit,
}: {
  group: { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }
  groupsMap: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (a: Asset) => void
}) {
  const isOpen = expanded.has(group.group.id)
  const indentPx = 24 + depth * 24

  // Children of this group within the same location's groupsMap.
  const children = Array.from(groupsMap.values()).filter(
    (g) => g.group.parent_id === group.group.id
  )
  const directCount = group.assets.length
  const subCount = children.reduce(
    (sum, c) => sum + countDescendantAssets(c, groupsMap),
    0
  )
  const totalCount = directCount + subCount

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(group.group.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(group.group.id)
          }
        }}
        className="py-2 flex items-center gap-2 hover:bg-slate-50 cursor-pointer select-none group"
        style={{ paddingLeft: indentPx, paddingRight: 24 }}
      >
        <span className="text-slate-400 text-sm w-4 text-center">
          {isOpen ? '▾' : '▸'}
        </span>
        <span className="text-base">📦</span>
        <span className="font-medium text-slate-800">{group.group.name}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wide">
          GROUP
        </span>
        <span className="text-xs text-slate-400">({totalCount})</span>
        <span className="ml-auto flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* One QR for the area itself, separate from a sticker per asset —
              this is the lobby placard that opens the whole site. */}
          <Link
            to={`/asset-groups/${group.group.id}/labels`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-amber-700 hover:underline"
            title="Print a placard with one QR for this whole area"
          >
            🪧 Placard
          </Link>
          {totalCount > 0 && (
            <Link
              to={`/assets/labels?ids=${collectDescendantAssetIds(group, groupsMap).join(',')}&title=${encodeURIComponent(group.group.name)}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-amber-700 hover:underline font-medium"
              title={`Print labels for all ${totalCount} asset${totalCount === 1 ? '' : 's'} under this group`}
            >
              🏷 Print all ({totalCount})
            </Link>
          )}
        </span>
      </div>
      {isOpen && (
        <>
          {children.map((c) => (
            <AssetGroupNode
              key={c.group.id}
              group={c}
              groupsMap={groupsMap}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
          {group.assets.map((a) => (
            <AssetLeafNode
              key={a.id}
              asset={a}
              depth={depth + 1}
              onEdit={onEdit}
            />
          ))}
        </>
      )}
    </div>
  )
}

function countDescendantAssets(
  group: { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] },
  groupsMap: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>
): number {
  let n = group.assets.length
  for (const child of groupsMap.values()) {
    if (child.group.parent_id === group.group.id) {
      n += countDescendantAssets(child, groupsMap)
    }
  }
  return n
}

function collectAllLocationAssetIds(
  groups: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>,
  ungrouped: Asset[],
): string[] {
  const ids = ungrouped.map((a) => a.id)
  for (const g of groups.values()) {
    ids.push(...g.assets.map((a) => a.id))
  }
  return ids
}

function collectDescendantAssetIds(
  group: { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] },
  groupsMap: Map<string, { group: { id: string; name: string; parent_id: string | null }; assets: Asset[] }>
): string[] {
  const ids = group.assets.map((a) => a.id)
  for (const child of groupsMap.values()) {
    if (child.group.parent_id === group.group.id) {
      ids.push(...collectDescendantAssetIds(child, groupsMap))
    }
  }
  return ids
}

function AssetLeafNode({
  asset,
  depth,
  onEdit,
}: {
  asset: Asset
  depth: number
  onEdit: (a: Asset) => void
}) {
  const indentPx = 24 + depth * 24
  return (
    <div
      className="py-2 flex items-center gap-2 hover:bg-slate-50 group"
      style={{ paddingLeft: indentPx, paddingRight: 24 }}
    >
      <span className="w-4" />
      {asset.asset_type?.icon ? (
        <span className="text-base">{asset.asset_type.icon}</span>
      ) : (
        <span className="text-base text-slate-400">🚪</span>
      )}
      <span className="font-medium text-slate-800 truncate">{asset.name}</span>
      {asset.asset_type && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded font-medium uppercase tracking-wide">
          {asset.asset_type.name}
        </span>
      )}
      {asset.asset_code && (
        <span className="font-mono text-xs text-slate-400 truncate">{asset.asset_code}</span>
      )}
      {!asset.verified_at && <NotConfirmed />}
      {asset.is_secured && (
        <span className="text-xs" title="Secured asset">🔒</span>
      )}
      {!asset.active && (
        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
          Inactive
        </span>
      )}
      <span className="ml-auto flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {asset.service_location && (
          <Link
            to={`/estimates/new?customer_id=${asset.service_location.customer_id}&customer_service_location_id=${asset.customer_service_location_id}&asset_id=${asset.id}`}
            className="text-xs text-amber-700 hover:underline font-medium"
            title="Create new estimate for this asset"
          >
            + Estimate
          </Link>
        )}
        <Link
          to={`/assets/${asset.id}/labels`}
          target="_blank"
          className="text-xs text-slate-600 hover:text-amber-700"
          title="Print labels"
        >
          🏷 Print
        </Link>
        <button
          type="button"
          onClick={() => onEdit(asset)}
          className="text-xs text-slate-600 hover:text-amber-700"
        >
          Edit
        </button>
      </span>
    </div>
  )
}

// ---------- Form state ----------

type AssetFormState = {
  name: string
  asset_type_id: string
  customer_service_location_id: string
  asset_group_id: string | null
  asset_code: string
  manufacturer: string
  model: string
  serial_number: string
  install_date: string
  notes: string
  custom_fields: Record<string, unknown>
  inspection_cadence: InspectionCadence | ""
  is_secured: boolean
  public_fields: Record<string, boolean> | null
  active: boolean
}
type ServiceLocationPickerRow = CustomerServiceLocation & {
  customer?: { id: string; display_name: string } | null
}

type ServiceLocationPickerResponse = {
  data: ServiceLocationPickerRow[]
}

// Slice 13c: emptyForm previously consumed by the inline CreateAssetModal,
// which the NewAssetWizardModal replaced. The wizard manages its own form
// state internally. Edit modal still uses formStateFromAsset below.

function formStateFromAsset(asset: Asset): AssetFormState {
  return {
    // Coalesce the "required" fields too: the API can return one of these as
    // null for older/partial assets, and a null here makes the edit modal's
    // canSave (.trim()/.length) + the location .trim() throw on first render,
    // which silently blanks the whole page (no error boundary).
    name: asset.name ?? "",
    asset_type_id: asset.asset_type_id ?? "",
    customer_service_location_id: asset.customer_service_location_id ?? "",
    asset_group_id: asset.asset_group_id,
    asset_code: asset.asset_code ?? "",
    manufacturer: asset.manufacturer ?? "",
    model: asset.model ?? "",
    serial_number: asset.serial_number ?? "",
    install_date: asset.install_date?.slice(0, 10) ?? "",
    notes: asset.notes ?? "",
    custom_fields: asset.custom_fields ?? {},
    inspection_cadence: asset.inspection_cadence ?? "",
    is_secured: asset.is_secured,
    public_fields: asset.public_fields ?? null,
    active: asset.active,
  }
}

function formStateToInput(form: AssetFormState, assetType?: AssetType | null) {
  return {
    name: form.name.trim(),
    asset_type_id: form.asset_type_id,
    customer_service_location_id: form.customer_service_location_id,
    asset_group_id: form.asset_group_id,
    asset_code: form.asset_code.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    model: form.model.trim() || null,
    serial_number: form.serial_number.trim() || null,
    install_date: form.install_date || null,
    notes: form.notes.trim() || null,
    custom_fields: normalizeAssetCustomFields(form.custom_fields, assetType),
    inspection_cadence: form.inspection_cadence || null,
    is_secured: form.is_secured,
    public_fields: form.public_fields ?? undefined,
    active: form.active,
  }
}

// Slice 13c: CreateAssetModal removed in favor of NewAssetWizardModal
// (mounted at the AssetsPage + TopBar quick-create level). The new wizard
// walks Customer -> Location -> Group -> details with inline create at
// every step. EditAssetModal below is unchanged.

// ---------- Edit Modal ----------

function EditAssetModal({
  asset,
  types,
  onClose,
}: {
  asset: Asset
  types: AssetType[]
  onClose: () => void
}) {
  const [form, setForm] = useState<AssetFormState>(formStateFromAsset(asset))
  const initial = useMemo(() => formStateFromAsset(asset), [asset])

  const updateMutation = useUpdateAsset()
  const deleteMutation = useDeleteAsset()

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const selectedType = types.find((type) => type.id === form.asset_type_id)
  const canSave =
    form.name.trim().length > 0 &&
    form.asset_type_id.length > 0 &&
    form.customer_service_location_id.length > 0 &&
    assetCustomFieldsAreValid(selectedType, form.custom_fields) &&
    isDirty &&
    !updateMutation.isPending

  const handleSave = () => {
    updateMutation.mutate(
      { id: asset.id, input: formStateToInput(form, selectedType) },
      { onSuccess: () => onClose() }
    )
  }

  const handleDelete = () => {
    // Confirmation handled by the global delete modal (password + reason).
    deleteMutation.mutate(asset.id, { onSuccess: () => onClose() })
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
    <ModalShell title={`Edit: ${asset.name}`} onClose={onClose}>
      <AssetForm form={form} onChange={setForm} types={types} mode="edit" existingAsset={asset} />
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

// ---------- Asset Form ----------

function AssetForm({
  form,
  onChange,
  types,
  mode,
  existingAsset,
}: {
  form: AssetFormState
  onChange: (form: AssetFormState) => void
  types: AssetType[]
  mode: "create" | "edit"
  existingAsset?: Asset
}) {
  const set = (key: keyof AssetFormState, value: unknown) => {
    onChange({ ...form, [key]: value })
  }

  const selectedType = types.find((type) => type.id === form.asset_type_id)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [groupLabel, setGroupLabel] = useState<string>(
    existingAsset?.asset_group?.name ?? ""
  )
  const trimmedFormLoc = form.customer_service_location_id.trim()
  const formLocReady = trimmedFormLoc.length > 0

  // Auto-inherit cadence from the selected asset_type when type changes (create mode only)
  useEffect(() => {
    if (mode !== "create" || !form.asset_type_id) return
    const type = types.find((t) => t.id === form.asset_type_id)
    if (type?.default_inspection_cadence && !form.inspection_cadence) {
      onChange({ ...form, inspection_cadence: type.default_inspection_cadence })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.asset_type_id])

  return (
    <div className="p-6 space-y-4">
      <Field label="Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Door 4B, RTU-1, Main Lobby Safe"
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Asset type" required>
          <select
            value={form.asset_type_id}
            onChange={(e) => set("asset_type_id", e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">- Select type -</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon ? `${t.icon} ` : ""}{t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="CrewBarn asset code / QR sticker">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.asset_code}
              onChange={(e) => set("asset_code", e.target.value)}
              placeholder="Blank = CrewBarn generates"
              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
            <QrScanButton onScan={(code) => set("asset_code", code)} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            This is CrewBarn's internal asset identity and the code printed on the QR label. Leave blank to auto-generate one.
          </p>
        </Field>
      </div>

      <Field label="Service location" required>
        <ServiceLocationSelect
          value={form.customer_service_location_id}
          existingLocation={existingAsset?.service_location ?? null}
          disabled={mode === "edit"}
          onSelect={(location) => {
            const nextLoc = location.id
            onChange({
              ...form,
              customer_service_location_id: nextLoc,
              asset_group_id:
                nextLoc === form.customer_service_location_id ? form.asset_group_id : null,
            })
            if (nextLoc !== form.customer_service_location_id) {
              setGroupLabel("")
            }
          }}
        />
        <p className="text-xs text-slate-500 mt-1">
          Pick the saved customer service address this asset belongs to.
          {mode === "edit" && " Existing assets keep their original service location."}
        </p>
      </Field>

      <Field label="Group">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGroupPickerOpen(true)}
            disabled={!formLocReady}
            title={!formLocReady ? "Pick a service location first" : ""}
            className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-left truncate"
          >
            {form.asset_group_id
              ? groupLabel || form.asset_group_id
              : <span className="text-slate-400">No group</span>}
          </button>
          {form.asset_group_id && (
            <button
              type="button"
              onClick={() => {
                set("asset_group_id", null)
                setGroupLabel("")
              }}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setGroupManagerOpen(true)}
            disabled={!formLocReady}
            className="text-xs text-amber-700 hover:text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Manage…
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Optional sub-group within the service location (e.g. Building → Floor → Room).
        </p>
        {formLocReady && (
          <>
            <AssetGroupTreePicker
              isOpen={groupPickerOpen}
              onClose={() => setGroupPickerOpen(false)}
              customerServiceLocationId={trimmedFormLoc}
              selectedGroupId={form.asset_group_id}
              onSelect={(id, group) => {
                set("asset_group_id", id)
                setGroupLabel(group?.name ?? "")
              }}
              onManageClick={() => {
                setGroupPickerOpen(false)
                setGroupManagerOpen(true)
              }}
            />
            <AssetGroupManagerModal
              isOpen={groupManagerOpen}
              onClose={() => setGroupManagerOpen(false)}
              customerServiceLocationId={trimmedFormLoc}
            />
          </>
        )}
      </Field>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">Physical metadata</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Manufacturer">
            <input
              type="text"
              value={form.manufacturer}
              onChange={(e) => set("manufacturer", e.target.value)}
              placeholder="e.g. Curries"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <Field label="Model">
            <input
              type="text"
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="e.g. 747"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
            />
          </Field>
          <Field label="Manufacturer serial / VIN / UL label">
            <input
              type="text"
              value={form.serial_number}
              onChange={(e) => set("serial_number", e.target.value)}
              placeholder="Optional if the asset has no factory serial"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use this for the factory, VIN, UL, or inspector serial. If blank, reports use the CrewBarn internal ID instead.
            </p>
            {!form.serial_number.trim() && (
              <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                Report fallback: {form.asset_code.trim() ? `CrewBarn internal ID ${form.asset_code.trim()}` : "CrewBarn will generate an internal ID on save"}
              </p>
            )}
          </Field>
        </div>
        <Field label="Install date">
          <input
            type="date"
            value={form.install_date}
            onChange={(e) => set("install_date", e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
          />
        </Field>
      </div>

      <AssetCustomFieldsForm
        assetType={selectedType}
        values={form.custom_fields}
        onChange={(customFields) => set("custom_fields", customFields)}
      />

      <Field label="Notes (internal)">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything you want to remember about this asset"
          rows={2}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 resize-y"
        />
      </Field>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">Inspection</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cadence">
            <select
              value={form.inspection_cadence}
              onChange={(e) => set("inspection_cadence", e.target.value as InspectionCadence | "")}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">- Inherit from type -</option>
              {INSPECTION_CADENCES.map((c) => (
                <option key={c} value={c}>
                  {INSPECTION_CADENCE_LABELS[c]}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Defaults to the type's cadence. Override here for exceptions.
            </p>
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
                <span className="text-sm text-slate-700">{form.active ? "Active" : "Inactive"}</span>
              </label>
            </div>
          </Field>
        </div>
      </div>

      <div className="-mx-6 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.is_secured}
            onChange={(e) => set("is_secured", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-900">🔒 Secured asset</label>
            <p className="mt-1 text-xs text-slate-500">
              Gate codes, key schedules, and other sensitive notes are stored encrypted and only
              open through an access request you approve. That stays true whatever you publish
              below.
            </p>
          </div>
        </div>

        {/* The point of the split: locking a gate code used to hide the
            inspection history too, so the safe choice and the useful choice
            were the same switch pointing opposite ways. */}
        <div className="mt-4 border-t border-slate-200 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            What a public scan shows
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {form.is_secured
              ? 'This asset is secured, so everything here is hidden unless you publish it.'
              : 'This asset is open, so everything here is shown unless you hide it.'}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PUBLIC_FIELD_OPTIONS.map((f) => {
              const map = form.public_fields
              const on = map ? (map[f.key] ?? !form.is_secured) : !form.is_secured
              return (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      set("public_fields", {
                        ...(form.public_fields ?? {}),
                        [f.key]: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-800">{f.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{f.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {form.public_fields && (
            <button
              type="button"
              onClick={() => set("public_fields", null)}
              className="mt-2 text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              Reset to the default for a {form.is_secured ? 'secured' : 'open'} asset
            </button>
          )}
        </div>
      </div>

      {existingAsset && (
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
          Display label: <span className="font-medium">{existingAsset.display_label}</span>
        </p>
      )}

      {/* Photos + stubs for future slices — only on edit since asset must exist */}
      {mode === "edit" && existingAsset && (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">Asset report packet</h3>
          <AssetReportPacket asset={existingAsset} />

          <div className="flex items-center justify-between mb-3 mt-6">
            <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide">QR sticker</h3>
            <a
              href={`/assets/${existingAsset.id}/labels`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-700 hover:underline font-medium"
            >
              🏷 Print labels (sheet / thermal)
            </a>
          </div>
          <AssetQrCard
            assetId={existingAsset.id}
            assetName={existingAsset.name}
            assetCode={existingAsset.asset_code} />
        
         <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3">Photos</h3>
          <AssetPhotoUploader assetId={existingAsset.id} />
          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3 mt-6">Documents</h3>
          <AssetDocumentUploader assetId={existingAsset.id} />
          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3 mt-6">Installed components</h3>
          <AssetComponentsManager assetId={existingAsset.id} />

          <h3 className="text-xs font-medium text-slate-700 uppercase tracking-wide mb-3 mt-6">Service history</h3>
          <p className="text-xs text-slate-500 mb-3">
            Quotes and jobs that reference this item, parts installed against it, and what techs
            logged or noted on site. Newest first.
          </p>
          {/*
            Above the timeline, not below it. Writing a note is the thing
            somebody came here to do; reading the history is what they do
            on the way past.
          */}
          <div className="mb-3">
            <AssetNoteBox assetId={existingAsset.id} />
          </div>
          <AssetHistoryTimeline assetId={existingAsset.id} />
        </div>
      )}
    </div>
  )
}

function AssetReportPacket({ asset }: { asset: Asset }) {
  const { data: documents = [], isLoading: docsLoading } = useAssetDocuments(asset.id)
  const { data: photos = [], isLoading: photosLoading } = useAssetPhotos(asset.id)
  const { data: history = [], isLoading: historyLoading } = useAssetHistory(asset.id)
  const { data: components = [], isLoading: componentsLoading } = useAssetComponents(asset.id)

  const location = asset.service_location
  const locationLabel = formatAssetLocation(location)
  const groupLabel = asset.asset_group?.name ?? "No group selected"
  const warnings = buildAssetReportWarnings(asset, documents.length, photos.length, history.length)
  const latestHistory = history.slice(0, 3)
  const hasManufacturerSerial = Boolean(asset.serial_number)
  const serialDisplay = asset.serial_number ?? (asset.asset_code ? `CrewBarn internal ID: ${asset.asset_code}` : "Not captured")

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-1">Warnings</div>
          <ul className="space-y-1 text-xs text-amber-900">
            {warnings.map((warning) => (<li key={warning}>{warning}</li>))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReportCard title="Asset / equipment">
          <ReportRow label="Asset" value={asset.name} />
          <ReportRow label="Type" value={asset.asset_type?.name ?? "Not set"} />
          <ReportRow label="CrewBarn internal ID" value={asset.asset_code ?? "System will generate or add sticker code"} mono />
          <ReportRow label="Manufacturer" value={asset.manufacturer ?? "Not captured"} />
          <ReportRow label="Model" value={asset.model ?? "Not captured"} />
          <ReportRow label="Serial" value={serialDisplay} mono />
          <ReportRow label="Serial source" value={hasManufacturerSerial ? "Manufacturer / VIN / UL label" : asset.asset_code ? "CrewBarn internal asset code" : "Not captured"} />
          <ReportRow label="Secured" value={asset.is_secured ? "Yes - access gated" : "No"} />
        </ReportCard>

        <ReportCard title="Location / tree">
          <ReportRow label="Service location" value={locationLabel} />
          <ReportRow label="Group" value={groupLabel} />
          <ReportRow label="Display" value={asset.display_label} />
          <ReportRow label="Install date" value={formatAssetReportDate(asset.install_date)} />
          <ReportRow label="Inspection cadence" value={asset.inspection_cadence ? INSPECTION_CADENCE_LABELS[asset.inspection_cadence] : "Inherited from type"} />
          <ReportRow label="Next due" value={formatAssetReportDate(asset.next_inspection_due_at)} />
        </ReportCard>

        <ReportCard title="Files needed / linked files">
          <ReportChecklistItem label="QR sticker is assigned" done={Boolean(asset.asset_code)} />
          <ReportChecklistItem label="Asset identity is report-ready" done={Boolean(asset.serial_number || asset.asset_code)} />
          <ReportChecklistItem label="At least one asset photo is attached" done={photos.length > 0} loading={photosLoading} />
          <ReportChecklistItem label="Manual, report, or supporting document is attached" done={documents.length > 0} loading={docsLoading} />
          <ReportChecklistItem label="Work history is tied to this asset" done={history.length > 0} loading={historyLoading} />
          <ReportChecklistItem label="Installed inventory components are tracked" done={components.length > 0} loading={componentsLoading} />
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
            Document numbers, report status, and visibility are now tracked. AHJ packets and signed report generation ship in the report engine slice.
          </div>
        </ReportCard>

        <ReportCard title="Report sources">
          <ReportRow label="Photos" value={photosLoading ? "Loading..." : `${photos.length} linked`} />
          <ReportRow label="Documents" value={docsLoading ? "Loading..." : `${documents.length} linked`} />
          <ReportRow label="History" value={historyLoading ? "Loading..." : `${history.length} events`} />
          <ReportRow label="Installed components" value={componentsLoading ? "Loading..." : `${components.length} linked`} />
          <ReportRow label="Inventory bridge" value={components.length > 0 ? "Inventory parts installed on this asset" : "Ready for installed parts from jobs"} />
          <ReportRow label="Status" value={asset.active ? "Active" : "Inactive"} />
          {asset.notes && <ReportRow label="Internal notes" value={asset.notes} />}
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReportCard title="Document links">
          {docsLoading ? (
            <p className="text-xs text-slate-500">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-slate-500">No files attached yet. Upload forms, manuals, work orders, inspection PDFs, or AHJ docs below.</p>
          ) : (
            <ul className="space-y-2">
              {documents.slice(0, 6).map((doc) => {
                const category = assetDocumentCategory(doc)
                return (
                  <li key={doc.id} className="flex items-center justify-between gap-3 rounded border border-slate-100 bg-white px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={"inline-flex flex-shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold " + category.className}>{category.label}</span>
                        <div className="truncate text-xs font-medium text-slate-800">{doc.title}</div>
                      </div>
                      <div className="truncate text-[11px] text-slate-500">{doc.document_number} · {assetDocumentKindLabel(doc)} · {assetDocumentStatusLabel(doc.document_status)} · {assetDocumentVisibilityLabel(doc.visibility)} · {doc.original_filename ?? "CrewBarn document"}{doc.size_bytes ? ` · ${formatAssetReportBytes(doc.size_bytes)}` : ""}</div>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-amber-700 hover:underline flex-shrink-0">Open</a>
                    )}
                  </li>
                )
              })}
              {documents.length > 6 && <li className="text-xs text-slate-500">+ {documents.length - 6} more below</li>}
            </ul>
          )}
        </ReportCard>

        <ReportCard title="Asset photos">
          {photosLoading ? (
            <p className="text-xs text-slate-500">Loading photos...</p>
          ) : photos.length === 0 ? (
            <p className="text-xs text-slate-500">No photos attached yet. Add overview, label, close-up, and before/after photos below.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((photo, index) => {
                const imageUrl = photo.thumb_url || photo.medium_url || photo.full_url
                return (
                  <a
                    key={photo.id}
                    href={photo.full_url || photo.medium_url || imageUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded border border-slate-100 bg-white p-1 hover:border-amber-200"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={photo.caption || photo.original_filename || `Asset photo ${index + 1}`} className="h-16 w-full rounded object-cover" />
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded bg-slate-100 text-[11px] text-slate-500">Photo</div>
                    )}
                    <div className="mt-1 truncate text-[11px] text-slate-500 group-hover:text-amber-700">
                      {photo.caption || photo.original_filename || `Photo ${index + 1}`}
                    </div>
                  </a>
                )
              })}
              {photos.length > 6 && <div className="flex h-16 items-center justify-center rounded border border-slate-100 bg-white text-[11px] text-slate-500">+ {photos.length - 6} more</div>}
            </div>
          )}
        </ReportCard>

        <ReportCard title="Installed components">
          {componentsLoading ? (
            <p className="text-xs text-slate-500">Loading installed components...</p>
          ) : components.length === 0 ? (
            <p className="text-xs text-slate-500">No inventory units are installed on this asset yet. Installed parts from jobs will appear here.</p>
          ) : (
            <ul className="space-y-2">
              {components.slice(0, 6).map((component) => (
                <li key={component.inventory_unit_id} className="rounded border border-slate-100 bg-white px-2 py-1.5">
                  <div className="text-xs font-medium text-slate-800 truncate">{reportComponentTitle(component)}</div>
                  <div className="text-[11px] text-slate-500">{reportComponentMeta(component)}</div>
                </li>
              ))}
              {components.length > 6 && <li className="text-xs text-slate-500">+ {components.length - 6} more installed components below</li>}
            </ul>
          )}
        </ReportCard>

        <ReportCard title="Latest linked work">
          {historyLoading ? (
            <p className="text-xs text-slate-500">Loading history...</p>
          ) : latestHistory.length === 0 ? (
            <p className="text-xs text-slate-500">No jobs, estimates, inspections, or inventory movements are tied to this asset yet.</p>
          ) : (
            <ul className="space-y-2">
              {latestHistory.map((event) => (
                <li key={`${event.type}-${event.event_id}`} className="rounded border border-slate-100 bg-white px-2 py-1.5">
                  <div className="text-xs font-medium text-slate-800 truncate">{reportHistoryTitle(event)}</div>
                  <div className="text-[11px] text-slate-500">{reportHistoryMeta(event)}</div>
                </li>
              ))}
            </ul>
          )}
        </ReportCard>
      </div>
    </section>
  )
}

function ServiceLocationSelect({
  value,
  existingLocation,
  disabled,
  onSelect,
}: {
  value: string
  existingLocation: AssetServiceLocation | null
  disabled: boolean
  onSelect: (location: ServiceLocationPickerRow) => void
}) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (existingLocation) {
      setSelectedLabel(formatAssetLocation(existingLocation))
    }
  }, [existingLocation])

  const query = useQuery({
    queryKey: ["asset-service-location-picker", debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ per_page: "30" })
      if (debouncedSearch) params.set("q", debouncedSearch)
      return apiRequest<ServiceLocationPickerResponse>(
        `/v1/customer-service-locations?${params.toString()}`
      )
    },
    enabled: !disabled && open,
  })

  if (disabled) {
    return (
      <input
        type="text"
        value={existingLocation ? formatAssetLocation(existingLocation) : value}
        disabled
        className="w-full text-sm px-3 py-2 border border-slate-200 rounded bg-slate-50 text-slate-600"
      />
    )
  }

  const rows = query.data?.data ?? []
  const displayValue = open ? search : selectedLabel

  return (
    <div className="relative">
      <input
        type="search"
        value={displayValue}
        onFocus={() => {
          setOpen(true)
          setSearch("")
        }}
        onChange={(e) => {
          setOpen(true)
          setSearch(e.target.value)
          setSelectedLabel("")
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search customer, nickname, street, city, or ZIP"
        className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-auto">
          {query.isLoading && (
            <div className="px-3 py-3 text-sm text-slate-500">Loading service locations...</div>
          )}
          {query.isError && (
            <div className="px-3 py-3 text-sm text-red-700">Failed to load service locations.</div>
          )}
          {!query.isLoading && !query.isError && rows.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">
              {debouncedSearch ? "No saved locations match that search." : "No saved service locations found."}
            </div>
          )}
          {rows.map((location) => {
            const label = formatPickerLocation(location)
            return (
              <button
                key={location.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(location)
                  setSelectedLabel(label)
                  setSearch("")
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-slate-100 last:border-b-0 ${
                  location.id === value ? "bg-amber-50" : ""
                }`}
              >
                <div className="text-sm font-medium text-slate-900">
                  {location.nickname || location.address.street_address || "Untitled location"}
                </div>
                <div className="text-xs text-slate-500">
                  {location.customer?.display_name ? `${location.customer.display_name} - ` : ""}
                  {formatCustomerLocationAddress(location)}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-slate-900 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function ReportRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-xs">
      <div className="font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={(mono ? "font-mono " : "") + "text-slate-700 whitespace-pre-wrap break-words"}>{value}</div>
    </div>
  )
}

function ReportChecklistItem({ label, done, loading }: { label: string; done: boolean; loading?: boolean }) {
  const status = loading ? "Checking" : done ? "Ready" : "Needed"
  const statusClass = loading ? "text-slate-500" : done ? "text-emerald-700" : "text-amber-700"
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-700">{label}</span>
      <span className={"font-semibold " + statusClass}>{status}</span>
    </div>
  )
}

function buildAssetReportWarnings(asset: Asset, documentCount: number, photoCount: number, historyCount: number): string[] {
  const warnings: string[] = []
  if (!asset.asset_code) warnings.push("No QR/sticker code is assigned yet.")
  if (!asset.asset_type) warnings.push("Asset type is missing; report templates cannot be selected reliably.")
  if (!asset.service_location) warnings.push("Service location details are missing from this report.")
  if (!asset.asset_group) warnings.push("No building/floor/group path is selected.")
  if (!asset.serial_number && !asset.asset_code) warnings.push("No manufacturer serial and no CrewBarn internal ID are available yet.")
  if (photoCount === 0) warnings.push("No asset photo is attached.")
  if (documentCount === 0) warnings.push("No manuals, reports, or supporting files are attached.")
  if (historyCount === 0) warnings.push("No job, estimate, inspection, or inventory history is linked yet.")
  if (asset.is_secured) warnings.push("This is a secured asset; public QR output must stay access-gated.")
  return warnings
}

function formatAssetLocation(location: AssetServiceLocation | null): string {
  if (!location) return "Not captured"
  const parts = [location.nickname, location.street_address, location.city, location.state, location.postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "Not captured"
}

function formatPickerLocation(location: ServiceLocationPickerRow): string {
  const customer = location.customer?.display_name?.trim()
  const address = formatCustomerLocationAddress(location)
  return [customer, location.nickname?.trim(), address].filter(Boolean).join(" - ")
}

function formatCustomerLocationAddress(location: ServiceLocationPickerRow): string {
  const formatted = location.address.formatted?.trim()
  if (formatted) return formatted
  return [
    location.address.street_address,
    location.address.apt_unit,
    location.address.city,
    location.address.state,
    location.address.postal_code,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ") || "No address captured"
}

function formatAssetReportDate(value: string | null | undefined): string {
  if (!value) return "Not captured"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function formatAssetReportBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function reportComponentTitle(component: { catalog_item?: { name: string; sku: string | null }; serial_number: string }): string {
  const name = component.catalog_item?.name ?? "Installed inventory unit"
  const sku = component.catalog_item?.sku ? ` (${component.catalog_item.sku})` : ""
  return `${name}${sku}`
}

function reportComponentMeta(component: { serial_number: string; status: string; installed_at: string | null; notes: string | null }): string {
  const pieces = [`Serial ${component.serial_number || "not captured"}`, component.status]
  if (component.installed_at) pieces.push(`Installed ${formatAssetReportDate(component.installed_at)}`)
  if (component.notes) pieces.push(component.notes)
  return pieces.filter(Boolean).join(" · ")
}

function reportHistoryTitle(event: { type: string; description?: string; catalog_item_name?: string | null }): string {
  if (event.type === "inventory_movement") return event.catalog_item_name ? `Inventory: ${event.catalog_item_name}` : "Inventory movement"
  if (event.type === "inspection_record") return event.description || "Inspection report"
  if (event.type === "estimate_line") return event.description || "Estimate line"
  if (event.type === "work_order_line") return event.description || "Work order line"
  return event.description || "Asset event"
}

function reportHistoryMeta(event: { type: string; event_date: string | null; parent?: { display_number?: string; number: string | number; status: string } | null }): string {
  const pieces = [event.type.replace(/_/g, " ")]
  if (event.parent) pieces.push(`${event.parent.display_number ?? event.parent.number} · ${event.parent.status}`)
  if (event.event_date) pieces.push(formatAssetReportDate(event.event_date))
  return pieces.join(" · ")
}

// ---------- Modal infrastructure (shared with other pages) ----------

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
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
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
import { useTheme } from '@/hooks/useTheme'
import { EasyPageHeading } from '@/components/easy/EasyPageHeading'
