/**
 * The tree, drawn as one virtual list: only the rows on screen are in the
 * page, so a shop with thousands of places scrolls as fast as one with ten.
 * Rows have two fixed heights (locations are taller), which keeps the maths
 * exact without measuring anything.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { toneFor, type BinTree, type FlatRow, type TickState, type TreeNode } from '@/lib/binTree'
import { FillBar, TypeIcon } from './binUi'
import { fmtNum } from './binStyle'

export const ROW_H = 40
export const LOC_H = 52
const OVERSCAN = 8

export interface TreeRowsProps {
  tree: BinTree
  rows: FlatRow[]
  focusId: string | null
  selectedId: string | null
  matches: Set<string>
  query: string
  selectMode: boolean
  tickOf: (id: string) => TickState
  onToggleOpen: (id: string) => void
  onPick: (id: string) => void
  onTick: (id: string) => void
  onMenu: (id: string, at: { x: number; y: number }) => void
  onAddRoot?: (locationId: string) => void
  canEdit: boolean
  /** Height of the scroll area. */
  height: number
}

function rowHeight(tree: BinTree, r: FlatRow): number {
  return tree.nodes.get(r.id)?.type === 'location' ? LOC_H : ROW_H
}

/** Highlight the typed text inside a label. */
function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-200/80 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function siblingsOf(tree: BinTree, n: TreeNode): TreeNode[] {
  const p = n.parentId ? tree.nodes.get(n.parentId) : null
  return p ? p.children.map((c) => tree.nodes.get(c)!).filter(Boolean) : [n]
}

export function BinTreeRows(props: TreeRowsProps) {
  const { tree, rows, height } = props
  const scroller = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  // The pinned header stops short of the scrollbar.
  const [scrollbar, setScrollbar] = useState(0)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setScrollbar(el.offsetWidth - el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const offsets = useMemo(() => {
    const out = new Array<number>(rows.length + 1)
    out[0] = 0
    for (let i = 0; i < rows.length; i++) out[i + 1] = out[i] + rowHeight(tree, rows[i])
    return out
  }, [rows, tree])
  const total = offsets[rows.length]

  // First row on screen, by binary search over the offsets.
  const first = useMemo(() => {
    let lo = 0
    let hi = rows.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1
      else hi = mid
    }
    return lo
  }, [offsets, rows.length, scrollTop])
  let last = first
  while (last < rows.length && offsets[last] < scrollTop + height) last++
  const start = Math.max(0, first - OVERSCAN)
  const end = Math.min(rows.length, last + OVERSCAN)

  // Keep the focused row on screen while moving with the arrow keys.
  useEffect(() => {
    if (!props.focusId || !scroller.current) return
    const i = rows.findIndex((r) => r.id === props.focusId)
    if (i < 0) return
    const top = offsets[i]
    const bottom = offsets[i + 1]
    const el = scroller.current
    if (top < el.scrollTop + LOC_H) el.scrollTop = Math.max(0, top - LOC_H)
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  }, [props.focusId, rows, offsets])

  // The location you are scrolling through stays pinned at the top.
  let pinned: FlatRow | null = null
  for (let i = first; i >= 0; i--) {
    const r = rows[i]
    if (r && tree.nodes.get(r.id)?.type === 'location') { pinned = r; break }
  }
  const pinnedIndex = pinned ? rows.indexOf(pinned) : -1
  const showPinned = pinned && offsets[pinnedIndex] < scrollTop

  return (
    <div className="relative">
      <div
        ref={scroller}
        role="tree"
        aria-label="Bins"
        aria-multiselectable={props.selectMode || undefined}
        className="relative overflow-y-auto overscroll-contain"
        style={{ height }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: total, position: 'relative' }}>
          {rows.slice(start, end).map((r, k) => {
            const i = start + k
            return (
              <div key={r.id} style={{ position: 'absolute', top: offsets[i], left: 0, right: 0, height: offsets[i + 1] - offsets[i] }}>
                <Row {...props} row={r} />
              </div>
            )
          })}
        </div>
      </div>
      {showPinned && pinned && (
        <div className="absolute left-0 top-0 z-10 shadow-[0_2px_6px_rgba(11,18,32,.08)]" style={{ height: LOC_H, right: scrollbar }}>
          <Row {...props} row={pinned} pinned />
        </div>
      )}
    </div>
  )
}

function Row(props: TreeRowsProps & { row: FlatRow; pinned?: boolean }) {
  const { tree, row, selectMode, canEdit } = props
  const n = tree.nodes.get(row.id)!
  const isLoc = n.type === 'location'
  const selected = props.selectedId === n.id
  const focused = props.focusId === n.id
  const tick = selectMode ? props.tickOf(n.id) : 'none'
  const tone = toneFor(n, siblingsOf(tree, n))
  const match = props.matches.has(n.id)

  const openMenu = (e: ReactMouseEvent) => {
    if (isLoc) return
    e.preventDefault()
    props.onMenu(n.id, { x: e.clientX, y: e.clientY })
  }

  return (
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.hasChildren ? row.open : undefined}
      aria-selected={selectMode ? tick === 'all' : selected}
      data-node-id={n.id}
      data-tour={isLoc ? (props.pinned ? undefined : 'inv-bin-location') : 'inv-bin-node'}
      onClick={() => (selectMode ? props.onTick(n.id) : props.onPick(n.id))}
      onDoubleClick={() => row.hasChildren && props.onToggleOpen(n.id)}
      onContextMenu={openMenu}
      className={`@container group relative grid h-full cursor-pointer select-none items-center gap-2 border-b px-3 sm:px-4 ${
        isLoc ? 'border-[var(--bins-border)] bg-[var(--bins-surface)]' : 'border-[var(--bins-border-soft)]'
      } ${selected && !selectMode ? 'bg-amber-50' : 'hover:bg-[var(--bins-soft)]'} ${focused ? 'outline outline-2 -outline-offset-2 outline-amber-300' : ''}`}
      style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}
    >
      {selected && !selectMode && <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-amber-500" />}
      {/* Sizes follow the row's own width (a container query), not the
          window: on Easy the list sits beside the tab menu and the details,
          so a wide window still has a narrow row and the extras overlapped
          the fill bar. Anything that does not fit is clipped, never drawn over. */}
      <div className="flex min-w-0 items-center overflow-hidden">
        {/* Connector lines: one guide per ancestor level that has more below. */}
        {row.lastAt.slice(1, -1).map((last, d) => (
          <span key={d} aria-hidden className="relative h-full w-5 shrink-0">
            {!last && <span className="absolute bottom-0 left-[9px] top-0 border-l-[1.5px] border-[var(--bins-border)]" />}
          </span>
        ))}
        {row.depth > 0 && (
          <span aria-hidden className="relative h-full w-5 shrink-0">
            <span className={`absolute left-[9px] top-0 border-l-[1.5px] border-[var(--bins-border)] ${row.lastAt[row.lastAt.length - 1] ? 'h-1/2' : 'h-full'}`} />
            <span className="absolute left-[9px] top-1/2 w-[9px] border-t-[1.5px] border-[var(--bins-border)]" />
          </span>
        )}
        {selectMode && (
          <span
            aria-hidden
            className={`mr-2 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] ${tick === 'none' ? 'border-[var(--bins-border)] bg-[var(--bins-surface)]' : 'border-amber-500 bg-amber-500 text-white'}`}
          >
            {tick === 'all' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
            {tick === 'some' && <span className="h-[2.5px] w-2.5 rounded bg-[var(--bins-surface)]" />}
          </span>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={row.open ? 'Close' : 'Open'}
          onClick={(e) => { e.stopPropagation(); if (row.hasChildren) props.onToggleOpen(n.id) }}
          className={`mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--bins-muted)] hover:bg-[var(--bins-soft)] hover:text-[var(--bins-text)] ${row.hasChildren ? '' : 'invisible'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={`transition-transform ${row.open ? 'rotate-90' : ''}`}><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <TypeIcon type={n.type} size={isLoc ? 30 : n.type === 'row' ? 20 : 24} />
        <span className={`ml-2 truncate ${isLoc ? 'text-[15px] font-bold text-[var(--bins-text)]' : n.type === 'row' ? 'text-[13.5px] text-[var(--bins-text-2)]' : 'text-[14px] font-semibold text-[var(--bins-text)]'} ${match ? 'underline decoration-amber-400 decoration-2 underline-offset-4' : ''}`}>
          <Marked text={n.label} query={props.query} />
        </span>
        {n.code && n.code !== n.label && (
          <code title={n.bin?.path_label || undefined} className="ml-2 hidden shrink-0 rounded-md bg-[var(--bins-soft)] px-1.5 py-0.5 text-[11.5px] text-[var(--bins-muted)] @[30rem]:inline">
            <Marked text={n.code} query={props.query} />
          </code>
        )}
        {n.children.length > 0 && (
          <span className="ml-2 hidden shrink-0 text-[12px] text-[var(--bins-muted)] @[38rem]:inline">
            {n.descendantCount} inside
          </span>
        )}
        {isLoc && n.emptySpots > 0 && (
          <span className="ml-2 hidden shrink-0 rounded-full bg-[var(--bins-soft)] px-2 py-0.5 text-[11.5px] text-[var(--bins-muted)] @[46rem]:inline">{n.emptySpots} empty</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden w-28 @[42rem]:block"><FillBar amount={n.total.amount} capacity={n.capacity} tone={tone} /></span>
        <span className="w-[68px] text-right text-[12.5px] tabular-nums text-[var(--bins-muted)] sm:w-[120px]">
          {n.total.amount > 0
            ? <><b className="font-semibold text-[var(--bins-text)]">{fmtNum(n.total.amount)}</b>{n.capacity ? <> / {fmtNum(n.capacity)}</> : <span className="hidden sm:inline"> units</span>}</>
            : isLoc && n.children.length === 0 ? '' : <span className="italic text-[var(--bins-muted)]">empty</span>}
        </span>
        {/* Row buttons only on hover or when picked, so the list stays calm. */}
        <span className={`flex w-8 justify-end gap-1 sm:w-[64px] ${selected || focused ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'}`}>
          {isLoc ? (
            canEdit && props.onAddRoot && (
              <button type="button" onClick={(e) => { e.stopPropagation(); props.onAddRoot!(n.id) }}
                className="grid h-8 w-8 place-items-center rounded-md text-[18px] font-semibold leading-none text-amber-700 hover:bg-amber-50"
                title="Add root bin: a rack, shelf or bin at the top of this location" aria-label="Add root bin">
                +
              </button>
            )
          ) : (
            <button type="button" aria-label={`More for ${n.label}`}
              onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); props.onMenu(n.id, { x: r.right - 4, y: r.bottom }) }}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--bins-muted)] hover:bg-[var(--bins-surface)] hover:text-amber-700 hover:shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            </button>
          )}
        </span>
      </div>
      {/* On phones the fill shows as a thin line under the row. */}
      {n.capacity ? (
        <span aria-hidden className="absolute bottom-0 left-0 h-[2px] @[42rem]:hidden" style={{ width: `${Math.min(100, (n.total.amount / n.capacity) * 100)}%`, background: tone.bucket === 'over' ? '#E5484D' : tone.bucket === 'near' ? '#F2A54A' : '#22A35A' }} />
      ) : null}
    </div>
  )
}
