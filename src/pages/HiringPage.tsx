import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { JobPostingEditor } from '@/components/hiring/JobPostingEditor'
import { ApplicantModal } from '@/components/hiring/ApplicantModal'
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  POSTING_STATUS_LABEL,
  deletePosting,
  duplicatePosting,
  formatLocation,
  formatPay,
  getHiringSettings,
  listApplications,
  listPostings,
  setHiringEnabled,
  setHiringExternalUrl,
  setPostingStatus,
  type ApplicationStatus,
  type HiringSettings,
  type JobApplication,
  type JobPosting,
} from '@/lib/hiring'

/**
 * /tool-shed/hiring — post openings, build the application form, review who
 * applied, hire.
 *
 * The switch at the top is the whole visibility model: on, and every OPEN
 * posting shows on the careers page and the portal board; off, and nothing
 * does, whatever state the postings are in. A shop that just filled its
 * opening flips one thing.
 */

const SETTINGS_KEY = ['hiring', 'settings']
const POSTINGS_KEY = ['hiring', 'postings']
const APPLICATIONS_KEY = ['hiring', 'applications']

type Tab = 'postings' | 'applicants'

export function HiringPage() {
  const { has } = usePermissions()
  const canEdit = has(PERM.STAFF_EDIT)
  const qc = useQueryClient()

  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: getHiringSettings })
  const postings = useQuery({ queryKey: POSTINGS_KEY, queryFn: listPostings })
  const applications = useQuery({ queryKey: APPLICATIONS_KEY, queryFn: () => listApplications() })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SETTINGS_KEY })
    qc.invalidateQueries({ queryKey: POSTINGS_KEY })
    qc.invalidateQueries({ queryKey: APPLICATIONS_KEY })
  }

  const [tab, setTab] = useState<Tab>('postings')
  const [editing, setEditing] = useState<JobPosting | null | 'new'>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const s = settings.data?.data
  const newCount = s?.new_applications ?? 0

  const toggle = useMutation({
    mutationFn: (on: boolean) => setHiringEnabled(on),
    onSuccess: (resp) => { qc.setQueryData(SETTINGS_KEY, resp); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Hiring</h1>
          <p className="mt-1 text-sm text-slate-600">
            Post an opening, build the application, and review who applies. Job seekers find you on the
            CrewBarn job board by city and state, and on your website's careers page.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            + New posting
          </button>
        )}
      </div>

      {/* The switch */}
      <div className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${s?.hiring_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <label className="flex cursor-pointer items-center gap-3">
          <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${s?.hiring_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={!!s?.hiring_enabled}
              disabled={!canEdit || !s || toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${s?.hiring_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              {s ? (s.hiring_enabled ? "We're hiring" : 'Not hiring right now') : 'Loading…'}
            </span>
            <span className="block text-xs text-slate-500">
              {s?.hiring_enabled
                ? `${s.open_postings} open posting${s.open_postings === 1 ? '' : 's'} visible to job seekers.`
                : 'Postings stay saved but nobody can see or apply to them.'}
            </span>
          </span>
        </label>
        {s && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden sm:inline">Careers page:</span>
            <a href={s.careers_url} target="_blank" rel="noreferrer" className="font-mono text-amber-700 hover:underline">
              {s.careers_url.replace('https://', '')}
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(s.careers_url)}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 font-medium hover:bg-slate-50"
            >
              Copy
            </button>
          </div>
        )}

        {/* Outside resume link. While the switch is on, the shop is listed
            on the job board by name with this link — no posting needed. For
            a shop that already takes resumes on Indeed or a form, this is
            the whole feature. */}
        {s && (
          <ExternalLinkRow
            value={s.hiring_external_url}
            enabled={s.hiring_enabled}
            canEdit={canEdit}
            onSaved={(resp) => { qc.setQueryData(SETTINGS_KEY, resp); setError(null) }}
            onError={setError}
          />
        )}
      </div>

      {error && <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'postings'} onClick={() => setTab('postings')}>
          Postings
        </TabButton>
        <TabButton active={tab === 'applicants'} onClick={() => setTab('applicants')}>
          Applicants
          {newCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{newCount} new</span>
          )}
        </TabButton>
      </div>

      {tab === 'postings' ? (
        <PostingsList
          postings={postings.data?.data ?? []}
          loading={postings.isLoading}
          canEdit={canEdit}
          hiringEnabled={!!s?.hiring_enabled}
          onEdit={(p) => setEditing(p)}
          onNew={() => setEditing('new')}
          onViewApplicants={() => setTab('applicants')}
          onChanged={invalidate}
          onError={setError}
        />
      ) : (
        <ApplicantsList
          applications={applications.data?.data ?? []}
          postings={postings.data?.data ?? []}
          loading={applications.isLoading}
          onOpen={setViewing}
        />
      )}

      {editing && canEdit && (
        <JobPostingEditor
          posting={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate() }}
        />
      )}

      {viewing && (
        <ApplicantModal applicationId={viewing} onClose={() => setViewing(null)} onChanged={invalidate} />
      )}
    </div>
  )
}

// ---------------- Outside resume link ----------------

function ExternalLinkRow({
  value,
  enabled,
  canEdit,
  onSaved,
  onError,
}: {
  value: string | null
  enabled: boolean
  canEdit: boolean
  onSaved: (resp: { data: HiringSettings }) => void
  onError: (m: string) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const dirty = draft.trim() !== (value ?? '')

  const save = useMutation({
    mutationFn: () => setHiringExternalUrl(draft),
    onSuccess: onSaved,
    onError: (e: Error) => onError(e.message),
  })

  return (
    <div className="basis-full border-t border-slate-200/70 pt-3">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outside resume link</span>
        <div className="mt-1 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty) save.mutate() }}
            disabled={!canEdit}
            placeholder="https://www.indeed.com/cmp/your-company  ·  a Google Form  ·  your own site"
            className="block min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50"
          />
          {canEdit && (
            <button
              type="button"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
              className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </label>
      <p className="mt-1 text-xs text-slate-500">
        {value
          ? enabled
            ? 'Listed on the CrewBarn job board and your careers page under your company name — even with no postings.'
            : 'Saved. Shows on the job board and your careers page once hiring is switched on.'
          : 'Already take resumes on Indeed or a form? Paste the link and job seekers see it under your company name while hiring is on.'}
      </p>
    </div>
  )
}

// ---------------- Postings ----------------

function PostingsList({
  postings,
  loading,
  canEdit,
  hiringEnabled,
  onEdit,
  onNew,
  onViewApplicants,
  onChanged,
  onError,
}: {
  postings: JobPosting[]
  loading: boolean
  canEdit: boolean
  hiringEnabled: boolean
  onEdit: (p: JobPosting) => void
  onNew: () => void
  onViewApplicants: () => void
  onChanged: () => void
  onError: (m: string | null) => void
}) {
  const status = useMutation({
    mutationFn: (v: { id: string; status: JobPosting['status'] }) => setPostingStatus(v.id, v.status),
    onSuccess: () => { onError(null); onChanged() },
    onError: (e: Error) => onError(e.message),
  })
  const dup = useMutation({
    mutationFn: (id: string) => duplicatePosting(id),
    onSuccess: (resp) => { onChanged(); onEdit(resp.data) },
    onError: (e: Error) => onError(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deletePosting(id),
    onSuccess: () => onChanged(),
    onError: (e: Error) => onError(e.message),
  })

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>

  if (postings.length === 0) {
    return (
      <div className="mt-8 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
        <div className="text-3xl">📋</div>
        <h2 className="mt-2 text-base font-semibold text-slate-900">No postings yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          A posting is the job, your requirements, and the questions you want answered. Start with the
          starter form and change anything.
        </p>
        {canEdit && (
          <button type="button" onClick={onNew} className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Create your first posting
          </button>
        )}
      </div>
    )
  }

  return (
    <ul className="mt-4 space-y-3">
      {postings.map((p) => {
        const live = hiringEnabled && p.status === 'open'
        const pay = formatPay(p)
        const loc = formatLocation(p)
        return (
          <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => canEdit && onEdit(p)} className="text-left text-base font-semibold text-slate-900 hover:text-amber-700">
                    {p.title}
                  </button>
                  <StatusPill status={p.status} live={live} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span>{EMPLOYMENT_TYPE_LABEL[p.employment_type]}</span>
                  {loc && <span>· {loc}</span>}
                  {pay && <span>· {pay}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <button type="button" onClick={onViewApplicants} className="hover:text-amber-700 hover:underline">
                    {p.applications_count} applicant{p.applications_count === 1 ? '' : 's'}
                    {p.new_applications_count > 0 && <span className="ml-1 font-semibold text-amber-700">({p.new_applications_count} new)</span>}
                  </button>
                  <span>{p.form.length} question{p.form.length === 1 ? '' : 's'}</span>
                  <span>{p.requirements.length} requirement{p.requirements.length === 1 ? '' : 's'}</span>
                  {p.status === 'open' && !hiringEnabled && (
                    <span className="font-medium text-amber-700">Hidden — hiring is switched off above</span>
                  )}
                  {p.status === 'draft' && (
                    <span className="font-medium text-amber-700">Not on the job board yet — click Open</span>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {p.status !== 'open' && (
                    <Action onClick={() => status.mutate({ id: p.id, status: 'open' })} primary>
                      {p.status === 'paused' ? 'Resume' : p.status === 'closed' ? 'Reopen' : 'Open'}
                    </Action>
                  )}
                  {p.status === 'open' && (
                    <>
                      <Action onClick={() => status.mutate({ id: p.id, status: 'paused' })}>Pause</Action>
                      <Action onClick={() => status.mutate({ id: p.id, status: 'closed' })}>Close</Action>
                    </>
                  )}
                  <Action onClick={() => onEdit(p)}>Edit</Action>
                  <Action onClick={() => dup.mutate(p.id)}>Duplicate</Action>
                  <Action
                    onClick={() => {
                      const n = p.applications_count
                      const msg = n > 0
                        ? `Delete "${p.title}" and its ${n} application${n === 1 ? '' : 's'}? This can't be undone.`
                        : `Delete "${p.title}"?`
                      if (window.confirm(msg)) remove.mutate(p.id)
                    }}
                    danger
                  >
                    Delete
                  </Action>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function StatusPill({ status, live }: { status: JobPosting['status']; live: boolean }) {
  const cls =
    status === 'open'
      ? live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      : status === 'draft'
        ? 'bg-slate-100 text-slate-600'
        : status === 'paused'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-200 text-slate-600'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status === 'open' && !live ? 'Open · hidden' : POSTING_STATUS_LABEL[status]}
    </span>
  )
}

// ---------------- Applicants ----------------

function ApplicantsList({
  applications,
  postings,
  loading,
  onOpen,
}: {
  applications: JobApplication[]
  postings: JobPosting[]
  loading: boolean
  onOpen: (id: string) => void
}) {
  const [postingFilter, setPostingFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('')
  const [hideClosed, setHideClosed] = useState(true)

  const rows = useMemo(
    () =>
      applications.filter((a) => {
        if (postingFilter && a.job_posting_id !== postingFilter) return false
        if (statusFilter && a.status !== statusFilter) return false
        if (hideClosed && (a.status === 'hired' || a.status === 'rejected')) return false
        return true
      }),
    [applications, postingFilter, statusFilter, hideClosed],
  )

  const counts = useMemo(() => {
    const c: Partial<Record<ApplicationStatus, number>> = {}
    for (const a of applications) c[a.status] = (c[a.status] ?? 0) + 1
    return c
  }, [applications])

  if (loading) return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>

  return (
    <div className="mt-4">
      {/* Pipeline strip — the counts are also the filter. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusFilter === '' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          All · {applications.length}
        </button>
        {APPLICATION_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusFilter === st ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {APPLICATION_STATUS_LABEL[st]} · {counts[st] ?? 0}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <select
          value={postingFilter}
          onChange={(e) => setPostingFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All postings</option>
          {postings.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
          Hide hired &amp; not selected
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          {applications.length === 0
            ? 'Nobody has applied yet. Applications land here the moment they come in.'
            : 'Nothing matches those filters.'}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Applicant</th>
                <th className="px-4 py-2">Posting</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer hover:bg-amber-50/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {a.status === 'new' && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="New" />}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{a.applicant_name}</div>
                        <div className="truncate text-xs text-slate-500">{a.applicant_email}{a.applicant_phone ? ` · ${a.applicant_phone}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{a.posting?.title ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_CLS[a.status]}`}>
                      {APPLICATION_STATUS_LABEL[a.status]}
                    </span>
                    {a.status === 'interview' && a.interview?.at && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {new Date(a.interview.at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {a.interview.confirmed_at && <span className="text-emerald-700"> · confirmed</span>}
                      </div>
                    )}
                    {a.status === 'interview' && a.interview?.requested_at && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Wants another time</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const STAGE_CLS: Record<ApplicationStatus, string> = {
  new: 'bg-amber-100 text-amber-800',
  reviewing: 'bg-sky-100 text-sky-800',
  interview: 'bg-violet-100 text-violet-800',
  offered: 'bg-emerald-100 text-emerald-800',
  hired: 'bg-emerald-600 text-white',
  rejected: 'bg-slate-100 text-slate-500',
}

// ---------------- Bits ----------------

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${active ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}

function Action({ onClick, children, primary, danger }: { onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean }) {
  const cls = primary
    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
    : danger
      ? 'border-slate-300 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-700'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </button>
  )
}
