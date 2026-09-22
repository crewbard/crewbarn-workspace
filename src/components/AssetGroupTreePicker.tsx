import { useEffect, useMemo, useState } from 'react'
import { useAssets } from '@/hooks/useAssets'
import { useAssetGroupTree } from '@/hooks/useAssetGroups'
import { useCustomerServiceLocation } from '@/hooks/useCustomerServiceLocations'
import { Modal } from '@/components/ui/Modal'
import type { Asset } from '@/types/asset'
import type { AssetGroup } from '@/types/assetGroup'
import type { CustomerServiceLocation } from '@/types/customer'

/**
 * AssetGroupTreePicker - modal for selecting a single group from the tree
 * of a given service location. Includes an "Unassigned" option for clearing.
 *
 * Used by AssetForm (set asset's group) and AssetsPage FiltersBar (filter).
 * The location id MUST be supplied by the caller - this picker doesn't
 * resolve locations itself. If onManageClick is passed, footer shows a
 * "Manage groups..." link to open the management modal.
 */

interface AssetGroupTreePickerProps {
  isOpen: boolean
  onClose: () => void
  customerServiceLocationId: string
  selectedGroupId?: string | null
  /** Modal closes automatically after selection. */
  onSelect: (groupId: string | null, group: AssetGroup | null) => void
  /** Optional "Manage groups..." link in footer. */
  onManageClick?: () => void
}

export function AssetGroupTreePicker({
  isOpen,
  onClose,
  customerServiceLocationId,
  selectedGroupId,
  onSelect,
  onManageClick,
}: AssetGroupTreePickerProps) {
  const { data: tree, isLoading, isError } = useAssetGroupTree(
    isOpen ? customerServiceLocationId : undefined
  )
  const { data: location } = useCustomerServiceLocation(
    isOpen ? customerServiceLocationId : null
  )
  const [previewGroup, setPreviewGroup] = useState<AssetGroup | null>(null)
  const previewGroupId = previewGroup?.id ?? null
  const previewQuery = useAssets(
    {
      customer_service_location_id: customerServiceLocationId,
      asset_group_id: previewGroupId ?? undefined,
      include_descendants: true,
      per_page: 12,
    },
    { enabled: isOpen && !!previewGroupId }
  )

  const flattenedGroups = useMemo(() => flattenGroups(tree ?? []), [tree])

  useEffect(() => {
    if (!isOpen) {
      setPreviewGroup(null)
      return
    }
    if (!previewGroup && selectedGroupId) {
      const selected = flattenedGroups.find((group) => group.id === selectedGroupId)
      if (selected) setPreviewGroup(selected)
    }
  }, [flattenedGroups, isOpen, previewGroup, selectedGroupId])

  function handlePick(groupId: string | null, group: AssetGroup | null) {
    onSelect(groupId, group)
    onClose()
  }

  const isNoneSelected = !selectedGroupId
  const isEmpty = !isLoading && !isError && (tree ?? []).length === 0
  const locName = location ? locationDisplayName(location) : null
  const locAddr = location ? formatLocationAddress(location) : undefined

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={locName ? `Pick a group at ${locName}` : 'Pick a group'}
      subtitle={locAddr}
      size="lg"
    >
      <Modal.Body>
        {isLoading && (
          <div className="text-sm text-slate-500 py-4">Loading groups...</div>
        )}
        {isError && (
          <div className="text-sm text-red-600 py-4">Failed to load groups.</div>
        )}

        {!isLoading && !isError && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <ul className="divide-y divide-slate-100">
                <PickerRow
                  label="(no group)"
                  italic
                  isSelected={isNoneSelected}
                  isPreviewed={!previewGroup}
                  depth={0}
                  onPreview={() => setPreviewGroup(null)}
                  onPick={() => handlePick(null, null)}
                />
                {(tree ?? []).map((root) => (
                  <GroupBranch
                    key={root.id}
                    node={root}
                    selectedGroupId={selectedGroupId ?? null}
                    previewGroupId={previewGroupId}
                    onPreview={setPreviewGroup}
                    onPick={handlePick}
                    depth={0}
                  />
                ))}
              </ul>

              {isEmpty && (
                <div className="text-xs text-slate-500 mt-3 text-center">
                  No groups yet for this location.
                  {onManageClick && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={onManageClick}
                        className="text-amber-700 hover:underline"
                      >
                        Add the first one
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <GroupAssetPreview
              group={previewGroup}
              assets={previewQuery.data?.data ?? []}
              total={previewQuery.data?.meta.total ?? 0}
              isLoading={previewQuery.isFetching}
              isError={previewQuery.isError}
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {onManageClick && (
          <button
            type="button"
            onClick={onManageClick}
            className="mr-auto text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            Manage groups...
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Cancel
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function GroupBranch({
  node,
  selectedGroupId,
  previewGroupId,
  onPreview,
  onPick,
  depth,
}: {
  node: AssetGroup
  selectedGroupId: string | null
  previewGroupId: string | null
  onPreview: (group: AssetGroup) => void
  onPick: (id: string | null, g: AssetGroup | null) => void
  depth: number
}) {
  return (
    <>
      <PickerRow
        label={node.name}
        countLabel={
          node.assets_count !== undefined ? `${node.assets_count} assets` : undefined
        }
        isSelected={node.id === selectedGroupId}
        isPreviewed={node.id === previewGroupId}
        depth={depth}
        onPreview={() => onPreview(node)}
        onPick={() => onPick(node.id, node)}
      />
      {(node.descendants ?? []).map((child) => (
        <GroupBranch
          key={child.id}
          node={child}
          selectedGroupId={selectedGroupId}
          previewGroupId={previewGroupId}
          onPreview={onPreview}
          onPick={onPick}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

function GroupAssetPreview({
  group,
  assets,
  total,
  isLoading,
  isError,
}: {
  group: AssetGroup | null
  assets: Asset[]
  total: number
  isLoading: boolean
  isError: boolean
}) {
  if (!group) {
    return (
      <aside className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-900">Location root</h3>
        <p className="mt-2">Click a group to preview the assets inside it before selecting.</p>
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{group.name}</h3>
          <p className="mt-1 text-xs text-slate-500">Assets in this group and child groups.</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
          {total}
        </span>
      </div>

      {isLoading && <p className="mt-4 text-sm text-slate-500">Loading assets...</p>}
      {isError && <p className="mt-4 text-sm text-red-600">Failed to load assets.</p>}
      {!isLoading && !isError && assets.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No assets are assigned under this group yet.</p>
      )}
      {!isLoading && !isError && assets.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <li key={asset.id} className="rounded-md bg-white border border-slate-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{asset.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {asset.asset_type?.name ?? 'Asset'}
                    {asset.asset_code ? ` - ${asset.asset_code}` : ''}
                  </p>
                </div>
                {asset.is_secured && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                    Secured
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > assets.length && (
        <p className="mt-2 text-xs text-slate-500">Showing first {assets.length} of {total}.</p>
      )}
    </aside>
  )
}

/**
 * Resolve the best human label for a service location.
 * Nickname wins; falls back to street address; else "Unnamed location".
 */
export function locationDisplayName(loc: CustomerServiceLocation): string {
  return loc.nickname || loc.address.street_address || 'Unnamed location'
}

/**
 * Joined address line for the modal subtitle. Prefers server-formatted.
 */
export function formatLocationAddress(
  loc: CustomerServiceLocation
): string | undefined {
  const addr = loc.address
  if (!addr) return undefined
  if (addr.formatted) return addr.formatted
  const parts = [addr.street_address, addr.apt_unit, addr.city, addr.state, addr.postal_code].filter(Boolean)
  const joined = parts.join(', ')
  return joined || undefined
}

function flattenGroups(groups: AssetGroup[]): AssetGroup[] {
  return groups.flatMap((group) => [group, ...flattenGroups(group.descendants ?? [])])
}

function PickerRow({
  label,
  countLabel,
  italic,
  isSelected,
  isPreviewed,
  depth,
  onPreview,
  onPick,
}: {
  label: string
  countLabel?: string
  italic?: boolean
  isSelected: boolean
  isPreviewed: boolean
  depth: number
  onPreview: () => void
  onPick: () => void
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded cursor-pointer ${
        isPreviewed ? 'bg-slate-100' : isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
      }`}
      onClick={onPreview}
    >
      <div
        className="flex items-center gap-2 min-w-0 flex-1"
        style={{ paddingLeft: depth * 20 }}
      >
        {depth > 0 && <span className="text-slate-300 text-xs">└</span>}
        <span
          className={`text-sm truncate ${
            italic ? 'italic text-slate-500' : 'text-slate-900'
          }`}
        >
          {label}
        </span>
        {countLabel && (
          <span className="text-xs text-slate-500 flex-shrink-0">
            · {countLabel}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onPick()
        }}
        disabled={isSelected}
        className="text-xs px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        {isSelected ? 'Selected' : 'Use this'}
      </button>
    </li>
  )
}
