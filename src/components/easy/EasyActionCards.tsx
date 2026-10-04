export interface EasyAction {
  key: string
  title: string
  description: string
  count?: number
  active?: boolean
  onClick: () => void
}

/** Navigation/filter actions only. Never sends a message or changes a record. */
export function EasyActionCards({ actions, label = 'Needs you' }: { actions: EasyAction[]; label?: string }) {
  return <section aria-label={label} className="mb-5">
    <h2 className="mb-2 text-sm font-semibold text-slate-700">{label}</h2>
    <div data-easy-action-grid className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(action => <button data-easy-action-card key={action.key} type="button" onClick={action.onClick} aria-pressed={action.active}
        className={`min-w-0 rounded-xl border p-4 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${action.active ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-400'}`}>
        {action.count !== undefined && <span className="mb-1 block text-2xl font-bold tabular-nums text-slate-900">{action.count.toLocaleString()}</span>}
        <span className="block font-semibold text-slate-900">{action.title}</span>
        <span className="mt-1 block text-sm text-slate-600">{action.description}</span>
      </button>)}
    </div>
  </section>
}
