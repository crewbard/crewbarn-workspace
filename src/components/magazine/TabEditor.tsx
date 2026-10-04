import { useState } from 'react'
import { IconArrowRight, IconPlus, IconTrash } from '@tabler/icons-react'
import { LIMITS, TAB_COLORS, type DocumentTab, type TabColor } from '@/lib/referenceCards'
import { SWATCH, colorOf } from './tabColors'
import type { Suggestion } from './pdfBook'
import type { PageNumbers } from './pageNumbers'

const SOURCE: Record<Suggestion['source'], string> = {
  edges: 'Its printed tabs',
  contents: 'Its contents page',
  bookmarks: 'Its bookmarks',
  headings: 'Its headings',
}

/**
 * Naming the tabs down the edge of the book.
 *
 * Inside the viewer rather than on a form somewhere, because the only
 * way to know which page "Motorcycles" starts on is to be looking at
 * the book: turn to it, add a tab here.
 */
export function TabEditor({
  saved,
  suggestions,
  page,
  pageCount,
  numbers,
  saving,
  error,
  onGo,
  onSave,
  onClose,
}: {
  saved: DocumentTab[]
  suggestions: Suggestion[]
  page: number
  pageCount: number
  /** The book's printed numbers, which is what the shop types. */
  numbers: PageNumbers
  saving: boolean
  error: string | null
  onGo: (page: number) => void
  onSave: (tabs: DocumentTab[]) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<DocumentTab[]>(saved)
  const [picking, setPicking] = useState<number | null>(null)

  const set = (i: number, patch: Partial<DocumentTab>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  const full = rows.length >= LIMITS.documentTabs

  const problems: string[] = []
  if (rows.some((r) => r.label.trim() === '')) problems.push('every tab needs a name')
  if (rows.some((r) => !Number.isInteger(r.page) || r.page < 1 || r.page > pageCount)) {
    problems.push(`pages run ${numbers.label(1)} to ${numbers.last}`)
  }

  const save = () =>
    onSave(
      [...rows]
        .map((r) => ({ ...r, label: r.label.trim() }))
        // Down the edge in page order, whatever order they were added in.
        .sort((a, b) => a.page - b.page),
    )

  return (
    <aside
      aria-label="Tabs"
      className="flex h-full w-[min(22rem,100vw)] shrink-0 flex-col border-l border-white/10 bg-white text-slate-900"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold">Tabs</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          They sit down the edge of the book like a catalogue's printed index tabs, and each
          one opens it at its page. Turn to a page, then add a tab for it.
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {/*
          Every source the PDF offers, best first. The viewer shows the
          first until tabs are saved; the others are here for when that
          guess is wrong -- a catalogue whose bookmarks are the print
          shop's file names, a contents page that lists the wrong level.
        */}
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">
              {rows.length === 0 ? 'Start from the PDF' : 'Or start over from the PDF'}
            </p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.source}
                type="button"
                onClick={() => setRows(suggestion.tabs.map((t) => ({ label: t.label, page: t.page, color: t.color ?? null })))}
                className="w-full rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-left text-sm text-sky-900 hover:bg-sky-100"
              >
                {SOURCE[suggestion.source]}
                <span className="block text-xs text-sky-700">
                  {suggestion.tabs.length} tabs: {suggestion.tabs.slice(0, 4).map((t) => t.label).join(', ')}
                  {suggestion.tabs.length > 4 ? '…' : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 && suggestions.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            No tabs yet. This PDF has no bookmarks, contents page or headings to start from, so add
            them as you go.
          </p>
        )}

        {rows.map((row, i) => {
          const color = colorOf(row, i)
          return (
            <div key={i} className="rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Colour: ${SWATCH[color].name}`}
                  onClick={() => setPicking(picking === i ? null : i)}
                  className="h-7 w-4 shrink-0 rounded-r-md ring-offset-1 focus-visible:ring-2 focus-visible:ring-sky-500"
                  style={{ background: SWATCH[color].bg }}
                />
                <input
                  value={row.label}
                  maxLength={LIMITS.documentTabLabel}
                  onChange={(e) => set(i, { label: e.target.value })}
                  placeholder="Tab name"
                  aria-label="Tab name"
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  p.
                  <PageField
                    key={`${row.page}:${numbers.shift}`}
                    page={row.page}
                    numbers={numbers}
                    onChange={(next) => set(i, { page: next })}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Go to page ${numbers.label(row.page)}`}
                  title="Go to this page"
                  onClick={() => onGo(row.page)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <IconArrowRight size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${row.label || 'tab'}`}
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                >
                  <IconTrash size={16} />
                </button>
              </div>

              {picking === i && (
                <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tab colour">
                  {TAB_COLORS.map((c: TabColor) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={SWATCH[c].name}
                      onClick={() => {
                        set(i, { color: c })
                        setPicking(null)
                      }}
                      className={
                        'h-6 w-6 rounded-full ring-offset-2 ' +
                        (color === c ? 'ring-2 ring-slate-900' : 'hover:ring-2 hover:ring-slate-300')
                      }
                      style={{ background: SWATCH[c].bg }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          disabled={full}
          onClick={() => setRows((r) => [...r, { label: '', page, color: null }])}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          <IconPlus size={16} />
          {full ? `${LIMITS.documentTabs} tabs is the most` : `Add a tab at page ${numbers.label(page)}`}
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-200 px-4 py-3">
        {(error || problems.length > 0) && (
          <p className="text-xs text-amber-800">{error ?? `Before saving: ${problems.join(', ')}.`}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || problems.length > 0}
            onClick={save}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save tabs'}
          </button>
        </div>
      </div>
    </aside>
  )
}

/**
 * A tab's page, typed as the book numbers it. Taken when you leave the
 * box or press Enter; a number the book does not have puts back the last.
 */
function PageField({
  page,
  numbers,
  onChange,
}: {
  page: number
  numbers: PageNumbers
  onChange: (page: number) => void
}) {
  const [text, setText] = useState(numbers.label(page))

  const commit = () => {
    const next = numbers.find(text)
    if (next === null) setText(numbers.label(page))
    else if (next !== page) onChange(next)
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      inputMode="numeric"
      aria-label="Page"
      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm tabular-nums"
    />
  )
}
