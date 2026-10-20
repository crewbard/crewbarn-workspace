import { SHORTCUTS, SHORTCUT_GROUPS } from '@/lib/shortcuts'
import { useShortcutAccess, useShortcutPrefs } from '@/hooks/useShortcuts'
import { Keys } from './Keys'

/**
 * Every shortcut, grouped, with the keys this person has. Read-only: the
 * Keyboard shortcuts page is where they're changed. Used in Help.
 */
export function ShortcutList({ columns = 2 }: { columns?: 1 | 2 }) {
  const { prefs, keys } = useShortcutPrefs()
  const canUse = useShortcutAccess()

  return (
    <div data-tour="help-shortcuts-list">
      {!prefs.enabled && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your keyboard shortcuts are turned off. Turn them on from Keyboard shortcuts in your account menu.
        </p>
      )}
      <div className={columns === 2 ? 'grid gap-x-8 gap-y-5 md:grid-cols-2' : 'space-y-5'}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
            <p className="mb-1.5 text-xs text-slate-500">{group.blurb}</p>
            <ul className="divide-y divide-slate-100">
              {SHORTCUTS.filter((s) => s.group === group.id).map((s) => {
                const usable = canUse(s)
                return (
                  <li key={s.id} className={`flex items-center justify-between gap-3 py-1.5 text-sm ${usable ? 'text-slate-700' : 'text-slate-400'}`}>
                    <span className="min-w-0">
                      {s.label}
                      {!usable && <span className="ml-1 text-xs">(not available to you)</span>}
                    </span>
                    <Keys keys={keys[s.id]} size="sm" />
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
