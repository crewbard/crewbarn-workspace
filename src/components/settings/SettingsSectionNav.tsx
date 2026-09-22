import type { ReactNode } from 'react'

export type SettingsSectionItem<T extends string> = {
  id: T
  label: string
  description: string
  group?: string
  status?: ReactNode
}

export function SettingsSectionNav<T extends string>({
  active,
  items,
  onSelect,
  statuses,
  title = 'Settings menu',
}: {
  active: T
  items: SettingsSectionItem<T>[]
  onSelect: (section: T) => void
  statuses?: Partial<Record<T, ReactNode>>
  title?: string
}) {
  const groups = Array.from(new Set(items.map((item) => item.group ?? 'Settings')))

  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="settings-section" className="mb-1 block text-xs font-semibold uppercase text-slate-500">
          Setting area
        </label>
        <select
          id="settings-section"
          value={active}
          onChange={(event) => onSelect(event.target.value as T)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>

      <aside className="sticky top-6 hidden overflow-hidden rounded-md border border-slate-200 bg-white lg:block" aria-label={title}>
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">Choose one area to configure.</div>
        </div>
        <nav className="py-2">
          {groups.map((group) => (
            <div key={group} className="pb-2 last:pb-0">
              {groups.length > 1 && (
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase text-slate-400">{group}</div>
              )}
              {items.filter((item) => (item.group ?? 'Settings') === group).map((item) => {
                const selected = item.id === active
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={selected ? 'page' : undefined}
                    className={`w-full border-l-2 px-4 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-50 text-slate-950'
                        : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {(statuses?.[item.id] ?? item.status) != null && (
                        <span className={`shrink-0 text-[10px] font-semibold ${selected ? 'text-amber-800' : 'text-slate-400'}`}>
                          {statuses?.[item.id] ?? item.status}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-500">{item.description}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

export function settingsSectionFromHash<T extends string>(items: Array<{ id: T }>, fallback: T): T {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '')
  return items.some((item) => item.id === hash) ? hash as T : fallback
}

export function updateSettingsSectionHash(section: string) {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${section}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
