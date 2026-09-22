import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { IconLock, IconShieldCheck } from '@tabler/icons-react'
import { apiRequest } from '@/lib/api'

type RequestInfo = { data: { client_name: string; tenant_name: string; user_name: string; role: string; two_factor_enrolled: boolean; two_factor_method: string; scope: string } }

export function OauthAuthorizePage() {
  const [search] = useSearchParams()
  const [code, setCode] = useState('')
  const params = useMemo(() => Object.fromEntries(search.entries()), [search])
  const query = search.toString()
  const info = useQuery({ queryKey: ['oauth-request', query], queryFn: () => apiRequest<RequestInfo>(`/v1/oauth/connector/request?${query}`) })
  const challenge = useMutation({ mutationFn: () => apiRequest('/v1/oauth/connector/challenge', { method: 'POST' }) })
  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'deny') => apiRequest<{ redirect_url: string }>('/v1/oauth/connector/approve', { method: 'POST', body: { ...params, decision, two_factor_code: code } }),
    onSuccess: (result) => { window.location.assign(result.redirect_url) },
  })
  const request = info.data?.data

  return <main className="min-h-screen bg-slate-100 px-4 py-10">
    <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><IconShieldCheck className="h-7 w-7 text-orange-600" /><div><h1 className="text-xl font-semibold text-slate-950">Authorize read-only access</h1><p className="text-sm text-slate-600">CrewBarn AI connector</p></div></div>
      {info.isLoading && <p className="mt-6 text-sm text-slate-600">Checking authorization request...</p>}
      {info.isError && <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">This authorization request is invalid or expired.</p>}
      {request && <>
        <div className="mt-6 border-y border-slate-200 py-4 text-sm text-slate-700">
          <p><strong>{request.client_name}</strong> is requesting access to <strong>{request.tenant_name}</strong>.</p>
          <p className="mt-2">Connected as {request.user_name} ({request.role}). Your current CrewBarn permissions and data scope will apply.</p>
        </div>
        <div className="mt-4 flex gap-3 rounded-md bg-slate-50 p-4"><IconLock className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" /><p className="text-sm text-slate-700">Read-only access only. The connector cannot create, update, or delete CrewBarn data and cannot switch tenants.</p></div>
        {!request.two_factor_enrolled ? <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Two-factor authentication is required before connecting. <Link className="font-semibold underline" to="/me/security">Set up 2FA</Link>.</div> : <div className="mt-5">
          <label className="block text-sm font-medium text-slate-800">Current {request.two_factor_method === 'totp' ? 'authenticator' : request.two_factor_method} code</label>
          <div className="mt-2 flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" />{request.two_factor_method !== 'totp' && <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" onClick={() => challenge.mutate()}>{challenge.isSuccess ? 'Code sent' : 'Send code'}</button>}</div>
        </div>}
        {decide.isError && <p className="mt-3 text-sm text-red-700">Authorization failed. Check the 2FA code and try again.</p>}
        <div className="mt-6 flex justify-end gap-3"><button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" onClick={() => decide.mutate('deny')}>Deny</button><button className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!request.two_factor_enrolled || !code.trim() || decide.isPending} onClick={() => decide.mutate('approve')}>Authorize</button></div>
      </>}
    </section>
  </main>
}
