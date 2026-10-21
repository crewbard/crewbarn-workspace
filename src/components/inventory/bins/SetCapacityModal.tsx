/**
 * "How many fit here?" Capacity is layered: it is set on the innermost places
 * (a bin's rows) and adds up from there, so a rack is its shelves, a shelf its
 * bins, a bin its rows. For one place with rows this shows the total and lets
 * you set every row at once or each row on its own; a place with nothing
 * inside (or several ticked places) is set directly, as before. Saves with the
 * normal bin update, one place at a time.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateInventoryBin } from '@/lib/inventoryBins'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import { innermostUnder, parseFits, type BinTree, type TreeNode } from '@/lib/binTree'
import { fmtNum } from './binStyle'

export function SetCapacityModal({ tree, ids, onClose, onSaved }: {
  tree: BinTree
  ids: string[]
  onClose: () => void
  /** What each place had before, so the change can be undone. */
  onSaved?: (before: Record<string, number | null>, label: string) => void
}) {
  const qc = useQueryClient()
  const places = ids.map((id) => tree.nodes.get(id)).filter((n): n is TreeNode => !!n && !!n.bin)
  const one = places.length === 1 ? places[0]! : null
  const rows = one ? innermostUnder(tree, one.id).filter((r) => r.bin) : []
  const layered = rows.length > 0
  const rowWord = (rows[0]?.bin?.kind || 'row').toLowerCase()

  const own = one ? one.bin!.capacity ?? null : null
  const [value, setValue] = useState(own ? String(own) : '')
  const sameAll = layered && rows.every((r) => r.bin!.capacity === rows[0]!.bin!.capacity) ? rows[0]!.bin!.capacity ?? null : null
  const [mode, setMode] = useState<'each' | 'rows'>(layered && sameAll == null && rows.some((r) => r.bin!.capacity != null) ? 'rows' : 'each')
  const [each, setEach] = useState(sameAll ? String(sameAll) : '')
  const [perRow, setPerRow] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.bin!.capacity ? String(r.bin!.capacity) : ''])))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // What would be saved: each place and its new capacity.
  const plan: Array<[TreeNode, number | null]> | null = (() => {
    if (!layered) {
      const v = parseFits(value)
      return v === undefined ? null : places.map((p): [TreeNode, number | null] => [p, v])
    }
    if (mode === 'each') {
      const v = parseFits(each)
      return v === undefined ? null : rows.map((r): [TreeNode, number | null] => [r, v])
    }
    const out: Array<[TreeNode, number | null]> = []
    for (const r of rows) { const v = parseFits(perRow[r.id] ?? ''); if (v === undefined) return null; out.push([r, v]) }
    return out
  })()
  const changes = (plan ?? []).filter(([p, v]) => (p.bin!.capacity ?? null) !== v)
  const newTotal = layered && plan && plan.every(([, v]) => v != null) ? plan.reduce((s, [, v]) => s + (v ?? 0), 0) : null

  async function save() {
    if (!plan) return
    setBusy(true)
    setError(null)
    let failed = 0
    const before: Record<string, number | null> = {}
    for (let i = 0; i < changes.length; i++) {
      const [p, v] = changes[i]!
      try {
        await updateInventoryBin(p.id, { capacity: v })
        before[p.id] = p.bin!.capacity ?? null
      } catch {
        failed++
      }
      setProgress(i + 1)
    }
    await qc.invalidateQueries({ queryKey: inventoryBinKeys.all })
    setBusy(false)
    const saved = Object.keys(before).length
    if (saved) {
      onSaved?.(before, layered
        ? `How many fit changed on ${saved} ${saved === 1 ? rowWord : `${rowWord}s`}`
        : plan[0]?.[1] == null ? 'Capacity cleared' : `Capacity set to ${plan[0]![1]}${places.length > 1 ? ` on ${saved} places` : ''}`)
    }
    if (failed) setError(`${failed} of ${changes.length} could not be saved. Try again.`)
    else onClose()
  }

  const input = 'h-11 w-full rounded-lg border border-[var(--bins-border)] bg-[var(--bins-surface)] px-3 text-[16px] text-[var(--bins-text)] focus:border-[var(--bins-accent)] focus:outline-none'
  const tab = (on: boolean) => `h-9 flex-1 rounded-md text-[13px] font-semibold ${on ? 'bg-[var(--bins-surface)] text-[var(--bins-text)] shadow-sm' : 'text-[var(--bins-text-2)]'}`
  const saveLabel = busy ? 'Saving…'
    : layered ? (changes.length ? `Save ${changes.length} ${changes.length === 1 ? rowWord : `${rowWord}s`}` : 'Save')
    : places.length > 1 ? `Set ${places.length} places` : plan?.[0]?.[1] == null ? 'Clear capacity' : 'Save'

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[color-mix(in_srgb,var(--bins-dark)_55%,transparent)] sm:items-center" role="dialog" aria-modal="true" aria-label="Set how many fit"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }}>
      <form className="flex max-h-[90vh] w-full max-w-[440px] flex-col rounded-t-2xl bg-[var(--bins-surface)] p-5 shadow-2xl sm:rounded-2xl"
        onSubmit={(e) => { e.preventDefault(); if (plan && changes.length && !busy) void save() }}>
        <h2 className="text-[17px] font-bold text-[var(--bins-text)]">How many fit?</h2>
        <p className="mt-1 text-[13px] text-[var(--bins-text-2)]">
          {one ? <>For <b>{one.bin!.path_label || one.label}</b>.</> : <>For each of the <b>{places.length}</b> places you ticked.</>}
          {layered ? <> It holds what its {rows.length} {rowWord}s hold, added up.</> : <> The tree uses this to show how full a place is.</>}
        </p>
        {layered && (
          <div className="mt-3 rounded-lg bg-[var(--bins-soft)] px-3 py-2 text-[13px] text-[var(--bins-text-2)]" data-cap-total>
            In all: <b className="tabular-nums text-[var(--bins-text)]">{newTotal != null ? fmtNum(newTotal) : 'not set'}</b>
            {one && <> · {fmtNum(one.total.amount)} in it now</>}
            {newTotal == null && <span className="block text-[12px]">Every {rowWord} needs a number for the total to add up.</span>}
          </div>
        )}
        {layered && (
          <div className="mt-3 flex gap-1 rounded-lg bg-[var(--bins-soft)] p-1" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'each'} className={tab(mode === 'each')} onClick={() => setMode('each')}>Every {rowWord} the same</button>
            <button type="button" role="tab" aria-selected={mode === 'rows'} className={tab(mode === 'rows')} onClick={() => setMode('rows')}>Each {rowWord} on its own</button>
          </div>
        )}
        <div className="mt-3 min-h-0 overflow-y-auto">
          {!layered && (
            <label className="block text-[13px] font-semibold text-[var(--bins-text-2)]">
              Units that fit
              <input autoFocus type="number" inputMode="numeric" min={1} step={1} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Leave blank to clear" className={`mt-1 ${input}`} />
            </label>
          )}
          {layered && mode === 'each' && (
            <label className="block text-[13px] font-semibold text-[var(--bins-text-2)]">
              Each {rowWord} holds
              <input autoFocus type="number" inputMode="numeric" min={1} step={1} value={each} onChange={(e) => setEach(e.target.value)} placeholder="Leave blank to clear" className={`mt-1 ${input}`} />
            </label>
          )}
          {layered && mode === 'rows' && (
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2">
              {rows.map((r) => (
                <label key={r.id} className="contents">
                  <span className="text-[13px] font-semibold text-[var(--bins-text)]">{r.code || r.label}</span>
                  <input type="number" inputMode="numeric" min={1} step={1} value={perRow[r.id] ?? ''} aria-label={`${r.code || r.label} holds`}
                    onChange={(e) => setPerRow((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="not set" className={input} />
                  <span className="text-[12px] tabular-nums text-[var(--bins-muted)]">{fmtNum(r.total.amount)} in it</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {!plan && <p className="mt-2 text-[12.5px] text-[var(--bins-room)]">Use whole numbers from 1 up, or leave a box blank.</p>}
        {busy && changes.length > 1 && <p className="mt-2 text-[12.5px] text-[var(--bins-muted)]">Saving {progress} of {changes.length}…</p>}
        {error && <p className="mt-2 rounded bg-[var(--bins-soft)] px-2 py-1.5 text-[12.5px] text-[var(--bins-room)]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Cancel</button>
          <button type="submit" disabled={!plan || !changes.length || busy}
            className="h-11 rounded-lg bg-[var(--bins-accent)] px-5 text-[14px] font-bold text-[var(--bins-surface)] hover:bg-[var(--bins-accent-strong)] disabled:bg-[var(--bins-border)] disabled:text-[var(--bins-text-2)]">
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
