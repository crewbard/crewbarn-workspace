import type { ReactNode } from 'react'

/**
 * The rail that picks which part of a settings page you are looking at.
 *
 * Six pages share it, so it is the one place worth making legible. What it
 * used to be — two lines of grey text per row, a hairline down the left to
 * say which was open — read as a list of file names: everything the same
 * weight, nothing recognisable without being read word by word.
 *
 * Now each row carries a mark. A picture of a padlock is recognised before
 * the word "security" is read, which is the whole job of a menu somebody
 * passes through twenty times a week. The open row is a filled tile and a
 * warm card rather than a 2px border, because at a glance the eye finds a
 * shape long before it finds a line.
 *
 * The mark is optional and a row without one still lines up, so a page that
 * has not picked icons yet is not broken by this — it just looks plainer.
 */

export type SettingsSectionItem<T extends string> = {
  id: T
  label: string
  description: string
  group?: string
  status?: ReactNode
  /** A small mark for the row — a Tabler icon at size 18 fits the tile. */
  icon?: ReactNode
}

export function SettingsSectionNav<T extends string>({
  active, items, onSelect, statuses, title = 'Settings sections', grouped = false,
}: {
  active: T
  items: SettingsSectionItem<T>[]
  onSelect: (section: T) => void
  statuses?: Partial<Record<T, ReactNode>>
  title?: string
  compact?: boolean
  grouped?: boolean
}) {
  const groups = Array.from(new Set(items.map(item => item.group ?? 'Settings')))
  const open = items.find(item => item.id === active)
  return <nav aria-label={title} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white">
    <label className="block p-3 md:hidden">
      <span className="sr-only">{title}</span>
      <select value={active} onChange={event => onSelect(event.target.value as T)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy-900">
        {groups.map(group => <optgroup key={group} label={group}>
          {items.filter(item => (item.group ?? 'Settings') === group).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="hidden p-2 md:block">
      {(grouped ? groups : ['All']).map(group => <div key={group} className={grouped ? 'flex items-start gap-3 border-b border-slate-100 py-2 last:border-0' : 'flex flex-wrap gap-1'}>
      {grouped && <span className="w-24 shrink-0 px-2 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{group}</span>}
      <div className="flex min-w-0 flex-wrap gap-1">
      {items.filter(item => !grouped || (item.group ?? 'Settings') === group).map(item => {
        const selected = item.id === active
        const status = statuses?.[item.id] ?? item.status
        return <button key={item.id} type="button" onClick={() => onSelect(item.id)} title={item.description} aria-current={selected ? 'page' : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-amber-500 ${selected ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-50'}`}>
          {item.icon && <span aria-hidden className="shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
          {status != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{status}</span>}
        </button>
      })}
      </div>
      </div>)}
    </div>
    {open && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{open.description}</p>}
  </nav>
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
