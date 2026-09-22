import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import type { InventoryLocation } from '@/types/inventoryLocation'

/**
 * Describe your own storage shape, then see exactly what you'll get.
 *
 * Replaces the fixed rack/shelf/bin/section wizard. Storage is an ordered stack
 * of layers — each one a nesting level applied identically under every parent
 * above it — so two layers and six layers use the same UI, and the layer is
 * named whatever the shop calls it.
 *
 * The tree on the right IS the confirmation step. You read the codes you're
 * about to create before you commit, which is why there's no "are you sure":
 * the answer is already on screen.
 */

type Mode = 'num' | 'pad' | 'alpha'

interface Layer {
  id: string
  name: string
  count: number
  mode: Mode
  prefix: string
  stock: boolean
}

interface PreviewNode {
  temp_key: string
  parent_temp_key: string | null
  depth: number
  kind: string
  bin_code: string
  name: string
  path: string
  holds_stock: boolean
}

interface PreviewPayload {
  nodes: PreviewNode[]
  conflicts: Array<{ path?: string; bin_code?: string; message: string }>
  chain: string[]
  truncated: boolean
  totals: { nodes: number; stock_nodes: number; levels: number }
}

const NAME_SUGGESTIONS = [
  'Rack', 'Shelf', 'Bin', 'Row', 'Drawer', 'Section', 'Cabinet', 'Aisle', 'Bay',
  'Tray', 'Case', 'Pocket', 'Slot', 'Wall', 'Room', 'Tote', 'Hook',
]

const PRESETS: Array<{ label: string; layers: Omit<Layer, 'id'>[] }> = [
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
    layers: [
      { name: 'Case', count: 2, mode: 'num', prefix: 'K', stock: false },
      { name: 'Pocket', count: 24, mode: 'pad', prefix: '', stock: true },
    ],
  },
]

let seq = 0
const newId = () => `L${++seq}`
const withIds = (layers: Omit<Layer, 'id'>[]): Layer[] => layers.map((l) => ({ ...l, id: newId() }))

/** shelves not shelfs, boxes not boxs — the summary line reads badly otherwise. */
function plural(word: string, n: number): string {
  if (n === 1) return word.toLowerCase()
  const w = word.toLowerCase()
  if (/(s|x|ch|sh)$/.test(w)) return `${w}es`
  if (/fe$/.test(w)) return `${w.slice(0, -2)}ves`
  if (/f$/.test(w)) return `${w.slice(0, -1)}ves`
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`
  return `${w}s`
}

function label(mode: Mode, index: number, count: number): string {
  if (mode === 'pad') return String(index).padStart(Math.max(2, String(count).length), '0')
  if (mode === 'alpha') {
    let out = ''
    let n = index
    while (n > 0) {
      n--
      out = String.fromCharCode(65 + (n % 26)) + out
      n = Math.floor(n / 26)
    }
    return out
  }
  return String(index)
}

/** The sample strip: first three then the last, so both ends are visible. */
function sample(layer: Layer): string {
  const codes = Array.from({ length: layer.count }, (_, i) =>
    layer.prefix + label(layer.mode, i + 1, layer.count))
  if (codes.length <= 4) return codes.join('  ')
  return `${codes.slice(0, 3).join('  ')}  …  ${codes[codes.length - 1]}`
}

export function InventoryStructureBuilder({
  locations,
  initialLocationId,
  onClose,
  onCreated,
}: {
  locations: InventoryLocation[]
  initialLocationId?: string
  onClose: () => void
  onCreated?: (created: number, skipped: number) => void
}) {
  const qc = useQueryClient()
  // No fallback to the first location. This builder creates hundreds of nodes
  // in one press, and silently pre-selecting whichever location happens to sort
  // first meant a whole rack could be built into the wrong place — which is
  // exactly what happened, with the structure landing in Returns.
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [layers, setLayers] = useState<Layer[]>(() => withIds(PRESETS[0].layers))
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].label)
  // Explicit open/closed per node, empty meaning "use the depth default".
  // This was two keys per node — the id to force open, "!"+id to force closed —
  // and clicking collapse only ADDED the closed key, so a node past depth 2
  // still matched the open test and refused to shut. One entry, one meaning.
  const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map())
  const [error, setError] = useState<string | null>(null)

  // Any edit means it's their shape now, not the preset's.
  const mutate = (fn: (draft: Layer[]) => Layer[]) => {
    setActivePreset(null)
    setLayers(fn)
  }

  const patch = (id: string, next: Partial<Layer>) =>
    mutate((ls) => ls.map((l) => (l.id === id ? { ...l, ...next } : l)))

  const move = (index: number, delta: number) =>
    mutate((ls) => {
      const to = index + delta
      if (to < 0 || to >= ls.length) return ls
      const copy = [...ls]
      ;[copy[index], copy[to]] = [copy[to], copy[index]]
      return copy
    })

  const addLayer = () =>
    mutate((ls) => {
      const used = new Set(ls.map((l) => l.name.toLowerCase()))
      const name = NAME_SUGGESTIONS.find((n) => !used.has(n.toLowerCase())) ?? 'Level'
      return [...ls, { id: newId(), name, count: 4, mode: 'num', prefix: '', stock: true }]
    })

  const body = useMemo(
    () => ({
      location_id: locationId,
      layers: layers
        .filter((l) => l.name.trim() !== '')
        .map((l) => ({ name: l.name.trim(), count: l.count, mode: l.mode, prefix: l.prefix, stock: l.stock })),
    }),
    [locationId, layers],
  )

  const preview = useQuery({
    queryKey: ['inventory-structure-preview', body],
    queryFn: () =>
      apiRequest<{ data: PreviewPayload }>('/v1/inventory-bins/structure-preview', {
        method: 'POST',
        body,
      }),
    enabled: !!locationId && body.layers.length > 0,
  })
  const data = preview.data?.data

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { created_count: number; skipped_count: number } }>(
        '/v1/inventory-bins/structure-apply',
        { method: 'POST', body },
      ),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['inventory-bins'] })
      onCreated?.(r.data.created_count, r.data.skipped_count)
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not create that structure.'),
  })

  const locationName = locations.find((l) => l.id === locationId)?.name ?? 'this place'
  const total = data?.totals.nodes ?? 0
  const overBudget = total > 2000

  return (
    <div className="flex flex-col gap-2.5">
      {/* Build this inside */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        <div className="min-w-[148px] shrink-0">
          <div className="text-[12.5px] font-bold text-[#0A1220]">Build this inside</div>
          {/* Says which state you're in. Nothing is preselected on purpose, and
              an unexplained empty preview reads as broken rather than as
              waiting for you. */}
          <div className={`text-[11.5px] ${locationId ? 'text-slate-400' : 'font-semibold text-amber-700'}`}>
            {locationId ? 'Everything below is scoped to this place' : 'Pick a place to start'}
          </div>
        </div>
        {locations.map((loc) => {
          const on = loc.id === locationId
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => { setLocationId(loc.id); setExpanded(new Map()) }}
              className={`h-[30px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-[12px] transition-colors ${
                on
                  ? 'border-amber-500 bg-amber-50 font-bold text-amber-800'
                  : 'border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50'
              }`}
            >
              {loc.name}
            </button>
          )
        })}
      </div>

      {/* Start from a shape */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        <div className="min-w-[148px] shrink-0">
          <div className="text-[12.5px] font-bold text-[#0A1220]">Start from a shape</div>
          <div className="text-[11.5px] text-slate-400">Then rename anything</div>
        </div>
        {PRESETS.map((p) => {
          const on = activePreset === p.label
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => { setLayers(withIds(p.layers)); setActivePreset(p.label); setExpanded(new Map()) }}
              className={`min-w-[132px] flex-1 rounded-[9px] border px-3 py-2 text-left transition-colors ${
                on ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block text-[12px] font-bold">{p.label}</span>
              <span className="mt-px block font-mono text-[10.5px] font-semibold opacity-70">
                {p.layers.map((l) => l.name).join(' › ')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-2.5 lg:grid-cols-[392px_1fr]">
        {/* ── layer stack ── */}
        <div className="flex flex-col gap-2.5">
          {layers.map((layer, i) => {
            const parent = i > 0 ? layers[i - 1].name : null
            const depthChip = i === 0 ? 'Outermost' : i === layers.length - 1 ? 'Innermost' : `Inside ${parent?.toLowerCase()}`
            return (
              <div key={layer.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ${
                    i === 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {depthChip}
                  </span>
                  <input
                    value={layer.name}
                    list="cb-layer-names"
                    onChange={(e) => patch(layer.id, { name: e.target.value })}
                    placeholder="Layer name"
                    className="h-[30px] min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-[12.5px] font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === layers.length - 1} title="Move down"
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {/* The last layer can't go — a structure with no layers is not a structure. */}
                  <button type="button" onClick={() => mutate((ls) => ls.filter((l) => l.id !== layer.id))}
                    disabled={layers.length === 1} title="Remove layer"
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        {i === 0 ? 'How many' : `Per ${parent?.toLowerCase()}`}
                      </span>
                      <button type="button" onClick={() => patch(layer.id, { count: Math.max(1, layer.count - 1) })}
                        className="h-6 w-6 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">−</button>
                      <span className="min-w-[26px] text-center font-mono text-[13px] font-bold text-[#0A1220]">{layer.count}</span>
                      <button type="button" onClick={() => patch(layer.id, { count: Math.min(60, layer.count + 1) })}
                        className="h-6 w-6 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">+</button>
                    </div>

                    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      {(['num', 'pad', 'alpha'] as Mode[]).map((m) => (
                        <button key={m} type="button" onClick={() => patch(layer.id, { mode: m })}
                          className={`h-[22px] whitespace-nowrap rounded-md px-2 font-mono text-[10.5px] font-bold ${
                            layer.mode === m ? 'bg-white text-[#0A1220] shadow-sm' : 'text-slate-500'
                          }`}>
                          {m === 'num' ? '1,2,3' : m === 'pad' ? '01,02' : 'A,B,C'}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Code</span>
                      <input value={layer.prefix} onChange={(e) => patch(layer.id, { prefix: e.target.value })}
                        placeholder="none"
                        className="h-[26px] w-[62px] rounded-md border border-slate-200 px-2 font-mono text-[12px] font-bold text-slate-900 focus:border-amber-500 focus:outline-none" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11.5px] font-bold text-slate-600">
                      {sample(layer)}
                    </span>
                    <div className="min-w-[4px] flex-1" />
                    <button type="button" onClick={() => patch(layer.id, { stock: !layer.stock })}
                      title="Can stock sit directly in this, or does it only hold other things?"
                      className={`flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11.5px] font-bold ${
                        layer.stock ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-400'
                      }`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        {layer.stock ? <path d="M4 12.5l5 5L20 7" /> : <path d="M8 3v10M3 8h10" />}
                      </svg>
                      Holds stock
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          <button type="button" onClick={addLayer} disabled={layers.length >= 8}
            className="flex h-[38px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add a deeper layer
          </button>
        </div>

        {/* ── live preview ── */}
        <div className="flex flex-col gap-2.5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-3.5 py-3">
              <div className="min-w-[180px] flex-1">
                <div className="text-[13px] font-bold text-[#0A1220]">What you&rsquo;ll get in {locationName}</div>
                <div className="mt-px text-[11.5px] text-slate-400">
                  {(data?.chain ?? []).join(' › ')} · {data?.totals.levels ?? 0} levels deep
                </div>
              </div>
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[11.5px] font-extrabold ${
                overBudget ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-600'
              }`}>
                {total.toLocaleString('en-US')} nodes · {(data?.totals.stock_nodes ?? 0).toLocaleString('en-US')} hold stock
              </span>
            </div>

            <div className="max-h-[372px] overflow-y-auto py-1.5">
              {preview.isLoading && <p className="px-3.5 py-8 text-center text-[13px] text-slate-500">Working it out…</p>}
              {preview.isError && (
                <p className="px-3.5 py-8 text-center text-[13px] text-rose-700">
                  {(preview.error as Error)?.message || 'Could not build a preview.'}
                </p>
              )}
              {data && !data.truncated && (
                <PreviewTree nodes={data.nodes} layers={layers} expanded={expanded} setExpanded={setExpanded} />
              )}
              {data?.truncated && (
                <p className="px-3.5 py-8 text-center text-[13px] text-rose-700">
                  {data.conflicts[0]?.message}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3">
              <span className="min-w-[200px] flex-1 text-[11.5px] text-slate-500">
                Uneven bays are normal — every node stays editable after this, so add or delete a single
                one any time.
              </span>
              <button type="button" onClick={onClose}
                className="h-[30px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={() => create.mutate()}
                disabled={create.isPending || !data || data.truncated || total === 0}
                className="h-[30px] shrink-0 rounded-lg bg-amber-500 px-3.5 text-[12px] font-bold text-[#0F1A2E] hover:bg-amber-600 disabled:opacity-50">
                {create.isPending ? 'Creating…' : `Create ${total.toLocaleString('en-US')} nodes`}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{error}</div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <PutAwayLabel nodes={data?.nodes ?? []} place={locationName} />
            <Conflicts conflicts={data?.conflicts ?? []} place={locationName} truncated={!!data?.truncated} />
          </div>
        </div>
      </div>

      <datalist id="cb-layer-names">
        {NAME_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}

/**
 * The tree, capped at 5 siblings per parent.
 *
 * Rendering all 570 would be honest but useless — you cannot read it, and the
 * point is to recognise the SHAPE. Five and a count of the rest does that.
 */
function PreviewTree({
  nodes, layers, expanded, setExpanded,
}: {
  nodes: PreviewNode[]
  layers: Layer[]
  expanded: Map<string, boolean>
  setExpanded: (m: Map<string, boolean>) => void
}) {
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, PreviewNode[]>()
    for (const n of nodes) {
      const list = map.get(n.parent_temp_key) ?? []
      list.push(n)
      map.set(n.parent_temp_key, list)
    }
    return map
  }, [nodes])

  const setOpen = (key: string, open: boolean) => {
    const next = new Map(expanded)
    next.set(key, open)
    setExpanded(next)
  }

  // Deepest-first descendant counts, for the "4 shelves · 40 bins" summary.
  const summaryOf = (node: PreviewNode): string => {
    const parts: string[] = []
    let level = childrenOf.get(node.temp_key) ?? []
    while (level.length > 0) {
      parts.push(`${level.length.toLocaleString('en-US')} ${plural(level[0].kind, level.length)}`)
      level = level.flatMap((c) => childrenOf.get(c.temp_key) ?? [])
    }
    return parts.join(' · ')
  }

  const render = (parentKey: string | null, depth: number): React.ReactNode[] => {
    const all = childrenOf.get(parentKey) ?? []
    const shown = all.slice(0, 5)
    const rows: React.ReactNode[] = []

    for (const node of shown) {
      const kids = childrenOf.get(node.temp_key) ?? []
      // Top two levels start open — enough to read the shape without scrolling
      // past 80 bins to reach the second rack. Anything the user has clicked
      // wins over that default, in both directions.
      const isOpen = kids.length > 0 && (expanded.get(node.temp_key) ?? depth < 2)
      rows.push(
        <div key={node.temp_key} className="flex items-center gap-2 overflow-hidden py-1 pr-3.5"
          style={{ paddingLeft: 14 + depth * 20 }}>
          {kids.length > 0 ? (
            <button type="button"
              onClick={() => setOpen(node.temp_key, !isOpen)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.bin_code}`}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[11px] font-extrabold text-slate-600">
              {isOpen ? '–' : '+'}
            </button>
          ) : (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[11px] text-slate-300">·</span>
          )}
          <span className={`shrink-0 rounded-md px-1.5 py-px font-mono text-[11.5px] font-bold ${
            depth === 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
          }`}>
            {node.bin_code}
          </span>
          <span className="min-w-[42px] flex-1 truncate text-[12px] text-slate-500">{node.name}</span>
          <span className="min-w-0 shrink truncate text-right text-[11.5px] text-slate-400">{summaryOf(node)}</span>
          {node.holds_stock && (
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
              stock
            </span>
          )}
        </div>,
      )
      if (isOpen) rows.push(...render(node.temp_key, depth + 1))
    }

    if (all.length > shown.length) {
      const rest = all.length - shown.length
      rows.push(
        <div key={`more-${parentKey}`} className="py-1 pr-3.5 text-[11.5px] text-slate-400"
          style={{ paddingLeft: 34 + depth * 20 }}>
          + {rest.toLocaleString('en-US')} more {plural(all[0].kind, rest)} like these
        </div>,
      )
    }

    return rows
  }

  if (nodes.length === 0) {
    return <p className="px-3.5 py-8 text-center text-[13px] text-slate-500">Name a layer to see what you&rsquo;ll get.</p>
  }
  void layers
  return <>{render(null, 0)}</>
}

/** The sticker, before anyone prints 570 of them. */
function PutAwayLabel({ nodes, place }: { nodes: PreviewNode[]; place: string }) {
  const deepest = nodes.reduce<PreviewNode | null>(
    (best, n) => (n.holds_stock && (!best || n.depth > best.depth) ? n : best), null)

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="text-[12.5px] font-bold text-[#0A1220]">Put-away label</div>
      <p className="mb-2.5 mt-1 text-[11.5px] leading-relaxed text-slate-500">
        What prints on the sticker and what a tech reads off their phone.
      </p>
      {deepest ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-slate-200 bg-slate-50/60 p-2.5">
          <span className="h-[46px] w-[46px] shrink-0 rounded-md"
            style={{ background: 'repeating-conic-gradient(#0F172A 0% 25%, #fff 0% 50%) 50% / 8px 8px' }} />
          <div className="min-w-0">
            <div className="font-mono text-[15px] font-extrabold text-[#0A1220]">
              {deepest.path.split(' / ').slice(-2).join(' · ')}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{place} / {deepest.path}</div>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-slate-400">
          No layer holds stock yet — turn on &ldquo;Holds stock&rdquo; where things actually sit.
        </p>
      )}
    </div>
  )
}

function Conflicts({
  conflicts, place, truncated,
}: {
  conflicts: Array<{ path?: string; message: string }>
  place: string
  truncated: boolean
}) {
  if (truncated) return <div />
  const clean = conflicts.length === 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${clean ? 'bg-emerald-500' : 'bg-amber-600'}`} />
        <span className="text-[12.5px] font-bold text-[#0A1220]">
          {clean ? `Nothing clashes in ${place}` : `${conflicts.length} already exist in ${place}`}
        </span>
      </div>
      <p className="mb-2 mt-1 text-[11.5px] leading-relaxed text-slate-500">
        {clean
          ? 'Every code in this structure is new here.'
          : 'Existing places keep their stock and history. The duplicates are skipped, not overwritten.'}
      </p>
      {!clean && (
        <div className="flex flex-col gap-1.5">
          {conflicts.slice(0, 6).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span className="truncate font-mono text-[11px] font-bold text-slate-600">{c.path}</span>
              <div className="min-w-[4px] flex-1" />
              <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">skipped</span>
            </div>
          ))}
          {conflicts.length > 6 && (
            <span className="text-[11px] text-slate-400">+ {conflicts.length - 6} more</span>
          )}
        </div>
      )}
    </div>
  )
}
