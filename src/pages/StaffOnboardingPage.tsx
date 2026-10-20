import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { API_URL, apiRequest } from '@/lib/api'

type Preview = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; tenant_name: string | null; requires_password: boolean; secure_vault_ready: boolean }
type Completion = { ok: boolean; app_download_url?: string | null; app_download_delivery?: { email_sent: boolean; sms_sent: boolean } | null }
const inputClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900'

export function StaffOnboardingPage() {
  const { token = '' } = useParams<{ token: string }>()
  const preview = useQuery({ queryKey: ['staff-onboarding', token], queryFn: () => apiRequest<{ data: Preview }>(`/v1/staff-onboarding/${encodeURIComponent(token)}`, { requireAuth: false }), retry: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Completion | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const body = new FormData(event.currentTarget)
    if (preview.data?.data.requires_password && body.get('password') !== body.get('password_confirmation')) {
      setError('Passwords do not match.'); return
    }
    for (const [key, value] of [...body.entries()]) {
      if ((typeof value === 'string' && !value.trim()) || (value instanceof File && value.size === 0)) body.delete(key)
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
      <form className="mt-6 space-y-6" onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Contact information</legend>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">First name<input className={inputClass} name="first_name" defaultValue={data.first_name || ''} autoComplete="given-name" required maxLength={100} /></label><label className="text-sm">Last name<input className={inputClass} name="last_name" defaultValue={data.last_name || ''} autoComplete="family-name" maxLength={100} /></label></div>
          <p className="text-sm text-slate-600">Email: {data.email || 'Not provided'}</p><label className="block text-sm">Mobile number<input className={inputClass} name="phone" type="tel" defaultValue={data.phone || ''} autoComplete="tel" maxLength={40} /></label>
          <label className="block text-sm">Start date (optional)<input className={inputClass} name="start_date" type="date" /></label>
        </fieldset>
        {data.requires_password && <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Choose your password</legend><p className="text-sm text-slate-600">Use at least 8 characters.</p><label className="block text-sm">Password<input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label className="block text-sm">Confirm password<input className={inputClass} name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required /></label></fieldset>}
        {data.secure_vault_ready && <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Personal details (optional)</legend><p className="text-sm text-slate-600">These details are stored in your company’s secure files. You can leave them blank.</p>
          <label className="block text-sm">Date of birth<input className={inputClass} type="date" name="birthday" autoComplete="bday" /></label>
          <label className="block text-sm">Street address<input className={inputClass} name="address[street]" autoComplete="address-line1" maxLength={255} /></label><label className="block text-sm">Apartment or unit<input className={inputClass} name="address[apt_unit]" autoComplete="address-line2" maxLength={50} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">City<input className={inputClass} name="address[city]" autoComplete="address-level2" maxLength={100} /></label><label className="text-sm">State<input className={inputClass} name="address[state]" autoComplete="address-level1" maxLength={100} /></label></div><label className="block text-sm">ZIP or postal code<input className={inputClass} name="address[postal_code]" autoComplete="postal-code" maxLength={20} /></label>
          <label className="block text-sm">Social Security number<input className={inputClass} name="ssn" type="password" inputMode="numeric" autoComplete="off" maxLength={11} /></label>
          <label className="block text-sm">Emergency contact name<input className={inputClass} name="emergency_contact[name]" maxLength={120} /></label><label className="block text-sm">Emergency contact phone<input className={inputClass} name="emergency_contact[phone]" type="tel" maxLength={40} /></label>
          <label className="block text-sm">Driver’s license — front<input className={inputClass} name="dl_front" type="file" accept="image/*" /></label><label className="block text-sm">Driver’s license — back<input className={inputClass} name="dl_back" type="file" accept="image/*" /></label><p className="text-xs text-slate-500">Images up to 10 MB each.</p>
        </fieldset>}
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-amber-500 px-4 py-3 font-semibold text-slate-900 hover:bg-amber-600 disabled:opacity-60">{busy ? 'Saving…' : 'Finish setup'}</button>
      </form>
    </>}
  </div></main>
}
