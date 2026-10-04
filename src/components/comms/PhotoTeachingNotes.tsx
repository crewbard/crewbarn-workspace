import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconSchool, IconSparkles } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { TeachingPhotoViewer } from './TeachingPhotoViewer'
import { ManufacturerContact } from './ManufacturerContact'
import { PhotoPartResearch } from './PhotoPartResearch'
import { PERM, usePermissions } from '@/hooks/usePermissions'
import { submitPartMatchFeedback, type CommsMessage, type CommsImageAnalysis } from '@/lib/comms'

/** A photo's AI badge is its single entry point: no extra cards beneath the conversation. */
export function PhotoTeachingNotes({ message, url: initialUrl, analysis: savedAnalysis, photoNumber: initialNumber, photoCount, images }: {
  message: CommsMessage; url: string; analysis: CommsImageAnalysis | null; photoNumber: number; photoCount: number; images: string[]
}) {
  const canTeach = usePermissions().has(PERM.AI_TRAIN)
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(initialNumber - 1)
  const url = images[selectedIndex] ?? initialUrl
  const photoNumber = selectedIndex + 1
  const belongsToPhoto = savedAnalysis?.source_url ? savedAnalysis.source_url === url : selectedIndex === 0
  const analysis = belongsToPhoto && savedAnalysis ? {
    ...savedAnalysis, matches: savedAnalysis.matches?.filter(match => match.confidence >= 70),
  } : null
  const [editState, setEditState] = useState({ dirty: false, saving: false })
  const selectPhoto = (index: number) => {
    if (index === selectedIndex || index < 0 || index >= images.length || editState.saving) return
    if (editState.dirty && !window.confirm('Discard unsaved notes and switch photos?')) return
    setEditState({ dirty: false, saving: false })
    setSelectedIndex(index)
  }
  const close = () => {
    if (editState.saving) return
    if (editState.dirty && !window.confirm('Discard your unsaved photo teaching notes?')) return
    setOpen(false)
    setEditState({ dirty: false, saving: false })
  }
  const best = analysis?.matches?.[0]
  const stock = best ? analysis?.stock?.find(row => row.matched_part_id === best.part.id) : null
  if (!savedAnalysis && !canTeach) return null
  return <>
    <button type="button" onClick={() => { setSelectedIndex(initialNumber - 1); setOpen(true) }}
      aria-label={`Open CBI details${canTeach ? ' and teach CBI' : ''} for photo ${initialNumber}`}
      title={canTeach ? 'View AI details and teach CBI' : 'View AI details'}
      className="absolute left-2 top-2 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/70 bg-navy-900/90 px-2.5 text-xs font-semibold text-white shadow transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
      <IconSparkles size={14} aria-hidden /> AI{canTeach && <span className="border-l border-white/30 pl-1.5">Teach</span>}
    </button>
    {open && createPortal(<Modal isOpen onClose={close} disableBackdropClose={editState.dirty || editState.saving} size="xl" title="CBI · Photo details"
      subtitle={`Photo ${photoNumber} of ${photoCount} · Review what CBI sees${canTeach ? ' and teach it what you know' : ''}`}>
      {images.length > 1 && <nav aria-label="Conversation photos" className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2">
        <button type="button" disabled={selectedIndex === 0 || editState.saving} onClick={() => selectPhoto(selectedIndex - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-1">
          {images.map((image, index) => <button key={image} type="button" aria-label={`View photo ${index + 1}`} aria-current={selectedIndex === index ? 'true' : undefined} disabled={editState.saving} onClick={() => selectPhoto(index)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${selectedIndex === index ? 'border-amber-500 ring-2 ring-amber-100' : 'border-transparent'} disabled:opacity-40`}>
            <img src={image} alt="" className="h-12 w-12 object-cover" />
          </button>)}
        </div>
        <button type="button" disabled={selectedIndex >= images.length - 1 || editState.saving} onClick={() => selectPhoto(selectedIndex + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
      </nav>}
      <Modal.Body className="!p-0">
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,1fr)]">
          <TeachingPhotoViewer key={url} url={url} photoNumber={photoNumber} />
          <div className="min-w-0 space-y-6 p-5 sm:p-6">
            <section className="space-y-3 break-words">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><IconSparkles size={18} className="text-amber-600" /> What CBI sees</h3>
              {photoCount > 1 && !analysis && <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">This photo has no separate saved analysis. CBI will not reuse another photo's description or part suggestion here.</p>}
              {analysis ? <>
                <p className="font-semibold text-slate-900">{analysis.summary || 'Image analysis'}</p>
                {analysis.description && <p className="text-sm leading-relaxed text-slate-600">{analysis.description}</p>}
                {!!analysis.visible_text?.length && <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">Visible text</span><p className="mt-1 text-slate-600">{analysis.visible_text.join(', ')}</p></div>}
                {!analysis.matches?.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No reliable catalog suggestion yet. Add identifying details or explain the repair needed. Some photos show a condition or damage rather than a replaceable part.</p>}
                {analysis.matches?.[0] && <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">Suggested match · {analysis.matches[0].confidence}%</p>
                  <p className="mt-1">{analysis.matches[0].part.description || 'Inventory item'}</p>
                  <p className="mt-1 font-mono text-xs">{analysis.matches[0].part.part_number || analysis.matches[0].part.sku || analysis.matches[0].part.model_number}</p>
                  <p className="mt-1 text-slate-500">{analysis.matches[0].reason}</p>
                </div>}
                {stock && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Stock: {stock.qty_available} available / {stock.qty_on_hand} on hand{stock.sku ? ` · ${stock.sku}` : ''}</p>}
                {analysis.error && <p role="alert" className="text-sm text-amber-800">{analysis.error}</p>}
              </> : <p className="text-sm text-slate-500">No AI description has been saved yet. You can still identify this photo for CBI.</p>}
              <p className="text-xs text-slate-500">AI suggestions can be wrong. Check the photo before relying on them.</p>
            </section>
            <ManufacturerContact key={url} messageId={message.id} suggestedName={photoCount === 1 ? best?.part.manufacturer : null} />
            <PhotoPartResearch key={`research-${url}`} messageId={message.id} url={url} subject={analysis?.summary ?? ''} />
            {canTeach ? <PhotoNote key={url} message={message} url={url} onStateChange={setEditState} /> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">You can review the analysis. Teaching CBI requires permission from your administrator.</p>}
          </div>
        </div>
      </Modal.Body>
    </Modal>, document.body)}
  </>
}

function PhotoNote({ message, url, onStateChange }: { message: CommsMessage; url: string; onStateChange: (state: { dirty: boolean; saving: boolean }) => void }) {
  const id = useId()
  const saved = (message.meta?.ai_photo_notes as Record<string, { finish?: string; notes?: string }> | undefined)?.[url]
  const [finish, setFinish] = useState(saved?.finish ?? '')
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [baseline, setBaseline] = useState({ finish: saved?.finish ?? '', notes: saved?.notes ?? '' })
  const dirty = finish.trim() !== baseline.finish.trim() || notes.trim() !== baseline.notes.trim()
  const cache = useQueryClient()
  const save = useMutation({
    mutationFn: () => submitPartMatchFeedback({ messageId: message.id, outcome: 'annotated', photoUrl: url, finish: finish.trim(), notes: notes.trim() }),
    onSuccess: () => {
      setBaseline({ finish: finish.trim(), notes: notes.trim() })
      return cache.invalidateQueries({ queryKey: ['comms', 'conversation', message.conversation_id] })
    },
  })
  useEffect(() => { onStateChange({ dirty, saving: save.isPending }) }, [dirty, save.isPending, onStateChange])
  return <section className="space-y-4 border-t border-slate-200 pt-5 text-sm">
    <h3 className="flex items-center gap-2 font-bold text-slate-900"><IconSchool size={18} className="text-amber-600" /> Teach CBI</h3>
    <p className="text-xs leading-relaxed text-slate-500">Add confirmed details or correct a mistake. Lighting can change how finishes look. Notes follow your learning and approval settings.</p>
    <p aria-live="polite" className="text-xs font-semibold text-amber-800">{save.isPending ? 'Saving this photo’s notes…' : dirty ? 'Unsaved changes' : baseline.notes || baseline.finish ? 'Saved notes for this photo' : 'No teaching notes yet'}</p>
    <fieldset disabled={save.isPending} className="space-y-4">
    <label htmlFor={`${id}-finish`} className="block font-medium text-slate-700">Finish / finish code
      <input id={`${id}-finish`} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5" value={finish} maxLength={120} onChange={e => setFinish(e.target.value)} placeholder="Color, coating, finish or manufacturer code, if relevant" />
    </label>
    <label htmlFor={`${id}-notes`} className="block font-medium text-slate-700">What should CBI learn from this photo?
      <textarea id={`${id}-notes`} className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5" rows={5} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Identify the part, explain what is visible, or correct the AI description…" />
    </label>
    <div className="flex items-center justify-between text-xs text-slate-500"><span>Only confirmed details—not guesses.</span><span>{notes.length}/1,000</span></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50" disabled={!dirty || (!finish.trim() && !notes.trim())} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save teaching notes'}</button>
      {dirty && <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-600" onClick={() => { setFinish(baseline.finish); setNotes(baseline.notes); save.reset() }}>Undo changes</button>}
    </div>
    </fieldset>
    {save.isError && <p role="alert" className="text-red-700">{save.error.message}</p>}
    {save.isSuccess && !dirty && <p role="status" className="text-emerald-700">Notes saved. {save.data.ai_memory?.discarded ? 'Not added to AI memory: check learning settings.' : 'Learning processed under your approval settings.'}</p>}
  </section>
}
