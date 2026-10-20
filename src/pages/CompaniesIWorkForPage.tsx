import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

interface WorkFor {
  id: string
  /** requested: asked by email; accepting its first job connects you. */
  status: 'requested' | 'accepted'
  hiring_company: string | null
  accepted_at: string | null
}

/**
 * /companies-i-work-for -- the companies that send this company work as a
 * sub, and where a company already on CrewBarn enters an invite code to take
 * work from one more. A company that added this one by email shows as wanting
 * to send work: accepting its first job connects them. Owner or admin only
 * (the server checks).
 */
export function CompaniesIWorkForPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')

  const list = useQuery({
    queryKey: ['sub-connections', 'as-sub'],
    queryFn: () => apiRequest<{ data: WorkFor[] }>('/v1/sub-connections?as=sub'),
    retry: false,
  })
  const accept = useMutation({
    mutationFn: () => apiRequest<{ data: { hiring_company: string | null } }>('/v1/sub-connections/accept', { method: 'POST', body: { code } }),
    onSuccess: () => {
      setCode('')
      void qc.invalidateQueries({ queryKey: ['sub-connections', 'as-sub'] })
    },
  })

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
      <div data-tour="work-for-header">
      <h1 className="text-2xl font-bold text-navy-900">Companies I work for</h1>
      <p className="mt-1 text-sm text-slate-600">
        Companies that send your company work. Their jobs show up in{' '}
        <Link to="/inbound-sub-jobs" className="font-medium text-amber-700 hover:underline">Inbound sub jobs</Link>.
      </p>
      <p className="mt-2 text-sm" data-tour="work-for-docs">
        <Link to="/sub-documents" className="font-medium text-amber-700 hover:underline">Your documents</Link>
        <span className="text-slate-500"> — the W-9, insurance and licenses these companies asked for.</span>
      </p>
      </div>

      <form
        data-tour="work-for-code"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault()
          accept.mutate()
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-navy-900">Have an invite code?</span>
          <span className="mb-2 block text-xs text-slate-500">Enter the code a company emailed you to take work from them in this company.</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono tracking-widest focus:border-amber-500 focus:outline-none sm:w-56"
            />
            <button type="submit" disabled={accept.isPending || code.trim().length < 8} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {accept.isPending ? 'Connecting…' : 'Accept invite'}
            </button>
          </div>
        </label>
        {accept.isSuccess && (
          <p role="status" className="mt-3 text-sm text-emerald-700">Connected to {accept.data.data.hiring_company ?? 'the company'}. Jobs they send you will show up in Inbound sub jobs.</p>
        )}
        {accept.isError && <p role="alert" className="mt-3 text-sm text-red-700">{(accept.error as Error).message}</p>}
      </form>

      <section className="mt-6" aria-labelledby="work-for-list" data-tour="work-for-list">
        <h2 id="work-for-list" className="sr-only">Connected companies</h2>
        {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {list.isError && <p className="text-sm text-slate-500">This is not turned on for your account yet.</p>}
        {list.isSuccess && list.data.data.length === 0 && <p className="text-sm text-slate-500">No companies yet.</p>}
        {list.isSuccess && list.data.data.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {list.data.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-semibold text-navy-900">{c.hiring_company ?? 'A company'}</span>
                {c.status === 'requested' ? (
                  <span className="text-xs text-amber-800">
                    Wants to send you work.{' '}
                    <Link to="/inbound-sub-jobs" className="font-medium text-amber-700 hover:underline">Accept their first job</Link> to connect.
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Connected {c.accepted_at ? new Date(c.accepted_at).toLocaleDateString() : ''}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
