import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { documentLabel } from '@/components/staff/SubCompanies'

interface InviteDetails {
  hiring_company: string | null
  company_name: string
  contact_name: string | null
  email: string
  phone: string | null
  required_documents: string[]
  expires_at: string | null
  email_has_account: boolean
}

/**
 * /sub-onboarding -- a sub company's own onboarding, from the code the
 * company that wants to send it work emailed. Public: the code is the key.
 *
 * Screen 1 (here) creates the sub's free company and its owner; from then on
 * they sign in like everyone else (email, password, the emailed security
 * code), and the documents screen picks up where they left off. Someone
 * already on CrewBarn signs in and enters the code for the company they have.
 */
export function SubOnboardingPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [invite, setInvite] = useState<InviteDetails | null>(null)

  const check = useMutation({
    mutationFn: () => apiRequest<{ data: InviteDetails }>('/v1/sub-onboarding/check', { method: 'POST', body: { code } }),
    onSuccess: (resp) => setInvite(resp.data),
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 text-center text-lg font-bold text-navy-800">
          Crew<span className="text-amber-500">Barn</span>
        </div>

        {!invite ? (
          <form
            data-tour="sub-onboard-code"
            onSubmit={(e) => {
              e.preventDefault()
              check.mutate()
            }}
          >
            <h1 className="text-center text-xl font-semibold text-navy-900">Set up your company</h1>
            <p className="mt-1 text-center text-sm text-slate-600">Enter the invite code from the email you were sent. It works once, within 24 hours.</p>
            <label className="mt-6 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-700">Invite code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                placeholder="ABCD-EFGH"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-center font-mono text-lg tracking-widest focus:border-amber-500 focus:outline-none"
              />
            </label>
            {check.isError && <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(check.error as Error).message}</p>}
            <button type="submit" disabled={check.isPending || code.trim().length < 8} className="mt-4 w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {check.isPending ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : invite.email_has_account ? (
          <ExistingAccount invite={invite} code={code} />
        ) : (
          <AccountStep invite={invite} code={code} />
        )}
      </div>
    </div>
  )
}

/** The email already has CrewBarn: accept for that company once signed in. */
function ExistingAccount({ invite, code }: { invite: InviteDetails; code: string }) {
  return (
    <div className="text-sm text-slate-700" data-tour="sub-onboard-existing">
      <h1 className="text-center text-xl font-semibold text-navy-900">You already have CrewBarn</h1>
      <p className="mt-3">
        {invite.email} already has a CrewBarn account. Sign in, then open <strong>Companies I work for</strong> and enter this code
        to take work from {invite.hiring_company ?? 'them'} in your company:
      </p>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 py-2 text-center font-mono text-lg font-bold tracking-widest text-navy-900">{code}</p>
      <Link to={`/login?next=${encodeURIComponent(`/companies-i-work-for?code=${code}`)}`} className="mt-5 block w-full rounded-md bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-amber-600">Sign in</Link>
    </div>
  )
}

/** Screen 1: the company and its owner. The account exists once this is saved. */
function AccountStep({ invite, code }: { invite: InviteDetails; code: string }) {
  const [first, ...rest] = (invite.contact_name ?? '').trim().split(/\s+/)
  const [businessName, setBusinessName] = useState(invite.company_name)
  const [firstName, setFirstName] = useState(first ?? '')
  const [lastName, setLastName] = useState(rest.join(' '))
  const [phone, setPhone] = useState(invite.phone ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [terms, setTerms] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [weak, setWeak] = useState(false)

  const create = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { email: string; required_documents: string[] } }>('/v1/sub-onboarding', {
        method: 'POST',
        body: {
          code,
          business_name: businessName,
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          password,
          accepted_terms: terms,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
  })

  if (create.isSuccess) {
    const docs = create.data.data.required_documents
    return (
      <div className="text-sm text-slate-700" data-tour="sub-onboard-done">
        <h1 className="text-center text-xl font-semibold text-navy-900">Your company is set up</h1>
        <p className="mt-3">
          Sign in with <strong>{create.data.data.email}</strong> and your new password. You will be asked for the security code we email
          you, like every sign-in.
        </p>
        {docs.length > 0 && (
          <p className="mt-3">
            Next, upload what {invite.hiring_company ?? 'they'} asked for: <strong>{docs.map(documentLabel).join(', ')}</strong>. If you
            need to stop, you can sign in and finish later.
          </p>
        )}
        <Link to={`/login?next=${encodeURIComponent('/sub-documents')}`} className="mt-5 block w-full rounded-md bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-amber-600">Sign in to continue</Link>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      data-tour="sub-onboard-form"
      onSubmit={(e) => {
        e.preventDefault()
        // Check the rule the hint states, so nobody finds out from a server error.
        if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          setWeak(true)
          setMismatch(false)
          return
        }
        setWeak(false)
        if (password !== confirm) {
          setMismatch(true)
          return
        }
        setMismatch(false)
        create.mutate()
      }}
    >
      <h1 className="text-center text-xl font-semibold text-navy-900">{invite.hiring_company ?? 'A company'} wants to send you work</h1>
      <p className="text-center text-sm text-slate-600">Set up your free CrewBarn company. You sign in with {invite.email}.</p>
      <Input label="Business name" value={businessName} onChange={setBusinessName} required autoComplete="organization" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="First name" value={firstName} onChange={setFirstName} required autoComplete="given-name" />
        <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
      </div>
      <Input label="Phone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
      <Input label="Password" type="password" value={password} onChange={setPassword} required autoComplete="new-password" hint="At least 10 characters, with upper and lower case and a number." />
      <Input label="Confirm password" type="password" value={confirm} onChange={setConfirm} required autoComplete="new-password" />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 rounded text-amber-600 focus:ring-amber-500" required />
        <span>I agree to the CrewBarn terms of service.</span>
      </label>
      {weak && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">Use at least 10 characters, with upper and lower case and a number.</p>}
      {mismatch && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">The passwords do not match.</p>}
      {create.isError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(create.error as Error).message}</p>}
      <button type="submit" disabled={create.isPending} className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
        {create.isPending ? 'Setting up…' : 'Create my company'}
      </button>
    </form>
  )
}

function Input({ label, value, onChange, type = 'text', required = false, autoComplete, hint }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  autoComplete?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-700">{label}</span>
      <input type={type} value={value} required={required} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
