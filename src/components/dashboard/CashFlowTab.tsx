import { useState } from 'react'
import { WIDGET_BY_ID } from './widgets'
import { WidgetBoundary } from './WidgetBoundary'
import { DASH_RANGE_LABELS, type DashRange } from '@/lib/dashboardTime'

/**
 * Cash Flow tab — a fixed, curated finance view built from the same live
 * widgets as the customizable board (so the numbers always match). Reuses the
 * existing /v1/dashboard/* endpoints; no new backend. Day/Month/Year drives
 * every chart.
 */
const CASHFLOW_TILES: Array<{ id: string; span: 1 | 2 }> = [
  { id: 'company-metrics', span: 2 },
  { id: 'revenue-gauge', span: 1 },
  { id: 'avg-job-revenue', span: 1 },
  { id: 'money-flow', span: 2 },
  { id: 'receivables', span: 2 },
  { id: 'cash-collected', span: 2 },
  { id: 'outstanding-balance', span: 1 },
]

export function CashFlowTab() {
  const [range, setRange] = useState<DashRange>('month')

  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="text-sm text-slate-500">
          Money in vs out, receivables, and average job revenue — live from your books.
        </p>
        <div data-easy-period-controls className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
          {(Object.keys(DASH_RANGE_LABELS) as DashRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                range === r ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {DASH_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div data-easy-widget-grid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {CASHFLOW_TILES.map(({ id, span }) => {
          const def = WIDGET_BY_ID.get(id)
          if (!def) return null
          return (
            <div
              key={id}
              className={`h-[300px] ${span === 2 ? 'sm:col-span-2 xl:col-span-2' : ''}`}
            >
              <WidgetBoundary title={def.title}>
                <def.Component range={range} />
              </WidgetBoundary>
            </div>
          )
        })}
      </div>
    </div>
  )
}
