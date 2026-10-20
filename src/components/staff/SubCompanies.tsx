import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { requestCompanySecureFileAccess, verifyCompanySecureFileAccess } from '@/lib/companySecureFiles'
import {
  fetchSubDocumentBlob,
  getSubConnectionDocuments,
  SubDocumentLockedError,
  SUB_DOCUMENT_STATE_CLASS,
  SUB_DOCUMENT_STATE_LABEL,
  type SubDocumentRow,
} from '@/lib/subDocuments'

/** A sub company this company invited, or works with. */
export interface SubConnection {
  id: string
  /** requested: a company already on CrewBarn, asked by email; its first job, accepted, connects you. */
  status: 'invited' | 'requested' | 'accepted' | 'ended'
  company_name: string
  contact_name: string | null
  email: string
  phone: string | null
  required_documents: string[]
  subcontractor_id: string | null
  code_expires_at: string | null
  accepted_at: string | null
  /** Accepted subs: every required document is in and current. */
  documents_complete?: boolean | null
  /** Accepted subs: something required runs out within 30 days. */
  documents_expiring?: boolean | null
}

const DOCUMENTS: Array<{ key: string; label: string }> = [
  { key: 'w9', label: 'W-9' },
  { key: 'insurance', label: 'Insurance certificate' },
  { key: 'license', label: 'License' },
  { key: 'other', label: 'Other document' },
  // Made out to you by their insurance company, one per company that asks.
  { key: 'insurance_holder', label: 'Insurance naming us as certificate holder' },
]

export const documentLabel = (key: string) => DOCUMENTS.find((d) => d.key === key)?.label ?? key

/** "+ Add someone" asks first: someone who works here, or a company you send work to. */
export function AddSomeoneChooser({ onEmployee, onSub, onClose }: { onEmployee: () => void; onSub: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="add-someone-title">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" data-tour="staff-add-chooser">
        <h2 id="add-someone-title" className="text-lg font-semibold text-navy-900">Who are you adding?</h2>
        <div className="mt-4 grid gap-3">
          <button type="button" data-tour="staff-add-employee" onClick={onEmployee} className="rounded-lg border border-slate-200 p-4 text-left hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
            <span className="block text-sm font-semibold text-navy-900">Employee</span>
            <span className="mt-0.5 block text-xs text-slate-600">Someone who works for you. They sign in to your CrewBarn with the role you give them.</span>
          </button>
          <button type="button" data-tour="staff-add-sub" onClick={onSub} className="rounded-lg border border-slate-200 p-4 text-left hover:border-amber-400 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
            <span className="block text-sm font-semibold text-navy-900">Sub company</span>
            <span className="mt-0.5 block text-xs text-slate-600">Another company you send work to. They get their own free CrewBarn, see only the jobs you send them, and add their own techs.</span>
          </button>
        </div>
        <div className="mt-4 text-right">
          <button type="button" data-tour="staff-add-cancel" onClick={onClose} className="text-sm text-slate-600 hover:text-navy-900">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export type InviteResult = SubConnection & { code: string | null; email_sent: boolean; on_crewbarn: boolean }

/** A sub record from before the sub network, not invited yet. */
export interface NotInvitedSub {
  subcontractor_id: string
  business_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
}

/**
 * Invite a sub company. They are emailed a code good for 24 hours; it is
 * shown here once, too, to read out or text. A company already on CrewBarn
 * (its owner's or an admin's email) gets no code: send it a job, and
 * accepting that first job connects you and shares its documents.
 *
 * `initial` fills it in from a sub record you already have (its invite then
 * uses that record); `onInvited` hears the result.
 */
export function SubInviteModal({
  onClose,
  initial,
  onInvited,
}: {
  onClose: () => void
  initial?: Partial<NotInvitedSub>
  onInvited?: (result: InviteResult) => void
}) {
  const qc = useQueryClient()
  const [companyName, setCompanyName] = useState(initial?.business_name ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [documents, setDocuments] = useState<string[]>(['w9', 'insurance'])
  const [result, setResult] = useState<InviteResult | null>(null)
  // The email last looked up, and the CrewBarn company it belongs to, if any.
  const [found, setFound] = useState<{ email: string; company: string | null } | null>(null)

  const lookup = useMutation({
    mutationFn: (address: string) =>
      apiRequest<{ data: { on_crewbarn: boolean; company_name: string | null } }>('/v1/sub-invites/lookup', { method: 'POST', body: { email: address } }),
    onSuccess: (resp, address) => setFound({ email: address, company: resp.data.on_crewbarn ? resp.data.company_name : null }),
  })
  const onCrewbarn = found !== null && found.email === email.trim() && found.company !== null ? found.company : null
  // Filled in from a sub record: look its email up straight away.
  useEffect(() => {
    const address = initial?.email?.trim()
    if (address && address.includes('@')) lookup.mutate(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const invite = useMutation({
    mutationFn: () =>
      apiRequest<{ data: InviteResult }>('/v1/sub-invites', {
        method: 'POST',
        body: {
          company_name: companyName || null,
          contact_name: contactName || null,
          email,
          phone: phone || null,
          required_documents: documents,
          subcontractor_id: initial?.subcontractor_id ?? null,
        },
      }),
    onSuccess: (resp) => {
      setResult(resp.data)
      void qc.invalidateQueries({ queryKey: ['sub-connections'] })
      void qc.invalidateQueries({ queryKey: ['subcontractors'] })
      onInvited?.(resp.data)
    },
  })

  const toggle = (key: string) =>
    setDocuments((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="sub-invite-title">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" data-tour="sub-invite-modal">
        <h2 id="sub-invite-title" className="text-lg font-semibold text-navy-900">Invite a sub company</h2>
        {result?.on_crewbarn ? (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-navy-900">{result.company_name}</span> is already on CrewBarn, so there's no code. Send them a job from the
              job page with <span className="font-semibold">Sub this out</span>. It can go right away.
            </p>
            <p>
              When they accept that first job, you're connected
              {result.required_documents.length ? <> and they share {result.required_documents.map(documentLabel).join(', ')} with you</> : null}.
              {result.email_sent ? ` We emailed ${result.email} to expect it.` : ''}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">Done</button>
            </div>
          </div>
        ) : result?.code ? (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>
              {result.email_sent ? `We emailed ${result.email} an invite code.` : `The email to ${result.email} did not go out. Give them this code yourself.`}{' '}
              It works once and expires in 24 hours.
            </p>
            <p className="rounded-lg border border-amber-200 bg-amber-50 py-3 text-center font-mono text-2xl font-bold tracking-widest text-navy-900">{result.code}</p>
            <p className="text-xs text-slate-500">
              They enter it at app.crewbarn.com/sub-onboarding, on a computer or a phone, then upload {result.required_documents.length ? result.required_documents.map(documentLabel).join(', ') : 'any documents you ask for'}.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => void navigator.clipboard?.writeText(result.code ?? '')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Copy code</button>
              <button type="button" onClick={onClose} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">Done</button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              invite.mutate()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                onBlur={() => {
                  const address = email.trim()
                  if (address.includes('@') && found?.email !== address) lookup.mutate(address)
                }}
                required
              />
              <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
            </div>
            {onCrewbarn ? (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <span className="font-semibold">{onCrewbarn}</span> is already on CrewBarn. No code needed: add them, then send them a job. Accepting it
                connects you.
              </p>
            ) : (
              <Field label="Company name" value={companyName} onChange={setCompanyName} required />
            )}
            <Field label="Contact name" value={contactName} onChange={setContactName} />
            <fieldset>
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-700">Documents they must upload</legend>
              <p className="mb-2 text-xs text-slate-500">Missing documents never stop an urgent job. You'll see what's missing and can send it anyway.</p>
              <div className="flex flex-wrap gap-3">
                {DOCUMENTS.map((d) => (
                  <label key={d.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={documents.includes(d.key)} onChange={() => toggle(d.key)} className="rounded text-amber-600 focus:ring-amber-500" />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {invite.isError && (
              <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{(invite.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:text-navy-900">Cancel</button>
              <button type="submit" disabled={invite.isPending} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {invite.isPending ? 'Sending…' : onCrewbarn ? `Add ${onCrewbarn}` : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * The subs this company invited: waiting on their code, or connected. Below
 * them, subs from before the sub network that take no new jobs until
 * invited (decided 2026-10-04).
 */
export function SubCompaniesList({ subs, notInvited = [] }: { subs: SubConnection[]; notInvited?: NotInvitedSub[] }) {
  const qc = useQueryClient()
  // Sending a new code and changing the status map are staff.edit on the server.
  const canEdit = usePermissions().has('staff.edit')
  const [inviting, setInviting] = useState<NotInvitedSub | null>(null)
  const [shown, setShown] = useState<{ id: string; code: string } | null>(null)
  const [docsFor, setDocsFor] = useState<string | null>(null)
  const [statusesOpen, setStatusesOpen] = useState(false)
  const resend = useMutation({
    mutationFn: (id: string) => apiRequest<{ data: { id: string; code: string } }>(`/v1/sub-invites/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
    onSuccess: (resp) => {
      setShown({ id: resp.data.id, code: resp.data.code })
      void qc.invalidateQueries({ queryKey: ['sub-connections'] })
    },
  })

  if (subs.length === 0 && notInvited.length === 0) return null

  return (
    <section className="mt-8" aria-labelledby="sub-companies-title" data-tour="staff-sub-companies">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sub-companies-title" className="text-base font-semibold text-navy-900">Sub companies</h2>
        <button type="button" onClick={() => setStatusesOpen(true)} className="text-xs font-medium text-amber-700 hover:underline">
          Job statuses for sub work
        </button>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {subs.map((s) => {
          const expired = s.status === 'invited' && s.code_expires_at !== null && new Date(s.code_expires_at) < new Date()
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900">{s.company_name}</p>
                <p className="truncate text-xs text-slate-500">{[s.contact_name, s.email].filter(Boolean).join(' · ')}</p>
                {shown?.id === s.id && <p className="mt-1 font-mono text-sm font-bold tracking-widest text-navy-900">New code: {shown.code}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : expired ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                  {s.status === 'accepted'
                    ? 'Connected'
                    : s.status === 'ended'
                      ? 'Ended'
                      : s.status === 'requested'
                        ? 'On CrewBarn · send them a job'
                        : expired
                          ? 'Code expired'
                          : 'Waiting on their code'}
                </span>
                {s.status === 'invited' && canEdit && (
                  <button type="button" onClick={() => resend.mutate(s.id)} disabled={resend.isPending} className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50">
                    Send a new code
                  </button>
                )}
                {s.status === 'accepted' && s.required_documents.length > 0 && (
                  <button
                    type="button"
                    data-tour="staff-sub-documents"
                    onClick={() => setDocsFor(docsFor === s.id ? null : s.id)}
                    aria-expanded={docsFor === s.id}
                    className={`text-xs font-medium hover:underline ${!s.documents_complete ? 'text-red-700' : s.documents_expiring ? 'text-amber-700' : 'text-slate-600'}`}
                  >
                    {!s.documents_complete ? 'Documents missing' : s.documents_expiring ? 'Documents expire soon' : 'Documents'}
                  </button>
                )}
              </div>
              {docsFor === s.id && <SubDocumentsPanel connectionId={s.id} />}
            </li>
          )
        })}
      </ul>
      {resend.isError && <p role="alert" className="mt-2 text-sm text-red-700">{(resend.error as Error).message}</p>}

      {notInvited.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-navy-900">Not on CrewBarn yet</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Subs you had before. Jobs now go to each sub's own CrewBarn, so invite them before you send them work. A company already on
            CrewBarn can take a job right away.
          </p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {notInvited.map((n) => (
              <li key={n.subcontractor_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{n.business_name}</p>
                  <p className="truncate text-xs text-slate-500">{[n.contact_name, n.email ?? 'No email on file'].filter(Boolean).join(' · ')}</p>
                </div>
                {canEdit && (
                  <button type="button" onClick={() => setInviting(n)} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                    Invite
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {inviting && <SubInviteModal initial={inviting} onClose={() => setInviting(null)} />}
      {statusesOpen && <SubStatusMapModal canEdit={canEdit} onClose={() => setStatusesOpen(false)} />}
    </section>
  )
}

interface StatusMapPayload {
  events: Array<{ event: string; label: string; status_id: string | null; chosen: boolean }>
  statuses: Array<{ id: string; name: string; category: string }>
}

/**
 * Which of this company's own job statuses a job moves to when its sub
 * accepts, declines, arrives or finishes. "Leave it" keeps whatever the job
 * is on; until a company chooses, the Facility Maintenance statuses are used
 * where it has them.
 */
function SubStatusMapModal({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const map = useQuery({
    queryKey: ['sub-status-map'],
    queryFn: () => apiRequest<{ data: StatusMapPayload }>('/v1/sub-network/status-map'),
  })
  const [choices, setChoices] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: StatusMapPayload }>('/v1/sub-network/status-map', {
        method: 'PUT',
        body: { map: Object.fromEntries(Object.entries(choices).map(([event, id]) => [event, id === '' ? null : id])) },
      }),
    onSuccess: (resp) => {
      qc.setQueryData(['sub-status-map'], resp)
      onClose()
    },
  })

  const data = map.data?.data

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="sub-status-map-title">
      <div className="m-auto w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" data-tour="sub-status-map">
        <h2 id="sub-status-map-title" className="text-lg font-semibold text-navy-900">Job statuses for sub work</h2>
        <p className="mt-1 text-sm text-slate-600">When something happens with the sub a job went to, move the job to one of your statuses, or leave it where it is.</p>
        {map.isLoading && <p className="mt-4 text-sm text-slate-500" role="status">Loading…</p>}
        {map.isError && <p role="alert" className="mt-4 text-sm text-red-700">{(map.error as Error).message}</p>}
        {data && (
          <div className="mt-4 space-y-3">
            {data.events.map((row) => (
              <label key={row.event} className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
                <span className="text-sm text-slate-700">{row.label}</span>
                <select
                  value={choices[row.event] ?? row.status_id ?? ''}
                  onChange={(e) => setChoices((c) => ({ ...c, [row.event]: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none sm:w-56"
                >
                  <option value="">Leave it</option>
                  {data.statuses.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {save.isError && <p role="alert" className="mt-3 text-sm text-red-700">{(save.error as Error).message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:text-navy-900">Cancel</button>
          <button type="button" onClick={() => save.mutate()} disabled={!canEdit || save.isPending || Object.keys(choices).length === 0} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The documents a connected sub uploaded for this company: where each one
 * stands, and -- once Secure Files is unlocked with the emailed code -- the
 * file itself. A W-9 can carry an SSN, so it is never one click away.
 */
function SubDocumentsPanel({ connectionId }: { connectionId: string }) {
  const docs = useQuery({ queryKey: ['sub-connections', connectionId, 'documents'], queryFn: () => getSubConnectionDocuments(connectionId), retry: false })
  const [locked, setLocked] = useState<{ row: SubDocumentRow; download: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function open(row: SubDocumentRow, download: boolean) {
    if (!row.document) return
    setError(null)
    // Opened before the request so the browser does not block it as a pop-up.
    const tab = download ? null : window.open('', '_blank')
    try {
      const blob = await fetchSubDocumentBlob(connectionId, row.document.id, download)
      const url = URL.createObjectURL(blob)
      // Shown in a tab only as a PDF or a photo; anything else is saved.
      const showable = blob.type === 'application/pdf' || blob.type.startsWith('image/')
      if (tab && !showable) tab.close()
      if (tab && showable) {
        tab.location.href = url
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = row.document.filename || row.label
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      tab?.close()
      if (e instanceof SubDocumentLockedError) setLocked({ row, download })
      else setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3">
      {docs.isLoading && <p className="text-xs text-slate-500" role="status">Loading…</p>}
      {docs.isError && <p role="alert" className="text-xs text-red-700">{(docs.error as Error).message}</p>}
      {docs.data && (
        <ul className="space-y-2">
          {docs.data.data.documents.map((row) => (
            <li key={row.key ?? row.kind} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-navy-900">{row.label}</span>
                {row.document?.expires_on && (
                  <span className="ml-2 text-xs text-slate-500">expires {new Date(`${row.document.expires_on}T00:00:00`).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SUB_DOCUMENT_STATE_CLASS[row.state]}`}>{SUB_DOCUMENT_STATE_LABEL[row.state]}</span>
                {row.document && (
                  <>
                    <button type="button" onClick={() => void open(row, false)} className="text-xs font-medium text-amber-700 hover:underline">View</button>
                    <button type="button" onClick={() => void open(row, true)} className="text-xs font-medium text-amber-700 hover:underline">Download</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {locked && (
        <UnlockSecureFiles
          onUnlocked={() => {
            const pending = locked
            setLocked(null)
            void open(pending.row, pending.download)
          }}
        />
      )}
    </div>
  )
}

/** The Secure Files step-up: a code to the signed-in person's email. */
function UnlockSecureFiles({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('')
  const send = useMutation({ mutationFn: () => requestCompanySecureFileAccess('email') })
  const verify = useMutation({ mutationFn: () => verifyCompanySecureFileAccess(code.trim()), onSuccess: onUnlocked })

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-700">These are kept in Secure Files. Unlock with a code sent to your email.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => send.mutate()} disabled={send.isPending} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
          {send.isPending ? 'Sending…' : send.isSuccess ? 'Send again' : 'Email me a code'}
        </button>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="Code" aria-label="Access code" className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        <button type="button" onClick={() => verify.mutate()} disabled={verify.isPending || !code.trim()} className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
          Unlock
        </button>
      </div>
      {send.data?.data && (
        <p className={`mt-1 text-xs ${send.data.data.sent ? 'text-emerald-700' : 'text-red-700'}`}>
          {send.data.data.sent ? `Code sent to ${send.data.data.to ?? 'your email'}.` : send.data.data.error ?? 'The code did not send.'}
        </p>
      )}
      {(send.error || verify.error) && <p role="alert" className="mt-1 text-xs text-red-700">{((send.error ?? verify.error) as Error).message}</p>}
    </div>
  )
}

function Field({ label, value, onChange, onBlur, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-700">{label}</span>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
    </label>
  )
}
