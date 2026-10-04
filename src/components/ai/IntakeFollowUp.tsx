import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AiIntakeDraft } from '@/lib/comms'
import { apiRequest } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const questions = [
  ['service', 'Work needed', 'What work do you need help with?'],
  ['address', 'Service address', 'What is the full service address, including any unit number?'],
  ['timing', 'Preferred time', 'What days and times work for you? We will confirm availability before booking.'],
  ['photo', 'Clearer photo', 'Could you send a clear overall photo and a close-up of any model markings?'],
  ['measurement', 'Part dimensions', 'If dimensions are needed, please include a ruler beside the part in the same plane, photographed straight-on. Please do not disassemble equipment to get a photo.'],
] as const

export function IntakeFollowUp({ draft }: { draft: AiIntakeDraft }) {
  const stored = draft.extracted_json?._follow_up_draft as { text?: string; revision?: number } | undefined
  const client = useQueryClient()
  const [revision, setRevision] = useState(stored?.revision ?? 0)
  const [savedText, setSavedText] = useState(stored?.text ?? '')
  const [selected, setSelected] = useState<string[]>([])
  const [text, setText] = useState(stored?.text ?? '')
  const save = useMutation({
    mutationFn: (body: string) => apiRequest<{ data: { text: string; revision: number } }>(`/v1/ai/intake/drafts/${encodeURIComponent(draft.id)}/follow-up-draft`, { method: 'POST', body: { text: body, revision } }),
    onSuccess: response => {
      setRevision(response.data.revision); setSavedText(response.data.text)
      client.invalidateQueries({ queryKey: ['ai-intake-drafts'] })
      client.invalidateQueries({ queryKey: ['photo-training-history', draft.id] })
    },
  })
  const [copyState, setCopyState] = useState('')
  const conversation = draft.comms_message?.conversation_id
  const build = () => {
    if (text.trim() && !window.confirm('Replace your edited draft with the selected questions?')) return
    setText(['Hello, we need a few details to finish reviewing your request:', ...questions.filter(([key]) => selected.includes(key)).map(([, , question]) => question), 'Thank you.'].join('\n\n'))
    setCopyState('')
  }
  return <details className="my-4 rounded-xl border border-amber-200 bg-white p-4">
    <summary className="cursor-pointer font-bold text-navy-900">Ask for missing details · human-reviewed draft</summary>
    <p className="mt-2 text-sm text-slate-600">Check the conversation first, then select only what is still missing. These are templates, not AI-generated conclusions. Nothing is sent, booked or learned here.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{questions.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={e => setSelected(current => e.target.checked ? [...current, key] : current.filter(item => item !== key))} />{label}</label>)}</div>
    <button type="button" disabled={!selected.length} onClick={build} className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold disabled:opacity-40">Prepare wording</button>
    <label className="mt-4 block text-sm font-semibold">Review and edit your message<textarea value={text} onChange={e => { setText(e.target.value); setCopyState('') }} rows={7} maxLength={4000} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="Choose questions above or write your own follow-up." /></label>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {conversation && revision > 0 && text.trim() === savedText && <Link target="_blank" rel="noopener noreferrer" to={`/communications?conversation=${encodeURIComponent(conversation)}&intake_follow_up=${encodeURIComponent(draft.id)}`} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold">Review saved draft in conversation →</Link>}
      <button type="button" disabled={save.isPending || !text.trim() || text.trim() === savedText} onClick={() => save.mutate(text)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold disabled:opacity-40">{save.isPending ? 'Saving…' : 'Save draft · do not send'}</button>
      <button type="button" disabled={!text.trim()} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold disabled:opacity-40" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopyState('Copied. Paste into the conversation and review the recipient before sending.') } catch { setCopyState('Clipboard unavailable. Select and copy the text above manually.') } }}>Copy reviewed draft</button>
      {conversation ? <Link target="_blank" rel="noopener noreferrer" to={`/communications?conversation=${encodeURIComponent(conversation)}`} className="text-sm font-semibold text-amber-800">Open original conversation →</Link> : <span className="text-sm text-slate-500">No linked conversation. Verify the customer and contact channel manually.</span>}
    </div>
    {copyState && <p role="status" className="mt-2 text-sm text-slate-600">{copyState}</p>}
    <p role="status" className="mt-3 text-xs text-slate-600">{text.trim() === savedText && revision > 0 ? `Saved draft · revision ${revision} · not sent` : 'Unsaved changes stay only in this view until you save.'}</p>
    {save.isError && <p role="alert" className="mt-2 text-sm text-red-700">{save.error instanceof Error ? save.error.message : 'Could not save.'} Your text is still here. If another reviewer changed it, copy your text before reopening the intake.</p>}
    <p className="mt-3 text-xs text-slate-500">Saving and copying are not sending. Use the conversation’s normal permissions and controls to send; then review any reply before updating the job.</p>
  </details>
}
