import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useAssetTypes } from '@/hooks/useAssetTypes'
import {
  useCreateAssetTreeBuilder,
  usePreviewAssetTreeBuilder,
} from '@/hooks/useAssetGroups'
import type {
  AssetTreeBuilderBranch,
  AssetTreeBuilderCreateResponse,
  AssetTreeBuilderPayload,
  AssetTreeBuilderPreview,
} from '@/types/assetGroup'

interface AssetTreeBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  customerServiceLocationId: string
  defaultRootName?: string | null
}

interface BranchDraft {
  path: string
  code: string
  count: string
}

const TRADE_PRESETS: Record<string, BranchDraft[]> = {
  fire_doors: [
    { path: 'Floor 1', code: 'F1', count: '10' },
    { path: 'Floor 2', code: 'F2', count: '10' },
    { path: 'Floor 3', code: 'F3', count: '8' },
  ],
  extinguishers: [
    { path: 'Floor 1 / East Wing', code: 'F1E', count: '4' },
    { path: 'Floor 1 / West Wing', code: 'F1W', count: '4' },
    { path: 'Floor 2 / Common Area', code: 'F2C', count: '3' },
  ],
  cameras: [
    { path: 'Exterior', code: 'EXT', count: '6' },
    { path: 'Interior / Lobby', code: 'LOBBY', count: '2' },
    { path: 'Interior / Stock Room', code: 'STOCK', count: '2' },
  ],
  access_control: [
    { path: 'Main Entry', code: 'MAIN', count: '2' },
    { path: 'Back Entry', code: 'BACK', count: '1' },
    { path: 'Office Area', code: 'OFFICE', count: '4' },
  ],
}

export function AssetTreeBuilderModal({
  isOpen,
  onClose,
  customerServiceLocationId,
  defaultRootName,
}: AssetTreeBuilderModalProps) {
  const { data: assetTypes } = useAssetTypes({ active: true, per_page: 200 })
  const types = assetTypes?.data ?? []
  const [assetTypeId, setAssetTypeId] = useState('')
  const selectedType = types.find((type) => type.id === assetTypeId)
  const [rootName, setRootName] = useState(defaultRootName || 'Main building')
  const [assetNamePrefix, setAssetNamePrefix] = useState('')
  const [assetCodePrefix, setAssetCodePrefix] = useState('')
  const [rows, setRows] = useState<BranchDraft[]>([
    { path: 'Floor 1', code: 'F1', count: '10' },
    { path: 'Floor 2', code: 'F2', count: '10' },
    { path: 'Floor 3', code: 'F3', count: '8' },
  ])
  const [preview, setPreview] = useState<AssetTreeBuilderPreview | null>(null)
  const [createdResult, setCreatedResult] = useState<AssetTreeBuilderCreateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const previewMutation = usePreviewAssetTreeBuilder()
  const createMutation = useCreateAssetTreeBuilder()

  const payload = useMemo<AssetTreeBuilderPayload | null>(() => {
    const branches: AssetTreeBuilderBranch[] = rows
      .map((row) => ({
        path: row.path.trim(),
        code: row.code.trim().toUpperCase() || null,
        asset_count: Number.parseInt(row.count, 10) || 0,
      }))
      .filter((row) => row.path && row.asset_count > 0)

    if (!customerServiceLocationId || !assetTypeId || !rootName.trim() || branches.length === 0) {
      return null
    }

    return {
      customer_service_location_id: customerServiceLocationId,
      asset_type_id: assetTypeId,
      root_name: rootName.trim(),
      asset_name_prefix: assetNamePrefix.trim() || selectedType?.name || null,
      asset_code_prefix: assetCodePrefix.trim().toUpperCase() || suggestedCodePrefix(selectedType?.name),
      branches,
    }
  }, [assetCodePrefix, assetNamePrefix, assetTypeId, customerServiceLocationId, rootName, rows, selectedType?.name])

  function resetCreatedState() {
    setCreatedResult(null)
  }

  function handleClose() {
    setCreatedResult(null)
    setPreview(null)
    setError(null)
    onClose()
  }

  function applyPreset(key: keyof typeof TRADE_PRESETS) {
    resetCreatedState()
    setRows(TRADE_PRESETS[key])
    setPreview(null)
  }

  async function handlePreview() {
    if (!payload) {
      setError('Select an asset type and add at least one path with a count.')
      return
    }
    setError(null)
    resetCreatedState()
    try {
      const result = await previewMutation.mutateAsync(payload)
      setPreview(result)
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function handleCreate() {
    if (!payload) return
    setError(null)
    try {
      const result = await createMutation.mutateAsync(payload)
      setCreatedResult(result)
      setPreview(result.preview)
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="CrewBarn asset builder"
      subtitle="Build the tree first, then finish each generated asset with photos, details, documents, components, and QR labels."
      size="xl"
    >
      <Modal.Body>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Asset type
                  <select
                    value={assetTypeId}
                    onChange={(event) => {
                      resetCreatedState()
                      const nextId = event.target.value
                      const type = types.find((item) => item.id === nextId)
                      setAssetTypeId(nextId)
                      if (type && !assetNamePrefix.trim()) setAssetNamePrefix(type.name)
                      if (type && !assetCodePrefix.trim()) setAssetCodePrefix(suggestedCodePrefix(type.name))
                      setPreview(null)
                    }}
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select asset type...</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Root group
                  <input
                    value={rootName}
                    onChange={(event) => {
                      resetCreatedState()
                      setRootName(event.target.value)
                      setPreview(null)
                    }}
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Asset name prefix
                  <input
                    value={assetNamePrefix}
                    onChange={(event) => {
                      resetCreatedState()
                      setAssetNamePrefix(event.target.value)
                      setPreview(null)
                    }}
                    placeholder={selectedType?.name || 'Fire Door'}
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Code prefix
                  <input
                    value={assetCodePrefix}
                    onChange={(event) => {
                      resetCreatedState()
                      setAssetCodePrefix(event.target.value.toUpperCase())
                      setPreview(null)
                    }}
                    placeholder="FD"
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm uppercase focus:border-amber-500 focus:outline-none"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Address layout rows</h3>
                  <p className="text-xs text-slate-500">Use paths like Floor 1 or Building A / Floor 2 / East Hall.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyPreset('fire_doors')} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Fire doors</button>
                  <button type="button" onClick={() => applyPreset('extinguishers')} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Extinguishers</button>
                  <button type="button" onClick={() => applyPreset('cameras')} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Cameras</button>
                  <button type="button" onClick={() => applyPreset('access_control')} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Access control</button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_96px_72px]">
                    <input
                      value={row.path}
                      onChange={(event) => updateRow(rows, setRows, index, { path: event.target.value }, setPreview, resetCreatedState)}
                      placeholder="Floor 1 / East Hall"
                      className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      value={row.code}
                      onChange={(event) => updateRow(rows, setRows, index, { code: event.target.value.toUpperCase() }, setPreview, resetCreatedState)}
                      placeholder="F1E"
                      className="rounded border border-slate-200 px-3 py-2 text-sm uppercase focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      value={row.count}
                      onChange={(event) => updateRow(rows, setRows, index, { count: event.target.value }, setPreview, resetCreatedState)}
                      placeholder="Count"
                      className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        resetCreatedState()
                        setRows(rows.filter((_, rowIndex) => rowIndex !== index))
                        setPreview(null)
                      }}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-40"
                      disabled={rows.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCreatedState()
                  setRows([...rows, { path: '', code: '', count: '1' }])
                  setPreview(null)
                }}
                className="mt-3 rounded border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                + Add row
              </button>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Preview before creating</h3>
              <p className="mt-1 text-xs text-amber-800">Nothing is saved until preview looks right and you click Create tree.</p>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewMutation.isPending}
                className="mt-3 w-full rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {previewMutation.isPending ? 'Building preview...' : 'Build preview'}
              </button>
            </section>

            {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {createdResult ? (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Tree created</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{createdResult.created.assets} assets are ready to finish</div>
                <p className="mt-1 text-sm text-slate-700">
                  CrewBarn created the group tree and asset shells. Use the asset list for this location to finish each asset one by one.
                </p>
                <div className="mt-4 rounded border border-emerald-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Finish workflow</div>
                  <ol className="mt-2 space-y-2 text-sm text-slate-700">
                    <li>1. Pick the first generated asset in the asset list or tree.</li>
                    <li>2. Confirm the name, code, type, group path, and cadence.</li>
                    <li>3. Add the asset photo, required docs/forms, components, and secure-data flag if needed.</li>
                    <li>4. Save, print/stick the QR label, then move to the next asset.</li>
                  </ol>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">First examples</div>
                  {createdResult.preview.examples.slice(0, 5).map((example) => (
                    <div key={example} className="rounded bg-white px-3 py-2 font-mono text-xs text-slate-700">{example}</div>
                  ))}
                </div>
              </section>
            ) : preview ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-lg font-semibold text-slate-900">{preview.total_nodes} records</div>
                <p className="text-sm text-slate-500">{preview.total_groups} groups and {preview.total_assets} assets will be created.</p>
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Examples</div>
                  {preview.examples.map((example) => (
                    <div key={example} className="rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{example}</div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                Build a preview to verify the tree before creating anything.
              </section>
            )}
          </aside>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
          {createdResult ? 'Close' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!preview || !!createdResult || createMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createdResult ? 'Tree created' : createMutation.isPending ? 'Creating...' : 'Create tree'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function updateRow(
  rows: BranchDraft[],
  setRows: (rows: BranchDraft[]) => void,
  index: number,
  patch: Partial<BranchDraft>,
  setPreview: (preview: AssetTreeBuilderPreview | null) => void,
  resetCreatedState: () => void
) {
  resetCreatedState()
  setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  setPreview(null)
}

function suggestedCodePrefix(name?: string | null): string {
  if (!name) return 'ASSET'
  const words = name.match(/[A-Za-z0-9]+/g) ?? []
  const prefix = words.map((word) => word[0]).join('').slice(0, 4).toUpperCase()
  return prefix || 'ASSET'
}

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
