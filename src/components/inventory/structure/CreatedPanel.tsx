/**
 * After a build: what was made, with Undo (while it's still empty, for 15
 * minutes) and Print labels for exactly the new places.
 */
import { canUndo, type CreatedPlaces } from '@/lib/structureTemplates'

export function CreatedPanel({
  created, placeName, undoing, undone, error, onUndo, onPrint, onAgain, onDone,
}: {
  created: CreatedPlaces
  placeName: string
  undoing: boolean
  undone: boolean
  error: string | null
  onUndo: () => void
  onPrint: () => void
  onAgain: () => void
  onDone: () => void
}) {
  const n = created.created_count
  return (
    <div role="status" className="mx-auto flex max-w-[640px] flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
      <span className={`grid h-12 w-12 place-items-center rounded-full ${undone ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {undone ? <path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3" /> : <path d="M4 12.5l5 5L20 7" />}
        </svg>
      </span>
      <h3 className="text-[18px] font-bold text-slate-900">
        {undone ? 'Taken back. Nothing new is left in ' + placeName + '.' : `${n.toLocaleString('en-US')} ${n === 1 ? 'place' : 'places'} created in ${placeName}`}
      </h3>
      {!undone && (
        <p className="text-[13px] text-slate-600">
          {created.skipped_count ? `${created.skipped_count.toLocaleString('en-US')} already existed and were left alone. ` : ''}
          {created.renamed?.length ? `${created.renamed.map((r) => `${r.from} became ${r.to}`).join(', ')}, because those codes were taken. ` : ''}
          Every place stays editable in Inventory › Bins.
        </p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {!undone && n > 0 && (
          <button type="button" onClick={onPrint} className="h-11 rounded-lg bg-amber-500 px-4 text-[14px] font-bold text-white hover:bg-amber-600">
            Print their labels
          </button>
        )}
        {!undone && canUndo(created) && (
          <button type="button" onClick={onUndo} disabled={undoing} className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {undoing ? 'Undoing…' : 'Undo'}
          </button>
        )}
        <button type="button" onClick={onAgain} className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
          Build another
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-lg px-4 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">Done</button>
      </div>
    </div>
  )
}
