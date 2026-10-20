import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { API_URL, apiRequest } from '@/lib/api'

interface ClaimDetails {
  business_name: string
  email: string
  contact_name: string | null
  phone: string | null
  invited_by: string | null
  jobs: string[]
  claimed: boolean
  /** False once the link is more than 14 days old: the job still works, the account can't be set up. */
  can_claim?: boolean
}

/**
 * /claim/:token -- a trade a customer brought into CrewBarn claims the free
 * account CrewBarn set up for it, with the customer's job already in it.
 * Public: the emailed link is the key. Once claimed they sign in like anyone
 * else (email, password, the emailed security code).
 */
export function TradeClaimPage() {
  const { token = '' } = useParams()
  const q = useQuery({
    queryKey: ['trade-claim', token],
    queryFn: () => apiRequest<{ data: ClaimDetails }>(`/v1/trade-claim/${encodeURIComponent(token)}`, { requireAuth: false }),
    retry: false,
  })
  const d = q.data?.data
  // Claimed: they sign in now, and the no-account link has stopped working.
  const [claimed, setClaimed] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 text-center text-lg font-bold text-navy-800">
          Crew<span className="text-amber-500">Barn</span>
        </div>
        {q.isLoading ? (
          <p className="text-center text-sm text-slate-500" role="status">Opening your account…</p>
        ) : q.isError || !d ? (
          <div className="text-sm text-slate-700">
            <h1 className="text-center text-xl font-semibold text-navy-900">This link doesn't work any more</h1>
            <p className="mt-3 text-center">
              It was already used, or a newer one was sent. If you set up your account already, sign in. Otherwise ask your customer to send it
              again.
            </p>
            <Link to="/login" className="mt-5 block w-full rounded-md bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-amber-600">Sign in</Link>
          </div>
        ) : (
          <>
            {d.can_claim === false ? (
              <p className="text-center text-sm text-slate-700">
                This link is more than 14 days old, so it can't set up your account any more. Ask your customer to send it again. You can still
                work the job below.
              </p>
            ) : (
              <ClaimForm token={token} details={d} onClaimed={() => setClaimed(true)} />
            )}
            {!claimed && <JobWithoutAccount token={token} />}
          </>
        )}
      </div>
    </div>
  )
}

function ClaimForm({ token, details, onClaimed }: { token: string; details: ClaimDetails; onClaimed: () => void }) {
  const [first, ...rest] = (details.contact_name ?? '').trim().split(/\s+/)
  const [businessName, setBusinessName] = useState(details.business_name)
  const [firstName, setFirstName] = useState(first ?? '')
  const [lastName, setLastName] = useState(rest.join(' '))
  const [phone, setPhone] = useState(details.phone ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [terms, setTerms] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const who = details.invited_by ?? 'Your customer'

  const claim = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { email: string } }>(`/v1/trade-claim/${encodeURIComponent(token)}`, {
        method: 'POST',
        requireAuth: false,
        body: {
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

  useEffect(() => {
    if (claim.isSuccess) onClaimed()
  }, [claim.isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (claim.isSuccess) {
    return (
      <div className="text-sm text-slate-700" data-tour="trade-claim-done">
        <h1 className="text-center text-xl font-semibold text-navy-900">Your account is ready</h1>
        <p className="mt-3">
          Sign in with <strong>{claim.data.data.email}</strong> and your new password. You'll be asked for the security code we email you,
          like every sign-in. Your {details.jobs.length === 1 ? 'job is' : 'jobs are'} under Jobs.
        </p>
        <Link to={`/login?next=${encodeURIComponent('/jobs')}`} className="mt-5 block w-full rounded-md bg-amber-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-amber-600">Sign in</Link>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      data-tour="trade-claim-form"
      onSubmit={(e) => {
        e.preventDefault()
        // The rule the hint states, checked here so nobody learns it from a server error.
        if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          setProblem('Use at least 10 characters, with upper and lower case and a number.')
          return
        }
        if (password !== confirm) {
          setProblem('The passwords do not match.')
          return
        }
        setProblem(null)
        claim.mutate()
      }}
    >
      <h1 className="text-center text-xl font-semibold text-navy-900">{who} set you up on CrewBarn</h1>
      <p className="text-center text-sm text-slate-600">
        A free account for your business, with {details.jobs.length === 1 ? 'their job' : 'their jobs'} in it. You sign in with {details.email}.
      </p>
      {details.jobs.length > 0 && (
        <ul className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-navy-900">
          {details.jobs.slice(0, 5).map((job, i) => (
            <li key={i} className="truncate py-0.5">{job}</li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-5 text-slate-500">
        On the free account you work the jobs your customers send you, add photos and videos, and send your invoice. Start using CrewBarn
        any time to run all your jobs here.
      </p>
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
      {problem && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{problem}</p>}
      {claim.isError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(claim.error as Error).message}</p>}
      <button type="submit" disabled={claim.isPending} className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
        {claim.isPending ? 'Setting up…' : 'Claim my account'}
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

interface TradeJob {
  business_name: string
  customer?: string | null
  title?: string
  details?: string | null
  address?: string | null
  stage: 'new' | 'scheduled' | 'working' | 'done' | 'declined'
  visit_at?: string | null
  invoice_sent?: boolean
}

/**
 * Not ready to sign up: the job from the same link. Confirm it, book the
 * visit, start, finish (with the invoice), or decline it, and the customer
 * sees each step. Claiming the account above ends the link.
 */
function JobWithoutAccount({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<'schedule' | 'complete' | 'decline' | 'note' | null>(null)
  const [note, setNote] = useState('')
  const [visitAt, setVisitAt] = useState('')
  const [invoice, setInvoice] = useState<File | null>(null)
  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const q = useQuery({
    queryKey: ['trade-job', token],
    queryFn: () => apiRequest<{ data: TradeJob }>(`/v1/trade-jobs/${encodeURIComponent(token)}`, { requireAuth: false }),
    enabled: open,
    retry: false,
  })
  const [job, setJob] = useState<TradeJob | null>(null)
  const shown = job ?? q.data?.data ?? null
  const send = useMutation({
    mutationFn: (what: string) => {
      const body = new FormData()
      body.append('action', what)
      if (note.trim()) body.append('note', note.trim())
      if (what === 'schedule') body.append('visit_at', visitAt)
      if (what === 'complete' && invoice) {
        body.append('invoice', invoice)
        if (number.trim()) body.append('invoice_number', number.trim())
        if (amount.trim()) body.append('invoice_amount', amount.trim())
      }
      return postJob(token, body)
    },
    onSuccess: (res) => {
      setJob(res.data)
      setAction(null)
      setNote('')
    },
  })

  // Escape closes the overlay.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const trigger = (
    <div className="mt-5 border-t border-slate-200 pt-4 text-center">
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-amber-700 underline-offset-2 hover:underline">
        Not ready to sign up? Update the job without an account
      </button>
    </div>
  )
  if (!open) return trigger

  const words: Record<TradeJob['stage'], string> = {
    new: 'Waiting for you',
    scheduled: shown?.visit_at ? `Visit booked: ${new Date(shown.visit_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Visit booked',
    working: 'You started the work',
    done: 'Done. Your customer has been told.',
    declined: "You declined it. It's back with your customer.",
  }
  const closed = shown?.stage === 'done' || shown?.stage === 'declined'
  const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none'

  return (
    <>
      {trigger}
      {/* An overlay over the claim form: the job, without an account. */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-job-heading"
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
    <div className="w-full max-w-md rounded-t-2xl bg-white p-5 text-sm text-slate-700 shadow-xl sm:rounded-2xl" data-tour="trade-job">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Without an account</p>
          <p id="trade-job-heading" className="text-base font-semibold text-navy-900">Update the job</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-navy-900">×</button>
      </div>
      {q.isLoading && !shown ? (
        <p className="text-center text-slate-500" role="status">Opening the job…</p>
      ) : !shown ? (
        <p className="text-center text-slate-500">This job can't be updated from this link any more.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-navy-900">{shown.title ?? 'The job'}</h2>
            <p className="text-xs text-slate-500">{[shown.customer, shown.address].filter(Boolean).join(' · ')}</p>
            {shown.details && <p className="mt-1 whitespace-pre-wrap">{shown.details}</p>}
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 font-medium text-navy-900">{words[shown.stage]}</p>
          </div>
          {!closed && action === null && (
            <div className="grid grid-cols-2 gap-2">
              {shown.stage === 'new' && <JobButton onClick={() => send.mutate('confirm')} disabled={send.isPending}>Confirm the job</JobButton>}
              <JobButton onClick={() => setAction('schedule')}>{shown.stage === 'scheduled' ? 'Change the visit' : 'Book a visit'}</JobButton>
              {shown.stage !== 'working' && <JobButton onClick={() => send.mutate('start')} disabled={send.isPending}>Start the work</JobButton>}
              <JobButton onClick={() => setAction('complete')} primary>Mark it done</JobButton>
              <JobButton onClick={() => setAction('note')}>Send a note</JobButton>
              <JobButton onClick={() => setAction('decline')}>Can't take it</JobButton>
            </div>
          )}
          {action && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                send.mutate(action)
              }}
            >
              {action === 'schedule' && (
                <input type="datetime-local" required className={input} value={visitAt} onChange={(e) => setVisitAt(e.target.value)} aria-label="Visit date and time" />
              )}
              {action === 'complete' && (
                <>
                  <label className="block text-xs font-medium text-slate-700">
                    Your invoice (optional, PDF or photo)
                    <input type="file" accept="application/pdf,image/*" className="mt-1 block w-full text-sm" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} />
                  </label>
                  {invoice && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className={input} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Invoice #" aria-label="Invoice number" />
                      <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Amount" aria-label="Amount" />
                    </div>
                  )}
                </>
              )}
              <textarea
                className={`${input} min-h-[64px]`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={action === 'note'}
                placeholder={action === 'decline' ? 'Why (your customer sees this)' : action === 'complete' ? 'What you did (optional)' : 'A note for your customer'}
                aria-label="Note"
              />
              {send.isError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(send.error as Error).message}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={send.isPending} className="flex-1 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  {send.isPending ? 'Sending…' : action === 'schedule' ? 'Book it' : action === 'complete' ? 'Mark it done' : action === 'decline' ? "I can't take it" : 'Send'}
                </button>
                <button type="button" onClick={() => setAction(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Back</button>
              </div>
            </form>
          )}
          {!closed && <p className="text-xs text-slate-500">With the free account you also get the job's details, photos and your invoices in one place.</p>}
          {closed && <button type="button" onClick={() => setOpen(false)} className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Close</button>}
        </div>
      )}
    </div>
      </div>
    </>
  )
}

/**
 * The job update is multipart (it can carry the invoice), so it goes through
 * fetch: apiRequest JSON-encodes bodies, and a FormData arrives empty.
 */
async function postJob(token: string, body: FormData): Promise<{ data: TradeJob }> {
  const res = await fetch(`${API_URL}/v1/trade-jobs/${encodeURIComponent(token)}`, { method: 'POST', headers: { Accept: 'application/json' }, body })
  const json = (await res.json().catch(() => null)) as { data?: TradeJob; message?: string } | null
  if (!res.ok || !json?.data) throw new Error(json?.message ?? `That didn't go through (${res.status}). Try again.`)
  return { data: json.data }
}

function JobButton({ children, onClick, disabled = false, primary = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${primary ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}
