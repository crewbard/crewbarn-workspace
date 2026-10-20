import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { API_URL, apiRequest } from '@/lib/api'

import { StaffSetupForm } from '@/components/staff/StaffSetupForm'
import { cleanSetupForm, type StaffSetupPreview as Preview, type StaffSetupCompletion as Completion } from '@/lib/staffSetup'

export function StaffOnboardingPage() {
  const { token = '' } = useParams<{ token: string }>()
  const preview = useQuery({ queryKey: ['staff-onboarding', token], queryFn: () => apiRequest<{ data: Preview }>(`/v1/staff-onboarding/${encodeURIComponent(token)}`, { requireAuth: false }), retry: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Completion | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const body = cleanSetupForm(event.currentTarget)
    if (preview.data?.data.requires_password && body.get('password') !== body.get('password_confirmation')) {
      setError('Passwords do not match.'); return
    }
    setBusy(true); setError(null)
    try {
      const response = await fetch(`${API_URL}/v1/staff-onboarding/${encodeURIComponent(token)}`, { method: 'POST', headers: { Accept: 'application/json' }, body })
      const result = await response.json()
      if (!response.ok) {
        setError(response.status === 404 ? 'This link is no longer available. Ask your company for a fresh link.' : response.status === 422 ? 'Please check your details and try again. If you still cannot continue, contact your company.' : 'We could not save your details. Please try again.')
        return
      }
      setDone(result.data as Completion)
    } catch { setError('We could not connect. Please try again.') }
    finally { setBusy(false) }
  }
  const data = preview.data?.data
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    {done ? <div role="status"><h1 className="text-2xl font-semibold text-slate-900">You’re all set</h1><p className="mt-3 text-slate-600">Your details have been saved.</p>
      {done.app_download_url && <div className="mt-6 rounded-lg bg-amber-50 p-4"><h2 className="font-semibold text-slate-900">Get the crew phone app</h2><p className="mt-2 text-sm text-slate-600">Install the app on your phone, then sign in with your email and password.</p><a className="mt-4 inline-block rounded-md bg-amber-500 px-4 py-2 font-medium text-slate-900" href={done.app_download_url} target="_blank" rel="noreferrer">Download the phone app</a><p className="mt-3 text-sm text-slate-600">{done.app_download_delivery?.email_sent && done.app_download_delivery?.sms_sent ? 'We also sent the download link by email and text.' : done.app_download_delivery?.email_sent ? 'We also emailed you the download link.' : done.app_download_delivery?.sms_sent ? 'We also texted you the download link.' : 'Keep this page open to use the download link.'}</p></div>}
      <Link className="mt-6 inline-block text-sm text-amber-700 underline" to="/login">Go to sign in</Link>
    </div> : preview.isLoading ? <p role="status">Loading your setup…</p> : preview.isError || !data ? <div><h1 className="text-xl font-semibold">This link is no longer available</h1><p className="mt-3 text-slate-600">It may have expired or already been used. Ask your company to send a fresh setup link.</p></div> : <>
      <h1 className="text-2xl font-semibold text-slate-900">Join {data.tenant_name || 'your team'}</h1><p className="mt-2 text-sm text-slate-600">Check your contact information and finish your setup.</p>
      <StaffSetupForm data={data} busy={busy} error={error} onSubmit={submit} />
    </>}
  </div></main>
}
