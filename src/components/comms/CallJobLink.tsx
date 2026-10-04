import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getConversation, linkConversation } from '@/lib/comms'
import { listWorkOrders } from '@/lib/workOrders'

/** Explicit selection only: never create a duplicate job from an appointment call. */
export function CallJobLink({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const client = useQueryClient()
  const conversation = useQuery({ queryKey: ['comms', 'conversation', conversationId], queryFn: () => getConversation(conversationId) })
  const jobs = useQuery({
    queryKey: ['comms', 'call-job-search', conversationId, term],
    queryFn: () => listWorkOrders({ q: term.trim() || undefined, service_customer_id: term.trim() ? undefined : conversation.data?.conversation.customer_id ?? undefined, per_page: 8 }),
    enabled: open && !!conversation.data,
  })
  const link = useMutation({
    mutationFn: (id: string) => linkConversation(conversationId, id),
    onSuccess: () => { setOpen(false); void client.invalidateQueries({ queryKey: ['comms'] }) },
  })
  const jobId = conversation.data?.conversation.work_order_id
  if (jobId) return <Link className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800" to={`/jobs/${jobId}?tab=messages`}>View linked job →</Link>
  return <div className="w-full">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">{open ? 'Cancel job link' : 'Link to an existing job'}</button>
    {open && <div className="mt-2 rounded-lg border p-3">
      <label className="block text-xs">Search jobs by number or title<input type="search" value={term} onChange={e => setTerm(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <p className="my-2 text-xs text-slate-500">Linking moves this conversation onto the selected job and out of the inbox.</p>
      {jobs.isError || conversation.isError ? <p role="alert">Could not load jobs. Try again.</p> : jobs.isFetching ? <p>Loading…</p> : jobs.data?.data.length === 0 ? <p>No matching jobs.</p> : jobs.data?.data.map(job => <button key={job.id} type="button" disabled={link.isPending} onClick={() => link.mutate(job.id)} className="block w-full rounded p-2 text-left text-sm hover:bg-slate-50">{job.display_number} · {job.title}</button>)}
      {link.isError && <p role="alert" className="text-sm text-red-700">Could not link this job. Nothing was changed.</p>}
    </div>}
  </div>
}
