import { useEffect, useState } from 'react'
import { formatCents } from '@/components/EstimateLineItemEditorCore'

/**
 * Good / better / best: one tab per option on an estimate, above its lines.
 *
 * Presentational: the live editor (estimate page) saves each change as it
 * is made; the create form keeps them until the estimate is saved. Either
 * way the open tab's lines are the ones in the editor below.
 */
export interface EstimateTierTab {
  key: string
  name: string
  highlights: string
  is_recommended: boolean
  /** What this option comes to. On the create form tax is added on save. */
  totalCents: number
  /** Lines only this option has, for the remove prompt. */
  ownLineCount: number
}

interface EstimateTierBarProps {
  tiers: EstimateTierTab[]
  activeKey: string
  onSelect: (key: string) => void
  onRename: (key: string, name: string) => void
  onHighlights: (key: string, highlights: string) => void
  onRecommend: (key: string, recommended: boolean) => void
  onRemove: (key: string) => void
  disabled?: boolean
}

export function EstimateTierBar({
  tiers,
  activeKey,
  onSelect,
  onRename,
  onHighlights,
  onRecommend,
  onRemove,
  disabled = false,
}: EstimateTierBarProps) {
  const active = tiers.find((t) => t.key === activeKey) ?? tiers[0]
  const [name, setName] = useState(active?.name ?? '')
  const [highlights, setHighlights] = useState(active?.highlights ?? '')
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  useEffect(() => {
    setName(active?.name ?? '')
    setHighlights(active?.highlights ?? '')
    setConfirmingRemove(false)
  }, [active?.key, active?.name, active?.highlights])

  if (!active) return null

  const commitName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(active.name)
      return
    }
    if (trimmed !== active.name) onRename(active.key, trimmed)
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40" data-tour="estimate-tiers">
      <div role="tablist" aria-label="Options on this estimate" className="flex gap-1 overflow-x-auto border-b border-amber-200 px-2 pt-2">
        {tiers.map((t) => {
          const on = t.key === active.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(t.key)}
              className={`-mb-px flex shrink-0 flex-col items-start rounded-t-md border px-3 py-1.5 text-left ${
                on
                  ? 'border-amber-200 border-b-white bg-white text-slate-900'
                  : 'border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1 text-sm font-semibold">
                {t.name}
                {t.is_recommended && (
                  <span className="rounded bg-amber-500 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                    Recommended
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums text-slate-500">{formatCents(t.totalCents)}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-2 bg-white px-3 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end rounded-b-lg">
        <label className="block text-xs font-medium text-slate-600">
          Name
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          What's different <span className="font-normal text-slate-400">(the customer sees this)</span>
          <input
            type="text"
            value={highlights}
            maxLength={2000}
            placeholder="e.g. 50 gallon tank, 10 year warranty"
            onChange={(e) => setHighlights(e.target.value)}
            onBlur={() => {
              if (highlights !== active.highlights) onHighlights(active.key, highlights)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={disabled}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={active.is_recommended}
              onChange={(e) => onRecommend(active.key, e.target.checked)}
              disabled={disabled}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Recommend
          </label>
          {confirmingRemove ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">
                Remove {active.name}
                {active.ownLineCount > 0 ? ` and its ${active.ownLineCount} line${active.ownLineCount === 1 ? '' : 's'}` : ''}?
              </span>
              <button
                type="button"
                onClick={() => onRemove(active.key)}
                disabled={disabled}
                className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={disabled}
              className="text-sm text-red-700 hover:text-red-800 disabled:opacity-50"
            >
              Remove tier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
