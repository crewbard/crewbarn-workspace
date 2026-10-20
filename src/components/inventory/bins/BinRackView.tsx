/**
 * Rack view: each rack as a card, each shelf as a line of tiles, so you see
 * the room the way it stands. A bin's rows open as their own tiles under the
 * shelf. Works for any depth: whatever sits under a location is a "rack",
 * whatever sits under that is a "shelf", and the places on a shelf are tiles.
 */
import { useState } from 'react'
import type { BinTree, TreeNode } from '@/lib/binTree'
import { BinTile, type MenuOpener } from './BinTile'
import { TypeIcon } from './binUi'
import { fmtNum } from './binStyle'

export function BinRackView({
  tree, locationIds, visible, selectedId, onPick, onMenu, onAddRoot, canEdit,
}: {
  tree: BinTree
  locationIds: string[]
  visible: Set<string> | null
  selectedId: string | null
  onPick: (id: string) => void
  onMenu: MenuOpener
  onAddRoot?: (locationId: string) => void
  canEdit: boolean
}) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const toggleRows = (id: string) => setOpenRows((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const kids = (n: TreeNode) => n.children.map((c) => tree.nodes.get(c)!).filter((c) => c && (!visible || visible.has(c.id)))

  const tiles = (list: TreeNode[], size: 'sm' | 'md' = 'md') => (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size === 'sm' ? 72 : 96}px, 1fr))` }}>
        {list.map((n) => {
          const rows = kids(n)
          return (
            <BinTile key={n.id} node={n} siblings={list} selected={selectedId === n.id} onPick={onPick} onMenu={onMenu} size={size}
              showRows rowNodes={rows} rowsOpen={openRows.has(n.id)} onToggleRows={rows.length ? toggleRows : undefined} />
          )
        })}
      </div>
      {list.filter((n) => openRows.has(n.id) && kids(n).length > 0).map((n) => (
        <div key={`rows-${n.id}`} className="mt-2 rounded-lg border border-dashed border-[var(--bins-border)] bg-[var(--bins-softer)] p-2">
          <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-semibold text-[var(--bins-muted)]">
            <TypeIcon type="row" size={16} /> Inside {n.label}
            <button type="button" onClick={() => toggleRows(n.id)} className="ml-auto rounded px-1.5 text-[var(--bins-muted)] hover:text-[var(--bins-text)]">Hide</button>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
            {kids(n).map((r) => (
              <BinTile key={r.id} node={r} siblings={kids(n)} selected={selectedId === r.id} onPick={onPick} onMenu={onMenu} size="sm" />
            ))}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <div className="space-y-6 p-3 sm:p-5">
      {locationIds.map((locId) => {
        const loc = tree.nodes.get(locId)!
        const top = kids(loc)
        const racks = top.filter((n) => n.children.length > 0)
        const loose = top.filter((n) => n.children.length === 0)
        return (
          <section key={locId} aria-label={loc.label}>
            <h4 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold text-[var(--bins-text)]">
              <TypeIcon type="location" size={28} /> {loc.label}
              <span className="text-[12.5px] font-normal text-[var(--bins-muted)]">
                {fmtNum(loc.total.amount)} units · {loc.descendantCount} places{loc.emptySpots ? ` · ${loc.emptySpots} empty` : ''}
              </span>
            </h4>
            {top.length === 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[var(--bins-border)] p-4 text-[13px] text-[var(--bins-muted)]">
                Nothing set up here yet.
                {canEdit && onAddRoot && (
                  <button type="button" onClick={() => onAddRoot(locId)} className="ml-auto rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-white hover:bg-amber-600">
                    + Add root bin
                  </button>
                )}
              </div>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              {racks.map((rack) => {
                const shelves = kids(rack)
                const direct = shelves.filter((s) => s.children.length === 0)
                const lines = shelves.filter((s) => s.children.length > 0)
                return (
                  <div key={rack.id} className="rounded-xl border border-[var(--bins-border)] bg-[var(--bins-surface)] p-3 shadow-sm sm:p-4">
                    <button type="button" onClick={() => onPick(rack.id)}
                      onContextMenu={(e) => { e.preventDefault(); onMenu(rack.id, { x: e.clientX, y: e.clientY }) }}
                      className={`mb-2 flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-[var(--bins-soft)] ${selectedId === rack.id ? 'bg-amber-50' : ''}`}>
                      <TypeIcon type={rack.type} size={24} />
                      <span className="font-semibold text-[var(--bins-text)]">{rack.label}</span>
                      {rack.code && rack.code !== rack.label && <code className="rounded bg-[var(--bins-soft)] px-1.5 text-[11.5px] text-[var(--bins-muted)]">{rack.code}</code>}
                      <span className="ml-auto text-[12px] tabular-nums text-[var(--bins-muted)]">
                        {fmtNum(rack.total.amount)}{rack.capacity ? ` / ${fmtNum(rack.capacity)}` : ''} units
                      </span>
                    </button>
                    <div className="space-y-2.5">
                      {lines.map((shelf) => (
                        <div key={shelf.id} className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)]">
                          <button type="button" onClick={() => onPick(shelf.id)}
                            onContextMenu={(e) => { e.preventDefault(); onMenu(shelf.id, { x: e.clientX, y: e.clientY }) }}
                            className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12.5px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)] sm:flex-col sm:items-start sm:gap-0 ${selectedId === shelf.id ? 'bg-amber-50 shadow-[inset_3px_0_0_var(--bins-accent)]' : ''}`}>
                            {shelf.label}
                            <span className="text-[11px] font-normal text-[var(--bins-muted)]">{fmtNum(shelf.total.amount)} units</span>
                          </button>
                          <div>{tiles(kids(shelf))}</div>
                        </div>
                      ))}
                      {direct.length > 0 && tiles(direct)}
                    </div>
                  </div>
                )
              })}
            </div>
            {loose.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--bins-muted)]">On their own</div>
                {tiles(loose)}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
