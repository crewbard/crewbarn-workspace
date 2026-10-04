import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { PhotoMeasure } from './PhotoMeasure'

type Photo = { key: string; message_id: string; index: number; url: string; created_at: string; body: string | null; annotation: { description: string; memory_id: string | null } | null }

export function IntakePhotos({ draftId }: { draftId: string }) {
  const canTeach = usePermissions().has(PERM.AI_TRAIN)
  // Default is the photos that came WITH this request. The whole
  // conversation is one click away for the rare time the right picture is
  // genuinely further back — but it is not the default, because a dealer who
  // texts every week had months of unrelated photos stacked above the one
  // being taught.
  const [showAll, setShowAll] = useState(false)
  const photos = useQuery({
    queryKey: ['intake-photos', draftId, showAll],
    queryFn: () => apiRequest<{ data: Photo[]; scope: string; window_minutes: number | null }>(
      `/v1/ai/intake/drafts/${encodeURIComponent(draftId)}/photos${showAll ? '?scope=conversation' : ''}`,
    ),
    refetchInterval: 30_000,
  })
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-bold text-navy-900">Photos · Teach CBI</h3>
      <button type="button" onClick={() => setShowAll(v => !v)} className="text-sm font-semibold text-navy-700 underline">
        {showAll ? 'Just this request' : 'Show the whole conversation'}
      </button>
    </div>
    <p className="mt-1 text-sm text-slate-500">
      {showAll
        ? 'Every attachment in this conversation, newest first — including older requests. Check the date before teaching.'
        : 'What came in with this request. Photos sent within half an hour of it, so a picture and the message describing it stay together.'}
    </p>
    {photos.isPending && <p role="status">Loading attachments…</p>}
    {photos.isError && <p role="alert" className="mt-3 text-sm text-red-700">Could not load photos. <button type="button" onClick={() => photos.refetch()} className="underline">Retry</button></p>}
    {photos.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-500">{showAll ? 'No attachments anywhere in this conversation.' : 'No photos came with this request. Try “Show the whole conversation” if you expected one.'}</p>}
    <div className="mt-4 grid gap-4 xl:grid-cols-2">{photos.data?.data.map(photo => <PhotoCard key={photo.key} photo={photo} draftId={draftId} />)}</div>
    {canTeach && <PhotoTrainingHistory draftId={draftId} />}
  </section>
}

type TrainingEvidence = { description?: string; parts?: Array<{ label: string; fits?: string | null }>; decider?: string | null; notes?: string | null }
type TrainingEvent = { id: string; actor_id: string | null; action: string; created_at: string; evidence: { before: TrainingEvidence | null; after: TrainingEvidence; lesson_saved: string | null } }
function describeEvidence(value: TrainingEvidence): string {
  if (!value.description && !value.parts) return JSON.stringify(value, null, 2)
  return value.description ?? [value.parts?.map(part => part.label + (part.fits ? ` (${part.fits})` : '')).join('; '), value.decider, value.notes].filter(Boolean).join('\n')
}
function PhotoTrainingHistory({ draftId }: { draftId: string }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const history = useQuery({ queryKey: ['photo-training-history', draftId, page], enabled: open, queryFn: () => apiRequest<{ data: TrainingEvent[]; current_page: number; last_page: number; total: number }>(`/v1/ai/intake/drafts/${encodeURIComponent(draftId)}/training-history?page=${page}`) })
  return <details className="mt-4 border-t border-slate-200 pt-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-bold">Intake review & teaching history</summary>
    <p className="mt-2 text-xs text-slate-500">Durable records from each audit feature’s release onward. Earlier history is not backfilled. Covers intake edits, dismissals, photo identification, parts corrections and their saved lessons.</p>
    {history.isPending && open && <p role="status">Loading history…</p>}
    {history.isError && <p role="alert" className="mt-2 text-sm text-red-700">History unavailable. The API may still need its audit migration. <button className="underline" onClick={() => history.refetch()}>Retry</button></p>}
    {history.data?.total === 0 && <p className="mt-3 text-sm">No durable training events yet.</p>}
    <ol className="mt-3 space-y-3">{history.data?.data.map(event => <li key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm">
      <p className="font-semibold">{{ job_created_by_human: 'Job created by a reviewer', intake_reviewed: 'Intake details reviewed', intake_dismissed: 'Intake set aside', photo_lesson_saved: 'Photo identification and lesson saved', photo_identified: 'Photo identified', parts_corrected_and_remembered: 'Parts corrected and lesson saved', parts_corrected_locally: 'Parts corrected · intake only' }[event.action] ?? event.action}</p>
      <p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()} · Reviewer {event.actor_id ?? 'not recorded'}</p>
      {event.evidence.before && <p className="mt-2 whitespace-pre-wrap break-words"><strong>Before:</strong> {describeEvidence(event.evidence.before)}</p>}
      <p className="mt-2 whitespace-pre-wrap break-words"><strong>After:</strong> {describeEvidence(event.evidence.after)}</p>
      {event.evidence.lesson_saved && <p className="mt-2 whitespace-pre-wrap break-words"><strong>Lesson saved:</strong> {event.evidence.lesson_saved}</p>}
    </li>)}</ol>
    {history.data && history.data.last_page > 1 && <div className="mt-3 flex items-center gap-3 text-sm"><button disabled={page <= 1 || history.isFetching} onClick={() => setPage(page - 1)}>Previous</button><span>Page {history.data.current_page} of {history.data.last_page}</span><button disabled={page >= history.data.last_page || history.isFetching} onClick={() => setPage(page + 1)}>Next</button></div>}
  </details>
}

function PhotoCard({ photo, draftId }: { photo: Photo; draftId: string }) {
  const canTeach = usePermissions().has(PERM.AI_TRAIN)
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(photo.annotation?.description ?? '')
  const [lesson, setLesson] = useState('')
  const [remember, setRemember] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const save = useMutation({ mutationFn: () => apiRequest(`/v1/ai/intake/drafts/${encodeURIComponent(draftId)}/photos/teach`, { method: 'POST', body: { message_id: photo.message_id, index: photo.index, description, lesson: remember ? lesson : null } }), onSuccess: () => { setOpen(false); setLesson(''); setRemember(false); client.invalidateQueries({ queryKey: ['intake-photos', draftId] }); client.invalidateQueries({ queryKey: ['photo-training-history', draftId] }); client.invalidateQueries({ queryKey: ['ai-intake-drafts'] }) } })
  const safeUrl = /^https?:\/\//i.test(photo.url) ? photo.url : null
  return <article className="min-w-0 rounded-xl border border-slate-200 p-3">
    {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer">{imageFailed ? <span className="text-sm underline">Open attachment (preview unavailable)</span> : <img src={safeUrl} alt="Conversation attachment — awaiting human identification" loading="lazy" className="h-48 w-full rounded-lg bg-slate-50 object-contain" onError={() => setImageFailed(true)} />}</a>}
    <p className="mt-2 text-xs text-slate-500">{new Date(photo.created_at).toLocaleString()}</p>
    {photo.body && <p className="mt-2 break-words text-sm text-slate-600">{photo.body}</p>}
    {photo.annotation && <p className="mt-3 whitespace-pre-wrap break-words text-sm"><strong>Your identification:</strong> {photo.annotation.description}{photo.annotation.memory_id && <span className="mt-1 block text-xs text-amber-800">A lasting lesson is saved. Manage it in What CBI knows.</span>}</p>}
    {canTeach ? <button type="button" className="mt-3 text-sm font-semibold text-amber-800" onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Tell CBI what this is'}</button> : <p className="mt-3 text-xs text-slate-500">Training permission is needed to identify photos.</p>}
    {open && <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); save.mutate() }}>
      {safeUrl && !imageFailed && <PhotoMeasure url={safeUrl} onUse={text => setDescription(current => [current, text].filter(Boolean).join('\n'))} />}
      {description.length > 1500 && <p role="alert" className="text-sm text-red-700">Identification exceeds 1,500 characters. Shorten it before saving; no measurements have been discarded.</p>}
      <label className="block text-sm font-semibold">What is in this photo?<textarea required maxLength={1500} value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" placeholder="Identify the item, visible markings, model and useful context." /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Also save a reusable lesson for CBI</label>
      {remember && <label className="block text-sm">What should CBI remember for future work?<textarea required maxLength={1500} value={lesson} onChange={event => setLesson(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" placeholder="State when this applies and how to recognize it. Avoid customer-specific details." /></label>}
      <p className="text-xs text-slate-500">Identification stays with this intake. A reusable lesson becomes confirmed shop knowledge; it does not retrain the vision model or authorize actions. Existing lessons are not removed by an identification-only edit.</p>
      {save.isError && <p role="alert" className="text-sm text-red-700">Could not save. Your text is retained; please retry.</p>}
      <button disabled={save.isPending || description.length > 1500 || !description.trim() || (remember && !lesson.trim())} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-navy-900 disabled:opacity-50">{save.isPending ? 'Saving…' : remember ? 'Save identification and lesson' : 'Save identification'}</button>
    </form>}
    {save.isSuccess && !open && <p role="status" className="mt-2 text-xs text-emerald-700">Saved.</p>}
  </article>
}
