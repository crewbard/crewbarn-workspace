import { useMemo, useState } from 'react'
import { buildAssetTreeWithAi } from '@/lib/assetGroups'
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
  /**
   * The schedule's own rows, when one was read.
   *
   * Carried untouched from the reply to the create call: these are
   * the numbers stencilled on the frames. Typing over the count drops
   * them, because a list of six beside a count of forty is a promise
   * the create call does not keep.
   */
  assets?: { name: string; tag: string | null }[]
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
  /*
   * The office is where the spreadsheet is. This existed only on the
   * phone, so whoever held the customer's schedule had to retype it
   * as a sentence — which threw away every number on it.
   */
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState('')
  const [instruction, setInstruction] = useState('')
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [questions, setQuestions] = useState<
    { id: string; text: string; options: string[] }[]
  >([])
  const [editedFrom, setEditedFrom] = useState<number | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  /** Build a draft, or change the one on screen. One call either way. */
  const runAi = async (change?: string) => {
    if (!change && !description.trim() && !schedule.trim()) {
      setError('Describe the property, or paste a schedule.')
      return
    }

    setAiBusy(true)
    setError(null)
    setPreview(null)

    try {
      const res = await buildAssetTreeWithAi({
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(schedule.trim() ? { schedule: schedule.trim() } : {}),
        ...(change
          ? {
              instruction: change,
              // The rows as they stand, corrections and all. Rebuilding
              // from the description would undo work done by hand.
              current: rows
                .filter((r) => r.path.trim() !== '')
                .map((r) => ({
                  path: r.path.trim(),
                  code: r.code.trim().toUpperCase() || null,
                  asset_count: Number.parseInt(r.count, 10) || 0,
                  ...(r.assets?.length ? { assets: r.assets } : {}),
                })),
            }
          : {}),
        asset_type_name: selectedType?.name,
      })

      if (res.root_name) setRootName(res.root_name)
      setAssumptions(res.assumptions ?? [])
      setQuestions(res.questions ?? [])
      setEditedFrom(res.edited_from ?? null)
      if (change) setInstruction('')
      setRows(
        (res.branches ?? []).map((b) => ({
          path: b.path,
          code: b.code ?? '',
          count: String(b.asset_count ?? 1),
          assets: b.assets?.length ? b.assets : undefined,
        })),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The builder could not read that. Try rephrasing, or build by hand.',
      )
    } finally {
      setAiBusy(false)
    }
  }

  /**
   * Answering puts the answer where the next draft reads it.
   *
   * Appended to the description rather than sent as a side channel, so
   * it can be seen, edited, and kept when the draft is built again.
   */
  const answer = (question: { id: string; text: string }, choice: string) => {
    setDescription((d) => `${d.trim()}\n${question.text} ${choice}`.trim())
    setQuestions((qs) => qs.filter((q) => q.id !== question.id))
  }

  const previewMutation = usePreviewAssetTreeBuilder()
  const createMutation = useCreateAssetTreeBuilder()

  const payload = useMemo<AssetTreeBuilderPayload | null>(() => {
    const branches: AssetTreeBuilderBranch[] = rows
      .map((row) => ({
        path: row.path.trim(),
        code: row.code.trim().toUpperCase() || null,
        asset_count: Number.parseInt(row.count, 10) || 0,
        // Sent only when a schedule gave us real ones.
        ...(row.assets?.length ? { assets: row.assets } : {}),
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

            {/*
              Above the rows it fills in. The office has the schedule;
              typing it back out as a sentence is what threw away every
              number on it.
            */}
            <section className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Build it from what you have</h3>
              <p className="text-xs text-slate-500">
                Describe the property, or paste the customer’s own list. A pasted
                list keeps every number on it.
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Describe it
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={5}
                    placeholder="e.g. 3 floors, 8 units per floor, 2 locks per unit"
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Or paste a schedule
                  <textarea
                    value={schedule}
                    onChange={(event) => setSchedule(event.target.value)}
                    rows={5}
                    placeholder="Paste rows from a spreadsheet or hardware list"
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </label>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Every row is treated as something real. Nothing is merged, and no row
                is invented to tidy a gap — a gap is usually something that is not
                there.
              </p>

              <button
                type="button"
                onClick={() => void runAi()}
                disabled={aiBusy || (!description.trim() && !schedule.trim())}
                className="mt-3 rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
              >
                {aiBusy ? 'Reading…' : 'Build the rows'}
              </button>

              {assumptions.length > 0 && (
                <div className="mt-4 rounded border-l-4 border-amber-500 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">It filled in for you</p>
                  <ul className="mt-1 space-y-1">
                    {assumptions.map((a, i) => (
                      <li key={i} className="text-sm text-slate-700">• {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {questions.map((q) => (
                <div key={q.id} className="mt-3 rounded border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{q.text}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(q.options.length ? q.options : ['Yes', 'No']).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => answer(q, opt)}
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        {opt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Skip
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Answering adds it to the description. Build again to use it.
                  </p>
                </div>
              ))}

              {rows.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Change something
                    <input
                      value={instruction}
                      onChange={(event) => setInstruction(event.target.value)}
                      placeholder="e.g. add a roof hatch to each stair, or floor 4 has no units"
                      className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void runAi(instruction.trim())}
                    disabled={aiBusy || !instruction.trim()}
                    className="mt-2 rounded border border-amber-600 px-3 py-1.5 text-sm font-semibold text-amber-700 disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Apply the change
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    Your edits stay. Only what you name is touched.
                  </p>
                </div>
              )}

              {/*
                A change read too broadly comes back far smaller, and
                work done by hand goes with it. Said out loud rather
                than left in a total nobody is counting.
              */}
              {editedFrom !== null && rows.length < editedFrom && (
                <p className="mt-3 text-sm font-semibold text-red-700">
                  That went from {editedFrom} rows to {rows.length}. Check before you
                  create.
                </p>
              )}
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
  setRows(
    rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row

      // Typing over the count drops that row's schedule entries: the
      // server trusts the list, so keeping both would show one number
      // and create another.
      const dropsList = patch.count !== undefined && patch.count !== row.count

      return { ...row, ...patch, ...(dropsList ? { assets: undefined } : {}) }
    }),
  )
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
