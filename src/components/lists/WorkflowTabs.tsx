/**
 * Shared workflow tab bar for list pages (Customers, Jobs, Estimates,
 * Invoices). Underline-style tabs; optional count badge per tab (wired once
 * the list endpoints return per-tab aggregates).
 */
export interface WorkflowTab {
  key: string
  label: string
  count?: number
}

export function WorkflowTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: WorkflowTab[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div data-workflow-tabs className="flex items-center gap-1 mb-3 border-b border-slate-200 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-pressed={active === t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            active === t.key
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
