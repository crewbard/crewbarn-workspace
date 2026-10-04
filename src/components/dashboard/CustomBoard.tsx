import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import { useDashboardCardSize, type DashCardSize } from '@/hooks/useDashboardCardSize'
import {
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGET_IDS,
  WIDGET_BY_ID,
} from '@/components/dashboard/widgets'
import { WidgetBoundary } from '@/components/dashboard/WidgetBoundary'
import { DASH_RANGE_LABELS, type DashRange } from '@/lib/dashboardTime'
import { DashboardPeriodContext } from '@/hooks/useDashboardSummary'
import { BoardPeriodPicker } from './PeriodPicker'

/**
 * Card-size presets — drive both the grid column count and the tile height.
 * Class strings are full literals so Tailwind picks them up at build time.
 */
const SIZE_CONFIG: Record<DashCardSize, { grid: string; tile: string; label: string }> = {
  large: { grid: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3', tile: 'h-[320px]', label: 'L' },
  medium: { grid: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4', tile: 'h-[260px]', label: 'M' },
  small: { grid: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5', tile: 'h-[200px]', label: 'S' },
}
const SIZE_ORDER: DashCardSize[] = ['small', 'medium', 'large']
const SIZE_TITLES: Record<DashCardSize, string> = {
  small: 'Small cards',
  medium: 'Medium cards',
  large: 'Large cards',
}

/**
 * CustomBoard — the full-screen, customizable widget board (formerly the whole
 * dashboard). Now the "Custom" tab of the dashboard.
 *
 *   - Drag blocks to reorder (persists per-browser).
 *   - "Customize" reveals an add-widget tray + per-widget remove.
 *   - Global Day / Month / Year selector drives the chart widgets.
 *
 * Layout + selection live in localStorage (useDashboardLayout); the set of
 * available blocks is the widget registry in components/dashboard/widgets.
 */
const ALL_IDS = DASHBOARD_WIDGETS.map((w) => w.id)

export function CustomBoard() {
  const { account } = useAuth()

  // Per-employee widget access: the office can restrict which widgets an
  // employee may use. null/absent = no restriction (all widgets).
  const allowedIds = useMemo(() => {
    const ids = account?.extension?.dashboard_widget_ids
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.filter((id) => ALL_IDS.includes(id))
    }
    return ALL_IDS
  }, [account])
  const allowedSet = useMemo(() => new Set(allowedIds), [allowedIds])
  const defaultIds = useMemo(
    () => DEFAULT_WIDGET_IDS.filter((id) => allowedSet.has(id)),
    [allowedSet],
  )

  const { widgets, addWidget, removeWidget, setOrder, reset } = useDashboardLayout(
    defaultIds,
    allowedIds,
  )
  const [range, setRange] = useState<DashRange>('month')
  // Which calendar period the whole board reports on. null = the current (open)
  // one. Switching Month/Quarter/Year invalidates the key, so it resets.
  const [period, setPeriod] = useState<string | null>(null)
  const [cardSize, setCardSize] = useDashboardCardSize()
  const [customizing, setCustomizing] = useState(false)
  const sizeCfg = SIZE_CONFIG[cardSize]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.indexOf(String(active.id))
    const newIndex = widgets.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setOrder(arrayMove(widgets, oldIndex, newIndex))
  }

  const available = DASHBOARD_WIDGETS.filter(
    (w) => !widgets.includes(w.id) && allowedSet.has(w.id),
  )

  return (
    <DashboardPeriodContext.Provider value={period}>
    <div className="w-full px-4 sm:px-6 py-5 sm:py-6">
      {/* Controls */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <p className="text-sm text-slate-500">
          Your own board — drag blocks to rearrange, customize to add or remove.
        </p>
        <div data-easy-board-controls className="flex items-center gap-2">
          {/* WHICH period — each is a closed calendar period (tax-year safe). */}
          <BoardPeriodPicker range={range} onChange={setPeriod} />
          {/* Day / Month / Quarter / Year */}
          <div data-tour="dash-range" className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            {(Object.keys(DASH_RANGE_LABELS) as DashRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r)
                  setPeriod(null) // a 2025 key isn't valid for Month, etc.
                }}
                className={[
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  range === r
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {DASH_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          {/* Card size: Small / Medium / Large */}
          <div data-tour="dash-size" className="inline-flex rounded-lg border border-slate-300 overflow-hidden" title="Card size">
            {SIZE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCardSize(s)}
                title={SIZE_TITLES[s]}
                aria-label={SIZE_TITLES[s]}
                aria-pressed={cardSize === s}
                className={[
                  'px-3 py-1.5 text-sm font-semibold transition-colors',
                  cardSize === s
                    ? 'bg-navy-800 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {SIZE_CONFIG[s].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-tour="dashboard-customize"
            onClick={() => setCustomizing((v) => !v)}
            className={[
              'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
              customizing
                ? 'bg-navy-800 text-white border-navy-800'
                : 'bg-white text-navy-800 border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            {customizing ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      {/* Add-widget tray (customize mode) */}
      {customizing && (
        <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-navy-900">Add a block</h2>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Reset to default
            </button>
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-slate-500">Every block is already on your dashboard.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => addWidget(w.id)}
                  title={w.description}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-amber-400 hover:bg-amber-50 text-navy-800"
                >
                  <span className="text-amber-600 font-bold">+</span>
                  {w.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No blocks yet. Click <strong>Customize</strong> to add some.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets} strategy={rectSortingStrategy}>
            <div data-easy-widget-grid className={`grid ${sizeCfg.grid} gap-4`}>
              {widgets.map((id) => {
                const def = WIDGET_BY_ID.get(id)
                if (!def) return null
                return (
                  <SortableWidget
                    key={id}
                    id={id}
                    span={def.span}
                    tile={sizeCfg.tile}
                    customizing={customizing}
                    onRemove={() => removeWidget(id)}
                  >
                    <WidgetBoundary title={def.title}>
                      <def.Component range={range} />
                    </WidgetBoundary>
                  </SortableWidget>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
    </DashboardPeriodContext.Provider>
  )
}

function SortableWidget({
  id,
  span,
  tile,
  customizing,
  onRemove,
  children,
}: {
  id: string
  span: 1 | 2
  tile: string
  customizing: boolean
  onRemove: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }
  const spanCls = span === 2 ? 'sm:col-span-2 xl:col-span-2' : ''

  return (
    <div ref={setNodeRef} data-tour={`dashw-${id}`} style={style} className={`relative ${tile} ${spanCls}`}>
      {customizing && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-300 text-slate-500 hover:text-slate-800 cursor-grab active:cursor-grabbing shadow-sm"
            title="Drag to move"
            aria-label="Drag to move"
          >
            <span className="text-base leading-none">⠿</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-300 text-slate-400 hover:text-red-600 hover:border-red-300 shadow-sm"
            title="Remove block"
            aria-label="Remove block"
          >
            ✕
          </button>
        </div>
      )}
      {/* Dim + ring the card in customize mode so it reads as editable */}
      <div className={['h-full', customizing ? 'ring-2 ring-amber-300/60 rounded-xl' : ''].join(' ')}>
        {children}
      </div>
    </div>
  )
}
