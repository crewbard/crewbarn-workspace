/**
 * One place as a tile, coloured by how full it is. Used by the rack view and
 * the detail panel. Right-click, a long press on a phone, or the menu key
 * (Shift+F10) opens the place's menu.
 */
import { toneFor, type TreeNode } from '@/lib/binTree'
import { fmtNum, toneInk, toneLabel, toneStyle } from './binStyle'
import { useMenuGestures, type MenuOpener } from './useMenuGestures'

export type { MenuOpener }

export function BinTile({
  node, siblings, selected, onPick, onMenu, size = 'md', showRows, rowNodes, onToggleRows, rowsOpen, subtitle, badges, role,
}: {
  node: TreeNode
  siblings: readonly TreeNode[]
  selected: boolean
  onPick: (id: string) => void
  onMenu: MenuOpener
  size?: 'sm' | 'md'
  /** Small row strip inside the tile (a bin's rows at a glance). */
  showRows?: boolean
  rowNodes?: readonly TreeNode[]
  rowsOpen?: boolean
  onToggleRows?: (id: string) => void
  /** Small print under the name (where it is), for pickers. */
  subtitle?: string
  /** Short tags such as "Usually kept here". */
  badges?: readonly string[]
  /** "radio" when the tile is a choice in a picker. */
  role?: 'radio'
}) {
  const tone = toneFor(node, siblings)
  const ink = toneInk(tone)
  const { fired, handlers } = useMenuGestures(node.id, onMenu)
  const amount = node.total.amount
  const title = `${node.bin?.path_label || node.label} · ${amount > 0 ? `${fmtNum(amount)}${node.capacity ? ` of ${fmtNum(node.capacity)}` : ''} units` : 'empty'} · ${toneLabel(tone)}. Right-click or press and hold for more.`
  return (
    <div className="relative">
      <button
        type="button"
        data-node-id={node.id}
        data-tile
        title={title}
        aria-label={title}
        role={role}
        aria-pressed={role ? undefined : selected}
        aria-checked={role ? selected : undefined}
        onClick={() => { if (!fired.current) onPick(node.id) }}
        {...handlers}
        className={`flex w-full flex-col justify-between rounded-lg border border-black/10 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          size === 'sm' ? 'min-h-[48px] px-2 py-1.5' : 'min-h-[64px] px-2.5 py-2'
        } ${selected ? 'outline outline-[2.5px] outline-offset-1 outline-amber-500' : ''}`}
        style={{ ...toneStyle(tone), color: ink, touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
      >
        <span className={`block truncate font-bold ${size === 'sm' ? 'text-[12px]' : 'text-[13px]'}`}>{node.code || node.label}</span>
        {subtitle && <span className="block truncate text-[11.5px] opacity-80">{subtitle}</span>}
        <span className="block text-[11.5px] tabular-nums opacity-90">
          {amount > 0 ? <>{fmtNum(amount)}{node.capacity ? ` / ${fmtNum(node.capacity)}` : ''}</> : <span className="italic opacity-80">empty</span>}
        </span>
        {badges && badges.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {badges.map((b) => <span key={b} className="rounded bg-white/90 px-1.5 text-[11px] font-semibold text-slate-900 ring-1 ring-black/10">{b}</span>)}
          </span>
        )}
        {showRows && rowNodes && rowNodes.length > 0 && (
          <span aria-hidden className="mt-1 flex gap-[2px]">
            {rowNodes.slice(0, 12).map((r) => {
              const t = toneFor(r, rowNodes)
              return <span key={r.id} className="h-1.5 flex-1 rounded-sm border border-black/10" style={toneStyle(t)} />
            })}
          </span>
        )}
      </button>
      {onToggleRows && rowNodes && rowNodes.length > 0 && (
        <button
          type="button"
          onClick={() => onToggleRows(node.id)}
          aria-expanded={rowsOpen}
          aria-label={`${rowsOpen ? 'Hide' : 'Show'} the ${rowNodes.length} rows in ${node.label}`}
          className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full border border-[var(--bins-border)] bg-[var(--bins-surface)] px-1 text-[10.5px] font-bold text-[var(--bins-text-2)] shadow-sm hover:text-amber-700"
        >
          {rowsOpen ? '−' : rowNodes.length}
        </button>
      )}
    </div>
  )
}
