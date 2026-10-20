/**
 * "Add rows" to many places at once: how many, lettered or numbered, and
 * optionally how many fit in each. Used by the builder's select mode (on the
 * drawing) and by the Bins screen's Select bar (BulkAddRowsModal, for real).
 */
import { useEffect, useState } from 'react'
import type { Mode } from '@/lib/structureDraft'

export interface AddRowsChoice {
  count: number
  mode: Mode
  capacity: number | null
}

export function AddRowsDialog({
  targets, example, busy = false, error, onSubmit, onClose,
}: {
  /** How many places get rows. */
  targets: number
  /** e.g. "BIN-03 has A, B, so it gets C, D, E" — shown under the count. */
  example?: (choice: AddRowsChoice) => string | null
  busy?: boolean
  error?: string | null
  onSubmit: (choice: AddRowsChoice) => void
  onClose: () => void
}) {
  const [count, setCount] = useState(4)
  // Escape closes it wherever the focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  const [mode, setMode] = useState<Mode>('alpha')
  const [fits, setFits] = useState('')
  const fitsNum = Math.floor(Number(fits))
  const fitsBad = fits.trim() !== '' && (!Number.isFinite(fitsNum) || fitsNum < 1 || String(fitsNum) !== fits.trim())
  const choice: AddRowsChoice = { count, mode, capacity: fits.trim() === '' || fitsBad ? null : fitsNum }
  const hint = example?.(choice)

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-label="Add rows"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <form className="w-full max-w-[440px] rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onSubmit={(e) => { e.preventDefault(); if (!fitsBad && !busy) onSubmit(choice) }}>
        <h2 className="text-[17px] font-bold text-slate-900">Add rows</h2>
        <p className="mt-1 text-[13px] text-slate-600">
          Inside each of the <b>{targets}</b> {targets === 1 ? 'place' : 'places'} you ticked. New rows carry on after the rows a place already has, so no code is used twice.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="w-28 text-[13px] font-semibold text-slate-700">How many</span>
          <button type="button" aria-label="Fewer" onClick={() => setCount((c) => Math.max(1, c - 1))} className="h-11 w-11 rounded-lg border border-slate-200 text-[18px] font-bold text-slate-600 hover:bg-slate-50">−</button>
          <input type="number" inputMode="numeric" min={1} max={60} value={count} aria-label="How many rows"
            onChange={(e) => setCount(Math.max(1, Math.min(60, Math.floor(Number(e.target.value)) || 1)))}
            className="h-11 w-16 rounded-lg border border-slate-200 text-center text-[16px] font-bold focus:border-amber-500 focus:outline-none" />
          <button type="button" aria-label="More" onClick={() => setCount((c) => Math.min(60, c + 1))} className="h-11 w-11 rounded-lg border border-slate-200 text-[18px] font-bold text-slate-600 hover:bg-slate-50">+</button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="w-28 text-[13px] font-semibold text-slate-700">Named</span>
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(['alpha', 'num', 'pad'] as Mode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                className={`h-10 rounded-md px-3 font-mono text-[12.5px] font-bold ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {m === 'alpha' ? 'A, B, C' : m === 'num' ? '1, 2, 3' : '01, 02'}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-3">
          <span className="w-28 text-[13px] font-semibold text-slate-700">Each fits</span>
          <input type="number" inputMode="numeric" min={1} value={fits} onChange={(e) => setFits(e.target.value)} placeholder="any"
            className="h-11 w-28 rounded-lg border border-slate-200 px-3 text-[15px] focus:border-amber-500 focus:outline-none" />
          <span className="text-[12px] text-slate-500">units (optional)</span>
        </label>
        {fitsBad && <p className="mt-1 text-[12.5px] text-red-600">Use a whole number from 1 up, or leave it blank.</p>}
        {hint && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[12px] text-slate-600">{hint}</p>}
        {error && <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-[12.5px] text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy || fitsBad || targets === 0}
            className="h-11 rounded-lg bg-amber-500 px-5 text-[14px] font-bold text-white hover:bg-amber-600 disabled:bg-slate-300">
            {busy ? 'Adding…' : `Add ${count * targets} ${count * targets === 1 ? 'row' : 'rows'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
