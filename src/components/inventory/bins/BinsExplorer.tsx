/**
 * Inventory › Bins. Every location with its racks, shelves, bins and rows,
 * as a tree or as racks of tiles, with a panel for the place you pick.
 *
 * The page (InventoryPage's BinsTab) owns the data and the existing forms;
 * this owns the screen. The rules live in lib/binTree.ts and
 * lib/binReceive.ts and are tested in scripts/bin-tree.test.mjs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listStockLevels } from '@/lib/inventoryStockLevels'
import {
  ancestorsOf, buildBinTree, filterTree, flattenTree, selectedBinIds, tickState, toggleSelect, treeTotals,
  type NodeType, type StockCell, type TreeBin, type TreeLocation,
} from '@/lib/binTree'
import { childWord, contextMenu, nextCodeFor, receivableCount, stockTargets, type MenuId } from '@/lib/binReceive'
import { binLabelPickUrl } from '@/lib/binLabelPick'
import { resolveScan } from '@/lib/scanResolve'
import { usePoOverrideStatus } from '@/hooks/usePoOverride'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useReceivablePurchaseOrders } from '@/hooks/useReceivablePurchaseOrders'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import { BinTreeRows } from './BinTreeRows'
import { BinRackView } from './BinRackView'
import { BinDetailPanel } from './BinDetailPanel'
import { BinContextMenu } from './BinContextMenu'
import { ReceiveFromPoModal } from './ReceiveFromPoModal'
import { SetCapacityModal } from './SetCapacityModal'
import { StartPoFromBinModal } from './StartPoFromBinModal'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { restoreCapacities } from './restoreCapacities'
import { BulkAddRowsModal } from '@/components/inventory/structure/BulkAddRowsModal'
import { canUndo, undoCreatedPlaces } from '@/lib/structureTemplates'
import './bins.css'
import { UndoToast } from '@/components/ui/UndoToast'
import { useUndoToast } from '@/hooks/useUndoToast'
import { TypeIcon } from './binUi'
import { TYPE_LABEL, fmtNum } from './binStyle'

export interface AddChildDefaults {
  code: string | null
  kind: string | null
  name: string | null
  sortOrder: number
  holdsStock: boolean | undefined
  capacity: number | null
}

export interface BinsExplorerProps<B extends TreeBin> {
  locations: TreeLocation[]
  bins: B[]
  rollup: Record<string, StockCell>
  canEdit: boolean
  poRequired: boolean
  onEdit: (bin: B) => void
  onAddChild: (parent: B, defaults: AddChildDefaults) => void
  onAddRoot: (locationId: string) => void
  onOpenCatalog: (bin: B) => void
  /** The existing "Add stock" modal, landing in this bin (or this location, to pick a bin in it). */
  onAddStock: (at: { bin: B | null; locationId: string | null }) => void
}

const VIEW_KEY = 'crewbarn.bins.view'
const HINT_KEY = 'crewbarn.bins.menuHintSeen'
const TYPE_CHIPS: NodeType[] = ['rack', 'shelf', 'bin', 'row']

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

function readLocal(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLocal(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}


const WIDE_QUERY = '(min-width: 1440px)'
const ROOMY_QUERY = '(min-width: 1024px)'

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const change = () => setOn(mq.matches)
    change()
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [query])
  return on
}

export function BinsExplorer<B extends TreeBin>(props: BinsExplorerProps<B>) {
  const { locations, bins, rollup, canEdit, poRequired } = props
  const navigate = useNavigate()
  const qc = useQueryClient()
  const tree = useMemo(() => buildBinTree(locations, bins, rollup), [locations, bins, rollup])
  const binById = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins])
  const totals = useMemo(() => treeTotals(tree), [tree])
  const receivable = useReceivablePurchaseOrders(canEdit)
  const openPoLines = canEdit ? (receivable.data ? receivableCount(receivable.data.data) : undefined) : 0

  const [view, setView] = useState<'tree' | 'rack'>(() => (readLocal(VIEW_KEY, 'tree') === 'rack' ? 'rack' : 'tree'))
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [types, setTypes] = useState<Set<NodeType>>(new Set())
  const [locationId, setLocationId] = useState('')
  const [emptyOnly, setEmptyOnly] = useState(false)
  const [nearFullOnly, setNearFullOnly] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  const [poTarget, setPoTarget] = useState<{ id: string; from: string } | null>(null)
  const [capIds, setCapIds] = useState<string[] | null>(null)
  const [startPoId, setStartPoId] = useState<string | null>(null)
  const perms = usePermissions()
  const canOrder = perms.has(PERM.INVENTORY_EDIT) || perms.has(PERM.INVENTORY_ORDER)
  const [rowIds, setRowIds] = useState<string[] | null>(null)
  /** Add product: open, and where from (null = start with the product). */
  const [toast, setToast] = useUndoToast()
  const [hintSeen, setHintSeen] = useState(() => readLocal(HINT_KEY, '') === '1')
  const searchRef = useRef<HTMLInputElement>(null)
  const listWrap = useRef<HTMLDivElement>(null)
  const [listHeight, setListHeight] = useState(520)
  // One detail panel at a time: beside the list on a wide screen (1440px
  // and up), sliding in from the right on a 1080p-sized window, and a
  // bottom sheet on a phone. A fixed column beside the racks squashed them
  // on a 27" 1080p monitor.
  const wide = useMedia(WIDE_QUERY)
  const roomy = useMedia(ROOMY_QUERY)

  useEffect(() => { writeLocal(VIEW_KEY, view) }, [view])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => {
    const el = listWrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setListHeight(Math.max(320, el.clientHeight)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [view])

  // Search by what is inside too: the places holding an item whose name,
  // SKU or barcode matches (the stock list's item_q filter).
  const itemQ = debounced.trim()
  const { data: itemHits } = useQuery({
    queryKey: ['inventory-stock-levels', 'bins-item-search', itemQ],
    queryFn: () => listStockLevels({ item_q: itemQ, has_stock: true, per_page: 200 }),
    enabled: itemQ.length >= 2,
    staleTime: 30_000,
  })
  const holding = useMemo(() => {
    const ids = new Set<string>()
    const names = new Set<string>()
    if (itemQ.length < 2) return { ids, names }
    for (const l of itemHits?.data ?? []) {
      if (!l.bin_id) continue
      ids.add(l.bin_id)
      if (l.catalog_item?.name) names.add(l.catalog_item.name)
    }
    return { ids, names }
  }, [itemHits, itemQ])
  const filter = useMemo(
    () => filterTree(tree, { query: debounced, types, emptyOnly, nearFullOnly, locationId: locationId || undefined, alsoMatch: holding.ids }),
    [tree, debounced, types, emptyOnly, nearFullOnly, locationId, holding.ids],
  )
  const narrowing = !!(debounced.trim() || types.size || emptyOnly || nearFullOnly)
  // A search opens the way to what it found; clearing it puts things back.
  const effectiveOpen = useMemo(() => (narrowing ? new Set([...open, ...filter.expand]) : open), [open, filter.expand, narrowing])
  const rows = useMemo(() => flattenTree(tree, effectiveOpen, filter.visible), [tree, effectiveOpen, filter.visible])
  const shownLocations = tree.roots.filter((id) => !filter.visible || filter.visible.has(id))

  const toggleOpen = useCallback((id: string) => setOpen((prev) => {
    const next = new Set(narrowing ? [...prev, ...filter.expand] : prev)
    if (next.has(id) && effectiveOpen.has(id)) next.delete(id); else next.add(id)
    return next
  }), [narrowing, filter.expand, effectiveOpen])

  const reveal = useCallback((id: string) => {
    setOpen((prev) => new Set([...prev, ...ancestorsOf(tree, id).map((a) => a.id)]))
    setSelectedId(id)
    setFocusId(id)
  }, [tree])

  const pick = useCallback((id: string) => {
    setSelectedId(id)
    setFocusId(id)
    const n = tree.nodes.get(id)
    // Opening a location from the list is the common first move.
    if (n?.type === 'location' && !effectiveOpen.has(id)) toggleOpen(id)
  }, [tree, effectiveOpen, toggleOpen])

  const tick = useCallback((id: string) => setTicked((prev) => toggleSelect(tree, prev, id)), [tree])
  const tickOf = useCallback((id: string) => tickState(tree, ticked, id), [tree, ticked])
  const pickedBins = useMemo(() => selectedBinIds(tree, ticked), [tree, ticked])

  const openMenu = useCallback((id: string, at: { x: number; y: number }) => {
    if (!tree.nodes.has(id)) return
    setMenu({ id, at })
    if (!hintSeen) { setHintSeen(true); writeLocal(HINT_KEY, '1') }
  }, [tree, hintSeen])

  const { data: overrideStatus } = usePoOverrideStatus(canEdit && poRequired)
  const rules = { canEdit, poRequired, openPoLines, canOrder }
  const runAction = (action: MenuId | 'move' | 'edit', nodeId: string, targetId?: string) => {
    const n = tree.nodes.get(nodeId)
    const bin = binById.get(nodeId)
    setMenu(null)
    if (!n) return
    if (action === 'details') { reveal(nodeId); return }
    if (action === 'catalog' && bin) { props.onOpenCatalog(bin); return }
    if ((action === 'move' || action === 'edit') && bin) { props.onEdit(bin); return }
    if (action === 'print') {
      navigate(n.children.length ? `/inventory-bins/${nodeId}/labels?include=descendants` : `/inventory-bins/${nodeId}/labels`)
      return
    }
    if (action === 'capacity') { setCapIds([nodeId]); return }
    if (action === 'start-po') { if (canOrder) setStartPoId(nodeId); return }
    if (action === 'add-row' && bin) {
      const kids = n.children.map((c) => tree.nodes.get(c)!).filter(Boolean)
      const kind = childWord(tree, nodeId)
      const sort = kids.reduce((m, k) => Math.max(m, k.bin?.sort_order ?? 0), 0) + 1
      const caps = new Set(kids.map((k) => k.bin?.capacity ?? null))
      const holds = new Set(kids.map((k) => k.holdsStock))
      props.onAddChild(bin, {
        code: nextCodeFor(tree, nodeId),
        kind: kind === 'place' ? null : kind,
        // The builder names places "Row 1", "Row 2"… by position.
        name: kind === 'place' ? null : `${kind} ${kids.length ? sort : 1}`,
        sortOrder: kids.length ? sort : 1,
        // A new row is like its neighbours: same holds-stock, same capacity.
        holdsStock: holds.size === 1 ? [...holds][0] : undefined,
        capacity: caps.size === 1 ? [...caps][0] : null,
      })
      return
    }
    if (action === 'add-product') {
      // One way in from every node. A spot that holds stock is used as is; a
      // container with one spot inside uses that; otherwise the next screen
      // asks where (the PO overlay's spot list, or the Add stock modal's bin picker).
      const ts = stockTargets(tree, nodeId)
      const target = targetId ?? (n.type !== 'location' && n.holdsStock ? nodeId : ts.length === 1 ? ts[0].id : null)
      if (ts.length === 0) { setToast({ text: `Nothing in ${n.label} can hold stock yet. Add a bin or row first.` }); return }
      if (poRequired) { setPoTarget({ id: target ?? ts[0].id, from: nodeId }); return }
      const tb = target ? binById.get(target) ?? null : null
      props.onAddStock({ bin: tb, locationId: n.locationId })
      return
    }
    if (action === 'add-po') {
      const ts = stockTargets(tree, nodeId)
      const target = targetId ?? (ts.find((t) => t.id === nodeId) ?? ts[0])?.id
      if (target) setPoTarget({ id: target, from: nodeId })
    }
  }

  // "+ Stock in › From a purchase order" (header, Stock Levels) lands here
  // with ?stockin=po: open the same PO window the toolbar's add-po does, once
  // per visit (state adjusted while rendering, not in an effect). Closing the
  // window drops the parameter, so the next pick opens it again.
  const [stockInParams, setStockInParams] = useSearchParams()
  const wantsPo = stockInParams.get('stockin') === 'po'
  const [stockInSeen, setStockInSeen] = useState(false)
  if (wantsPo !== stockInSeen) {
    setStockInSeen(wantsPo)
    const root = locationId || tree.roots[0]
    const ts = wantsPo && canEdit && root ? stockTargets(tree, root) : []
    if (ts.length) setPoTarget({ id: ts[0].id, from: root })
  }
  const closePo = () => {
    setPoTarget(null)
    if (wantsPo) {
      const next = new URLSearchParams(stockInParams)
      next.delete('stockin')
      setStockInParams(next, { replace: true })
    }
  }

  // A barcode gun anywhere on the page finds what it scanned: a bin sticker,
  // or a unit's QR (its bin). The shared decoder says what the code is; a
  // plain code falls back to a bin's own barcode or code.
  useHardwareScanner((payload) => {
    void resolveScan(payload).then((r) => {
      const id = r.kind === 'bin' ? r.bin.id : r.kind === 'stock_unit' ? r.unit.current_bin_id : null
      if (id && tree.nodes.has(id)) { reveal(id); setToast({ text: r.label }); return }
      if (r.kind === 'text') {
        const v = r.text.toLowerCase()
        const hit = bins.find((b) => (b.barcode ?? '').toLowerCase() === v || (b.qr_code_value ?? '').toLowerCase() === v)
          ?? bins.find((b) => (b.bin_code ?? '').toLowerCase() === v)
        if (hit) { reveal(hit.id); setToast({ text: `Found ${hit.path_label || hit.name || hit.bin_code}` }); return }
        setToast({ text: `No bin has the code ${r.text}` })
        return
      }
      setToast({ text: r.kind === 'product' ? 'That is a product label. Scan a bin to find it here.' : r.label })
    })
  })

  // Keyboard: arrows move, Enter picks, / searches, R and T switch views,
  // X ticks, the menu key opens the menu, Esc steps back.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (menu || poTarget || capIds || rowIds || startPoId) return
    if (e.key === 'Escape') {
      if (isTyping(e.target) && query) { setQuery(''); return }
      if (selectMode) { setSelectMode(false); setTicked(new Set()); return }
      if (selectedId) { setSelectedId(null); return }
      return
    }
    if (isTyping(e.target)) {
      if (e.key === 'ArrowDown' && view === 'tree' && rows.length) { e.preventDefault(); setFocusId(rows[0].id); (e.currentTarget as HTMLElement).focus() }
      return
    }
    const i = focusId ? rows.findIndex((r) => r.id === focusId) : -1
    const cur = i >= 0 ? rows[i] : null
    switch (e.key) {
      case '/': e.preventDefault(); searchRef.current?.focus(); return
      case 'r': case 'R': if (!e.metaKey && !e.ctrlKey) setView('rack'); return
      case 't': case 'T': if (!e.metaKey && !e.ctrlKey) setView('tree'); return
      case 'x': case 'X':
        if (e.metaKey || e.ctrlKey) return
        if (!selectMode) setSelectMode(true)
        else if (cur) tick(cur.id)
        return
    }
    if (view !== 'tree') return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) setFocusId(next.id)
    } else if (e.key === 'ArrowRight' && cur) {
      e.preventDefault()
      if (cur.hasChildren && !cur.open) toggleOpen(cur.id)
      else if (cur.open && rows[i + 1]) setFocusId(rows[i + 1].id)
    } else if (e.key === 'ArrowLeft' && cur) {
      e.preventDefault()
      if (cur.open) toggleOpen(cur.id)
      else { const p = tree.nodes.get(cur.id)?.parentId; if (p) setFocusId(p) }
    } else if ((e.key === 'Enter' || e.key === ' ') && cur) {
      e.preventDefault()
      if (selectMode) tick(cur.id); else pick(cur.id)
    } else if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && cur) {
      e.preventDefault()
      const el = document.querySelector(`[data-node-id="${cur.id}"]`)
      const r = el?.getBoundingClientRect()
      openMenu(cur.id, { x: (r?.left ?? 100) + 60, y: r?.bottom ?? 100 })
    }
  }

  const clearFilters = () => { setQuery(''); setTypes(new Set()); setEmptyOnly(false); setNearFullOnly(false) }
  const menuNode = menu ? tree.nodes.get(menu.id) : null
  const detail = selectedId ? tree.nodes.get(selectedId) : null
  const noBins = bins.length === 0

  const kbd = 'rounded border px-1'
  const keyHints = (
    <>
      <span className="block"><kbd className={kbd}>↑</kbd> <kbd className={kbd}>↓</kbd> move · <kbd className={kbd}>→</kbd> open · <kbd className={kbd}>Enter</kbd> pick</span>
      <span className="block"><kbd className={kbd}>/</kbd> find · <kbd className={kbd}>R</kbd> racks · <kbd className={kbd}>T</kbd> list · <kbd className={kbd}>X</kbd> tick</span>
    </>
  )
  const totalsTiles = (
    <>
      <div className="rounded-lg bg-[var(--bins-softer)] p-2.5"><div className="text-[16px] font-bold text-[var(--bins-text)]">{fmtNum(totals.places)}</div><div className="text-[11px]">places</div></div>
      <div className="rounded-lg bg-[var(--bins-softer)] p-2.5"><div className="text-[16px] font-bold text-[var(--bins-text)]">{fmtNum(totals.amount)}</div><div className="text-[11px]">units stored</div></div>
    </>
  )

  return (
    <div data-bins-ui onKeyDown={onKeyDown} tabIndex={-1} className="outline-none">
      {/* Toolbar */}
      <div data-easy-list-toolbar data-tour="inv-bins-filters" className="space-y-2.5 border-b border-[var(--bins-border-soft)] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <svg className="pointer-events-none absolute left-3 top-[13px] text-[var(--bins-muted)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a bin, or what's in it: name, code, item or SKU…" aria-label="Find a bin"
              className="h-11 w-full rounded-lg border border-[var(--bins-border)] pl-9 pr-12 text-[14px] focus:border-amber-500 focus:outline-none" />
            <kbd className="pointer-events-none absolute right-3 top-3 hidden rounded border border-[var(--bins-border)] border-b-2 px-1.5 text-[11px] text-[var(--bins-muted)] sm:block">/</kbd>
          </div>
          {canEdit && (
            <button type="button" data-tour="inv-bins-add-product" onClick={() => runAction('add-product', selectedId ?? (locationId || tree.roots[0] || ''))}
              className="h-11 rounded-lg bg-[var(--bins-accent)] px-4 text-[14px] font-bold text-white hover:bg-[var(--bins-accent-strong)]">
              + Add product
            </button>
          )}
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location"
            className="h-11 rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-[14px] focus:border-amber-500 focus:outline-none">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div role="group" aria-label="View" className="inline-flex rounded-lg border border-[var(--bins-border)] bg-[var(--bins-soft)] p-[3px]">
            {(['tree', 'rack'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} title={v === 'tree' ? 'List (T)' : 'Racks (R)'}
                className={`h-9 rounded-md px-3 text-[13px] font-semibold ${view === v ? 'bg-[var(--bins-surface)] text-[var(--bins-text)] shadow-sm' : 'text-[var(--bins-muted)]'}`}>
                {v === 'tree' ? 'List' : 'Racks'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={types.size === 0} onClick={() => setTypes(new Set())}
            className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold ${chipOn(types.size === 0)}`}>
            All kinds
          </button>
          {TYPE_CHIPS.map((t) => (
            <button key={t} type="button" data-type-chip={t} aria-pressed={types.has(t)}
              onClick={() => setTypes((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold ${chipOn(types.has(t))}`}>
              <TypeIcon type={t} size={18} /> {TYPE_LABEL[t]}
            </button>
          ))}
          <span className="mx-1 hidden h-6 border-l border-[var(--bins-border)] sm:block" />
          <Stat on={emptyOnly} onClick={() => setEmptyOnly((v) => !v)} label="Empty spots" value={totals.emptySpots} title="Places that can take stock and have nothing in them" />
          {totals.nearFull > 0 || nearFullOnly ? (
            <Stat on={nearFullOnly} onClick={() => setNearFullOnly((v) => !v)} label="Near full" value={totals.nearFull} title="Places at 85% of their capacity or more" />
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            {view === 'tree' && (
              <span data-tour="inv-bins-expand" className="flex items-center gap-1">
                <button type="button" onClick={() => setOpen(new Set(tree.nodes.keys()))} className="h-10 rounded-lg px-2.5 text-[12.5px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Expand all</button>
                <button type="button" onClick={() => setOpen(new Set())} className="h-10 rounded-lg px-2.5 text-[12.5px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Collapse all</button>
              </span>
            )}
            <button type="button" aria-pressed={selectMode} onClick={() => { setSelectMode((v) => !v); setTicked(new Set()) }} title="Tick several places to print labels or set capacity together (X)"
              className={`h-10 rounded-lg border px-3 text-[12.5px] font-semibold ${selectMode ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-[var(--bins-border)] text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]'}`}>
              {selectMode ? 'Done ticking' : 'Select'}
            </button>
          </div>
        </div>
        {narrowing && (
          <div role="status" data-tour="inv-bins-filter-bar" className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--bins-accent-line)] bg-[var(--bins-accent-soft)] px-3 py-2 text-[13px] text-[var(--bins-accent-ink)]">
            <span><b>Showing {filterWords(types, debounced, emptyOnly, nearFullOnly)}</b> · {fmtNum(filter.matches.size)} found, highlighted. Open any of them to see what is inside.</span>
            {holding.ids.size > 0 && (
              <span data-bins-item-hits className="basis-full text-[12.5px]">
                Includes {fmtNum(holding.ids.size)} place{holding.ids.size === 1 ? '' : 's'} holding {[...holding.names].slice(0, 3).join(', ')}{holding.names.size > 3 ? ` and ${holding.names.size - 3} more` : ''}.
              </span>
            )}
            <button type="button" onClick={clearFilters} className="ml-auto h-9 rounded-md px-3 font-semibold underline hover:bg-[var(--bins-surface)]">Clear</button>
          </div>
        )}
        {!hintSeen && !noBins && (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--bins-accent-soft)] px-3 py-2 text-[12.5px] text-[var(--bins-text)]">
            <span aria-hidden>💡</span>
            <span><b>Tip:</b> right-click any bin (or press and hold on a phone) for quick actions, like adding stock from a purchase order. A barcode scanner finds a bin too.</span>
            <button type="button" onClick={() => { setHintSeen(true); writeLocal(HINT_KEY, '1') }} className="ml-auto shrink-0 rounded-md px-2 py-1 font-semibold hover:bg-[var(--bins-soft)]">Got it</button>
          </div>
        )}
      </div>

      {noBins && locations.length > 0 && !narrowing && (
        <div data-tour="inv-bins-empty" className="px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-[var(--bins-text)]">No bins yet</p>
          <p className="mt-1 text-[13px] text-[var(--bins-muted)]">Use <b>Build structure</b> to lay out a whole rack in one go, or <b>+ New Bin</b> for one at a time.</p>
        </div>
      )}
      {narrowing && filter.matches.size === 0 && (
        <div data-tour="inv-bins-nomatch" className="px-6 py-10 text-center">
          <p className="text-[14px] text-[var(--bins-text-2)]">Nothing matches that.</p>
          <button type="button" onClick={clearFilters}
            className="mt-3 h-10 rounded-lg border border-[var(--bins-border)] px-4 text-[13px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Clear the filters</button>
        </div>
      )}

      {/* Not wide enough for a side column: the same hints and totals as one thin strip. */}
      {roomy && !wide && !(narrowing && filter.matches.size === 0) && (
        <div data-tour="inv-bins-strip" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[var(--bins-border-soft)] px-4 py-2 text-[12px] text-[var(--bins-muted)]">
          <span className="font-semibold text-[var(--bins-text-2)]">Pick a place to open it.</span>
          <span className="flex flex-wrap gap-x-3">{keyHints}</span>
          <span className="ml-auto flex gap-4">
            <span><b className="text-[13px] text-[var(--bins-text)]">{fmtNum(totals.places)}</b> places</span>
            <span><b className="text-[13px] text-[var(--bins-text)]">{fmtNum(totals.amount)}</b> units stored</span>
          </span>
        </div>
      )}

      {/* Body: list or racks, with the detail panel beside it on a wide screen. */}
      {!(narrowing && filter.matches.size === 0) && (
        <div data-easy-split="" className="min-[1440px]:grid min-[1440px]:grid-cols-[minmax(0,1fr)_clamp(320px,24vw,640px)]">
          <div ref={listWrap} className={view === 'tree' ? 'h-[max(420px,calc(100vh-330px))]' : 'max-h-[max(420px,calc(100vh-330px))] overflow-y-auto'}>
            {view === 'tree' ? (
              <BinTreeRows
                tree={tree} rows={rows} focusId={focusId} selectedId={selectedId} matches={filter.matches} query={debounced}
                selectMode={selectMode} tickOf={tickOf} onToggleOpen={toggleOpen} onPick={pick} onTick={tick} onMenu={openMenu}
                onAddRoot={props.onAddRoot} canEdit={canEdit} height={listHeight}
              />
            ) : (
              <BinRackView tree={tree} locationIds={shownLocations} visible={filter.visible} selectedId={selectedId}
                onPick={selectMode ? tick : pick} onMenu={openMenu} onAddRoot={props.onAddRoot} canEdit={canEdit} />
            )}
          </div>
          <aside className="hidden border-l border-[var(--bins-border-soft)] min-[1440px]:block">
            {detail && wide ? (
              <div className="sticky top-0 h-[max(420px,calc(100vh-330px))]">
                <BinDetailPanel tree={tree} id={detail.id} menu={contextMenu(tree, detail.id, rules)} onPick={pick} onMenu={openMenu}
                  onAction={(a) => runAction(a, detail.id)}
                  onAddRoot={props.onAddRoot} canEdit={canEdit} />
              </div>
            ) : (
              <div className="p-6 text-[13px] text-[var(--bins-muted)]">
                <p className="font-semibold text-[var(--bins-text-2)]">Pick a place to see it here.</p>
                <p className="mt-1">You'll see what's in it, how full it is, and buttons for labels, adding rows and receiving stock.</p>
                <dl className="mt-4 space-y-1 text-[12px]">{keyHints}</dl>
                <div className="mt-4 grid grid-cols-2 gap-2">{totalsTiles}</div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* A 1080p-sized window: the panel slides in from the right over the racks. */}
      {detail && !wide && roomy && (
        <div>
          <div className="fixed inset-0 z-[110] bg-[color-mix(in_srgb,var(--bins-dark)_25%,transparent)]" onClick={() => setSelectedId(null)} />
          <div role="dialog" aria-label={detail.label} data-tour="inv-bins-slideover"
            className="fixed inset-y-0 right-0 z-[111] w-[min(420px,92vw)] overflow-hidden border-l border-[var(--bins-border)] bg-[var(--bins-surface)] shadow-2xl">
            <BinDetailPanel tree={tree} id={detail.id} menu={contextMenu(tree, detail.id, rules)} onPick={pick} onMenu={openMenu}
              onAction={(a) => runAction(a, detail.id)}
              onAddRoot={props.onAddRoot} canEdit={canEdit} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}

      {/* Phones: the panel comes up from the bottom. */}
      {detail && !wide && !roomy && (
        <div>
          <div className="fixed inset-0 z-[110] bg-[color-mix(in_srgb,var(--bins-dark)_35%,transparent)]" onClick={() => setSelectedId(null)} />
          <div role="dialog" aria-label={detail.label} className="fixed inset-x-0 bottom-0 z-[111] h-[78vh] overflow-hidden rounded-t-2xl bg-[var(--bins-surface)] shadow-2xl">
            <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded bg-[var(--bins-border)]" />
            <BinDetailPanel tree={tree} id={detail.id} menu={contextMenu(tree, detail.id, rules)} onPick={pick} onMenu={openMenu}
              onAction={(a) => runAction(a, detail.id)}
              onAddRoot={props.onAddRoot} canEdit={canEdit} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}

      {/* Ticked several: what you can do with all of them. */}
      {selectMode && (
        <div role="region" aria-label="Ticked places" className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-[var(--bins-dark)] py-2 pl-4 pr-2 text-[13.5px] text-white shadow-2xl">
          <span><b className="text-amber-400">{pickedBins.length}</b> ticked</span>
          <button type="button" disabled={!pickedBins.length} onClick={() => navigate(binLabelPickUrl(pickedBins))}
            className="h-10 rounded-lg bg-amber-500 px-3.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-40">Print labels</button>
          {canEdit && (
            <button type="button" disabled={!pickedBins.length} onClick={() => setCapIds(pickedBins)}
              className="h-10 rounded-lg px-3 font-semibold hover:bg-white/10 disabled:opacity-40">Set how many fit</button>
          )}
          {canEdit && (
            <button type="button" disabled={!pickedBins.length} onClick={() => setRowIds(pickedBins)}
              className="h-10 rounded-lg px-3 font-semibold hover:bg-white/10 disabled:opacity-40">Add rows</button>
          )}
          <button type="button" onClick={() => setTicked(new Set())} className="h-10 rounded-lg px-3 text-white/70 hover:bg-white/10">Clear</button>
        </div>
      )}

      {menu && menuNode && (
        <BinContextMenu node={menuNode} items={contextMenu(tree, menu.id, rules)} targets={stockTargets(tree, menu.id)} at={menu.at}
          onChoose={(id, target) => runAction(id, menu.id, target)} onClose={() => setMenu(null)} />
      )}
      {poTarget && tree.nodes.has(poTarget.id) && (
        <ReceiveFromPoModal tree={tree} targetId={poTarget.id} targets={stockTargets(tree, poTarget.from)} onClose={closePo}
          onWithoutPo={overrideStatus?.can_override ? (id) => { closePo(); props.onAddStock({ bin: binById.get(id) ?? null, locationId: tree.nodes.get(id)?.locationId ?? null }) } : undefined} />
      )}
      {startPoId && tree.nodes.get(startPoId) && (
        <StartPoFromBinModal node={tree.nodes.get(startPoId)!} onClose={() => setStartPoId(null)} />
      )}
      {capIds && (
        <SetCapacityModal tree={tree} ids={capIds} onClose={() => setCapIds(null)}
          onSaved={(before, text) => setToast({
            text,
            undo: async () => {
              setToast(null)
              await restoreCapacities(before)
              await qc.invalidateQueries({ queryKey: inventoryBinKeys.all })
              setToast({ text: 'Put back the way it was' })
            },
          })} />
      )}
      {rowIds && (
        <BulkAddRowsModal tree={tree} ids={rowIds} onClose={() => setRowIds(null)}
          onDone={(made, text) => setToast({
            text,
            undo: !canUndo(made) ? undefined : async () => {
              setToast(null)
              try {
                await undoCreatedPlaces(made)
                setToast({ text: 'Took the new rows back out' })
              } catch (e) {
                setToast({ text: e instanceof Error ? e.message : 'Could not take the rows back out' })
              }
              await qc.invalidateQueries({ queryKey: inventoryBinKeys.all })
            },
          })} />
      )}
      <UndoToast toast={toast} />
    </div>
  )
}

function chipOn(on: boolean): string {
  return on
    ? 'border-[var(--bins-accent)] bg-[var(--bins-accent-soft)] text-[var(--bins-accent-ink)]'
    : 'border-[var(--bins-border)] bg-[var(--bins-surface)] text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]'
}

const KIND_WORDS: Record<string, string> = { rack: 'racks', shelf: 'shelves', bin: 'bins', row: 'rows', other: 'other places' }

/** "racks and shelves only", "empty spots", "matches for “b4”". */
function filterWords(types: ReadonlySet<NodeType>, query: string, empty: boolean, near: boolean): string {
  const parts: string[] = []
  if (types.size) parts.push(`${[...types].map((t) => KIND_WORDS[t] ?? t).join(' and ')} only`)
  if (empty) parts.push('empty spots')
  if (near) parts.push('near-full places')
  if (query.trim()) parts.push(`matches for “${query.trim()}”`)
  return parts.join(', ')
}

function Stat({ on, onClick, label, value, title }: { on: boolean; onClick: () => void; label: string; value: number; title: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} title={title}
      className={`flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold ${chipOn(on)}`}>
      {label} <span className="rounded-full bg-[var(--bins-soft)] px-1.5 text-[11.5px] tabular-nums text-[var(--bins-text-2)]">{fmtNum(value)}</span>
    </button>
  )
}
