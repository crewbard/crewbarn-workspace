import { useState } from 'react'
import {
  useAssetGroupTree,
  useCreateAssetGroup,
  useUpdateAssetGroup,
  useDeleteAssetGroup,
} from '@/hooks/useAssetGroups'
import { useCustomerServiceLocation } from '@/hooks/useCustomerServiceLocations'
import {
  locationDisplayName,
  formatLocationAddress,
} from '@/components/AssetGroupTreePicker'
import { Modal } from '@/components/ui/Modal'
import { AssetTreeBuilderModal } from '@/components/AssetTreeBuilderModal'
import type { AssetGroup } from '@/types/assetGroup'

/**
 * AssetGroupManagerModal — full CRUD on the group hierarchy of a single
 * service location. Add root, add child, rename inline, soft-delete.
 *
 * Move (re-parent) is intentionally NOT in v1 — needs a recursive picker
 * inside this picker, deferred. Backend already supports it (cycle-checked
 * in AssetGroupController@update) so wiring is small follow-up.
 *
 * Cascade delete of children is also not implemented yet (punchlist #9).
 * The delete confirm dialog warns the user when the group has descendants.
 */

interface AssetGroupManagerModalProps {
  isOpen: boolean
  onClose: () => void
  customerServiceLocationId: string
}

export function AssetGroupManagerModal({
  isOpen,
  onClose,
  customerServiceLocationId,
}: AssetGroupManagerModalProps) {
  const { data: tree, isLoading, isError } = useAssetGroupTree(
    isOpen ? customerServiceLocationId : undefined
  )
  const { data: location } = useCustomerServiceLocation(
    isOpen ? customerServiceLocationId : null
  )
  const createMutation = useCreateAssetGroup()
  const [newRootName, setNewRootName] = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locName = location ? locationDisplayName(location) : null
  const locAddr = location ? formatLocationAddress(location) : undefined

  async function handleAddRoot() {
    const name = newRootName.trim()
    if (!name) return
    setError(null)
    try {
      await createMutation.mutateAsync({
        customer_service_location_id: customerServiceLocationId,
        name,
      })
      setNewRootName('')
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={locName ? `Manage groups at ${locName}` : 'Manage groups'}
      subtitle={locAddr}
      size="lg"
    >
      <Modal.Body>
        {isLoading && (
          <div className="text-sm text-slate-500 py-4">Loading…</div>
        )}
        {isError && (
          <div className="text-sm text-red-600 py-4">Failed to load groups.</div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Build an asset tree</div>
                  <div className="text-xs text-amber-800">Use asset types plus floor, zone, room, or area counts to create groups and assets in one pass.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Build with CrewBarn
                </button>
              </div>
            </div>
            <div className="flex items-end gap-2 mb-4 pb-4 border-b border-slate-100">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Add root group
                </label>
                <input
                  type="text"
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRoot()
                  }}
                  placeholder='e.g. "Building C"'
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAddRoot}
                disabled={!newRootName.trim() || createMutation.isPending}
                className="text-sm px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {error && (
              <div className="text-xs text-red-600 mb-3">{error}</div>
            )}
            {(tree ?? []).length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-6">
                No groups yet. Add a root group above to get started.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(tree ?? []).map((root) => (
                  <ManagerBranch
                    key={root.id}
                    node={root}
                    customerServiceLocationId={customerServiceLocationId}
                    depth={0}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Modal.Body>
      <AssetTreeBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        customerServiceLocationId={customerServiceLocationId}
        defaultRootName={locName}
      />
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Done
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function ManagerBranch({
  node,
  customerServiceLocationId,
  depth,
}: {
  node: AssetGroup
  customerServiceLocationId: string
  depth: number
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(node.name)
  const [showAddChild, setShowAddChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useUpdateAssetGroup()
  const deleteMutation = useDeleteAssetGroup()
  const createMutation = useCreateAssetGroup()

  async function handleSaveRename() {
    const name = draftName.trim()
    if (!name) return
    setError(null)
    try {
      await updateMutation.mutateAsync({ id: node.id, input: { name } })
      setEditing(false)
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleDelete() {
    const childCount = (node.descendants ?? []).length
    const assetCount = node.assets_count ?? 0
    let confirmMsg = `Delete "${node.name}"?`
    if (childCount > 0) {
      confirmMsg += `\n\nWARNING: This group has ${childCount} child group(s). They will be orphaned (cascade not yet implemented).`
    }
    if (assetCount > 0) {
      confirmMsg += `\n\n${assetCount} asset(s) currently in this group. They will become unassigned.`
    }
    if (!confirm(confirmMsg)) return
    setError(null)
    try {
      await deleteMutation.mutateAsync(node.id)
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleAddChild() {
    const name = childName.trim()
    if (!name) return
    setError(null)
    try {
      await createMutation.mutateAsync({
        customer_service_location_id: customerServiceLocationId,
        parent_id: node.id,
        name,
      })
      setChildName('')
      setShowAddChild(false)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <>
      <li className="py-2">
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: depth * 20 }}
        >
          {depth > 0 && <span className="text-slate-300 text-xs">└</span>}
          {editing ? (
            <>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') {
                    setDraftName(node.name)
                    setEditing(false)
                  }
                }}
                className="flex-1 text-sm px-2 py-1 border border-amber-500 rounded focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={updateMutation.isPending}
                className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftName(node.name)
                  setEditing(false)
                }}
                className="text-xs px-2 py-1 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-slate-900 truncate">
                {node.name}
              </span>
              {node.assets_count !== undefined && (
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {node.assets_count} assets
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-amber-700 hover:text-amber-800 px-1.5"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setShowAddChild((v) => !v)}
                className="text-xs text-slate-700 hover:text-slate-900 px-1.5"
              >
                + Child
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-600 hover:text-red-800 px-1.5 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
        {showAddChild && (
          <div
            className="flex items-center gap-2 mt-2"
            style={{ paddingLeft: (depth + 1) * 20 }}
          >
            <span className="text-slate-300 text-xs">└</span>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddChild()
                if (e.key === 'Escape') {
                  setShowAddChild(false)
                  setChildName('')
                }
              }}
              placeholder='e.g. "Floor 3"'
              className="flex-1 text-sm px-2 py-1 border border-amber-500 rounded focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddChild}
              disabled={!childName.trim() || createMutation.isPending}
              className="text-xs px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddChild(false)
                setChildName('')
              }}
              className="text-xs px-2 py-1 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        )}
        {error && (
          <div
            className="text-xs text-red-600 mt-1"
            style={{ paddingLeft: depth * 20 }}
          >
            {error}
          </div>
        )}
      </li>
      {(node.descendants ?? []).map((child) => (
        <ManagerBranch
          key={child.id}
          node={child}
          customerServiceLocationId={customerServiceLocationId}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
