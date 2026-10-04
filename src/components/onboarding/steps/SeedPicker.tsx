import type { ReactNode } from 'react'

/**
 * "Here is what a shop like yours usually has — tick what you have."
 *
 * Two steps ask this: the tools and trucks you own, and the stock on your
 * shelf. They were built twice and drifted — one said "Select at least one
 * tool, vehicle, software subscription, or kit to create", the other "Select
 * at least one stock item or skip this gate for now" — for the same
 * situation, an empty list.
 *
 * Both were also a table of rows with every field always visible: a name box,
 * a category box, a notes box, quantities. Twenty rows of that is a
 * spreadsheet, and a spreadsheet is what somebody opens CrewBarn to stop
 * using. Here a row is a tick and a name, and the details fold away until
 * somebody wants them.
 *
 * Everything each step sends is unchanged; this only owns the shape of the
 * list and the words around it.
 */

export interface SeedRow {
  selected: boolean
  name: string
}

export function SeedPicker<T extends SeedRow>({
  rows,
  onChange,
  intelligenceLabel,
  countNoun,
  emptyHint,
  detail,
}: {
  rows: T[]
  onChange: (index: number, patch: Partial<T>) => void
  /** Where the suggestions came from: "AI-tailored", "Curated trade research". */
  intelligenceLabel: string
  /** What one row is, for the count: "tool", "item". */
  countNoun: string
  /** Shown when the list came back empty. */
  emptyHint: string
  /** The fields that fold away, per row. */
  detail: (row: T, patch: (p: Partial<T>) => void) => ReactNode
}) {
  const chosen = rows.filter((r) => r.selected && r.name.trim()).length

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-600">
        {emptyHint}
      </p>
    )
  }

  const setAll = (selected: boolean) => rows.forEach((_, i) => onChange(i, { selected } as Partial<T>))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-navy-900">
            {chosen} of {rows.length}
          </span>{' '}
          {chosen === 1 ? countNoun : countNoun + 's'} ticked · suggestions from{' '}
          <span className="text-slate-500">{intelligenceLabel.toLowerCase()}</span>
        </p>
        <div className="flex gap-3 text-sm font-semibold">
          <button type="button" onClick={() => setAll(true)} className="text-amber-700 hover:underline">
            Tick all
          </button>
          <button type="button" onClick={() => setAll(false)} className="text-slate-500 hover:text-navy-900">
            Clear
          </button>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.map((row, index) => (
          <li key={`${row.name}-${index}`} className={row.selected ? '' : 'opacity-55'}>
            <div className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(event) => onChange(index, { selected: event.target.checked } as Partial<T>)}
                aria-label={row.name}
                className="mt-1 h-[18px] w-[18px] shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="min-w-0 grow">
                <input
                  value={row.name}
                  onChange={(event) => onChange(index, { name: event.target.value } as Partial<T>)}
                  aria-label={`Name of ${row.name}`}
                  className="w-full border-0 bg-transparent p-0 text-[15px] font-semibold text-navy-900 focus:outline-none"
                />
                <details className="mt-1">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-slate-400 hover:text-slate-600">
                    Details
                  </summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {detail(row, (p) => onChange(index, p))}
                  </div>
                </details>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A small labelled box for the folded-away detail fields. */
export function SeedField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number'
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        min={type === 'number' ? 0 : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
    </label>
  )
}
