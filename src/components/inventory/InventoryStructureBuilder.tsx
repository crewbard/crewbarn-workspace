import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { InventoryLocation } from '@/types/inventoryLocation'
import { useTradeVertical } from '@/components/catalog/useTradeVertical'
import { listAllInventoryBins } from '@/lib/inventoryBins'
import { binLabelPickUrl } from '@/lib/binLabelPick'
import {
  addRows, apiTreeToDraft, binsToDraft, codePath, copyAsSibling, countDraft, draftToApiTree, findNode, generateDraft,
  layerLabel, levelLine, levelSummaries, MAX_LAYERS, MAX_PER_LAYER, MAX_TREE_NODES, nextCodes, newKey, patchNode,
  removeNode, renumberRoots, setCapacityMany, setRowCount, type DraftNode, type Layer, type Mode, type NodePatch,
} from '@/lib/structureDraft'
import {
  applyStructureTemplate, canUndo, copyPlace, deleteStructureTemplate, listStructureTemplates, saveStructureTemplate,
  structureTemplateKeys, undoCreatedPlaces, type CreatedPlaces, type SaveTemplateInput, type StructureTemplate,
} from '@/lib/structureTemplates'
import { StructureCanvas } from '@/components/inventory/structure/StructureCanvas'
import { DRAFT_LOCATION, tileEditorKey, useDraftTree } from '@/components/inventory/structure/useDraftTree'
import { TileEditor } from '@/components/inventory/structure/TileEditor'
import { AddRowsDialog } from '@/components/inventory/structure/AddRowsDialog'
import { CanvasMenu, type CanvasAction } from '@/components/inventory/structure/CanvasMenu'
import { CreatedPanel } from '@/components/inventory/structure/CreatedPanel'
import { SaveShapeDialog, TemplateCards } from '@/components/inventory/structure/TemplatesBar'

/**
 * Describe your own storage shape, then see it drawn exactly as the Bins
 * screen will show it, and change any single tile before creating.
 *
 * Storage starts as an ordered stack of layers (every shelf alike), named
 * whatever the shop calls them. The drawing on the right is the Bins Racks
 * view, live: click a tile to rename it, change its code, set how many fit
 * or give it more rows; "Add another like this one" copies a rack or shelf
 * with the next free codes. Saved shapes are the company's own templates.
 *
 * Every step can be undone (Undo, or Ctrl+Z), and so can the build itself
 * for 15 minutes, while the new places are still empty.
 */

interface PreviewPayload {
  nodes: Array<{ depth: number; bin_code: string; path: string; holds_stock: boolean }>
  conflicts: Array<{ path?: string; bin_code?: string; message: string }>
  chain: string[]
  truncated: boolean
  totals: { nodes: number; stock_nodes: number; levels: number }
}

const NAME_SUGGESTIONS = [
  'Rack', 'Shelf', 'Bin', 'Row', 'Drawer', 'Section', 'Cabinet', 'Aisle', 'Bay',
  'Tray', 'Case', 'Pocket', 'Slot', 'Wall', 'Room', 'Tote', 'Hook',
]

const PRESETS: Array<{ label: string; layers: Omit<Layer, 'id'>[]; trade?: string }> = [
  {
    label: 'Warehouse rack',
    layers: [
      { name: 'Rack', count: 2, mode: 'num', prefix: 'R', stock: false },
      { name: 'Shelf', count: 4, mode: 'num', prefix: 'S', stock: false },
      { name: 'Bin', count: 10, mode: 'pad', prefix: 'BIN-', stock: true },
      { name: 'Row', count: 6, mode: 'alpha', prefix: '', stock: true },
    ],
  },
  {
    label: 'Cabinet + drawers',
    layers: [
      { name: 'Cabinet', count: 2, mode: 'num', prefix: 'C', stock: false },
      { name: 'Drawer', count: 6, mode: 'pad', prefix: 'D', stock: false },
      { name: 'Section', count: 4, mode: 'alpha', prefix: '', stock: true },
    ],
  },
  {
    label: 'Service truck',
    layers: [
      { name: 'Cabinet', count: 3, mode: 'num', prefix: 'C', stock: false },
      { name: 'Drawer', count: 4, mode: 'num', prefix: 'D', stock: false },
      { name: 'Bin', count: 6, mode: 'pad', prefix: 'BIN-', stock: true },
      { name: 'Row', count: 4, mode: 'alpha', prefix: '', stock: true },
    ],
  },
  {
    label: 'Key case',
    // Locksmith trade pack only.
    trade: 'locksmith',
    layers: [
      { name: 'Case', count: 2, mode: 'num', prefix: 'K', stock: false },
      { name: 'Pocket', count: 24, mode: 'pad', prefix: '', stock: true },
    ],
  },
]

const withIds = (layers: Omit<Layer, 'id'>[]): Layer[] => layers.map((l) => ({ ...l, id: newKey('L') }))
const stripIds = (layers: Layer[]): Array<Omit<Layer, 'id'>> => layers.map((l) => {
  const { id, ...rest } = l
  void id
  return rest
})

/** The builder's whole drawing, as one value, so Undo is just "the one before". */
interface Doc {
  layers: Layer[]
  /** Set once single tiles are changed; then the drawing is this tree, not the layers. */
  custom: DraftNode[] | null
  preset: string | null
}

/** The step back that "Undo" takes, and what it says. */
interface Step { doc: Doc; what: string; at: number }

/** shelves not shelfs, boxes not boxs. */
function plural(word: string, n: number): string {
  if (n === 1) return word.toLowerCase()
  const w = word.toLowerCase()
  if (/(s|x|ch|sh)$/.test(w)) return `${w}es`
  if (/fe$/.test(w)) return `${w.slice(0, -2)}ves`
  if (/f$/.test(w)) return `${w.slice(0, -1)}ves`
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`
  return `${w}s`
}

/** The sample strip: first three then the last, so both ends are visible. */
function sample(layer: Layer): string {
  const codes = Array.from({ length: layer.count }, (_, i) => layer.prefix + layerLabel(layer.mode, i + 1, layer.count))
  if (codes.length <= 4) return codes.join('  ')
  return `${codes.slice(0, 3).join('  ')}  …  ${codes[codes.length - 1]}`
}

function useNarrow(): boolean {
  const q = '(max-width: 1023px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setNarrow(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return narrow
}

/** Kept out of render; only read when a step is recorded. */
function clock(): number {
  return Date.now()
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export function InventoryStructureBuilder({
  locations,
  initialLocationId,
  onClose,
  onCreated,
  onPlacesCreated,
  initialDraft,
}: {
  locations: InventoryLocation[]
  initialLocationId?: string
  onClose: () => void
  onCreated?: (created: number, skipped: number) => void
  /** Embedded use (Receive delivery): hand the new places straight back
   *  instead of showing the "Created" panel. The Bins tab leaves this unset,
   *  so it behaves exactly as before. */
  onPlacesCreated?: (made: CreatedPlaces, locationId: string) => void
  /** Embedded use: start from this drawing (a guess from the shop's own
   *  places) instead of the first built-in shape. Still fully editable. */
  initialDraft?: { nodes: DraftNode[]; note: string } | null
}) {
  const qc = useQueryClient()
  const tradeVertical = useTradeVertical()
  const narrow = useNarrow()
  const navigate = useNavigate()
  // No fallback to the first location. This builder creates hundreds of places
  // in one press, and pre-selecting whichever location sorts first once built a
  // whole rack into Returns.
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [doc, setDoc] = useState<Doc>(() => ({ layers: withIds(PRESETS[0].layers), custom: initialDraft?.nodes.length ? initialDraft.nodes : null, preset: initialDraft?.nodes.length ? null : PRESETS[0].label }))
  const [past, setPast] = useState<Step[]>([])
  const [future, setFuture] = useState<Step[]>([])
  const [note, setNote] = useState<string | null>(initialDraft?.note ?? null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ key: string; at: { x: number; y: number } } | null>(null)
  const [rowsFor, setRowsFor] = useState<string[] | null>(null)
  const [fitsAll, setFitsAll] = useState('')
  const [saving, setSaving] = useState<{ title: string; intro: string; name: string; input: (n: string, d: string) => SaveTemplateInput } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedPlaces | null>(null)
  const [createdIn, setCreatedIn] = useState('')
  const [undone, setUndone] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState('')

  const layers = doc.layers
  const draft = useMemo(() => doc.custom ?? generateDraft(layers), [doc.custom, layers])
  const locationName = locations.find((l) => l.id === locationId)?.name ?? 'this place'
  const tree = useDraftTree(draft, locationName)
  const total = useMemo(() => countDraft(draft), [draft])
  const levels = useMemo(() => levelSummaries(draft), [draft])

  // ── history ── (from event handlers, so `doc`, `past` and `future` are current)
  const commit = (next: Doc, what: string) => {
    const now = clock()
    // Typing a name is one step, not one per letter.
    const last = past[past.length - 1]
    if (!(last && last.what === what && now - last.at < 1500)) setPast([...past.slice(-49), { doc, what, at: now }])
    else setPast([...past.slice(0, -1), { ...last, at: now }])
    setFuture([])
    setDoc(next)
  }
  const undo = useCallback(() => {
    const last = past[past.length - 1]
    if (!last) return
    setPast(past.slice(0, -1))
    setFuture([...future, { doc, what: last.what, at: 0 }])
    setDoc(last.doc)
    setNote(`Took back: ${last.what}`)
  }, [past, future, doc])
  const redo = useCallback(() => {
    const last = future[future.length - 1]
    if (!last) return
    setFuture(future.slice(0, -1))
    setPast([...past, { doc, what: last.what, at: 0 }])
    setDoc(last.doc)
    setNote(`Put back: ${last.what}`)
  }, [past, future, doc])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // ── layer edits (replace any single-tile changes, which Undo brings back) ──
  const editLayers = (fn: (ls: Layer[]) => Layer[], what: string) => {
    if (doc.custom) setNote('The drawing now follows the layers again. Undo brings your tile changes back.')
    commit({ layers: fn(layers), custom: null, preset: null }, what)
    setFocusKey(null)
    setTicked(new Set())
  }
  const patchLayer = (id: string, next: Partial<Layer>, what: string) =>
    editLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...next } : l)), what)
  const move = (index: number, delta: number) =>
    editLayers((ls) => {
      const to = index + delta
      if (to < 0 || to >= ls.length) return ls
      const copy = [...ls]
      ;[copy[index], copy[to]] = [copy[to], copy[index]]
      return copy
    }, 'moved a layer')
  const addLayer = () =>
    editLayers((ls) => {
      const used = new Set(ls.map((l) => l.name.toLowerCase()))
      const name = NAME_SUGGESTIONS.find((n) => !used.has(n.toLowerCase())) ?? 'Level'
      return [...ls, { id: newKey('L'), name, count: 4, mode: 'num', prefix: '', stock: true }]
    }, 'added a layer')

  // ── tile edits ──
  const editTree = (next: DraftNode[], what: string) => commit({ ...doc, custom: next, preset: null }, what)
  const onPatch = (key: string, p: NodePatch) => {
    const n = findNode(draft, key)?.node
    editTree(patchNode(draft, key, p), `changed ${n?.code ?? 'a place'}`)
  }
  const onRows = (key: string, count: number) => {
    const n = findNode(draft, key)?.node
    editTree(setRowCount(draft, key, count), `rows in ${n?.code ?? 'a place'}`)
  }
  const onCopy = (key: string) => {
    const found = findNode(draft, key)
    if (!found) return
    if (total + 1 + countDraft(found.node.children) > MAX_TREE_NODES) {
      setNote(`That would go past ${MAX_TREE_NODES.toLocaleString('en-US')} places, the most one build can make.`)
      return
    }
    const r = copyAsSibling(draft, key)
    if (!r.copyKey) return
    editTree(r.nodes, `added ${r.code}, a copy of ${found.node.code}`)
    setFocusKey(r.copyKey)
    setNote(`Added ${found.node.kind.toLowerCase()} ${r.code}, just like ${found.node.code}. Undo takes it back.`)
  }
  const onRemove = (key: string) => {
    const n = findNode(draft, key)?.node
    editTree(removeNode(draft, key), `removed ${n?.code ?? 'a place'}`)
    setFocusKey(null)
    setNote(`Removed ${n?.code ?? 'it'} from the drawing. Undo puts it back.`)
  }
  const onPick = (key: string) => {
    if (key === DRAFT_LOCATION) return
    if (selectMode) {
      setTicked((prev) => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s })
      return
    }
    setFocusKey((k) => (k === key ? null : key))
  }
  const onMenuChoose = (a: CanvasAction) => {
    const key = menu?.key
    setMenu(null)
    if (!key) return
    if (a === 'edit') setFocusKey(key)
    if (a === 'copy') onCopy(key)
    if (a === 'rows') setRowsFor([key])
    if (a === 'remove') onRemove(key)
  }
  const tickedKeys = [...ticked].filter((k) => findNode(draft, k))

  // ── the server's view: what clashes with what's already there ──
  const body = useMemo(() => (doc.custom
    ? { location_id: locationId, tree: draftToApiTree(doc.custom) }
    : {
      location_id: locationId,
      layers: layers.filter((l) => l.name.trim() !== '').map((l) => ({
        name: l.name.trim(), count: l.count, mode: l.mode, prefix: l.prefix, stock: l.stock,
        ...(l.stock && l.capacity ? { capacity: l.capacity } : {}),
      })),
    }), [doc.custom, layers, locationId])
  const hasShape = doc.custom ? doc.custom.length > 0 : (body as { layers?: unknown[] }).layers!.length > 0
  const preview = useQuery({
    queryKey: ['inventory-structure-preview', body],
    queryFn: () => apiRequest<{ data: PreviewPayload }>('/v1/inventory-bins/structure-preview', { method: 'POST', body }),
    enabled: !!locationId && hasShape && total <= MAX_TREE_NODES,
    placeholderData: (prev) => prev,
  })
  const data = preview.data?.data
  const existing = useQuery({
    queryKey: ['inventory-bins', 'list', { location_id: locationId }, 'all', 'structure-builder'],
    queryFn: () => listAllInventoryBins({ location_id: locationId }),
    enabled: !!locationId,
    staleTime: 30_000,
  })
  const existingRoots = useMemo(() => (existing.data?.data ?? []).filter((b) => !b.parent_bin_id && b.active !== false), [existing.data])
  const rootClashes = useMemo(() => {
    const taken = new Set(existingRoots.map((b) => (b.bin_code ?? '').trim().toLowerCase()).filter(Boolean))
    return draft.filter((n) => taken.has(n.code.trim().toLowerCase())).map((n) => n.code)
  }, [existingRoots, draft])
  const useNextFree = () => {
    const r = renumberRoots(draft, existingRoots.map((b) => b.bin_code ?? ''))
    editTree(r.nodes, 'used the next free codes')
    setNote(`${r.moved.map((m) => `${m.from} is now ${m.to}`).join(', ')}. Undo takes it back.`)
  }

  // ── templates ──
  const templates = useQuery({ queryKey: structureTemplateKeys.all, queryFn: listStructureTemplates, staleTime: 60_000 })
  const [buildingId, setBuildingId] = useState<string | null>(null)
  const openTemplate = (t: StructureTemplate) => {
    if (t.layers?.length) commit({ layers: withIds(t.layers), custom: null, preset: `tpl:${t.id}` }, `opened ${t.name}`)
    else commit({ layers, custom: apiTreeToDraft(t.shape), preset: `tpl:${t.id}` }, `opened ${t.name}`)
    setFocusKey(null)
    setNote(`Opened “${t.name}”. Change anything, then Create.`)
  }
  const buildTemplate = async (t: StructureTemplate) => {
    if (!locationId) return
    setBuildingId(t.id)
    setError(null)
    try {
      const made = await applyStructureTemplate(t.id, locationId)
      finishCreate(made)
    } catch (e) {
      setError(message(e, `Could not build “${t.name}”.`))
    } finally {
      setBuildingId(null)
    }
  }
  const removeTemplate = async (t: StructureTemplate) => {
    try {
      await deleteStructureTemplate(t.id)
      await qc.invalidateQueries({ queryKey: structureTemplateKeys.all })
      setNote(`Deleted the saved shape “${t.name}”. Places already built from it stay.`)
    } catch (e) {
      setError(message(e, 'Could not delete that saved shape.'))
    }
  }
  const saveShape = useMutation({
    mutationFn: (input: SaveTemplateInput) => saveStructureTemplate(input),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: structureTemplateKeys.all })
      setSaving(null)
      setNote(`Saved “${t.name}”. It's under Your saved shapes, ready to build in one click.`)
    },
    onError: (e) => setSaveError(message(e, 'Could not save that shape.')),
  })
  const askSave = (opts: NonNullable<typeof saving>) => { setSaveError(null); setSaving(opts) }

  // ── create, and what comes after ──
  const finishCreate = (made: CreatedPlaces) => {
    void qc.invalidateQueries({ queryKey: ['inventory-bins'] })
    if (onPlacesCreated) {
      onCreated?.(made.created_count, made.skipped_count ?? 0)
      onPlacesCreated(made, locationId)
      return
    }
    setCreated(made)
    setCreatedIn(locationName)
    setUndone(false)
    setUndoError(null)
    onCreated?.(made.created_count, made.skipped_count ?? 0)
  }
  const create = useMutation({
    mutationFn: () => apiRequest<{ data: CreatedPlaces }>('/v1/inventory-bins/structure-apply', { method: 'POST', body }),
    onSuccess: (r) => finishCreate(r.data),
    onError: (e) => setError(message(e, 'Could not create that structure.')),
  })
  const copyExisting = async (id: string) => {
    setError(null)
    try { finishCreate(await copyPlace(id)) } catch (e) { setError(message(e, 'Could not copy that place.')) }
  }
  const [undoing, setUndoing] = useState(false)
  const undoCreate = async () => {
    if (!created || !canUndo(created)) return
    setUndoing(true)
    setUndoError(null)
    try {
      await undoCreatedPlaces(created)
      await qc.invalidateQueries({ queryKey: ['inventory-bins'] })
      setUndone(true)
    } catch (e) {
      setUndoError(message(e, 'Could not take it back.'))
    } finally {
      setUndoing(false)
    }
  }

  const overBudget = total > 2000
  const tooBig = total > MAX_TREE_NODES
  const focused = focusKey ? findNode(draft, focusKey) : null
  // The deepest place that holds stock: what its sticker will say.
  const stockSpot = useMemo(() => {
    let best: string[] | null = null
    const walk = (list: DraftNode[], path: string[]): boolean => {
      for (const n of list) {
        const p = [...path, n.code]
        if (n.holdsStock && (!best || p.length > best.length)) best = p
        if (best && best.length >= levels.length) return true
        if (walk(n.children, p)) return true
      }
      return false
    }
    walk(draft, [])
    return best as string[] | null
  }, [draft, levels.length])

  if (created) {
    return (
      <div data-tour="inv-structure-builder" className="py-4">
        <CreatedPanel
          created={created}
          placeName={createdIn}
          undoing={undoing}
          undone={undone}
          error={undoError}
          onUndo={undoCreate}
          onPrint={() => { onClose(); navigate(binLabelPickUrl(created.created_ids)) }}
          onAgain={() => { setCreated(null); setFocusKey(null) }}
          onDone={onClose}
        />
      </div>
    )
  }

  const visiblePresets = PRESETS.filter((p) => !p.trade || p.trade === tradeVertical)

  return (
    <div data-tour="inv-structure-builder" className="flex flex-col gap-2.5">
      {/* Build this inside */}
      <div data-tour="inv-structure-place" className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        <div className="min-w-[148px] shrink-0">
          <div className="text-[12.5px] font-bold text-slate-900">Build this inside</div>
          <div className={`text-[11.5px] ${locationId ? 'text-slate-400' : 'font-semibold text-amber-700'}`}>
            {locationId ? 'Everything below goes in this place' : 'Pick a place to start'}
          </div>
        </div>
        {locations.map((loc) => {
          const on = loc.id === locationId
          return (
            <button key={loc.id} type="button" onClick={() => { setLocationId(loc.id); setExistingId('') }} aria-pressed={on}
              className={`h-[36px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-[12.5px] transition-colors ${
                on ? 'border-amber-500 bg-amber-50 font-bold text-amber-800' : 'border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50'
              }`}>
              {loc.name}
            </button>
          )
        })}
      </div>

      {/* Start from a shape: built-in, the company's saved ones, or one that already exists */}
      <div data-tour="inv-structure-shapes" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-[148px] shrink-0">
            <div className="text-[12.5px] font-bold text-slate-900">Start from a shape</div>
            <div className="text-[11.5px] text-slate-400">Then change anything</div>
          </div>
          {visiblePresets.map((p) => {
            const on = doc.preset === p.label
            return (
              <button key={p.label} type="button" aria-pressed={on}
                onClick={() => { commit({ layers: withIds(p.layers), custom: null, preset: p.label }, `started from ${p.label}`); setFocusKey(null) }}
                className={`min-w-[132px] flex-1 rounded-[9px] border px-3 py-2 text-left transition-colors ${
                  on ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}>
                <span className="block text-[12px] font-bold">{p.label}</span>
                <span className="mt-px block font-mono text-[10.5px] font-semibold opacity-70">{p.layers.map((l) => l.name).join(' › ')}</span>
              </button>
            )
          })}
        </div>
        <details className="group rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2" open={(templates.data?.length ?? 0) > 0}>
          <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-2 text-[12.5px] font-bold text-slate-700">
            <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
            Your saved shapes{templates.data?.length ? ` (${templates.data.length})` : ''}
          </summary>
          <div className="mt-2">
            <TemplateCards templates={templates.data ?? []} loading={templates.isLoading} placeName={locationId ? locationName : null}
              canBuild={!!locationId} busyId={buildingId} onOpen={openTemplate} onBuild={buildTemplate} onDelete={removeTemplate} />
          </div>
        </details>
        <details className="group rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-2 text-[12.5px] font-bold text-slate-700">
            <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
            Copy one you already have
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {!locationId ? (
              <p className="text-[12px] text-slate-500">Pick a place at the top first. Then choose a rack, cabinet or truck already in it.</p>
            ) : existingRoots.length === 0 ? (
              <p className="text-[12px] text-slate-500">{existing.isLoading ? 'Looking…' : `Nothing is set up in ${locationName} yet.`}</p>
            ) : (
              <>
                <label className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                  Copy
                  <select value={existingId} onChange={(e) => setExistingId(e.target.value)}
                    className="h-10 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium focus:border-amber-500 focus:outline-none">
                    <option value="">Choose one in {locationName}…</option>
                    {existingRoots.map((b) => <option key={b.id} value={b.id}>{b.bin_code} · {b.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!existingId} onClick={() => copyExisting(existingId)}
                    className="h-10 rounded-lg bg-amber-500 px-3 text-[12.5px] font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500">
                    Add another like this one now
                  </button>
                  <button type="button" disabled={!existingId} onClick={() => {
                      const d = binsToDraft(existing.data?.data ?? [], existingId)
                      const r = renumberRoots(d, existingRoots.map((b) => b.bin_code ?? ''))
                      commit({ layers, custom: r.nodes, preset: null }, 'started from a copy')
                      setFocusKey(null)
                      setNote(`Copied ${d[0]?.code} as ${r.nodes[0]?.code}. Change anything, then Create.`)
                    }}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                    Copy it here to change first
                  </button>
                  <button type="button" disabled={!existingId} onClick={() => {
                      const b = existingRoots.find((x) => x.id === existingId)
                      askSave({ title: 'Save as a shape', intro: `Saves ${b?.bin_code} and everything inside it, so you can build the same again anywhere.`, name: b?.name ?? '', input: (name, description) => ({ name, description, from_bin_id: existingId }) })
                    }}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                    Save it as a shape
                  </button>
                  <button type="button" onClick={() => askSave({ title: `Save all of ${locationName} as a shape`, intro: `Saves every rack, shelf and bin in ${locationName}. Handy for setting up the next truck the same way.`, name: `Same as ${locationName}`, input: (name, description) => ({ name, description, from_location_id: locationId }) })}
                    className="h-10 rounded-lg px-3 text-[12.5px] font-semibold text-slate-600 hover:bg-white">
                    Save all of {locationName} as a shape
                  </button>
                </div>
              </>
            )}
          </div>
        </details>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2.5 lg:grid-cols-[372px_minmax(0,1fr)]">
        {/* ── layer stack ── */}
        <div data-tour="inv-structure-layers" className="flex min-w-0 flex-col gap-2.5">
          {doc.custom && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
              You've changed single places on the drawing. Changing a layer here starts the drawing again from the layers; Undo brings your changes back.
            </div>
          )}
          {layers.map((layer, i) => {
            const parent = i > 0 ? layers[i - 1].name : null
            const depthChip = i === 0 ? 'Outermost' : i === layers.length - 1 ? 'Innermost' : `Inside ${parent?.toLowerCase()}`
            const level = levels[i]
            return (
              <div key={layer.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${i === 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                    {depthChip}
                  </span>
                  <input value={layer.name} list="cb-layer-names" aria-label="Layer name"
                    onChange={(e) => patchLayer(layer.id, { name: e.target.value }, `renamed a layer`)}
                    placeholder="Layer name"
                    className="h-[34px] min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-[13px] font-bold text-slate-900 focus:border-amber-500 focus:outline-none" />
                  <IconBtn title="Move up" disabled={i === 0} onClick={() => move(i, -1)} d="M12 19V5M6 11l6-6 6 6" />
                  <IconBtn title="Move down" disabled={i === layers.length - 1} onClick={() => move(i, 1)} d="M12 5v14M6 13l6 6 6-6" />
                  <IconBtn title="Remove layer" disabled={layers.length === 1} onClick={() => editLayers((ls) => ls.filter((l) => l.id !== layer.id), 'removed a layer')} d="M6 6l12 12M18 6L6 18" />
                </div>
                <div className="flex flex-col gap-2.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{i === 0 ? 'How many' : `Per ${parent?.toLowerCase()}`}</span>
                      <button type="button" aria-label={`Fewer ${plural(layer.name || 'place', 2)}`} onClick={() => patchLayer(layer.id, { count: Math.max(1, layer.count - 1) }, `${layer.name} count`)}
                        className="h-8 w-8 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">−</button>
                      <span className="min-w-[26px] text-center font-mono text-[13px] font-bold text-slate-900">{layer.count}</span>
                      <button type="button" aria-label={`More ${plural(layer.name || 'place', 2)}`} onClick={() => patchLayer(layer.id, { count: Math.min(MAX_PER_LAYER, layer.count + 1) }, `${layer.name} count`)}
                        className="h-8 w-8 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">+</button>
                    </div>
                    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      {(['num', 'pad', 'alpha'] as Mode[]).map((m) => (
                        <button key={m} type="button" aria-pressed={layer.mode === m} onClick={() => patchLayer(layer.id, { mode: m }, `${layer.name} numbering`)}
                          className={`h-[28px] whitespace-nowrap rounded-md px-2 font-mono text-[10.5px] font-bold ${layer.mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                          {m === 'num' ? '1,2,3' : m === 'pad' ? '01,02' : 'A,B,C'}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Code</span>
                      <input value={layer.prefix} onChange={(e) => patchLayer(layer.id, { prefix: e.target.value }, `${layer.name} code`)} placeholder="none"
                        className="h-[30px] w-[62px] rounded-md border border-slate-200 px-2 font-mono text-[12px] font-bold text-slate-900 focus:border-amber-500 focus:outline-none" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] font-bold text-slate-600">{sample(layer)}</span>
                    <div className="min-w-[4px] flex-1" />
                    {layer.stock && (
                      <label className="flex items-center gap-1.5" title="How many units fit in each one. Leave blank if it doesn't matter.">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Fits</span>
                        <input type="number" inputMode="numeric" min={1} step={1} value={layer.capacity ?? ''}
                          onChange={(e) => {
                            const n = Math.floor(Number(e.target.value))
                            patchLayer(layer.id, { capacity: e.target.value === '' || !Number.isFinite(n) || n < 1 ? null : n }, `${layer.name} fits`)
                          }}
                          placeholder="any" aria-label={`Units each ${layer.name || 'place'} fits`}
                          className="h-[30px] w-[64px] rounded-md border border-slate-200 px-2 text-[12px] font-bold text-slate-900 focus:border-amber-500 focus:outline-none" />
                      </label>
                    )}
                    <button type="button" aria-pressed={layer.stock} onClick={() => patchLayer(layer.id, { stock: !layer.stock }, `${layer.name} holds stock`)}
                      title="Can stock sit directly in this, or does it only hold other things?"
                      className={`flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11.5px] font-bold ${layer.stock ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-400'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        {layer.stock ? <path d="M4 12.5l5 5L20 7" /> : <path d="M8 3v10M3 8h10" />}
                      </svg>
                      Holds stock
                    </button>
                  </div>
                  {/* Inline codes: the real first and last code at this level, and what each fits. */}
                  {level && (
                    <div className="truncate rounded-md border border-dashed border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-600" title={levelLine(level)} data-testid="level-line">
                      {levelLine(level)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <button type="button" onClick={addLayer} disabled={layers.length >= MAX_LAYERS}
            className="flex h-[40px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add a deeper layer
          </button>
          {/* Deeper levels that only exist because of tile changes (e.g. rows added to one bin). */}
          {levels.slice(layers.length).map((lv) => (
            <div key={lv.depth} className="truncate rounded-md border border-dashed border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600" data-testid="level-line">
              {lv.kind}: {levelLine(lv)}
            </div>
          ))}
        </div>

        {/* ── the drawing (the live preview) ── */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <div data-tour="inv-structure-preview" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
              <div className="min-w-[180px] flex-1">
                <div className="text-[13px] font-bold text-slate-900">What you&rsquo;ll get in {locationName}</div>
                <div className="mt-px text-[11.5px] text-slate-400">
                  {selectMode ? 'Tap places to tick them' : 'Tap any place to change it. Right-click or press and hold for more.'}
                </div>
              </div>
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11.5px] font-extrabold ${overBudget ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                {total.toLocaleString('en-US')} places · {(data?.totals.stock_nodes ?? levels.reduce((s, l) => s + (l.holdsStock ? l.count : 0), 0)).toLocaleString('en-US')} hold stock
              </span>
              <button type="button" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)"
                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Undo</button>
              <button type="button" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)"
                className="hidden h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:block">Redo</button>
              <button type="button" aria-pressed={selectMode} onClick={() => { setSelectMode((s) => !s); setTicked(new Set()); setFocusKey(null) }}
                className={`h-9 shrink-0 rounded-lg border px-2.5 text-[12px] font-semibold ${selectMode ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {selectMode ? 'Done ticking' : 'Select several'}
              </button>
            </div>

            {selectMode && (
              <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-3.5 py-2 text-[12.5px]">
                <b className="text-amber-900">{tickedKeys.length} ticked</b>
                <button type="button" disabled={!tickedKeys.length} onClick={() => setRowsFor(tickedKeys)}
                  className="h-9 rounded-lg bg-amber-500 px-3 font-bold text-white hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500">Add rows…</button>
                <span className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" min={1} value={fitsAll} onChange={(e) => setFitsAll(e.target.value)} placeholder="fits"
                    aria-label="How many fit in each ticked place" className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 focus:border-amber-500 focus:outline-none" />
                  <button type="button" disabled={!tickedKeys.length || !(Math.floor(Number(fitsAll)) >= 1)}
                    onClick={() => { editTree(setCapacityMany(draft, tickedKeys, Math.floor(Number(fitsAll))), `set fits on ${tickedKeys.length}`); setNote(`Each ticked place that holds stock now fits ${Math.floor(Number(fitsAll))}. Undo takes it back.`) }}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Set fits</button>
                </span>
                <button type="button" onClick={() => setTicked(new Set())} disabled={!tickedKeys.length} className="h-9 rounded-lg px-2 font-semibold text-slate-600 hover:bg-white disabled:opacity-40">Clear</button>
              </div>
            )}

            {note && (
              <div role="status" className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-[12.5px] text-slate-700">
                <span className="min-w-0 flex-1">{note}</span>
                <button type="button" onClick={() => setNote(null)} aria-label="Dismiss" className="h-8 rounded px-2 text-slate-400 hover:text-slate-700">×</button>
              </div>
            )}

            <div className={`grid ${focused && !narrow ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
              <div className="max-h-[62vh] min-w-0 overflow-y-auto">
                {tooBig ? (
                  <p className="px-4 py-10 text-center text-[13px] text-rose-700">
                    That's {total.toLocaleString('en-US')} places. One build can make up to {MAX_TREE_NODES.toLocaleString('en-US')}; lower a count or build it in two goes.
                  </p>
                ) : (
                  <StructureCanvas tree={tree} draft={draft} selected={ticked} focusKey={focusKey} selectMode={selectMode}
                    onPick={onPick} onMenu={(key, at) => { if (key !== DRAFT_LOCATION) setMenu({ key, at }) }} onCopy={onCopy}
                    emptyText="Name a layer to see what you'll get." />
                )}
              </div>
              {focused && !narrow && !selectMode && (
                <div className="border-t border-slate-100 p-3 xl:border-l xl:border-t-0">
                  <TileEditor key={tileEditorKey(draft, focusKey!)} draft={draft} nodeKey={focusKey!} onPatch={onPatch} onRows={onRows} onCopy={onCopy} onRemove={onRemove} onClose={() => setFocusKey(null)} sheet={false} />
                </div>
              )}
            </div>

            <div data-tour="inv-structure-actions" className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3">
              <span className="min-w-[200px] flex-1 text-[11.5px] text-slate-500">
                Every place stays editable after this, and you can Undo the whole build for 15 minutes while it's still empty.
              </span>
              <button type="button" onClick={() => askSave({
                  title: 'Save as a shape', intro: 'Your company can build this same shape again in one click, in any place.',
                  name: doc.preset && !doc.preset.startsWith('tpl:') ? doc.preset : '',
                  input: (name, description) => ({ name, description, tree: draftToApiTree(draft), layers: doc.custom ? null : stripIds(layers) }),
                })}
                disabled={!draft.length || tooBig}
                className="h-[36px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                Save as a shape
              </button>
              <button type="button" onClick={onClose} data-tour="inv-structure-cancel"
                className="h-[36px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={() => {
                  if (overBudget && !window.confirm(`This creates ${total.toLocaleString('en-US')} storage spots in one go. Create them anyway? You can Undo for 15 minutes while they're empty.`)) return
                  setError(null)
                  create.mutate()
                }}
                disabled={!locationId || create.isPending || !data || data.truncated || total === 0 || tooBig}
                title={!locationId ? 'Pick a place at the top first' : undefined}
                className="h-[36px] shrink-0 rounded-lg bg-amber-500 px-3.5 text-[12.5px] font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                {create.isPending ? 'Creating…' : `Create ${total.toLocaleString('en-US')} places`}
              </button>
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{error}</div>}
          {preview.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
              {message(preview.error, 'Could not check this against what is already there.')}
            </div>
          )}

          <div data-tour="inv-structure-checks" className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
              <div className="text-[12.5px] font-bold text-slate-900">Put-away label</div>
              <p className="mb-2.5 mt-1 text-[11.5px] leading-relaxed text-slate-500">What prints on the sticker and what a tech reads off their phone.</p>
              {stockSpot ? (
                <div className="flex items-center gap-2.5 rounded-[10px] border border-slate-200 bg-slate-50/60 p-2.5">
                  <span className="h-[46px] w-[46px] shrink-0 rounded-md" style={{ background: 'repeating-conic-gradient(#0F172A 0% 25%, #fff 0% 50%) 50% / 8px 8px' }} />
                  <div className="min-w-0">
                    <div className="font-mono text-[15px] font-extrabold text-slate-900">{stockSpot.slice(-2).join(' · ')}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{locationName} / {stockSpot.join(' / ')}</div>
                  </div>
                </div>
              ) : (
                <p className="text-[11.5px] text-slate-400">Nothing holds stock yet. Turn on &ldquo;Holds stock&rdquo; where things actually sit.</p>
              )}
            </div>
            <Conflicts conflicts={data?.conflicts ?? []} place={locationName} truncated={!!data?.truncated}
              rootClashes={rootClashes} onNextFree={rootClashes.length ? useNextFree : undefined} />
          </div>
        </div>
      </div>

      {focused && narrow && !selectMode && (
        <TileEditor key={tileEditorKey(draft, focusKey!)} draft={draft} nodeKey={focusKey!} onPatch={onPatch} onRows={onRows} onCopy={onCopy} onRemove={onRemove} onClose={() => setFocusKey(null)} sheet />
      )}
      {menu && (
        <CanvasMenu at={menu.at} word={(findNode(draft, menu.key)?.node.kind || 'place').toLowerCase()} onChoose={onMenuChoose} onClose={() => setMenu(null)} />
      )}
      {rowsFor && (
        <AddRowsDialog
          targets={rowsFor.length}
          example={(c) => {
            const first = findNode(draft, rowsFor[0])?.node
            if (!first) return null
            const have = first.children.map((k) => k.code)
            const next = nextCodes(have, Math.min(c.count, 6), c.mode)
            return `${first.code}${have.length ? ` has ${have.slice(0, 4).join(', ')}${have.length > 4 ? '…' : ''}, so it` : ''} gets ${next.join(', ')}${c.count > 6 ? '…' : ''}`
          }}
          onClose={() => setRowsFor(null)}
          onSubmit={(c) => {
            if (total + c.count * rowsFor.length > MAX_TREE_NODES) {
              setNote(`That would go past ${MAX_TREE_NODES.toLocaleString('en-US')} places, the most one build can make.`)
              return
            }
            editTree(addRows(draft, rowsFor, c.count, { mode: c.mode, capacity: c.capacity }), `added rows to ${rowsFor.length}`)
            setNote(`Added ${c.count} rows inside ${rowsFor.length === 1 ? codePath(findNode(draft, rowsFor[0])?.path ?? []) : `${rowsFor.length} places`}. Undo takes them back.`)
            setRowsFor(null)
          }}
        />
      )}
      {saving && (
        <SaveShapeDialog title={saving.title} intro={saving.intro} defaultName={saving.name} busy={saveShape.isPending} error={saveError}
          onClose={() => setSaving(null)} onSave={(name, description) => { setSaveError(null); saveShape.mutate(saving.input(name, description)) }} />
      )}

      <datalist id="cb-layer-names">
        {NAME_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}

function IconBtn({ title, disabled, onClick, d }: { title: string; disabled?: boolean; onClick: () => void; d: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d} strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )
}

function Conflicts({
  conflicts, place, truncated, rootClashes, onNextFree,
}: {
  conflicts: Array<{ path?: string; message: string }>
  place: string
  truncated: boolean
  rootClashes: string[]
  onNextFree?: () => void
}) {
  if (truncated) return <div />
  const clean = conflicts.length === 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${clean ? 'bg-emerald-500' : 'bg-amber-600'}`} />
        <span className="text-[12.5px] font-bold text-slate-900">{clean ? `Nothing clashes in ${place}` : `${conflicts.length} already exist in ${place}`}</span>
      </div>
      <p className="mb-2 mt-1 text-[11.5px] leading-relaxed text-slate-500">
        {clean ? 'Every code in this structure is new here.' : 'Existing places keep their stock and history. The ones that already exist are skipped, not overwritten.'}
      </p>
      {onNextFree && (
        <button type="button" onClick={onNextFree}
          className="mb-2 min-h-[40px] w-full rounded-lg border border-amber-300 bg-amber-50 px-3 text-left text-[12.5px] font-semibold text-amber-900 hover:bg-amber-100">
          Build new ones instead: use the next free codes for {rootClashes.slice(0, 3).join(', ')}{rootClashes.length > 3 ? '…' : ''}
        </button>
      )}
      {!clean && (
        <div className="flex flex-col gap-1.5">
          {conflicts.slice(0, 6).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span className="truncate font-mono text-[11px] font-bold text-slate-600">{c.path}</span>
              <div className="min-w-[4px] flex-1" />
              <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">skipped</span>
            </div>
          ))}
          {conflicts.length > 6 && <span className="text-[11px] text-slate-400">+ {conflicts.length - 6} more</span>}
        </div>
      )}
    </div>
  )
}
