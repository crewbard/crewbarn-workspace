import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAiIntakeDraft } from '@/lib/comms'

/** Explicit import only. The normal composer remains the only send path. */
export function IntakeDraftHandoff({ intakeId, conversationId, recipient, onLoad }: { intakeId: string; conversationId: string; recipient: string; onLoad: (text: string) => boolean }) {
  const [loaded, setLoaded] = useState(false)
  const query = useQuery({ queryKey: ['intake-handoff', intakeId, conversationId], queryFn: () => getAiIntakeDraft(intakeId), staleTime: 0 })
  const saved = query.data?.extracted_json?._follow_up_draft as { text?: string; revision?: number } | undefined
  const matches = query.data?.comms_message?.conversation_id === conversationId
  if (loaded) return <p role="status" className="border-b border-amber-200 bg-amber-50 p-3 text-sm">Saved intake draft loaded—not sent. Review the recipient, message and any attachments below before using Send.</p>
  return <section className="border-b border-amber-200 bg-amber-50 p-3 text-sm">
    <h3 className="font-bold">Review saved intake follow-up</h3>
    {query.isPending && <p role="status">Loading saved draft…</p>}
    {query.isError && <p role="alert">Could not load the draft. <button type="button" onClick={() => query.refetch()} className="underline">Retry</button></p>}
    {query.data && !matches && <p role="alert">This intake belongs to a different conversation. Nothing was loaded into the composer.</p>}
    {matches && !saved?.text && <p>No saved follow-up exists. Return to intake and save your draft first.</p>}
    {matches && saved?.text && <>
      <p className="mt-1">Recipient: <strong>{recipient || 'Wait for recipient details'}</strong> · Saved revision {saved.revision}</p>
      <p className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3">{saved.text}</p>
      <button type="button" disabled={!recipient} className="mt-2 rounded-lg bg-amber-500 px-3 py-2 font-semibold disabled:opacity-40" onClick={() => { if (onLoad(saved.text!)) setLoaded(true) }}>Load into composer · do not send</button>
      <p className="mt-2 text-xs">This is the saved version, not unsaved edits from another tab. Sending uses normal conversation permissions. Loading does not mark the intake draft as sent.</p>
    </>}
  </section>
}
