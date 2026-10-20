/**
 * "How many fit here?" for one place or for everything ticked. Saves one
 * place at a time with the normal bin update, and says how it went.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateInventoryBin } from '@/lib/inventoryBins'
import { inventoryBinKeys } from '@/hooks/useInventoryBins'
import type { BinTree } from '@/lib/binTree'

export function SetCapacityModal({ tree, ids, onClose, onSaved }: {
  tree: BinTree
  ids: string[]
  onClose: () => void
  /** What each place had before, so the change can be undone. */
  onSaved?: (before: Record<string, number | null>, label: string) => void
}) {
  const qc = useQueryClient()
  const places = ids.map((id) => tree.nodes.get(id)).filter((n) => n && n.bin)
  const current = places.length === 1 ? places[0]!.bin!.capacity ?? null : null
  const [value, setValue] = useState(current ? String(current) : '')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const n = Math.floor(Number(value))
  const clearing = value.trim() === ''
  const valid = clearing || (Number.isFinite(n) && n >= 1 && n <= 1_000_000 && String(n) === value.trim())
  const one = places.length === 1 ? places[0]! : null

  async function save() {
    setBusy(true)
    setError(null)
    let failed = 0
    const before: Record<string, number | null> = {}
    for (let i = 0; i < places.length; i++) {
      try {
        await updateInventoryBin(places[i]!.id, { capacity: clearing ? null : n })
        before[places[i]!.id] = places[i]!.bin!.capacity ?? null
      } catch {
        failed++
      }
      setProgress(i + 1)
    }
    await qc.invalidateQueries({ queryKey: inventoryBinKeys.all })
    setBusy(false)
    if (Object.keys(before).length) {
      onSaved?.(before, clearing ? 'Capacity cleared' : `Capacity set to ${n}${places.length > 1 ? ` on ${Object.keys(before).length} places` : ''}`)
    }
    if (failed) setError(`${failed} of ${places.length} could not be saved. Try again.`)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-[color-mix(in_srgb,var(--bins-dark)_55%,transparent)] sm:items-center" role="dialog" aria-modal="true" aria-label="Set how many fit"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }}>
      <form className="w-full max-w-[420px] rounded-t-2xl bg-[var(--bins-surface)] p-5 shadow-2xl sm:rounded-2xl"
        onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void save() }}>
        <h2 className="text-[17px] font-bold text-[var(--bins-text)]">How many fit?</h2>
        <p className="mt-1 text-[13px] text-[var(--bins-text-2)]">
          {one ? <>For <b>{one.bin!.path_label || one.label}</b>.</> : <>For each of the <b>{places.length}</b> places you ticked.</>}
          {' '}The tree uses this to show how full a place is.
        </p>
        <label className="mt-4 block text-[13px] font-semibold text-[var(--bins-text-2)]">
          Units that fit
          <input autoFocus type="number" inputMode="numeric" min={1} step={1} value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Leave blank to clear"
            className="mt-1 h-12 w-full rounded-lg border border-[var(--bins-border)] px-3 text-[16px] focus:border-amber-500 focus:outline-none" />
        </label>
        {!valid && <p className="mt-1 text-[12.5px] text-red-600">Use a whole number from 1 up, or leave it blank.</p>}
        {busy && places.length > 1 && <p className="mt-2 text-[12.5px] text-[var(--bins-muted)]">Saving {progress} of {places.length}…</p>}
        {error && <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-[12.5px] text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-[var(--bins-text-2)] hover:bg-[var(--bins-soft)]">Cancel</button>
          <button type="submit" disabled={!valid || busy || places.length === 0}
            className="h-11 rounded-lg bg-amber-500 px-5 text-[14px] font-bold text-white hover:bg-amber-600 disabled:bg-[var(--bins-border)] disabled:text-[var(--bins-text-2)]">
            {busy ? 'Saving…' : clearing ? 'Clear capacity' : places.length > 1 ? `Set ${places.length} places` : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

