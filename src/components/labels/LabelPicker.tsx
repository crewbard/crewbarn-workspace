import { useEffect, useMemo, useRef, useState } from 'react'
import { LabelFace, faceScale, type LabelFaceData } from '@/components/labels/LabelFace'
import { THERMAL_SIZES, type ThermalSizeKey } from '@/lib/thermalLabels'
import {
  columnsFor,
  labelGroups,
  matchesFilter,
  rangeBetween,
  visibleRows,
} from '@/lib/labelSelection'

/**
 * Every label, laid out in rows across the preview, each with a tick box.
 *
 * Only the rows in view are drawn: a storage structure can make hundreds of
 * labels, and hundreds of QR codes drawn at once freeze the page. The rest
 * of the list is empty space of the right height, so the scroll bar is true.
 *
 * Labels are drawn at about actual size, the same face that prints.
 */

const GAP = 12
/** Room around a face for its tick box and outline. */
const PAD_X = 16
const PAD_Y = 40

export function LabelPicker({
  faces,
  size,
  isChosen,
  onChange,
  chosenCount,
}: {
  faces: LabelFaceData[]
  size: ThermalSizeKey
  isChosen: (index: number) => boolean
  /** Tick (true) or untick (false) these positions. */
  onChange: (indices: number[], on: boolean) => void
  chosenCount: number
}) {
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState<number | null>(null)
  const [groupId, setGroupId] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)

  const spec = THERMAL_SIZES[size] ?? THERMAL_SIZES.sheet
  const scale = faceScale(size)
  const faceW = (spec.w || 2) * scale
  const faceH = (spec.h || 1) * scale
  const cellW = faceW + PAD_X
  const rowH = faceH + PAD_Y + GAP

  const shown = useMemo(() => {
    const out: number[] = []
    faces.forEach((f, i) => {
      if (matchesFilter(f, query)) out.push(i)
    })
    return out
  }, [faces, query])

  const groups = useMemo(() => labelGroups(faces), [faces])
  const group = groups.find((g) => g.id === groupId)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const columns = columnsFor(box.width - 8, cellW, GAP)
  const win = visibleRows({ count: shown.length, columns, rowHeight: rowH, scrollTop, viewport: box.height })
  const rows: number[][] = []
  for (let r = win.first; r <= win.last; r++) rows.push(shown.slice(r * columns, (r + 1) * columns))

  const shownChosen = shown.filter(isChosen).length
  const filtered = query.trim() !== ''

  const click = (index: number, shift: boolean) => {
    const on = !isChosen(index)
    const range = shift && anchor !== null ? rangeBetween(shown, anchor, index) : [index]
    onChange(range, on)
    setAnchor(index)
  }

  return (
    <div data-tour="labels-pick" className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-navy-900" aria-live="polite">
          {chosenCount} of {faces.length} selected
        </span>
        <span className="text-[12px] text-[var(--color-slate-500)]">Untick any you don&apos;t want.</span>
        <button
          type="button"
          onClick={() => onChange(shown, true)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          {filtered ? `Select all ${shown.length} shown` : 'Select all'}
        </button>
        <button
          type="button"
          onClick={() => onChange(shown, false)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          {filtered ? 'Select none of these' : 'Select none'}
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // A new search starts at the top, or the list can look empty.
            if (scroller.current) scroller.current.scrollTop = 0
            setScrollTop(0)
          }}
          placeholder="Find a label"
          aria-label="Find a label"
          className="min-w-[140px] grow rounded-lg border border-slate-300 px-2.5 py-1 text-[13px]"
        />
      </div>

      {groups.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            aria-label="Pick a group of labels"
            className="min-w-0 max-w-full grow rounded-lg border border-slate-300 bg-white px-2 py-1 text-[13px]"
          >
            <option value="">Pick a group: a type or a place…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          {group && (
            <>
              <button
                type="button"
                onClick={() => {
                  const keep = new Set(group.indices)
                  onChange(faces.map((_, i) => i).filter((i) => !keep.has(i)), false)
                  onChange(group.indices, true)
                }}
                className="rounded-lg bg-navy-900 px-2.5 py-1 text-[12px] font-semibold text-white"
              >
                Only these
              </button>
              <button
                type="button"
                onClick={() => onChange(group.indices, true)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700"
              >
                Add these
              </button>
              <button
                type="button"
                onClick={() => onChange(group.indices, false)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700"
              >
                Take these out
              </button>
            </>
          )}
        </div>
      )}

      <div
        ref={scroller}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="max-h-[65vh] min-h-[200px] overflow-y-auto rounded-xl bg-amber-50/60 p-1 ring-1 ring-slate-200"
      >
        {shown.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-slate-500">No label matches “{query}”.</p>
        ) : (
          <div style={{ height: win.rows * rowH, position: 'relative' }}>
            {rows.map((row, r) => (
              <div
                key={win.first + r}
                className="absolute left-0 right-0 flex justify-center"
                style={{ top: (win.first + r) * rowH, gap: GAP, paddingTop: GAP / 2 }}
              >
                {row.map((i) => {
                  const on = isChosen(i)
                  const f = faces[i]
                  return (
                    <button
                      key={i}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${f.name}${f.path ? `, ${f.path}` : ''}`}
                      onClick={(e) => click(i, e.shiftKey)}
                      className={`flex shrink-0 flex-col items-stretch rounded-lg p-1.5 text-left transition ${
                        on ? 'bg-white ring-2 ring-amber-400' : 'bg-white/60 opacity-50 ring-1 ring-slate-200 hover:opacity-80'
                      }`}
                      style={{ width: cellW }}
                    >
                      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span
                          aria-hidden
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] leading-none ${
                            on ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-400 bg-white'
                          }`}
                        >
                          {on ? '✓' : ''}
                        </span>
                        <span className="truncate">{f.name}</span>
                      </span>
                      <span className="self-center overflow-hidden rounded-md shadow-sm ring-1 ring-slate-200">
                        <LabelFace data={f} size={size} />
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-slate-500">
        {filtered ? `${shownChosen} of the ${shown.length} shown are selected. ` : ''}
        Click a label to leave it out or put it back. Shift-click picks everything in between.
      </p>
    </div>
  )
}
