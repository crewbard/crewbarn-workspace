import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FolderLayout } from '@/hooks/useTheme'

/**
 * FolderBrowser — the "files" view shared by Jobs / Estimates / Customers.
 *
 * Takes a flat list of folders (each already holding its rendered cards) and
 * renders them in the tenant's chosen layout:
 *
 *   - Cabinet   — horizontal file-folder tabs; one folder open below at a time.
 *   - Tree      — a left folder list + right reading pane; one folder at a time.
 *   - Accordion — stacked collapsible rows; multiple open at once.
 *
 * It owns only the folder chrome + open/close state; the caller renders the
 * cards, so it stays entity-agnostic. Accent surfaces use amber-* utilities, so
 * they follow the tenant's brand accent automatically.
 */

export type FolderMoney =
  | { kind: 'balance'; collected: number; uncollected: number }
  | { kind: 'total'; total: number; label?: string }

export interface FolderNode {
  key: string
  label: string
  count: number
  /** Folder color (hex) for the tab stub / tree dot. Defaults to navy. */
  tab?: string
  /** Optional money roll-up shown on the open folder. */
  money?: FolderMoney
  /** Pre-rendered cards (eager pages, e.g. Jobs). */
  items?: ReactNode[]
  /** Lazy content for the open folder (Customers / Estimates fetch on open).
   *  `display` = 'grid' for Cabinet/Accordion, 'list' for Tree. Takes
   *  precedence over `items` when present. */
  render?: (display: 'grid' | 'list') => ReactNode
  /** One level of nested folders (Jobs "Year" → Month). When present, opening
   *  this folder shows a sub-folder row; opening a sub shows ITS content. */
  subFolders?: FolderNode[]
}

const DEFAULT_TAB = '#0F1A2E'

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function countLabel(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : noun + 's'}`
}

export function FolderBrowser({
  folders,
  layout,
  countNoun = 'item',
  emptyFolderText = 'Nothing filed here.',
}: {
  folders: FolderNode[]
  layout: FolderLayout
  countNoun?: string
  emptyFolderText?: string
}) {
  // Signature of the current folder set — reset the open folder when the
  // grouping/entity changes (folders swap out entirely).
  const signature = useMemo(() => folders.map((f) => f.key).join('|'), [folders])
  const [openKey, setOpenKey] = useState<string | null>(folders[0]?.key ?? null)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(folders[0] ? [folders[0].key] : []))

  useEffect(() => {
    setOpenKey(folders[0]?.key ?? null)
    setOpenKeys(new Set(folders[0] ? [folders[0].key] : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  if (folders.length === 0) return null

  if (layout === 'tree') {
    return <TreeLayout folders={folders} openKey={openKey} onOpen={setOpenKey} countNoun={countNoun} emptyFolderText={emptyFolderText} />
  }
  if (layout === 'accordion') {
    return (
      <AccordionLayout
        folders={folders}
        openKeys={openKeys}
        onToggle={(key) =>
          setOpenKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })
        }
        countNoun={countNoun}
        emptyFolderText={emptyFolderText}
      />
    )
  }
  return <CabinetLayout folders={folders} openKey={openKey} onOpen={setOpenKey} countNoun={countNoun} emptyFolderText={emptyFolderText} />
}

/** Money roll-up as white stat boxes, shown at the top of the open folder body
 *  (matching the design — not crammed into the navy header). */
function MoneyBoxes({ money }: { money: FolderMoney }) {
  return (
    <div className="mb-3.5 flex flex-wrap gap-2.5">
      {money.kind === 'total' ? (
        <StatBox label={money.label ?? 'Total value'} value={formatMoney(money.total)} valueClass="text-navy-900" />
      ) : (
        <>
          <StatBox label="Collected" value={formatMoney(money.collected)} valueClass="text-emerald-700" />
          <StatBox label="Uncollected" value={formatMoney(money.uncollected)} valueClass="text-rose-700" />
        </>
      )}
    </div>
  )
}

function StatBox({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-base font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

const FOLDER_PAGE_SIZE = 50

/** Grid capped at 4 cards per row, stepping down on narrower widths. */
const CARD_GRID_CLASS = 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** Eager `items` paged 50 at a time with a Prev/Next bar, so opening a big
 *  folder (e.g. a 100-job status) shows a screenful, not a wall. `resetKey`
 *  (the folder key) snaps back to page 1 when the open folder swaps out. */
function PaginatedItems({
  items,
  display,
  empty,
  resetKey,
}: {
  items: ReactNode[]
  display: 'grid' | 'list'
  empty: string
  resetKey: string
}) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [resetKey])

  if (items.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">{empty}</div>
  }

  const totalPages = Math.ceil(items.length / FOLDER_PAGE_SIZE)
  const current = Math.min(page, totalPages)
  const start = (current - 1) * FOLDER_PAGE_SIZE
  const shown = items.slice(start, start + FOLDER_PAGE_SIZE)

  return (
    <div>
      {display === 'list'
        ? <div className="space-y-2.5">{shown}</div>
        : <div className={CARD_GRID_CLASS}>{shown}</div>}
      {totalPages > 1 && (
        <Pager
          from={start + 1}
          to={start + shown.length}
          total={items.length}
          page={current}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}
    </div>
  )
}

/** Shared Prev / "Showing x–y of N" / Next bar for folder bodies. */
export function Pager({
  from,
  to,
  total,
  page,
  totalPages,
  onPrev,
  onNext,
  busy = false,
}: {
  from: number
  to: number
  total: number
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  busy?: boolean
}) {
  const btn = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <div className="text-sm text-slate-500">Showing {from}–{to} of {total}</div>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={onPrev} disabled={page <= 1 || busy}>Previous</button>
        <span className="px-1 text-sm text-slate-600">Page {page} of {totalPages}</span>
        <button type="button" className={btn} onClick={onNext} disabled={page >= totalPages || busy}>Next</button>
      </div>
    </div>
  )
}

/** An open folder's body: lazy `render` if the folder provides one, else its
 *  eager `items` (paged). 'list' stacks vertically (Tree); 'grid' fills cards. */
function FolderContent({ folder, display, empty }: { folder: FolderNode; display: 'grid' | 'list'; empty: string }) {
  if (folder.render) return <>{folder.render(display)}</>
  return <PaginatedItems items={folder.items ?? []} display={display} empty={empty} resetKey={folder.key} />
}

/**
 * The body of an open folder: its money roll-up + content. When the folder has
 * sub-folders (Jobs "Year" → Month), it instead shows a smaller sub-folder row
 * and, below it, the open sub-folder's money + content. Owns its own sub-open
 * state, so each expanded Accordion row drills independently.
 */
function FolderBody({
  folder,
  display,
  empty,
  countNoun,
}: {
  folder: FolderNode
  display: 'grid' | 'list'
  empty: string
  countNoun: string
}) {
  const subs = folder.subFolders
  const [openSub, setOpenSub] = useState<string | null>(subs?.[0]?.key ?? null)

  if (!subs || subs.length === 0) {
    return (
      <>
        {folder.money && <MoneyBoxes money={folder.money} />}
        <FolderContent folder={folder} display={display} empty={empty} />
      </>
    )
  }

  const activeSub = subs.find((s) => s.key === openSub) ?? null
  return (
    <>
      <div className="mb-3.5">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Month folders</div>
        <div className="flex gap-2.5 overflow-x-auto pb-1.5">
          {subs.map((s) => {
            const on = s.key === openSub
            return (
              <button
                key={s.key}
                type="button"
                aria-expanded={on}
                onClick={() => setOpenSub(on ? null : s.key)}
                className="group relative w-32 shrink-0 pt-2 text-left focus:outline-none"
              >
                <span
                  aria-hidden
                  className={'absolute left-0 top-0 h-3 w-14 rounded-t-md transition-colors ' + (on ? 'bg-amber-500' : '')}
                  style={on ? undefined : { backgroundColor: s.tab ?? DEFAULT_TAB }}
                />
                <span
                  className={'relative flex min-h-[60px] flex-col justify-between rounded-b-lg rounded-tr-lg border p-2.5 shadow-sm transition-all ' + (
                    on ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white group-hover:border-amber-300'
                  )}
                >
                  <span className="line-clamp-1 text-[13px] font-bold text-navy-900">{s.label}</span>
                  <span className="mt-1 text-[10.5px] font-medium text-slate-500">{countLabel(s.count, countNoun)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {activeSub ? (
        <>
          {activeSub.money && <MoneyBoxes money={activeSub.money} />}
          <FolderContent folder={activeSub} display={display} empty={empty} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Select a folder to view its files.
        </div>
      )}
    </>
  )
}

/* ── Cabinet ─────────────────────────────────────────────────────────── */
function CabinetLayout({
  folders,
  openKey,
  onOpen,
  countNoun,
  emptyFolderText,
}: {
  folders: FolderNode[]
  openKey: string | null
  onOpen: (key: string | null) => void
  countNoun: string
  emptyFolderText: string
}) {
  const active = folders.find((f) => f.key === openKey) ?? null
  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Folders">
        {folders.map((f) => {
          const open = f.key === openKey
          return (
            <button
              key={f.key}
              type="button"
              aria-expanded={open}
              onClick={() => onOpen(open ? null : f.key)}
              className="group relative w-44 shrink-0 pt-2.5 text-left focus:outline-none"
            >
              <span
                aria-hidden
                className={'absolute left-0 top-0 h-4 w-24 rounded-t-md transition-colors ' + (open ? 'bg-amber-500' : '')}
                style={open ? undefined : { backgroundColor: f.tab ?? DEFAULT_TAB }}
              />
              <span
                className={'relative flex min-h-[88px] flex-col justify-between rounded-b-xl rounded-tr-xl border p-4 shadow-sm transition-all ' + (
                  open
                    ? 'border-amber-300 bg-amber-50 shadow-md'
                    : 'border-slate-200 bg-white group-hover:-translate-y-0.5 group-hover:border-amber-300 group-hover:shadow-md'
                )}
              >
                <span className="line-clamp-2 text-base font-extrabold leading-tight text-navy-900">{f.label}</span>
                <span className="mt-2 text-[11px] font-medium text-slate-500">{countLabel(f.count, countNoun)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {active ? (
        <section className="mt-3.5 overflow-hidden rounded-xl border border-amber-300 shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-navy-800 px-4 py-3 text-white">
            <h2 className="min-w-0 truncate text-[15px] font-bold">{active.label}</h2>
            <button
              type="button"
              onClick={() => onOpen(null)}
              className="shrink-0 rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/20"
            >
              Close folder
            </button>
          </div>
          <div className="bg-white p-3.5">
            <FolderBody folder={active} display="grid" empty={emptyFolderText} countNoun={countNoun} />
          </div>
        </section>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-navy-200 bg-white px-6 py-8 text-center text-sm text-navy-500">
          Select a folder to view its files.
        </div>
      )}
    </div>
  )
}

/* ── Tree ────────────────────────────────────────────────────────────── */
function TreeLayout({
  folders,
  openKey,
  onOpen,
  countNoun,
  emptyFolderText,
}: {
  folders: FolderNode[]
  openKey: string | null
  onOpen: (key: string | null) => void
  countNoun: string
  emptyFolderText: string
}) {
  const active = folders.find((f) => f.key === openKey) ?? folders[0]
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row">
        <div className="w-full shrink-0 border-b border-slate-200 bg-slate-50 md:w-52 md:border-b-0 md:border-r">
          <ul className="max-h-[520px] overflow-y-auto py-1">
            {folders.map((f) => {
              const on = f.key === active?.key
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(f.key)}
                    className={'flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors ' + (
                      on ? 'border-amber-500 bg-amber-50 font-bold text-navy-900' : 'border-transparent text-slate-700 hover:bg-white'
                    )}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.tab ?? DEFAULT_TAB }} aria-hidden />
                    <span className="flex-1 truncate">{f.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-400">{f.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="min-w-0 flex-1 p-4">
          {active ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-navy-900">{active.label}</h2>
                <span className="text-xs font-medium text-slate-500">{countLabel(active.count, countNoun)}</span>
              </div>
              <div className="mt-3">
                <FolderBody folder={active} display="list" empty={emptyFolderText} countNoun={countNoun} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ── Accordion ───────────────────────────────────────────────────────── */
function AccordionLayout({
  folders,
  openKeys,
  onToggle,
  countNoun,
  emptyFolderText,
}: {
  folders: FolderNode[]
  openKeys: Set<string>
  onToggle: (key: string) => void
  countNoun: string
  emptyFolderText: string
}) {
  return (
    <div className="space-y-2">
      {folders.map((f) => {
        const open = openKeys.has(f.key)
        return (
          <div key={f.key} className={'overflow-hidden rounded-lg border transition-colors ' + (open ? 'border-amber-300' : 'border-slate-200')}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(f.key)}
              className={'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ' + (open ? 'bg-amber-50' : 'bg-white hover:bg-slate-50')}
            >
              <span
                aria-hidden
                className="relative h-5 w-7 shrink-0 rounded-sm"
                style={{ backgroundColor: f.tab ?? DEFAULT_TAB }}
              >
                <span className="absolute -top-1 left-0 h-1.5 w-3.5 rounded-t-sm" style={{ backgroundColor: f.tab ?? DEFAULT_TAB }} />
              </span>
              <span className="flex-1 truncate text-sm font-bold text-navy-900">{f.label}</span>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {countLabel(f.count, countNoun)}
                {f.money && <AccordionMoney money={f.money} />}
              </span>
              <svg viewBox="0 0 12 12" fill="none" className={'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open && (
              <div className="border-t border-amber-200/70 bg-white p-3.5">
                <FolderBody folder={f} display="grid" empty={emptyFolderText} countNoun={countNoun} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function AccordionMoney({ money }: { money: FolderMoney }) {
  const value = money.kind === 'total' ? money.total : money.collected + money.uncollected
  return <span className="ml-2 font-mono font-bold tabular-nums text-navy-700">· {formatMoney(value)}</span>
}
