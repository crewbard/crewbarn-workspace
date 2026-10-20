/**
 * The right-hand panel for the picked place: where it is, how full, what is
 * inside it as tiles, and the things you can do with it, as big buttons.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBinContents } from '@/hooks/useInventoryBins'
import { ancestorsOf, toneFor, type BinTree } from '@/lib/binTree'
import type { MenuId, MenuItem } from '@/lib/binReceive'
import { BinTile, type MenuOpener } from './BinTile'
import { FillLegend, TypeIcon } from './binUi'
import { fmtNum, toneLabel, toneStyle } from './binStyle'

export function BinDetailPanel({
  tree, id, menu, onPick, onMenu, onAction, onAddRoot, canEdit, onClose,
}: {
  tree: BinTree
  id: string
  menu: MenuItem[]
  onPick: (id: string) => void
  onMenu: MenuOpener
  onAction: (id: MenuId | 'move' | 'edit', anchor?: HTMLElement) => void
  onAddRoot?: (locationId: string) => void
  canEdit: boolean
  onClose?: () => void
}) {
  const n = tree.nodes.get(id)
  const isLoc = n?.type === 'location'
  const contents = useBinContents(n && !isLoc ? n.id : undefined)
  const items = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; unit: string | null }>()
    for (const s of contents.data?.stock_levels ?? []) {
      const q = Number(s.quantities?.qty_on_hand) || 0
      if (q <= 0) continue
      const key = s.catalog_item_id
      const row = map.get(key) ?? { name: s.catalog_item?.name ?? 'Item', qty: 0, unit: s.catalog_item?.unit_label ?? null }
      row.qty += q
      map.set(key, row)
    }
    for (const u of contents.data?.units ?? []) {
      if (u.status !== 'available' && u.status !== 'reserved') continue
      const row = map.get(u.catalog_item_id) ?? { name: u.catalog_item?.name ?? 'Item', qty: 0, unit: null }
      if (!(contents.data?.stock_levels ?? []).some((s) => s.catalog_item_id === u.catalog_item_id)) row.qty += 1
      map.set(u.catalog_item_id, row)
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty)
  }, [contents.data])

  if (!n) return null
  const crumbs = ancestorsOf(tree, id)
  const kids = n.children.map((c) => tree.nodes.get(c)!).filter(Boolean)
  const tone = toneFor(n, n.parentId ? tree.nodes.get(n.parentId)!.children.map((c) => tree.nodes.get(c)!) : [n])
  const pct = n.capacity ? Math.round((n.total.amount / n.capacity) * 100) : null
  const byId = Object.fromEntries(menu.map((m) => [m.id, m])) as Record<MenuId, MenuItem | undefined>
  const anyCap = kids.some((k) => k.capacity != null)
  const anyNoCap = kids.some((k) => k.capacity == null)

  return (
    <div data-tour={isLoc ? "inv-bin-detail-location" : "inv-bin-detail"} className="flex h-full flex-col">
      <div className="border-b border-[var(--bins-border-soft)] px-4 pb-3 pt-4">
        <nav aria-label="Where this is" className="mb-2 flex flex-wrap items-center gap-1 text-[12px] text-[var(--bins-muted)]">
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <button type="button" onClick={() => onPick(c.id)} className="rounded px-1 py-0.5 hover:bg-[var(--bins-soft)] hover:text-[var(--bins-text)]">{c.label}</button>
              <span className="text-[var(--bins-border)]">›</span>
            </span>
          ))}
          {onClose && <button type="button" onClick={onClose} aria-label="Close details" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-[var(--bins-muted)] hover:bg-[var(--bins-soft)]">✕</button>}
        </nav>
        <div className="flex items-center gap-3">
          <TypeIcon type={n.type} size={36} />
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-bold text-[var(--bins-text)]">{n.label}</h3>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--bins-muted)]">
              {n.bin?.kind && <span className="rounded bg-[var(--bins-soft)] px-1.5 py-0.5 font-semibold text-[var(--bins-text-2)]">{n.bin.kind}</span>}
              {n.code && <code className="rounded bg-[var(--bins-soft)] px-1.5 py-0.5">{n.code}</code>}
              {n.bin && !n.holdsStock && <span>Holds other places, not stock</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ['Items', n.total.items],
            ['Units', n.total.amount],
            ['Inside', n.descendantCount],
            ['Empty spots', n.emptySpots],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-lg bg-[var(--bins-softer)] px-2.5 py-2">
              <div className="text-[16px] font-bold tabular-nums text-[var(--bins-text)]">{fmtNum(v as number)}</div>
              <div className="text-[11px] text-[var(--bins-muted)]">{label}</div>
            </div>
          ))}
        </div>
        {!isLoc && (
          <div className="mt-3 flex items-center gap-2.5 text-[12.5px] text-[var(--bins-text-2)]">
            {n.capacity ? (
              <>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bins-soft)]">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, ...toneStyle(tone), backgroundImage: 'none' }} />
                </span>
                <span className="tabular-nums"><b className="text-[var(--bins-text)]">{fmtNum(n.total.amount)}</b> / {fmtNum(n.capacity)} · {toneLabel(tone)}</span>
              </>
            ) : (
              <span>
                No capacity set{n.children.length && !n.bin?.capacity ? ' (and not every place inside has one)' : ''}.{' '}
                {canEdit && <button type="button" className="font-semibold text-amber-700 hover:underline" onClick={() => onAction('capacity')}>Set how many fit</button>}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onAction={onAction} m={byId['add-product']} primary wide tour="inv-bin-add-product" />
          <ActionButton onAction={onAction} m={byId['add-po']} wide={isLoc} />
          {isLoc ? (
            canEdit && onAddRoot && (
              <button type="button" onClick={() => onAddRoot(n.id)} className="col-span-2 min-h-[44px] rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-left text-[13.5px] font-semibold text-[var(--bins-text)] hover:border-[var(--bins-accent)]">
                + Add a bin or rack here
              </button>
            )
          ) : (
            <>
              <ActionButton onAction={onAction} m={byId.print} tour="inv-bin-labels" />
              <ActionButton onAction={onAction} m={byId['add-row']} />
              {canEdit && <button type="button" onClick={() => onAction('move')} className="min-h-[44px] rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-left text-[13.5px] font-semibold text-[var(--bins-text)] hover:border-[var(--bins-accent)]">Move or edit</button>}
              <button type="button" data-tour="inv-bin-contents" onClick={() => onAction('catalog')}
                className="min-h-[44px] rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-left text-[13.5px] font-semibold text-[var(--bins-text)] hover:border-[var(--bins-accent)]">
                Open catalog
              </button>
            </>
          )}
        </div>

        {kids.length > 0 && (
          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--bins-muted)]">Inside ({kids.length})</h4>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
              {kids.map((k) => (
                <BinTile key={k.id} node={k} siblings={kids} selected={false} onPick={onPick} onMenu={onMenu} size="sm"
                  showRows rowNodes={k.children.map((c) => tree.nodes.get(c)!).filter(Boolean)} />
              ))}
            </div>
            <div className="mt-2"><FillLegend withCapacity={anyCap} withoutCapacity={anyNoCap} /></div>
          </section>
        )}
        {kids.length === 0 && !isLoc && (
          <p className="rounded-lg border border-dashed border-[var(--bins-border)] p-3 text-[12.5px] text-[var(--bins-muted)]">
            Nothing inside. {canEdit && byId['add-row'] ? <>Use <b>{byId['add-row'].label}</b> to split it into rows.</> : null}
          </p>
        )}

        {!isLoc && (
          <section>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--bins-muted)]">Stock here</h4>
            {contents.isLoading && <p className="text-[12.5px] text-[var(--bins-muted)]">Loading…</p>}
            {!contents.isLoading && items.length === 0 && <p className="text-[12.5px] text-[var(--bins-muted)]">Nothing stored here yet.</p>}
            <ul className="divide-y divide-dashed divide-[var(--bins-border)]">
              {items.slice(0, 8).map((it) => (
                <li key={it.name} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                  <span className="truncate text-[var(--bins-text)]">{it.name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--bins-muted)]">{fmtNum(it.qty)}{it.unit && it.unit !== 'each' ? ` ${it.unit}` : ''}</span>
                </li>
              ))}
            </ul>
            {items.length > 8 && (
              <button type="button" onClick={() => onAction('catalog')} className="mt-1 text-[12.5px] font-semibold text-amber-700 hover:underline">
                See all {items.length} in the catalog
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function ActionButton({ m, primary = false, wide = false, tour, onAction }: {
  m?: MenuItem
  primary?: boolean
  wide?: boolean
  tour?: string
  onAction: (id: MenuId, anchor?: HTMLElement) => void
}) {
  if (!m) return null
  // Off: say why in one readable line, with the way out. Never faint print.
  if (m.disabled) {
    return (
      <div data-tour={tour} className={`${wide ? 'col-span-2 ' : ''}rounded-lg border border-dashed border-[var(--bins-border)] bg-[var(--bins-softer)] px-3 py-2`}>
        <div className="text-[13.5px] font-semibold text-[var(--bins-text-2)]">{m.label}</div>
        {m.reason && <div className="mt-0.5 text-[13px] leading-snug text-[var(--bins-text-2)]">{m.reason}</div>}
        {m.fix && ('href' in m.fix
          ? <Link to={m.fix.href} className="mt-1 inline-block text-[13px] font-semibold text-[var(--bins-accent-ink)] underline">{m.fix.label}</Link>
          : <button type="button" onClick={() => onAction((m.fix as { action: MenuId }).action)} className="mt-1 text-[13px] font-semibold text-[var(--bins-accent-ink)] underline">{m.fix.label}</button>)}
      </div>
    )
  }
  return (
    <button type="button" data-tour={tour} onClick={(e) => onAction(m.id, e.currentTarget)}
      className={`${wide ? 'col-span-2 ' : ''}flex min-h-[48px] flex-col items-start justify-center rounded-lg border px-3 py-2 text-left font-semibold ${
        primary ? 'border-[var(--bins-accent)] bg-[var(--bins-accent)] text-[15px] text-white hover:bg-[var(--bins-accent-strong)]'
          : 'border-[var(--bins-border)] bg-[var(--bins-surface)] text-[13.5px] text-[var(--bins-text)] hover:border-[var(--bins-accent)]'}`}>
      {primary ? `+ ${m.label}` : m.label}
      {m.reason && <span className={`mt-0.5 text-[12.5px] font-normal leading-snug ${primary ? 'text-white/90' : 'text-[var(--bins-muted)]'}`}>{m.reason}</span>}
    </button>
  )
}
