import { API_URL, apiRequest, getActingTenant, getStoredToken } from '@/lib/api'

/**
 * Hiring — the tenant's postings, the application form they build, and the
 * people who applied. The applicant side (search + apply) lives in the
 * portal, not here.
 */

export type PostingStatus = 'draft' | 'open' | 'paused' | 'closed'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'seasonal'
export type PayType =
  | 'hourly' | 'salary' | 'per_job'
  | 'commission_parts' | 'commission_labor' | 'commission_sales'
  | 'bonus' | 'tips' | 'other'

/**
 * One line of a pay package. Which amount is used depends on the type —
 * money for hourly/salary/per-job/bonus/other, percent for commissions,
 * nothing for tips — and the description is where "after 90 days" or
 * "on all parts sold on your calls" goes.
 */
export interface PayEntry {
  type: PayType
  min_cents: number | null
  max_cents: number | null
  percent: number | null
  description: string | null
}

export const PAY_TYPES: Record<PayType, { label: string; amount: 'money' | 'percent' | 'none'; unit: string; hint: string }> = {
  hourly: { label: 'Hourly', amount: 'money', unit: '/hr', hint: 'A rate or a range.' },
  salary: { label: 'Salary', amount: 'money', unit: '/yr', hint: 'Annual, or a range.' },
  per_job: { label: 'Per job', amount: 'money', unit: '/job', hint: 'Piece rate.' },
  commission_parts: { label: 'Parts commission', amount: 'percent', unit: '', hint: 'Percent of parts sold.' },
  commission_labor: { label: 'Labor commission', amount: 'percent', unit: '', hint: 'Percent of labor billed.' },
  commission_sales: { label: 'Sales commission', amount: 'percent', unit: '', hint: 'Percent of the total ticket.' },
  bonus: { label: 'Bonus', amount: 'money', unit: '', hint: 'Say when it is earned.' },
  tips: { label: 'Tips', amount: 'none', unit: '', hint: 'Kept by the tech.' },
  other: { label: 'Other', amount: 'money', unit: '', hint: 'Describe it.' },
}
export type QuestionType =
  | 'text' | 'longtext' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'url' | 'file'
export type ApplicationStatus = 'new' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected'

export interface Requirement {
  text: string
  /** Renders as an "I meet this" checkbox the applicant must tick. */
  must_confirm: boolean
}

export interface ApplicationQuestion {
  /** Stable once saved; answers are stored against it. Blank on a new question. */
  key: string
  label: string
  type: QuestionType
  required: boolean
  options: string[] | null
  help: string | null
}

export interface JobPosting {
  id: string
  title: string
  slug: string
  employment_type: EmploymentType
  description: string | null
  pay: PayEntry[]
  /** Server-built one-liner: "$18–$25/hr + 10% parts commission". */
  pay_summary: string | null
  city: string | null
  state: string | null
  zip: string | null
  requirements: Requirement[]
  form: ApplicationQuestion[]
  /** Ask applicants for photos of their driver's license, front and back. */
  license_required: boolean
  status: PostingStatus
  published_at: string | null
  closed_at: string | null
  applications_count: number
  new_applications_count: number
  created_at: string | null
  updated_at: string | null
}

export type JobPostingInput = Partial<
  Pick<
    JobPosting,
    | 'title' | 'employment_type' | 'description' | 'pay'
    | 'city' | 'state' | 'zip' | 'requirements' | 'form' | 'license_required'
  >
>

export interface JobApplication {
  id: string
  job_posting_id: string
  posting: { id: string; title: string; slug: string; status: PostingStatus } | null
  applicant_name: string
  applicant_email: string
  applicant_phone: string | null
  status: ApplicationStatus
  source: 'portal' | 'careers_page' | 'direct_link'
  has_resume: boolean
  license?: { front: boolean; back: boolean; uploaded_at: string | null }
  hired_account_id: string | null
  /** The interview the office set. Present once one has been scheduled. */
  interview?: {
    at: string
    location: string | null
    note: string | null
    notified_at: string | null
    confirmed_at: string | null
    /** The applicant asked for a different time (pending until answered). */
    requested_at: string | null
    request_note: string | null
    request_outcome: 'accepted' | 'countered' | null
  } | null
  /** Set once hired from the card: the role picked and where the set-up link went. */
  hire?: {
    role_slug: string | null
    setup_url: string | null
    email_sent_at: string | null
    sms_sent_at: string | null
  } | null
  status_changed_at: string | null
  created_at: string | null
}

export interface HireInput {
  role_slug: string
  app_access: boolean
  employee_portal: boolean
  pay_type?: string | null
  hourly_rate_cents?: number | null
  annual_salary_cents?: number | null
  commission_percent?: number | null
}

export interface HireResult {
  data: JobApplicationDetail
  invite: { email_sent: boolean; email_error: string | null; accept_url: string } | null
  sms: { sent: boolean; error: string | null }
}

export interface JobApplicationDetail extends JobApplication {
  answers: Record<string, unknown>
  confirmed_requirements: number[]
  cover_note: string | null
  notes: string | null
  resume_name: string | null
  form: ApplicationQuestion[]
  requirements: Requirement[]
}

export interface HiringSettings {
  hiring_enabled: boolean
  /** Outside link where the shop takes resumes (Indeed, a form). */
  hiring_external_url: string | null
  careers_url: string
  open_postings: number
  new_applications: number
  applications_by_status: Partial<Record<ApplicationStatus, number>>
}

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  seasonal: 'Seasonal',
}

export const POSTING_STATUS_LABEL: Record<PostingStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  paused: 'Paused',
  closed: 'Closed',
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new', 'reviewing', 'interview', 'offered', 'hired', 'rejected',
]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  interview: 'Interview',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Not selected',
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Short answer',
  longtext: 'Paragraph',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
  select: 'Pick one',
  multiselect: 'Pick several',
  url: 'Link',
  file: 'File upload',
}

// ---------------- Settings ----------------

export function getHiringSettings() {
  return apiRequest<{ data: HiringSettings }>('/v1/hiring/settings')
}

export function setHiringEnabled(enabled: boolean) {
  return apiRequest<{ data: HiringSettings }>('/v1/hiring/settings', {
    method: 'PATCH',
    body: { hiring_enabled: enabled },
  })
}

export function setHiringExternalUrl(url: string) {
  return apiRequest<{ data: HiringSettings }>('/v1/hiring/settings', {
    method: 'PATCH',
    body: { hiring_external_url: url.trim() || null },
  })
}

// ---------------- Postings ----------------

export function listPostings() {
  return apiRequest<{ data: JobPosting[] }>('/v1/hiring/postings')
}

export function getPosting(id: string) {
  return apiRequest<{ data: JobPosting }>(`/v1/hiring/postings/${id}`)
}

export function createPosting(input: JobPostingInput & { title: string }) {
  return apiRequest<{ data: JobPosting }>('/v1/hiring/postings', { method: 'POST', body: input })
}

export function updatePosting(id: string, input: JobPostingInput) {
  return apiRequest<{ data: JobPosting }>(`/v1/hiring/postings/${id}`, { method: 'PATCH', body: input })
}

export function deletePosting(id: string) {
  return apiRequest<{ data: { id: string; deleted: boolean } }>(`/v1/hiring/postings/${id}`, { method: 'DELETE' })
}

export function setPostingStatus(id: string, status: PostingStatus) {
  return apiRequest<{ data: JobPosting }>(`/v1/hiring/postings/${id}/status`, {
    method: 'POST',
    body: { status },
  })
}

export function duplicatePosting(id: string) {
  return apiRequest<{ data: JobPosting }>(`/v1/hiring/postings/${id}/duplicate`, { method: 'POST' })
}

// ---------------- Applications ----------------

export function listApplications(filters: { posting_id?: string; status?: ApplicationStatus } = {}) {
  const params = new URLSearchParams()
  if (filters.posting_id) params.set('posting_id', filters.posting_id)
  if (filters.status) params.set('status', filters.status)
  const qs = params.toString()
  return apiRequest<{ data: JobApplication[] }>(`/v1/hiring/applications${qs ? `?${qs}` : ''}`)
}

export function getApplication(id: string) {
  return apiRequest<{ data: JobApplicationDetail }>(`/v1/hiring/applications/${id}`)
}

export function updateApplication(
  id: string,
  input: { status?: ApplicationStatus; notes?: string | null; hired_account_id?: string | null },
) {
  return apiRequest<{ data: JobApplicationDetail }>(`/v1/hiring/applications/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export function deleteApplication(id: string) {
  return apiRequest<{ data: { id: string; deleted: boolean } }>(`/v1/hiring/applications/${id}`, { method: 'DELETE' })
}

/** Called by the Staff page once Hire has created the staff record. */
export function markApplicationHired(applicationId: string, accountId: string) {
  return updateApplication(applicationId, { status: 'hired', hired_account_id: accountId })
}

export interface InterviewInput {
  /** ISO datetime. */
  at: string
  location?: string | null
  note?: string | null
}

export interface InterviewResult {
  data: JobApplicationDetail
  notified: { email: { sent: boolean; error: string | null }; sms: { sent: boolean; error: string | null } }
}

/**
 * Set (or move) the interview. Puts the applicant in the Interview stage and
 * tells them by email + text; the same time as their request accepts it.
 */
export function scheduleInterview(id: string, input: InterviewInput) {
  return apiRequest<InterviewResult>(`/v1/hiring/applications/${id}/interview`, { method: 'POST', body: input })
}

/** ISO → the value a datetime-local input wants (browser-local wall time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Hire from the applicant card: creates the staff account with the chosen
 * role, emails + texts the set-up link, and marks the application hired.
 */
export function hireApplicant(id: string, input: HireInput) {
  return apiRequest<HireResult>(`/v1/hiring/applications/${id}/hire`, { method: 'POST', body: input })
}

/** A fresh set-up link (email + text) for someone already hired. */
export function resendSetupLink(id: string) {
  return apiRequest<HireResult>(`/v1/hiring/applications/${id}/resend-setup`, { method: 'POST' })
}

/**
 * Open the applicant's resume — a PDF in a new tab, anything else as a
 * download. A raw fetch rather than apiRequest because the response is
 * bytes, not JSON, and the file has to arrive with the bearer token: a
 * plain <a href> to the API would go out unauthenticated.
 *
 * `tab` is a window the CALLER opened synchronously in its click handler.
 * Popup blockers allow window.open only inside a user gesture, and by the
 * time the fetch resolves that gesture is long gone — so the tab is opened
 * blank first and pointed at the file once it arrives.
 */
export async function openResume(
  applicationId: string,
  resumeName: string | null,
  opts: { download?: boolean; tab?: Window | null } = {},
): Promise<void> {
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting

  try {
    const res = await fetch(
      `${API_URL}/v1/hiring/applications/${applicationId}/resume${opts.download ? '?download=1' : ''}`,
      { headers },
    )
    if (!res.ok) {
      let message = `Could not open the resume (${res.status}).`
      try {
        const body = await res.json()
        if (typeof body?.message === 'string') message = body.message
      } catch { /* not JSON */ }
      throw new Error(message)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const isPdf = blob.type === 'application/pdf'

    if (!opts.download && isPdf && opts.tab) {
      opts.tab.location.href = url
    } else {
      opts.tab?.close()
      const a = document.createElement('a')
      a.href = url
      a.download = resumeName || 'resume'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    // Don't leave a blank tab behind on failure.
    opts.tab?.close()
    throw e
  }
}

// ---------------- Display helpers ----------------

/** Mirrors JobPosting::payLine on the server, for live preview in the editor. */
export function formatPayEntry(e: PayEntry): string | null {
  const def = PAY_TYPES[e.type]
  if (!def) return null
  const money = (c: number) =>
    '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const label = def.label.toLowerCase()

  if (def.amount === 'money') {
    let range: string | null = null
    if (e.min_cents != null && e.max_cents != null) {
      range = e.min_cents === e.max_cents ? money(e.min_cents) : `${money(e.min_cents)}–${money(e.max_cents)}`
    } else if (e.min_cents != null) {
      range = e.type === 'bonus' || e.type === 'other' ? money(e.min_cents) : `From ${money(e.min_cents)}`
    } else if (e.max_cents != null) {
      range = `Up to ${money(e.max_cents)}`
    }
    if (e.type === 'hourly' || e.type === 'salary' || e.type === 'per_job') return range ? range + def.unit : null
    return range ? `${range} ${label}` : def.label
  }
  if (def.amount === 'percent') {
    return (e.percent != null ? `${e.percent}% ` : '') + label
  }
  return def.label
}

export function formatPay(p: Pick<JobPosting, 'pay'>): string | null {
  const parts = (p.pay ?? []).map(formatPayEntry).filter((x): x is string => !!x)
  return parts.length ? parts.join(' + ') : null
}

export function formatLocation(p: Pick<JobPosting, 'city' | 'state'>): string {
  return [p.city, p.state].filter(Boolean).join(', ')
}

export type ApplicationFileKind = 'resume' | 'license-front' | 'license-back'

/**
 * Fetch an applicant file (authenticated) and hand back an object URL the
 * in-page viewer can show. The caller revokes it when done.
 */
export async function fetchApplicationFile(
  applicationId: string,
  kind: ApplicationFileKind,
): Promise<{ url: string; type: string }> {
  const headers: Record<string, string> = {}
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const acting = getActingTenant()
  if (acting) headers['X-Act-As-Tenant'] = acting

  const path = kind === 'resume'
    ? `/v1/hiring/applications/${applicationId}/resume`
    : `/v1/hiring/applications/${applicationId}/license/${kind === 'license-front' ? 'front' : 'back'}`
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (!res.ok) {
    let message = `Could not open the file (${res.status}).`
    try {
      const body = await res.json()
      if (typeof body?.message === 'string') message = body.message
    } catch { /* not JSON */ }
    throw new Error(message)
  }
  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), type: blob.type }
}
