import type { ReactNode } from 'react'
import type { FormDraft } from '@/hooks/useFormDrafts'

export type DraftReviewField = {
  label: string
  value: string
  wide?: boolean
}

export function SavedDraftPanel<T>({
  drafts,
  selected,
  onSelect,
  onClose,
  onDiscard,
  onUse,
  reviewFields,
  reviewContent,
  useLabel,
}: {
  drafts: FormDraft<T>[]
  selected: FormDraft<T> | null
  onSelect: (draft: FormDraft<T>) => void
  onClose: () => void
  onDiscard: (draft: FormDraft<T>) => void
  onUse: (draft: FormDraft<T>) => void
  reviewFields: (draft: FormDraft<T>) => DraftReviewField[]
  reviewContent?: (draft: FormDraft<T>) => ReactNode
  useLabel: (draft: FormDraft<T>) => string
}) {
  if (drafts.length === 0 && !selected) return null

  return (
    <>
      {drafts.length > 0 && (
        <section className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Saved drafts</h2>
              <p className="mt-0.5 text-xs text-slate-500">Review before creating.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{drafts.length}</span>
          </div>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => onSelect(draft)}
                className="block w-full px-4 py-3 text-left hover:bg-amber-50/60"
              >
                <span className="block truncate text-sm font-semibold text-slate-800">{draft.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {new Date(draft.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-20 top-14 z-40 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-label="Review saved draft">
          <button type="button" aria-label="Close draft review" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
          <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Review draft</div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selected.label}</h2>
                <p className="mt-1 text-xs text-slate-500">Saved {new Date(selected.updatedAt).toLocaleString()}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">×</button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {reviewContent?.(selected)}
              <div className="grid grid-cols-2 gap-4">
                {reviewFields(selected).map((field) => (
                  <div key={field.label} className={field.wide ? 'col-span-2' : ''}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{field.label}</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                      {field.value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-4">
              <button type="button" onClick={() => onDiscard(selected)} className="rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                Discard draft
              </button>
              <button type="button" onClick={() => onUse(selected)} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
                {useLabel(selected)} →
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}