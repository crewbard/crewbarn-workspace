/**
 * The structure, drawn live as the Bins screen's Racks view will show it:
 * each rack a card, each shelf a line of tiles, a bin's rows as a strip and,
 * on request, as their own tiles. Same tiles and colours as Inventory › Bins
 * (BinTile, buildBinTree), so what you set up here is what you'll see there.
 *
 * Click a tile (or a rack or shelf name) to change it; right-click or press
 * and hold for quick actions. In select mode, clicks tick tiles instead.
 */
import { useMemo, useState } from 'react'
import type { BinTree, TreeNode } from '@/lib/binTree'
import { countDraft, type DraftNode } from '@/lib/structureDraft'
import { DRAFT_LOCATION } from './useDraftTree'
import { BinTile, type MenuOpener } from '@/components/inventory/bins/BinTile'
import { TypeIcon } from '@/components/inventory/bins/binUi'
import { fmtNum } from '@/components/inventory/bins/binStyle'

/** Past this many tiles the canvas draws the first racks and says how many more. */
const TILE_BUDGET = 1500

export function StructureCanvas({
  tree, draft, selected, focusKey, selectMode, onPick, onMenu, onCopy, emptyText,
}: {
  tree: BinTree
  draft: readonly DraftNode[]
  /** Ticked tiles (select mode). */
  selected: ReadonlySet<string>
  /** The place being edited. */
  focusKey: string | null
  selectMode: boolean
  onPick: (key: string) => void
  onMenu: MenuOpener
  /** "Add another like this one" on a rack or shelf. */
  onCopy: (key: string) => void
  emptyText: string
}) {
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const toggleRows = (id: string) => setOpenRows((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const kids = (n: TreeNode) => n.children.map((c) => tree.nodes.get(c)!).filter(Boolean)
  const loc = tree.nodes.get(DRAFT_LOCATION)
  const total = useMemo(() => countDraft(draft), [draft])

  if (!loc || loc.children.length === 0) {
    return <p className="px-4 py-10 text-center text-[13px] text-slate-500">{emptyText}</p>
  }

  const top = kids(loc)
  const racks = top.filter((n) => n.children.length > 0)
  const loose = top.filter((n) => n.children.length === 0)

  // Draw whole racks until the budget is spent; the rest are summarised.
  let budget = TILE_BUDGET
  const shown: TreeNode[] = []
  for (const r of racks) {
    if (shown.length > 0 && budget - (1 + r.descendantCount) < 0) break
    shown.push(r)
    budget -= 1 + r.descendantCount
  }
  const hidden = racks.length - shown.length
  const isOn = (id: string) => (selectMode ? selected.has(id) : focusKey === id)

  const tiles = (list: TreeNode[], size: 'sm' | 'md' = 'md') => (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size === 'sm' ? 72 : 92}px, 1fr))` }}>
        {list.map((n) => {
          const rows = kids(n)
          return (
            <div key={n.id} className="relative">
              <BinTile node={n} siblings={list} selected={isOn(n.id)} onPick={onPick} onMenu={onMenu} size={size}
                showRows rowNodes={rows} rowsOpen={openRows.has(n.id)} onToggleRows={rows.length ? toggleRows : undefined} />
              <FitsBadge node={n} />
            </div>
          )
        })}
      </div>
      {list.filter((n) => openRows.has(n.id) && n.children.length > 0).map((n) => (
        <div key={`rows-${n.id}`} className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-2">
          <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-semibold text-slate-500">
            <TypeIcon type="row" size={16} /> Inside {n.label}
            <button type="button" onClick={() => toggleRows(n.id)} className="ml-auto rounded px-1.5 text-slate-400 hover:text-slate-700">Hide</button>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
            {kids(n).map((r) => (
              <div key={r.id} className="relative">
                <BinTile node={r} siblings={kids(n)} selected={isOn(r.id)} onPick={onPick} onMenu={onMenu} size="sm" />
                <FitsBadge node={r} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )

  return (
    <div className="space-y-4 p-3 sm:p-4" data-testid="structure-canvas">
      <div className="grid gap-3 2xl:grid-cols-2">
        {shown.map((rack) => {
          const shelves = kids(rack)
          const direct = shelves.filter((s) => s.children.length === 0)
          const lines = shelves.filter((s) => s.children.length > 0)
          return (
            <div key={rack.id} className={`rounded-xl border bg-white p-3 shadow-sm ${isOn(rack.id) ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
              <div className="mb-2 flex items-center gap-1">
                <button type="button" onClick={() => onPick(rack.id)}
                  onContextMenu={(e) => { e.preventDefault(); onMenu(rack.id, { x: e.clientX, y: e.clientY }) }}
                  className={`flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50 ${isOn(rack.id) ? 'bg-amber-50' : ''}`}>
                  <TypeIcon type={rack.type} size={24} />
                  <span className="truncate font-semibold text-slate-900">{rack.label}</span>
                  <code className="shrink-0 rounded bg-slate-100 px-1.5 text-[11.5px] text-slate-500">{rack.code}</code>
                  <span className="ml-auto shrink-0 text-[12px] tabular-nums text-slate-500">
                    {fmtNum(rack.descendantCount)} inside{rack.capacity ? ` · fits ${fmtNum(rack.capacity)}` : ''}
                  </span>
                </button>
                <CopyButton label={`Add another ${(rack.bin?.kind || 'one').toLowerCase()} like ${rack.code}`} onClick={() => onCopy(rack.id)} />
              </div>
              <div className="space-y-2.5">
                {lines.map((shelf) => (
                  <div key={shelf.id} className="grid gap-2 sm:grid-cols-[104px_minmax(0,1fr)]">
                    <div className="flex items-start gap-1 sm:flex-col">
                      <button type="button" onClick={() => onPick(shelf.id)}
                        onContextMenu={(e) => { e.preventDefault(); onMenu(shelf.id, { x: e.clientX, y: e.clientY }) }}
                        className={`flex min-h-[36px] w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 sm:flex-col sm:items-start sm:gap-0 ${isOn(shelf.id) ? 'bg-amber-50 shadow-[inset_3px_0_0_#F28C28]' : ''}`}>
                        {shelf.label}
                        <span className="font-mono text-[11px] font-normal text-slate-500">{shelf.code}{shelf.capacity ? ` · fits ${fmtNum(shelf.capacity)}` : ''}</span>
                      </button>
                      <CopyButton small label={`Add another ${(shelf.bin?.kind || 'one').toLowerCase()} like ${shelf.code}`} onClick={() => onCopy(shelf.id)} />
                    </div>
                    <div>{tiles(kids(shelf))}</div>
                  </div>
                ))}
                {direct.length > 0 && tiles(direct)}
              </div>
            </div>
          )
        })}
      </div>
      {hidden > 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-600">
          + {fmtNum(hidden)} more like these. All {fmtNum(total)} places will be created; the drawing shows the first {fmtNum(shown.length)} to stay quick.
        </p>
      )}
      {loose.length > 0 && (
        <div>
          {racks.length > 0 && <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">On their own</div>}
          {tiles(loose)}
        </div>
      )}
    </div>
  )
}

/** "fits 20" in the tile's corner. The tile itself says "empty": nothing is in it yet. */
function FitsBadge({ node }: { node: TreeNode }) {
  if (!node.holdsStock || node.bin?.capacity == null) return null
  return (
    <span aria-hidden className="pointer-events-none absolute bottom-1 right-1.5 rounded bg-white/85 px-1 text-[10.5px] font-semibold tabular-nums text-slate-600">
      fits {fmtNum(node.bin.capacity)}
    </span>
  )
}

function CopyButton({ label, onClick, small = false }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`grid shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 ${small ? 'h-8 w-8' : 'h-10 w-10'}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /><path d="M14 11v6M11 14h6" />
      </svg>
    </button>
  )
}
