import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type ApiError } from '@/lib/api'

/**
 * Append-only notes feed for a work order. Once saved, a note is
 * permanent — there is no edit / delete. The "Add note +" composer
 * collapses by default so the feed stays the focus.
 *
 * Legacy internal_notes / public_notes columns (single-textarea era)
 * render as a read-only "legacy" entry at the top of the feed when
 * present, so existing data isn't lost on the cutover.
 */

export interface NoteAuthor {
  id: string
  name: string | null
}

export interface NoteRow {
  id: string
  body: string
  visibility: 'internal' | 'public'
  created_at: string
  author: NoteAuthor | null
}

function useWorkOrderNotes(workOrderId: string) {
  return useQuery({
    queryKey: ['work-order', workOrderId, 'notes'],
    queryFn: () => apiRequest<{ data: NoteRow[] }>(`/v1/work-orders/${workOrderId}/notes`),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function WorkOrderNotesTabButton({
  workOrderId,
  active,
  onClick,
  legacyInternal,
  legacyPublic,
}: {
  workOrderId: string
  active: boolean
  onClick: () => void
  legacyInternal?: string | null
  legacyPublic?: string | null
}) {
  const notesQ = useWorkOrderNotes(workOrderId)
  const notes = notesQ.data?.data ?? []
  const legacyNotes = [legacyInternal, legacyPublic].filter((note): note is string => !!note?.trim())
  const noteCount = notes.length + legacyNotes.length

  // The tab row scrolls sideways, and overflow-x:auto forces overflow-y to auto
  // as well — so an absolutely-positioned preview hanging below the row gets
  // clipped to the row's own height. Same reason TimeField portals its dropdown.
  // Rendered fixed, at coordinates measured from the button on hover.
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const place = () => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Clamp so a tab near the right edge doesn't push the panel off-screen.
    const width = Math.min(384, window.innerWidth - 32)
    const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16)
    setPos({ top: r.bottom + 8, left })
  }

  return (
    <div
      ref={anchorRef}
      className="group relative shrink-0"
      onMouseEnter={place}
      onMouseLeave={() => setPos(null)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`pb-3 -mb-px text-sm font-medium border-b-2 inline-flex items-center gap-1.5 ${
          active
            ? 'border-amber-600 text-amber-700'
            : 'border-transparent text-slate-600 hover:text-slate-900'
        }`}
      >
        Notes
        {noteCount > 0 && (
          <span className="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
            {noteCount > 99 ? '99+' : noteCount}
          </span>
        )}
      </button>

      {pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 70 }}
          className="w-96 max-w-[calc(100vw-2rem)]"
          // Stay open while the pointer is over the panel itself, so the notes
          // are readable and scrollable instead of vanishing on the way there.
          onMouseEnter={place}
          onMouseLeave={() => setPos(null)}
        >
        <div className="rounded-md border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <strong className="text-xs text-slate-900">Job notes</strong>
            <span className="text-[11px] text-slate-500">Click to read or add</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {notesQ.isLoading ? (
              <p className="text-xs italic text-slate-500">Loading notes...</p>
            ) : noteCount === 0 ? (
              <p className="text-xs italic text-slate-500">No notes yet. Click Notes to add one.</p>
            ) : (
              <>
                {notes.map((note) => <NotePreview key={note.id} note={note} />)}
                {legacyNotes.map((note, index) => (
                  <div key={`legacy-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Legacy note</div>
                    <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{note}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function WorkOrderNotesPanel({
  workOrderId,
  legacyInternal,
  legacyPublic,
}: {
  workOrderId: string
  legacyInternal?: string | null
  legacyPublic?: string | null
}) {
  const qc = useQueryClient()
  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal')

  const notesQ = useWorkOrderNotes(workOrderId)

  const add = useMutation({
    mutationFn: () =>
      apiRequest<{ data: NoteRow }>(`/v1/work-orders/${workOrderId}/notes`, {
        method: 'POST',
        body: { body: body.trim(), visibility },
      }),
    onSuccess: () => {
      setBody('')
      setComposing(false)
      qc.invalidateQueries({ queryKey: ['work-order', workOrderId, 'notes'] })
    },
  })

  const notes = notesQ.data?.data ?? []
  const hasLegacy = !!(legacyInternal && legacyInternal.trim()) || !!(legacyPublic && legacyPublic.trim())

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">
          Notes
        </h2>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
          >
            + Add note
          </button>
        )}
      </div>

      {composing && (
        <div className="mb-4 border border-amber-200 bg-amber-50 rounded-lg p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Write a note. Once saved, it's permanent."
            className="w-full text-sm rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            <label className="text-xs text-slate-600 inline-flex items-center gap-2">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'internal' | 'public')}
                className="text-xs rounded border border-slate-300 px-2 py-1 bg-white"
              >
                <option value="internal">Internal (staff only)</option>
                <option value="public">Public (customer can see)</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposing(false)
                  setBody('')
                }}
                className="text-xs px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!body.trim() || add.isPending}
                onClick={() => add.mutate()}
                className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
              >
                {add.isPending ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
          {add.isError && (
            <div className="mt-2 text-xs text-red-700">
              {(add.error as ApiError).message ?? 'Could not save note.'}
            </div>
          )}
        </div>
      )}

      {notesQ.isLoading ? (
        <div className="text-xs text-slate-500 italic">Loading notes…</div>
      ) : notes.length === 0 && !hasLegacy ? (
        <div className="text-xs text-slate-500 italic">
          No notes yet. Add one above — they're permanent so the job has a paper trail.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
          {hasLegacy && (
            <li className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Legacy note (pre-feed)
                </span>
              </div>
              {legacyInternal && (
                <div className="text-sm whitespace-pre-wrap text-slate-800">
                  <span className="inline-block text-[10px] font-semibold text-slate-500 uppercase mr-2">
                    Internal
                  </span>
                  {legacyInternal}
                </div>
              )}
              {legacyPublic && (
                <div className="text-sm whitespace-pre-wrap text-slate-800 mt-2">
                  <span className="inline-block text-[10px] font-semibold text-emerald-700 uppercase mr-2">
                    Public
                  </span>
                  {legacyPublic}
                </div>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function NotePreview({ note }: { note: NoteRow }) {
  const when = note.created_at ? new Date(note.created_at) : null
  return (
    <div className="rounded border border-slate-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <strong className="truncate text-slate-700">{note.author?.name ?? 'System'}</strong>
        {when && <span className="shrink-0">{when.toLocaleString()}</span>}
      </div>
      <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{note.body}</p>
    </div>
  )
}

function NoteItem({ note }: { note: NoteRow }) {
  const when = note.created_at ? new Date(note.created_at) : null
  const visBadge =
    note.visibility === 'public' ? (
      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
        Public
      </span>
    ) : (
      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
        Internal
      </span>
    )
  return (
    <li className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
            {(note.author?.name?.[0] ?? '?').toUpperCase()}
          </span>
          <strong className="text-slate-800">{note.author?.name ?? 'System'}</strong>
          {when && <span className="text-slate-400">· {when.toLocaleString()}</span>}
        </div>
        {visBadge}
      </div>
      <div className="text-sm whitespace-pre-wrap text-slate-800">{note.body}</div>
    </li>
  )
}
