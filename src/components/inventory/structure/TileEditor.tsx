/**
 * Change one place on the canvas: its name, code, how many fit, whether
 * stock sits in it, and how many rows it has. Beside the canvas on a wide
 * screen, a sheet from the bottom on a phone. Every change is one step of
 * the builder's Undo.
 */
import { useState } from 'react'
import { codePath, codeProblem, findNode, rowKindOf, rowsOf, type DraftNode, type NodePatch } from '@/lib/structureDraft'
import { TypeIcon } from '@/components/inventory/bins/binUi'
import { nodeType } from '@/lib/binTree'

export function TileEditor({
  draft, nodeKey, onPatch, onRows, onCopy, onRemove, onClose, sheet,
}: {
  draft: readonly DraftNode[]
  nodeKey: string
  onPatch: (key: string, patch: NodePatch) => void
  onRows: (key: string, count: number) => void
  onCopy: (key: string) => void
  onRemove: (key: string) => void
  onClose: () => void
  /** Phone layout: a bottom sheet over the page. */
  sheet: boolean
}) {
  const found = findNode(draft, nodeKey)
  const node = found?.node
  const [name, setName] = useState(node?.name ?? '')
  const [code, setCode] = useState(node?.code ?? '')
  const [fits, setFits] = useState(node?.capacity != null ? String(node.capacity) : '')
  // A different tile, or an Undo that changed this one, remounts it (see
  // tileEditorKey), so the boxes always start from what's true now.

  if (!found || !node) return null
  const problem = code.trim() !== node.code ? codeProblem(draft, nodeKey, code) : null
  const word = (node.kind || 'place').toLowerCase()
  const rows = rowsOf(node)
  const rowWord = rowKindOf(node).toLowerCase()
  const canHaveRows = node.children.length === 0 || rows.length > 0
  const fitsNum = Math.floor(Number(fits))
  const fitsBad = fits.trim() !== '' && (!Number.isFinite(fitsNum) || fitsNum < 1 || String(fitsNum) !== fits.trim())
  const saveFits = () => {
    if (fitsBad) return
    const next = fits.trim() === '' ? null : fitsNum
    if (next !== node.capacity) onPatch(nodeKey, { capacity: next })
  }

  const body = (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2.5">
        <TypeIcon type={nodeType(node.kind)} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-slate-900">{node.name}</div>
          <div className="truncate font-mono text-[12px] text-slate-500">{codePath(found.path)}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </div>

      <label className="block text-[12.5px] font-semibold text-slate-700">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
          onBlur={() => { const v = name.trim(); if (v && v !== node.name) onPatch(nodeKey, { name: v }); else setName(node.name) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-[15px] focus:border-amber-500 focus:outline-none" />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block text-[12.5px] font-semibold text-slate-700">
          Code on the label
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={100}
            aria-invalid={!!problem}
            onBlur={() => { if (!problem && code.trim() && code.trim() !== node.code) onPatch(nodeKey, { code: code.trim() }); else if (problem || !code.trim()) setCode(node.code) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className={`mt-1 h-11 w-full rounded-lg border px-3 font-mono text-[15px] font-bold focus:outline-none ${problem ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-amber-500'}`} />
        </label>
        <label className={`block text-[12.5px] font-semibold ${node.holdsStock ? 'text-slate-700' : 'text-slate-400'}`}>
          How many fit
          <input type="number" inputMode="numeric" min={1} step={1} value={fits} disabled={!node.holdsStock}
            onChange={(e) => setFits(e.target.value)} onBlur={saveFits}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder={node.holdsStock ? 'any' : '—'}
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-[15px] focus:border-amber-500 focus:outline-none disabled:bg-slate-50" />
        </label>
      </div>
      {problem && <p className="-mt-1.5 text-[12.5px] text-red-600">{problem}</p>}
      {fitsBad && <p className="-mt-1.5 text-[12.5px] text-red-600">Use a whole number from 1 up, or leave it blank.</p>}

      <button type="button" onClick={() => onPatch(nodeKey, { holdsStock: !node.holdsStock })} aria-pressed={node.holdsStock}
        className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-left text-[13px] font-semibold ${node.holdsStock ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
        <span className={`grid h-5 w-5 place-items-center rounded border ${node.holdsStock ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'}`}>
          {node.holdsStock && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12.5l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        Stock can sit in this {word}
      </button>

      {canHaveRows && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-slate-800">{rows.length ? `${capital(rowWord)}s inside` : 'Rows inside'}</div>
            <div className="truncate font-mono text-[11.5px] text-slate-500">
              {rows.length ? rows.map((r) => r.code).slice(0, 8).join(' ') + (rows.length > 8 ? ' …' : '') : 'none yet'}
            </div>
          </div>
          <button type="button" aria-label={`One ${rowWord} fewer`} disabled={rows.length === 0} onClick={() => onRows(nodeKey, rows.length - 1)}
            className="h-11 w-11 rounded-lg border border-slate-200 text-[18px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30">−</button>
          <span className="min-w-[24px] text-center font-mono text-[15px] font-bold tabular-nums">{rows.length}</span>
          <button type="button" aria-label={`One more ${rowWord}`} onClick={() => onRows(nodeKey, rows.length + 1)}
            className="h-11 w-11 rounded-lg border border-slate-200 text-[18px] font-bold text-slate-600 hover:bg-slate-50">+</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onCopy(nodeKey)}
          className="min-h-[44px] rounded-lg bg-amber-500 px-3 text-[13px] font-bold text-white hover:bg-amber-600">
          Add another {word} like this
        </button>
        <button type="button" onClick={() => onRemove(nodeKey)}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700">
          Remove this {word}
        </button>
      </div>
      <p className="text-[11.5px] text-slate-500">Changes are only on this drawing until you press Create. Undo takes back any step.</p>
    </div>
  )

  if (sheet) {
    return (
      <div>
        <div className="fixed inset-0 z-[125] bg-slate-900/30" onClick={onClose} />
        <div role="dialog" aria-label={`Change ${node.name}`} className="fixed inset-x-0 bottom-0 z-[126] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
          <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded bg-slate-200" />
          {body}
        </div>
      </div>
    )
  }
  return <div role="region" aria-label={`Change ${node.name}`} className="rounded-xl border border-amber-200 bg-white shadow-sm">{body}</div>
}

function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

