import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ApplicantFileViewer } from '@/components/hiring/ApplicantFileViewer'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import type { ApplicationFileKind } from '@/lib/hiring'
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  deleteApplication,
  formatWhen,
  getApplication,
  hireApplicant,
  openResume,
  resendSetupLink,
  scheduleInterview,
  toLocalInput,
  updateApplication,
  type ApplicationQuestion,
  type ApplicationStatus,
  type HireResult,
  type InterviewInput,
  type InterviewResult,
  type JobApplicationDetail,
} from '@/lib/hiring'

interface RoleOption {
  role_slug: string
  display_name: string
  description: string | null
}

const isPdfName = (name: string | null) => !!name && /\.pdf$/i.test(name)

/**
 * Review one applicant: what they answered, which requirements they
 * confirmed, the tenant's private notes, and where they are in the pipeline.
 *
 * "Hire" opens a short panel right here: what they're being hired as (the
 * role decides their app permissions), whether they get the field app and
 * the employee portal, and optionally their wage. Saving creates the staff
 * account through the same endpoint the Staff page uses, then the set-up
 * link goes out by email and text — and stays on the applicant's portal
 * page until they've used it.
 */
export function ApplicantModal({
  applicationId,
  onClose,
  onChanged,
}: {
  applicationId: string
  onClose: () => void
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['hiring', 'application', applicationId],
    queryFn: () => getApplication(applicationId),
  })
  const a = q.data?.data ?? null

  const [notes, setNotes] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  useEffect(() => {
    if (a && !notesDirty) setNotes(a.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, a?.notes])

  const [error, setError] = useState<string | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)
  // Which file is open in the overlay viewer (resume or a license side).
  const [viewing, setViewing] = useState<ApplicationFileKind | null>(null)

  const update = useMutation({
    mutationFn: (input: { status?: ApplicationStatus; notes?: string | null }) => updateApplication(applicationId, input),
    onSuccess: (resp) => {
      qc.setQueryData(['hiring', 'application', applicationId], resp)
      setNotesDirty(false)
      onChanged()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: () => deleteApplication(applicationId),
    onSuccess: () => { onChanged(); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  // ── Interview ──
  // "Interview" is an appointment, not a label: picking it in the Stage
  // menu opens this panel, and the stage only changes once a time is set.
  const [scheduling, setScheduling] = useState(false)
  const [ivAt, setIvAt] = useState('')
  const [ivLocation, setIvLocation] = useState('')
  const [ivNote, setIvNote] = useState('')
  const [ivNotified, setIvNotified] = useState<InterviewResult['notified'] | null>(null)

  const openScheduler = (prefillIso: string | null) => {
    setIvAt(toLocalInput(prefillIso))
    setIvLocation(a?.interview?.location ?? '')
    setIvNote(a?.interview?.note ?? '')
    setError(null)
    setScheduling(true)
  }

  const schedule = useMutation({
    mutationFn: (input: InterviewInput) => scheduleInterview(applicationId, input),
    onSuccess: (resp) => {
      qc.setQueryData(['hiring', 'application', applicationId], { data: resp.data })
      setIvNotified(resp.notified)
      setScheduling(false)
      onChanged()
    },
    onError: (e: Error) => setError(e.message),
  })

  const changeStage = (next: ApplicationStatus) => {
    if (next === 'interview' && a?.status !== 'interview') {
      // Already filling the panel in? Keep what they typed.
      if (!scheduling) openScheduler(a?.interview?.requested_at ?? a?.interview?.at ?? null)
      return
    }
    setScheduling(false)
    update.mutate({ status: next })
  }
  // The menu shows Interview while the panel is open, so it doesn't look
  // like the pick was lost; it's only saved once the time is set.
  const stageValue: ApplicationStatus = scheduling && a?.status !== 'interview' ? 'interview' : (a?.status ?? 'new')

  // ── Hire panel ──
  const { role_slug: actorRoleSlug } = usePermissions()
  const [hiring, setHiring] = useState(false)
  const [roleSlug, setRoleSlug] = useState('')
  const [appAccess, setAppAccess] = useState(true)
  const [employeePortal, setEmployeePortal] = useState(true)
  const [payType, setPayType] = useState('')
  const [rate, setRate] = useState('')
  const [hireResult, setHireResult] = useState<HireResult | null>(null)
  const [copied, setCopied] = useState(false)

  // The tenant's roles ride along on the staff list endpoint (staff.view),
  // which hiring staff already have — no separate roles permission needed.
  const rolesQ = useQuery({
    queryKey: ['staff', 'roles-for-hire'],
    queryFn: () => apiRequest<{ roles: RoleOption[] }>('/v1/staff?per_page=1'),
    enabled: hiring,
    staleTime: 5 * 60_000,
  })
  const roles = useMemo(
    () => (rolesQ.data?.roles ?? []).filter((r) => actorRoleSlug === 'owner' || r.role_slug !== 'owner'),
    [rolesQ.data, actorRoleSlug],
  )
  useEffect(() => {
    // Default to the first non-owner role — never silently make a hire an owner.
    if (!roleSlug && roles.length > 0) setRoleSlug(roles.find((r) => r.role_slug !== 'owner')?.role_slug ?? roles[0].role_slug)
  }, [roleSlug, roles])

  const hire = useMutation({
    mutationFn: () =>
      hireApplicant(applicationId, {
        role_slug: roleSlug,
        app_access: appAccess,
        employee_portal: employeePortal,
        pay_type: payType || null,
        hourly_rate_cents: payType === 'hourly' && rate ? Math.round(parseFloat(rate) * 100) : null,
        annual_salary_cents: payType === 'salary' && rate ? Math.round(parseFloat(rate) * 100) : null,
        commission_percent: payType === 'commission' && rate ? parseFloat(rate) : null,
      }),
    onSuccess: (resp) => {
      qc.setQueryData(['hiring', 'application', applicationId], { data: resp.data })
      qc.invalidateQueries({ queryKey: ['staff'] })
      setHireResult(resp)
      setHiring(false)
      onChanged()
    },
    onError: (e: Error) => setError(e.message),
  })

  const resend = useMutation({
    mutationFn: () => resendSetupLink(applicationId),
    onSuccess: (resp) => {
      qc.setQueryData(['hiring', 'application', applicationId], { data: resp.data })
      setHireResult(resp)
    },
    onError: (e: Error) => setError(e.message),
  })

  const copyLink = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }).catch(() => undefined)
  }

  return (
    <Modal isOpen onClose={onClose} title={a?.applicant_name ?? 'Applicant'} subtitle={a?.posting?.title} size="md">
      <Modal.Body>
        {q.isLoading || !a ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-6">
            {/* Contact + pipeline */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-slate-50 p-4">
              <div className="space-y-1 text-sm">
                <div><a href={`mailto:${a.applicant_email}`} className="font-medium text-amber-700 hover:underline">{a.applicant_email}</a></div>
                {a.applicant_phone && (
                  <div><a href={`tel:${a.applicant_phone}`} className="text-slate-700 hover:underline">{a.applicant_phone}</a></div>
                )}
                <div className="text-xs text-slate-500">
                  Applied {a.created_at ? new Date(a.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  {' · '}via {a.source === 'portal' ? 'job board' : a.source === 'careers_page' ? 'your website' : 'direct link'}
                </div>
              </div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stage
                <select
                  value={stageValue}
                  onChange={(e) => changeStage(e.target.value as ApplicationStatus)}
                  className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium normal-case tracking-normal text-slate-900 focus:border-amber-500 focus:outline-none"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{APPLICATION_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                {scheduling && a.status !== 'interview' && (
                  <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-violet-700">Saved once the time is set below</span>
                )}
              </label>
            </div>

            {scheduling && (
              <section className="space-y-3 rounded-lg border border-violet-300 bg-violet-50/60 p-4">
                <div>
                  <h4 className={H4}>{a.interview?.at ? 'Move the interview' : 'Set up the interview'}</h4>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {a.applicant_name.split(/\s+/)[0]} gets the time by email{a.applicant_phone ? ' and text' : ''}, and can confirm it or ask for a different time from their job-board page.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={LBL}>
                    Date &amp; time
                    <input
                      type="datetime-local"
                      value={ivAt}
                      min={toLocalInput(new Date().toISOString())}
                      onChange={(e) => setIvAt(e.target.value)}
                      className={INPUT}
                    />
                  </label>
                  <label className={LBL}>
                    Where
                    <input
                      type="text"
                      value={ivLocation}
                      onChange={(e) => setIvLocation(e.target.value)}
                      placeholder="Shop address, phone call, or video link"
                      className={INPUT}
                    />
                  </label>
                </div>
                <label className={LBL}>
                  Note for them (optional)
                  <textarea
                    rows={2}
                    value={ivNote}
                    onChange={(e) => setIvNote(e.target.value)}
                    placeholder="Ask for Dan at the counter. Bring your license."
                    className={INPUT}
                  />
                </label>
                {schedule.error && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Could not save the interview: {(schedule.error as Error).message}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setScheduling(false); schedule.reset() }} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
                  <button
                    type="button"
                    disabled={!ivAt || schedule.isPending}
                    onClick={() => schedule.mutate({ at: new Date(ivAt).toISOString(), location: ivLocation.trim() || null, note: ivNote.trim() || null })}
                    className="rounded-md bg-violet-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    {schedule.isPending ? 'Sending…' : a.interview?.at ? 'Move & notify' : 'Set interview & notify'}
                  </button>
                </div>
              </section>
            )}

            {!scheduling && a.interview?.at && a.status === 'interview' && (
              <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Interview</div>
                    <div className="text-sm font-semibold text-slate-900">{formatWhen(a.interview.at)}</div>
                    {a.interview.location && <div className="text-sm text-slate-700">{a.interview.location}</div>}
                    {a.interview.note && <div className="text-xs text-slate-500">{a.interview.note}</div>}
                    <div className="mt-1 text-xs text-slate-500">
                      {a.interview.confirmed_at
                        ? <span className="font-medium text-emerald-700">Confirmed by {a.applicant_name.split(/\s+/)[0]}</span>
                        : a.interview.request_outcome === 'countered' && !a.interview.requested_at
                          ? 'New time sent — waiting on their confirmation'
                          : 'Not confirmed yet'}
                      {' · '}
                      {ivNotified
                        ? <>
                            {ivNotified.email.sent ? 'emailed' : 'not emailed'}
                            {ivNotified.email.error && <span className="text-rose-700"> ({ivNotified.email.error})</span>}
                            {' · '}
                            {ivNotified.sms.sent ? 'texted' : 'not texted'}
                            {ivNotified.sms.error && <span className="text-rose-700"> ({ivNotified.sms.error})</span>}
                          </>
                        : a.interview.notified_at ? `told ${formatWhen(a.interview.notified_at)}` : 'not notified'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openScheduler(a.interview?.at ?? null)}
                    className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                  >
                    Reschedule
                  </button>
                </div>
                {a.interview.requested_at && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                    <div className="text-sm font-semibold text-amber-900">Asked for a different time: {formatWhen(a.interview.requested_at)}</div>
                    {a.interview.request_note && <div className="mt-0.5 text-xs text-amber-800">&ldquo;{a.interview.request_note}&rdquo;</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={schedule.isPending}
                        onClick={() => schedule.mutate({ at: a.interview!.requested_at!, location: a.interview!.location, note: a.interview!.note })}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {schedule.isPending ? 'Sending…' : 'Accept that time'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openScheduler(a.interview?.requested_at ?? null)}
                        className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        Propose another
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {a.hired_account_id && (
              <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <div>
                  Hired{a.hire?.role_slug ? <> as <span className="font-semibold">{roleLabel(a.hire.role_slug, rolesQ.data?.roles)}</span></> : null} — now on your{' '}
                  <button type="button" onClick={() => navigate('/tool-shed/staff')} className="font-semibold underline">staff list</button>.
                </div>
                {(hireResult || a.hire) && (
                  <div className="text-xs text-emerald-800">
                    Set-up link{' '}
                    {hireResult ? (
                      <>
                        {hireResult.invite?.email_sent ? 'emailed' : 'not emailed'}
                        {hireResult.invite?.email_error && <span className="text-rose-700"> ({hireResult.invite.email_error})</span>}
                        {' · '}
                        {hireResult.sms.sent ? 'texted' : 'not texted'}
                        {hireResult.sms.error && <span className="text-rose-700"> ({hireResult.sms.error})</span>}
                      </>
                    ) : (
                      <>
                        {a.hire?.email_sent_at ? 'emailed' : 'not emailed'} · {a.hire?.sms_sent_at ? 'texted' : 'not texted'}
                      </>
                    )}
                    . It also shows on their job-board page under My applications.
                  </div>
                )}
                {(hireResult?.invite?.accept_url ?? a.hire?.setup_url) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      readOnly
                      value={hireResult?.invite?.accept_url ?? a.hire?.setup_url ?? ''}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => copyLink(hireResult?.invite?.accept_url ?? a.hire?.setup_url ?? '')}
                      className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      disabled={resend.isPending}
                      onClick={() => resend.mutate()}
                      className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {resend.isPending ? 'Sending…' : 'Send again'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {hiring && !a.hired_account_id && (
              <section className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-4">
                <div>
                  <h4 className={H4}>Hiring {a.applicant_name.split(/\s+/)[0]} as</h4>
                  <p className="mt-0.5 text-xs text-slate-600">
                    The role sets what they can see and do in CrewBarn. You can change it any time on the Staff page.
                  </p>
                </div>
                {rolesQ.isLoading ? (
                  <div className="text-sm text-slate-500">Loading roles…</div>
                ) : (
                  <div>
                    <select
                      value={roleSlug}
                      onChange={(e) => setRoleSlug(e.target.value)}
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                    >
                      {roles.map((r) => (
                        <option key={r.role_slug} value={r.role_slug}>{r.display_name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">{roles.find((r) => r.role_slug === roleSlug)?.description}</p>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <input type="checkbox" checked={appAccess} onChange={(e) => setAppAccess(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-xs text-slate-700">
                      <span className="font-semibold">Field app</span> — logs in on their phone, clocks in, runs jobs.
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <input type="checkbox" checked={employeePortal} onChange={(e) => setEmployeePortal(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-xs text-slate-700">
                      <span className="font-semibold">Employee portal</span> — schedule, tasks, time off, messages on the web.
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Wage
                    <select value={payType} onChange={(e) => setPayType(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-900 focus:border-emerald-500 focus:outline-none">
                      <option value="">Set later</option>
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary</option>
                      <option value="commission">Commission</option>
                    </select>
                  </label>
                  {payType && (
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {payType === 'commission' ? 'Percent' : payType === 'salary' ? 'Annual ($)' : 'Rate ($/hr)'}
                      <input
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder={payType === 'commission' ? '10' : payType === 'salary' ? '52000' : '25'}
                        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                  )}
                </div>
                <p className="text-[11px] text-slate-600">
                  {appAccess || employeePortal
                    ? <>Sends a set-up link to <span className="font-medium">{a.applicant_email}</span>{a.applicant_phone ? <> and texts it to <span className="font-medium">{a.applicant_phone}</span></> : null}. The same link shows on their job-board page.</>
                    : <>No login: they become an assignable crew member and no set-up link is sent.</>}
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setHiring(false)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
                  <button
                    type="button"
                    onClick={() => hire.mutate()}
                    disabled={hire.isPending || !roleSlug}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {hire.isPending ? 'Hiring…' : appAccess || employeePortal ? 'Hire & send set-up link' : 'Hire'}
                  </button>
                </div>
              </section>
            )}

            {/* Requirements */}
            {a.requirements.length > 0 && (
              <section>
                <h4 className={H4}>Requirements</h4>
                <ul className="mt-2 space-y-1">
                  {a.requirements.map((r, i) => {
                    const confirmed = a.confirmed_requirements.includes(i)
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 shrink-0 ${r.must_confirm ? (confirmed ? 'text-emerald-600' : 'text-rose-500') : 'text-slate-300'}`}>
                          {r.must_confirm ? (confirmed ? '✓' : '✗') : '•'}
                        </span>
                        <span className={r.must_confirm && !confirmed ? 'text-rose-700' : 'text-slate-700'}>
                          {r.text}
                          {r.must_confirm && !confirmed && <span className="ml-1 text-xs text-rose-500">(not confirmed)</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Answers */}
            <section>
              <h4 className={H4}>Answers</h4>
              {a.form.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">This posting had no questions.</p>
              ) : (
                <dl className="mt-2 divide-y divide-slate-100">
                  {a.form.map((question) => (
                    <div key={question.key} className="py-2.5">
                      <dt className="text-xs font-medium text-slate-500">{question.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">
                        <Answer question={question} value={a.answers[question.key]} resumeName={a.resume_name} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {a.cover_note && (
                <div className="mt-3 rounded-md border border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-500">Note from the applicant</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{a.cover_note}</p>
                </div>
              )}
            </section>

            {/* Resume */}
            {a.has_resume && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="text-slate-500">Resume</span>{' '}
                  <span className="font-medium text-slate-900">{a.resume_name ?? 'attached'}</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isPdfName(a.resume_name) && (
                    <button
                      type="button"
                      onClick={() => setViewing('resume')}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      View
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={resumeBusy}
                    onClick={() => {
                      setResumeBusy(true)
                      openResume(a.id, a.resume_name, { download: true })
                        .catch((e: Error) => setError(e.message))
                        .finally(() => setResumeBusy(false))
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {resumeBusy ? 'Fetching…' : 'Download'}
                  </button>
                </div>
              </section>
            )}

            {/* Driver's license photos */}
            {(a.license?.front || a.license?.back) && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <span className="text-slate-500">Driver's license</span>{' '}
                  <span className="font-medium text-slate-900">
                    {a.license.front && a.license.back ? 'front and back' : a.license.front ? 'front only' : 'back only'}
                  </span>
                  {a.license.uploaded_at && <span className="text-slate-400"> · {new Date(a.license.uploaded_at).toLocaleDateString()}</span>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {(['front', 'back'] as const).filter((s) => a.license?.[s]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setViewing(side === 'front' ? 'license-front' : 'license-back')}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      View {side}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Private notes */}
            <section>
              <h4 className={H4}>Your notes <span className="font-normal normal-case tracking-normal text-slate-400">— private</span></h4>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }}
                onBlur={() => { if (notesDirty && notes !== (a.notes ?? '')) update.mutate({ notes: notes || null }) }}
                rows={3}
                placeholder="Called 9/14 — strong on automotive, wants weekends off…"
                className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </section>

            {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => { if (window.confirm('Delete this application? The applicant can apply again.')) remove.mutate() }}
            disabled={remove.isPending}
            className="text-sm font-medium text-slate-400 hover:text-rose-600"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Close
            </button>
            {a && !a.hired_account_id && !hiring && (
              <button
                type="button"
                onClick={() => { setError(null); setHiring(true) }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Hire
              </button>
            )}
          </div>
        </div>
      </Modal.Footer>

      {viewing && a && (
        <ApplicantFileViewer
          applicationId={a.id}
          kind={viewing}
          title={viewing === 'resume' ? 'Resume' : viewing === 'license-front' ? "Driver's license — front" : "Driver's license — back"}
          fileName={viewing === 'resume' ? a.resume_name : null}
          onClose={() => setViewing(null)}
        />
      )}
    </Modal>
  )
}

const H4 = 'text-xs font-semibold uppercase tracking-wide text-slate-500'
const LBL = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500'
const INPUT = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none'

function roleLabel(slug: string, roles: RoleOption[] | undefined): string {
  return roles?.find((r) => r.role_slug === slug)?.display_name ?? slug.replace(/_/g, ' ')
}

function Answer({ question, value, resumeName }: { question: ApplicationQuestion; value: unknown; resumeName: string | null }) {
  if (question.type === 'file') {
    return resumeName ? <span className="text-slate-500">Attached — see Resume below</span> : <span className="text-slate-400">Not provided</span>
  }
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-slate-400">—</span>
  }
  if (question.type === 'boolean') return <>{value ? 'Yes' : 'No'}</>
  if (Array.isArray(value)) return <>{value.map(String).join(', ')}</>
  if (question.type === 'url' && typeof value === 'string') {
    return <a href={value} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">{value}</a>
  }
  return <>{String(value)}</>
}

export type { JobApplicationDetail }
