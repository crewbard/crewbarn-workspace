import type { FolderLayout } from '@/hooks/useTheme'

/**
 * On-page folder-layout switcher (Cabinet / Tree / Accordion). A light
 * segmented control matching the Cards/Files + This week/Filters toolbar
 * buttons; the active segment uses the brand accent. Shown on the list pages
 * only when the "files" folder view is active.
 */
const OPTIONS: Array<{ id: FolderLayout; label: string }> = [
  { id: 'cabinet', label: 'Cabinet' },
  { id: 'tree', label: 'Tree' },
  { id: 'accordion', label: 'Accordion' },
]

export function FolderLayoutSwitch({
  value,
  onChange,
}: {
  value: FolderLayout
  onChange: (layout: FolderLayout) => void
}) {
  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded-md border border-slate-300 bg-slate-100 p-1" role="group" aria-label="Folder layout">
      {OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={
              'rounded px-2.5 py-1 text-xs font-semibold transition-colors ' +
              (active ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
