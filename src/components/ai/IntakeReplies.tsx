import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import type { AiIntakeDraft } from '@/lib/comms'

type Reply = { id: string; body: string | null; channel: string; created_at: string; media_urls: string[] }
export function IntakeReplies({ draft }: { draft: AiIntakeDraft }) {
  const [open, setOpen] = useState(false)
  const thread = draft.comms_message?.conversation_id
  const replies = useQuery({ queryKey: ['intake-replies', draft.id], enabled: open && Boolean(thread), refetchInterval: open ? 30_000 : false, queryFn: () => apiRequest<{ data: Reply[]; has_more: boolean }>(`/v1/ai/intake/drafts/${encodeURIComponent(draft.id)}/replies`) })
  return <details className="my-4 rounded-xl border border-slate-200 bg-white p-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-bold text-navy-900">Review newer customer messages</summary>
    <p className="mt-2 text-sm text-slate-600">Inbound messages received after the original intake message, newest first. They may concern another request. Opening this panel does not mark messages read, approve work, or change any job.</p>
    {!thread && <p className="mt-3 text-sm">No linked source conversation. Match the customer and conversation before using a reply.</p>}
    {thread && replies.isPending && <p role="status" className="mt-3 text-sm">Loading newer messages…</p>}
    {replies.isError && <p role="alert" className="mt-3 text-sm text-red-700">Could not load replies. <button type="button" className="underline" onClick={() => replies.refetch()}>Retry</button></p>}
    {replies.data?.data.length === 0 && <p className="mt-3 text-sm text-slate-500">No newer inbound messages found. This is not evidence that a follow-up was sent.</p>}
    <ol className="mt-3 max-h-96 space-y-3 overflow-auto">{replies.data?.data.map(reply => <li key={reply.id} className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{new Date(reply.created_at).toLocaleString()} · {reply.channel}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{reply.body || 'Attachment or message without text. Review it in the original conversation.'}</p>
      {reply.media_urls?.length > 0 && <p className="mt-2 text-xs text-amber-800">{reply.media_urls.length} attachment(s) · review conversation photos or open the thread.</p>}
    </li>)}</ol>
    {replies.data?.has_more && <p className="mt-3 text-xs">Showing the latest 20. Open the conversation for earlier messages.</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-amber-800">
      {thread && <Link target="_blank" rel="noopener noreferrer" to={`/communications?conversation=${encodeURIComponent(thread)}`}>Open original conversation →</Link>}
      {draft.created_work_order_id && <Link to={`/jobs/${encodeURIComponent(draft.created_work_order_id)}`}>Review linked job →</Link>}
    </div>
    <p className="mt-3 text-xs text-slate-500">Verify the request and customer first. Edit the reviewed intake or linked job using its normal controls. Automatic reply-to-job updates are not enabled.</p>
  </details>
}
