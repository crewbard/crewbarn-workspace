import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { markApplicationHired } from '@/lib/hiring'
import { usePermissions, PERM } from '@/hooks/usePermissions'
import { tenantDate, useTenantTimezone } from '@/hooks/useTenantTime'
import { DASHBOARD_WIDGETS } from '@/components/dashboard/widgets'

type Tab = 'staff' | 'scorecard' | 'timesheet'

interface Staff {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  name: string
  /** Phone the click-to-call bridge rings before dialing the customer. */
  phone: string | null
  /** The tech's own Net2Phone DID — click-to-call originates from it. */
  net2phone_number: string | null
  /** When on, this person's inbound texts also thread into Comms + AI intake. */
  sms_comms_passthrough: boolean
  role_slug: string | null
  /** Tech (app user, can log in) when true; non-login crew when false. */
  app_access: boolean
  employee_portal: boolean
  status: string
  rule_require_notes: boolean
  rule_tech_nudge: boolean
  rule_cod_collection: boolean
  rule_geofence_auto_clock: boolean
  /** null = all widgets allowed; array = restricted to these ids. */
  dashboard_widget_ids: string[] | null
  permission_override_enabled: boolean
  permission_overrides: string[] | null
  data_scope_overrides: Record<string, 'all' | 'own'> | null
  last_login_at: string | null
  created_at: string
}

interface RoleOption {
  role_slug: string
  display_name: string
  description: string | null
  permissions: string[]
  data_scopes: Record<string, 'all' | 'own'>
}

interface PermissionCatalogGroup {
  group: string
  items: { key: string; label: string }[]
}

interface StaffIndexResp {
  data: Staff[]
  roles: RoleOption[]
  permission_catalog: PermissionCatalogGroup[]
}

interface InviteResp {
  data: Staff
  invite: {
    email_sent: boolean
    email_error: string | null
    accept_url: string
  }
}

/** A real Net2Phone DID on the tenant's account (for the per-tech picker). */
interface Net2PhoneNumber {
  number: string | null
  id: string | null
  assignment_status: string | null
  assignee_email: string | null
  assignee_name: string | null
}

/**
 * Classify a Net2Phone DID for the picker: a label, whether it's a system line
 * (ring group / IVR — "assigned" but to no user, so NOT tech-assignable), and a
 * sort rank (available first, then user lines, then system lines last).
 */
function net2phoneOptionMeta(n: Net2PhoneNumber): { label: string; system: boolean; rank: number } {
  const num = formatPhoneDisplay(n.number ?? '')
  const status = (n.assignment_status ?? '').toLowerCase()
  const who = n.assignee_name || n.assignee_email
  if (status !== 'assigned') {
    return { label: `${num} — available`, system: false, rank: 0 }
  }
  if (!who) {
    return { label: `${num} — system line (ring group / auto-attendant)`, system: true, rank: 2 }
  }
  return { label: `${num} — ${who}`, system: false, rank: 1 }
}

/** Pretty-print a +1XXXXXXXXXX / 10-digit number as (XXX) XXX-XXXX; pass through otherwise. */
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length === 10) {
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  }
  return raw
}

type PayrollProfile = {
  account_id: string
  pay_type: 'hourly' | 'salary' | 'commission' | 'hybrid'
  hourly_rate_cents: number
  annual_salary_cents: number
  commission_percent: number
  commission_basis: 'paid_revenue' | 'gross_revenue' | 'gross_margin'
  parts_commission_percent: number
  parts_commission_max_parts_cents: number
  target_margin_percent: number | null
  standard_weekly_hours: number
  sick_days_per_quarter: number
  vacation_accrual_percent: number
  pto_hours_available: number
  sick_hours_available: number
  vacation_hours_available: number
  expense_reimbursement_enabled: boolean
  active: boolean
  notes?: string | null
}

type PayrollProfileForm = {
  pay_type: PayrollProfile['pay_type']
  hourly_rate: string
  annual_salary: string
  commission_percent: string
  commission_basis: PayrollProfile['commission_basis']
  parts_commission_percent: string
  parts_commission_max_parts: string
  target_margin_percent: string
  standard_weekly_hours: string
  sick_days_per_quarter: string
  vacation_accrual_percent: string
  pto_hours_available: string
  sick_hours_available: string
  vacation_hours_available: string
  expense_reimbursement_enabled: boolean
  active: boolean
  notes: string
}

type PayrollCalculatorInputs = {
  hours: string
  revenue: string
  paid: string
  grossMargin: string
  partsCost: string
}

function dollarsToCents(value: string): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function numberValue(value: string): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function payrollHourlyEquivalent(form: PayrollProfileForm): number {
  if (form.pay_type === 'hourly' || form.pay_type === 'hybrid') {
    return dollarsToCents(form.hourly_rate)
  }

  if (form.pay_type === 'salary') {
    const annualHours = Math.max(1, numberValue(form.standard_weekly_hours) * 52)
    return Math.round(dollarsToCents(form.annual_salary) / annualHours)
  }

  return 0
}

function calculatePayrollPreview(form: PayrollProfileForm, inputs: PayrollCalculatorInputs) {
  const hours = numberValue(inputs.hours)
  const revenue = dollarsToCents(inputs.revenue)
  const paid = dollarsToCents(inputs.paid)
  const grossMargin = dollarsToCents(inputs.grossMargin)
  const partsCost = dollarsToCents(inputs.partsCost)
  const hourlyEquivalent = payrollHourlyEquivalent(form)
  const laborCost = form.pay_type === 'hourly' || form.pay_type === 'hybrid' || form.pay_type === 'salary'
    ? Math.round(hours * hourlyEquivalent)
    : 0
  const commissionBasis = form.commission_basis === 'gross_revenue'
    ? revenue
    : form.commission_basis === 'gross_margin'
      ? Math.max(0, grossMargin)
      : paid
  const commissionCost = form.pay_type === 'commission' || form.pay_type === 'hybrid'
    ? Math.round(commissionBasis * (Math.max(0, numberValue(form.commission_percent)) / 100))
    : 0
  const partsCap = dollarsToCents(form.parts_commission_max_parts)
  const partsCommissionCost = partsCost > 0 && (partsCap <= 0 || partsCost <= partsCap)
    ? Math.round(partsCost * (Math.max(0, numberValue(form.parts_commission_percent)) / 100))
    : 0
  const quarterHours = Math.max(1, numberValue(form.standard_weekly_hours) * 13)
  const sickHours = Math.round((Math.max(0, numberValue(form.sick_days_per_quarter)) * Math.min(1, hours / quarterHours) * 8) * 100) / 100
  const vacationAccrual = Math.round(revenue * (Math.max(0, numberValue(form.vacation_accrual_percent)) / 100))
  const vacationHours = hourlyEquivalent > 0 ? Math.round((vacationAccrual / hourlyEquivalent) * 100) / 100 : 0

  return {
    laborCost,
    commissionCost,
    partsCommissionCost,
    sickHours,
    vacationAccrual,
    vacationHours,
    totalPayrollCost: laborCost + commissionCost + partsCommissionCost,
  }
}

/**
 * Tool Shed → People → Staff & Crews.
 *
 * Two tabs: Staff (tenant_admin accounts + invite flow) and Crews (named
 * groups of staff for joint job assignment).
 *
 * Invite flow now sends a real email via Resend. We still display the
 * accept-URL as a fallback for shops without email configured yet.
 */
export function StaffCrewsPage() {
  const [tab, setTab] = useState<Tab>('staff')

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Staff & crews</h1>
          <p className="text-sm text-slate-600 mt-1">
            People who work at this shop + the crews you assemble for joint jobs.{' '}
            <Link to="/tool-shed/roles" className="text-amber-700 hover:underline">
              Manage role permissions →
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6 border-b border-slate-200 flex gap-1">
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')}>
          Staff
        </TabButton>
        <TabButton active={tab === 'scorecard'} onClick={() => setTab('scorecard')}>
          Scorecard
        </TabButton>
        <TabButton active={tab === 'timesheet'} onClick={() => setTab('timesheet')}>
          Timesheet
        </TabButton>
      </div>

      {tab === 'staff' && <StaffPanel />}
      {tab === 'scorecard' && <ScorecardPanel />}
      {tab === 'timesheet' && <TimesheetPanel />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'text-navy-900' : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
      {active && <span className="absolute left-3 right-3 -bottom-px h-[3px] bg-amber-500" />}
    </button>
  )
}

// -------- Staff panel --------

function StaffPanel() {
  const { has, role_slug: actorRoleSlug } = usePermissions()
  const canEdit = has(PERM.STAFF_EDIT)
  const canInviteOwner = actorRoleSlug === 'owner'
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [showDisabled, setShowDisabled] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)

  // Hiring hands off here: "Hire" on an applicant lands on this page with
  // the invite form already filled in from the application, and the id of
  // that application so the new staff record links back to it. One click
  // from "we want this person" to their onboarding link.
  const [searchParams, setSearchParams] = useSearchParams()
  const hireFrom = searchParams.get('from_application')
  const invitePrefill = useMemo(
    () =>
      hireFrom
        ? {
            first_name: searchParams.get('first_name') ?? '',
            last_name: searchParams.get('last_name') ?? '',
            email: searchParams.get('email') ?? '',
            phone: searchParams.get('phone') ?? '',
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hireFrom],
  )
  useEffect(() => {
    if (hireFrom && canEdit) setShowInvite(true)
  }, [hireFrom, canEdit])
  const clearHireParams = () => {
    if (!hireFrom) return
    const next = new URLSearchParams(searchParams)
    for (const k of ['from_application', 'first_name', 'last_name', 'email', 'phone']) next.delete(k)
    setSearchParams(next, { replace: true })
  }
  const [inviteResult, setInviteResult] = useState<{
    email: string
    email_sent: boolean
    email_error: string | null
    accept_url: string
  } | null>(null)

  const list = useQuery({
    queryKey: ['staff', { search, showDisabled }],
    queryFn: () => {
      const p = new URLSearchParams()
      if (search.trim()) p.set('q', search.trim())
      if (showDisabled) p.set('show_disabled', '1')
      return apiRequest<StaffIndexResp>('/v1/staff' + (p.toString() ? `?${p}` : ''))
    },
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['staff'] })
  }

  // Per-employee, per-rule field-rule toggles (workflow training). PATCHes a
  // single rule field directly from the row; stopPropagation keeps it from
  // opening the editor.
  const toggleRule = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiRequest(`/v1/staff/${id}`, { method: 'PATCH', body: { [field]: value } }),
    onSuccess: invalidate,
  })

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or name…"
            className="text-sm px-3 py-2 border border-slate-300 rounded-md w-72"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            Show disabled
          </label>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            + Add staff or crew
          </button>
        )}
      </div>

      <div className="mt-5 bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {list.isLoading && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!list.isLoading && (list.data?.data?.length ?? 0) === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No staff match.</div>
        )}
        {(list.data?.data?.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-center px-4 py-2.5" title="Per-employee field rules. Turn off individually while training.">Field rules <span className="font-normal normal-case text-[10px] text-slate-400">(notes · nudge · COD · auto-clock)</span></th>
                <th className="text-left px-4 py-2.5">Payroll</th>
                <th className="text-left px-4 py-2.5">Last login</th>
                <th className="text-right px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.data!.data.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => canEdit && setEditing(s)}
                  className={canEdit ? 'cursor-pointer hover:bg-amber-50' : ''}
                >
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {s.name}
                    {!s.app_access && (
                      <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 align-middle">
                        {s.employee_portal ? 'Crew · portal' : 'Crew · no login'}
                      </span>
                    )}
                    {s.app_access && s.employee_portal && (
                      <span className="ml-2 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 align-middle" title="Lands in the employee portal on the web">Portal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.email}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {s.phone ? (
                      <span>{s.phone}</span>
                    ) : (
                      <span className="text-slate-300" title="No phone — click-to-call can't ring this person yet">—</span>
                    )}
                    {s.net2phone_number && (
                      <span className="block text-[11px] text-slate-400" title="Net2Phone DID — click-to-call originates from this line">
                        N2P {s.net2phone_number}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {roleDisplayName(s.role_slug, list.data?.roles ?? [])}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RulePill label="Notes" on={s.rule_require_notes} disabled={!canEdit || toggleRule.isPending}
                        onClick={() => toggleRule.mutate({ id: s.id, field: 'rule_require_notes', value: !s.rule_require_notes })} />
                      <RulePill label="Nudge" on={s.rule_tech_nudge} disabled={!canEdit || toggleRule.isPending}
                        onClick={() => toggleRule.mutate({ id: s.id, field: 'rule_tech_nudge', value: !s.rule_tech_nudge })} />
                      <RulePill label="COD" on={s.rule_cod_collection} disabled={!canEdit || toggleRule.isPending}
                        onClick={() => toggleRule.mutate({ id: s.id, field: 'rule_cod_collection', value: !s.rule_cod_collection })} />
                      <RulePill label="Auto-clock" on={s.rule_geofence_auto_clock} disabled={!canEdit || toggleRule.isPending}
                        onClick={() => toggleRule.mutate({ id: s.id, field: 'rule_geofence_auto_clock', value: !s.rule_geofence_auto_clock })} />
                    </div>
                  </td>
                  {/* Opens the staff overlay rather than navigating to the
                      payroll page. EditModal already renders StaffPayrollEditor,
                      so the trip to Accounting left the Staff list to show the
                      same pay rules the overlay has — and the way back was the
                      browser's Back button. The overlay keeps the rest of this
                      person's settings one scroll away. */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setEditing(s)}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Settings
                    </button>
                    {/* Their employee portal, as they'd see it. Beside Settings
                        because "what does Ian actually see?" is asked from the
                        list, not from inside the editor. */}
                    <Link
                      to={`/me?as=${s.id}`}
                      title={`Open the employee portal as ${s.name} (read-only preview)`}
                      className="ml-1.5 inline-block rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-amber-300 hover:bg-amber-50"
                    >
                      Portal
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {s.last_login_at
                      ? new Date(s.last_login_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && canEdit && (
        <InviteModal
          roles={list.data?.roles ?? []}
          canInviteOwner={canInviteOwner}
          initial={invitePrefill}
          onClose={() => {
            setShowInvite(false)
            clearHireParams()
          }}
          onInvited={(resp, email) => {
            setShowInvite(false)
            if (hireFrom) {
              // Best effort: the staff record exists either way. If this
              // fails the applicant still shows as "offered" and the tenant
              // can mark them hired by hand — a visible state, not a silent one.
              markApplicationHired(hireFrom, resp.data.id).catch(() => {})
              clearHireParams()
            }
            // Crew (no login) come back with no invite — just refresh the list.
            if (resp.invite) {
              setInviteResult({
                email,
                email_sent: resp.invite.email_sent,
                email_error: resp.invite.email_error,
                accept_url: resp.invite.accept_url,
              })
            }
            invalidate()
          }}
        />
      )}

      {editing && canEdit && (
        <EditModal
          staff={editing}
          roles={list.data?.roles ?? []}
          permissionCatalog={list.data?.permission_catalog ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            invalidate()
          }}
          onResendInvite={(resp) => {
            setEditing(null)
            setInviteResult({
              email: resp.data.email,
              email_sent: resp.invite.email_sent,
              email_error: resp.invite.email_error,
              accept_url: resp.invite.accept_url,
            })
            invalidate()
          }}
        />
      )}

      {inviteResult && (
        <InviteResultModal {...inviteResult} onClose={() => setInviteResult(null)} />
      )}
    </div>
  )
}

function roleDisplayName(slug: string | null, roles: RoleOption[]): string {
  if (!slug) return '—'
  return roles.find((r) => r.role_slug === slug)?.display_name ?? slug
}

function permissionGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    customers: 'Customers',
    calls: 'Calls',
    jobs: 'Jobs',
    tasks: 'Tasks',
    invoices: 'Invoices',
    revenue: 'Revenue',
    inventory: 'Inventory',
    catalog: 'Catalog',
    parts: 'AI parts',
    assets: 'Assets',
    warranties: 'Warranties',
    templates: 'Templates',
    staff: 'Staff',
    settings: 'Settings',
    ai: 'AI',
    mobile: 'Mobile',
    franchises: 'Franchise',
    company: 'Company secure files',
  }
  return labels[group] ?? group
}

function payrollFormFromProfile(profile: PayrollProfile): PayrollProfileForm {
  return {
    pay_type: profile.pay_type,
    hourly_rate: String((profile.hourly_rate_cents ?? 0) / 100),
    annual_salary: String((profile.annual_salary_cents ?? 0) / 100),
    commission_percent: String(profile.commission_percent ?? 0),
    commission_basis: profile.commission_basis,
    parts_commission_percent: String(profile.parts_commission_percent ?? 0),
    parts_commission_max_parts: String((profile.parts_commission_max_parts_cents ?? 0) / 100),
    target_margin_percent: profile.target_margin_percent == null ? '' : String(profile.target_margin_percent),
    standard_weekly_hours: String(profile.standard_weekly_hours ?? 40),
    sick_days_per_quarter: String(profile.sick_days_per_quarter ?? 0),
    vacation_accrual_percent: String(profile.vacation_accrual_percent ?? 0),
    pto_hours_available: String(profile.pto_hours_available ?? 0),
    sick_hours_available: String(profile.sick_hours_available ?? 0),
    vacation_hours_available: String(profile.vacation_hours_available ?? 0),
    expense_reimbursement_enabled: profile.expense_reimbursement_enabled,
    active: profile.active,
    notes: profile.notes ?? '',
  }
}

/** Compact per-employee rule chip — amber = applies, struck/grey = exempt. */
function RulePill({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string
  on: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      title={on ? `${label}: ON for this employee — click to exempt` : `${label}: exempt — click to apply`}
      className={[
        'text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors disabled:opacity-50 whitespace-nowrap',
        on
          ? 'bg-amber-100 border-amber-300 text-amber-800'
          : 'bg-slate-50 border-slate-200 text-slate-400 line-through',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function PayrollPreviewMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${strong ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white/70'}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-sm ${strong ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>{value}</div>
    </div>
  )
}

function StaffPayrollEditor({ staff }: { staff: Staff }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PayrollProfileForm | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [calculator, setCalculator] = useState<PayrollCalculatorInputs>({
    hours: '8',
    revenue: '1200',
    paid: '1200',
    grossMargin: '700',
    partsCost: '350',
  })

  const profilesQ = useQuery({
    queryKey: ['payroll-profiles'],
    queryFn: () => apiRequest<{ data: PayrollProfile[] }>('/v1/payroll-profiles'),
  })

  const profile = useMemo(
    () => profilesQ.data?.data.find((row) => row.account_id === staff.id) ?? null,
    [profilesQ.data?.data, staff.id],
  )

  useEffect(() => {
    if (!profile || form) return
    setForm(payrollFormFromProfile(profile))
  }, [profile, form])

  const editorForm =
    form ??
    (profile
      ? payrollFormFromProfile(profile)
      : {
          pay_type: 'hourly',
          hourly_rate: '0',
          annual_salary: '0',
          commission_percent: '0',
          commission_basis: 'paid_revenue',
          parts_commission_percent: '0',
          parts_commission_max_parts: '0',
          target_margin_percent: '',
          standard_weekly_hours: '40',
          sick_days_per_quarter: '0',
          vacation_accrual_percent: '0',
          pto_hours_available: '0',
          sick_hours_available: '0',
          vacation_hours_available: '0',
          expense_reimbursement_enabled: true,
          active: staff.status !== 'disabled',
          notes: '',
        })

  const save = useMutation({
    mutationFn: () =>
      apiRequest<{ data: PayrollProfile }>(`/v1/payroll-profiles/${encodeURIComponent(staff.id)}`, {
        method: 'PATCH',
        body: {
          pay_type: editorForm.pay_type,
          hourly_rate: Number(editorForm.hourly_rate || 0),
          annual_salary: Number(editorForm.annual_salary || 0),
          commission_percent: Number(editorForm.commission_percent || 0),
          commission_basis: editorForm.commission_basis,
          parts_commission_percent: Number(editorForm.parts_commission_percent || 0),
          parts_commission_max_parts: Number(editorForm.parts_commission_max_parts || 0),
          target_margin_percent:
            editorForm.target_margin_percent === '' ? null : Number(editorForm.target_margin_percent),
          standard_weekly_hours: Number(editorForm.standard_weekly_hours || 40),
          sick_days_per_quarter: Number(editorForm.sick_days_per_quarter || 0),
          vacation_accrual_percent: Number(editorForm.vacation_accrual_percent || 0),
          pto_hours_available: Number(editorForm.pto_hours_available || 0),
          sick_hours_available: Number(editorForm.sick_hours_available || 0),
          vacation_hours_available: Number(editorForm.vacation_hours_available || 0),
          expense_reimbursement_enabled: editorForm.expense_reimbursement_enabled,
          active: editorForm.active,
          notes: editorForm.notes || null,
        },
      }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-profiles'] })
      setForm(payrollFormFromProfile(resp.data))
      setMessage('Payroll saved.')
      window.setTimeout(() => setMessage(null), 1800)
    },
    onError: (e: Error) => setMessage(e.message),
  })

  const update = (patch: Partial<PayrollProfileForm>) => setForm({ ...editorForm, ...patch })
  const inputCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'
  const calculatorPreview = calculatePayrollPreview(editorForm, calculator)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Payroll override
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pay rules for this person override the company default in payroll and profitability reports.
          </p>
        </div>
        <Link
          to={`/accounting/payroll/profiles?account=${encodeURIComponent(staff.id)}`}
          className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
        >
          Full payroll page
        </Link>
      </div>

      {profilesQ.isLoading ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Loading payroll...
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pay type
              <select
                className={inputCls}
                value={editorForm.pay_type}
                onChange={(e) => update({ pay_type: e.target.value as PayrollProfile['pay_type'] })}
              >
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
                <option value="commission">Commission</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Hourly rate
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.hourly_rate}
                onChange={(e) => update({ hourly_rate: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Annual salary
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.annual_salary}
                onChange={(e) => update({ annual_salary: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Commission %
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.commission_percent}
                onChange={(e) => update({ commission_percent: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Commission basis
              <select
                className={inputCls}
                value={editorForm.commission_basis}
                onChange={(e) => update({ commission_basis: e.target.value as PayrollProfile['commission_basis'] })}
              >
                <option value="paid_revenue">Paid revenue</option>
                <option value="gross_revenue">Gross revenue</option>
                <option value="gross_margin">Gross margin</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Target margin %
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.target_margin_percent}
                onChange={(e) => update({ target_margin_percent: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Parts commission
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Parts commission %
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={editorForm.parts_commission_percent}
                  onChange={(e) => update({ parts_commission_percent: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Only if parts are at or below
                <input
                  className={inputCls}
                  inputMode="decimal"
                  placeholder="500"
                  value={editorForm.parts_commission_max_parts}
                  onChange={(e) => update({ parts_commission_max_parts: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Weekly hours
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.standard_weekly_hours}
                onChange={(e) => update({ standard_weekly_hours: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Sick days / quarter
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.sick_days_per_quarter}
                onChange={(e) => update({ sick_days_per_quarter: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Vacation accrual %
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.vacation_accrual_percent}
                onChange={(e) => update({ vacation_accrual_percent: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Tech calculator</div>
                <p className="mt-1 text-xs text-slate-500">
                  Test a sample job. Parts commission follows the cap above.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Sick {Number(editorForm.sick_days_per_quarter || 0).toFixed(2)} days / quarter · Vacation {Number(editorForm.vacation_accrual_percent || 0).toFixed(2)}%
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Hours
                <input className={inputCls} inputMode="decimal" value={calculator.hours} onChange={(e) => setCalculator({ ...calculator, hours: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Revenue
                <input className={inputCls} inputMode="decimal" value={calculator.revenue} onChange={(e) => setCalculator({ ...calculator, revenue: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Paid
                <input className={inputCls} inputMode="decimal" value={calculator.paid} onChange={(e) => setCalculator({ ...calculator, paid: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Gross margin
                <input className={inputCls} inputMode="decimal" value={calculator.grossMargin} onChange={(e) => setCalculator({ ...calculator, grossMargin: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Parts cost
                <input className={inputCls} inputMode="decimal" value={calculator.partsCost} onChange={(e) => setCalculator({ ...calculator, partsCost: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
              <PayrollPreviewMetric label="Labor" value={formatMoney(calculatorPreview.laborCost)} />
              <PayrollPreviewMetric label="Commission" value={formatMoney(calculatorPreview.commissionCost)} />
              <PayrollPreviewMetric label="Parts comm." value={formatMoney(calculatorPreview.partsCommissionCost)} />
              <PayrollPreviewMetric label="Sick earned" value={`${calculatorPreview.sickHours}h`} />
              <PayrollPreviewMetric label="Vacation" value={`${calculatorPreview.vacationHours}h / ${formatMoney(calculatorPreview.vacationAccrual)}`} />
              <PayrollPreviewMetric label="Total" value={formatMoney(calculatorPreview.totalPayrollCost)} strong />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              PTO hours
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.pto_hours_available}
                onChange={(e) => update({ pto_hours_available: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Sick hours
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.sick_hours_available}
                onChange={(e) => update({ sick_hours_available: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Vacation hours
              <input
                className={inputCls}
                inputMode="decimal"
                value={editorForm.vacation_hours_available}
                onChange={(e) => update({ vacation_hours_available: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={editorForm.expense_reimbursement_enabled}
                onChange={(e) => update({ expense_reimbursement_enabled: e.target.checked })}
              />
              Reimburse expenses
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={editorForm.active}
                onChange={(e) => update({ active: e.target.checked })}
              />
              Include in payroll reports
            </label>
          </div>

          <label className="mt-3 grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Payroll notes
            <textarea
              className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={editorForm.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className={message?.includes('saved') ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>
              {message}
            </span>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {save.isPending ? 'Saving payroll...' : 'Save payroll'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    disabled: 'bg-slate-100 text-slate-500',
    pending: 'bg-amber-50 text-amber-700',
  }
  const cls = styles[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {status}
    </span>
  )
}

function Net2PhoneNumberSelect({
  value,
  onChange,
  inputCls,
}: {
  value: string
  onChange: (next: string) => void
  inputCls: string
}) {
  const numbersQ = useQuery({
    queryKey: ['net2phone-numbers'],
    queryFn: () => apiRequest<{ data: Net2PhoneNumber[] }>('/v1/comms/net2phone/numbers'),
  })

  const fetched = numbersQ.data?.data ?? []
  const currentInList = value === '' || fetched.some((n) => (n.number ?? '') === value)

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Net2Phone number</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">— none —</option>
        {/* Keep the current value selectable even if it's not in the fetched
            list (revoked/renamed DID, or list failed to load). */}
        {!currentInList && <option value={value}>{formatPhoneDisplay(value)}</option>}
        {[...fetched]
          .map((n) => ({ n, meta: net2phoneOptionMeta(n) }))
          .sort((a, b) => a.meta.rank - b.meta.rank)
          .map(({ n, meta }) => (
            <option key={n.id ?? n.number} value={n.number ?? ''} disabled={meta.system}>
              {meta.label}
            </option>
          ))}
      </select>
      <p className="text-[11px] text-slate-500 mt-1.5">
        {numbersQ.isLoading
          ? 'Loading Net2Phone numbers…'
          : numbersQ.isError || fetched.length === 0
            ? "Couldn't load Net2Phone numbers — connect Net2Phone in Communication settings, or leave blank to use the shop's click-to-call number."
            : "Pick an available number or the tech's own line (system / ring-group lines are greyed out). Net2Phone must also allow this number as a click-to-call originator and route it to the tech's cell. Leave on “— none —” to use the shop's click-to-call number."}
      </p>
    </div>
  )
}

// -------- Invite modal + result modal + edit modal --------

function InviteModal({
  roles,
  canInviteOwner,
  initial,
  onClose,
  onInvited,
}: {
  roles: RoleOption[]
  canInviteOwner: boolean
  /** Prefill from a job application (Hiring → Hire). */
  initial?: { first_name: string; last_name: string; email: string; phone: string } | null
  onClose: () => void
  onInvited: (resp: InviteResp, email: string) => void
}) {
  const selectableRoles = useMemo(
    () => roles.filter((role) => canInviteOwner || role.role_slug !== 'owner'),
    [canInviteOwner, roles],
  )
  const [email, setEmail] = useState(initial?.email ?? '')
  const [firstName, setFirstName] = useState(initial?.first_name ?? '')
  const [lastName, setLastName] = useState(initial?.last_name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [net2phoneNumber, setNet2phoneNumber] = useState('')
  const [smsToComms, setSmsToComms] = useState(false)
  // Tech = app login (email invite). Crew = no login (just an assignable record).
  const [appAccess, setAppAccess] = useState(true)
  // The light web shell. On by default for a tech; crew opt in (needs an email).
  const [employeePortal, setEmployeePortal] = useState(true)
  // Wage setup → PayrollProfile. rate is dollars for hourly/salary, percent for commission.
  const [payType, setPayType] = useState('')
  const [rate, setRate] = useState('')
  const [roleSlug, setRoleSlug] = useState(
    // Default to the first NON-owner role — never silently make a new hire an owner.
    selectableRoles.find((r) => r.role_slug !== 'owner')?.role_slug ?? '',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roleSlug && selectableRoles.length > 0) {
      setRoleSlug(selectableRoles.find((r) => r.role_slug !== 'owner')?.role_slug ?? selectableRoles[0].role_slug)
    }
  }, [roleSlug, selectableRoles])

  const invite = useMutation({
    mutationFn: () =>
      apiRequest<InviteResp>('/v1/staff', {
        method: 'POST',
        body: {
          email: email.trim() || null,
          first_name: firstName,
          last_name: lastName || null,
          phone: phone.trim() || null,
          net2phone_number: net2phoneNumber.trim() || null,
          sms_comms_passthrough: smsToComms,
          role_slug: roleSlug,
          app_access: appAccess,
          employee_portal: employeePortal,
          pay_type: payType || null,
          hourly_rate_cents: payType === 'hourly' && rate ? Math.round(parseFloat(rate) * 100) : null,
          annual_salary_cents: payType === 'salary' && rate ? Math.round(parseFloat(rate) * 100) : null,
          commission_percent: payType === 'commission' && rate ? parseFloat(rate) : null,
        },
      }),
    onSuccess: (resp) => onInvited(resp, email),
    onError: (e: Error) => setError(e.message),
  })

  const inputCls =
    'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{appAccess ? 'Invite staff' : 'Add crew'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAppAccess(true)} className={`flex-1 text-sm px-3 py-2 rounded-md border ${appAccess ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium' : 'border-slate-300 text-slate-600'}`}>Full-time tech</button>
              <button type="button" onClick={() => setAppAccess(false)} className={`flex-1 text-sm px-3 py-2 rounded-md border ${!appAccess ? 'border-amber-500 bg-amber-50 text-amber-900 font-medium' : 'border-slate-300 text-slate-600'}`}>Temp / crew</button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {appAccess ? 'A tech logs into the mobile app, auto-clocks, and can lead jobs.' : 'Crew are assigned to jobs and have hours logged by a tech — no app login.'}
            </p>
            <label className="mt-2 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={employeePortal}
                onChange={(e) => setEmployeePortal(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[12px] text-slate-700">
                <span className="font-medium">Employee portal</span> — a light web view of their day: jobs, tasks, time off, messages.
                {!appAccess && employeePortal && <span className="block text-amber-700">Crew with the portal get a login, so an email is required.</span>}
              </span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">{appAccess || employeePortal ? 'Email' : 'Email (optional)'}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@shop.com"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Mobile phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Click-to-call rings this number first, then dials the customer. Optional now — they can add it later.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smsToComms}
                onChange={(e) => setSmsToComms(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">Texts also hit Comms &amp; Intake</span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Their inbound texts to the business/intake line also appear in the customer inbox and run through AI intake — on top of their staff thread. Leave off for regular crew.
            </p>
          </div>
          {appAccess && (
            <Net2PhoneNumberSelect
              value={net2phoneNumber}
              onChange={setNet2phoneNumber}
              inputCls={inputCls}
            />
          )}
          {appAccess && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Role</label>
              <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className={inputCls}>
                {selectableRoles.map((r) => (
                  <option key={r.role_slug} value={r.role_slug}>{r.display_name}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {roles.find((r) => r.role_slug === roleSlug)?.description}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Wage type</label>
              <select value={payType} onChange={(e) => setPayType(e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
                <option value="commission">Commission</option>
              </select>
            </div>
            {payType && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
                  {payType === 'commission' ? 'Percent' : payType === 'salary' ? 'Annual ($)' : 'Rate ($/hr)'}
                </label>
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder={payType === 'commission' ? '10' : payType === 'salary' ? '52000' : '25'}
                  className={inputCls}
                />
              </div>
            )}
          </div>
          {appAccess && (
            <p className="text-[11px] text-slate-500">
              We&apos;ll email them a link to set their password. If email isn&apos;t configured, you&apos;ll get the link to share manually.
            </p>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            onClick={() => invite.mutate()}
            disabled={invite.isPending || ((appAccess || employeePortal) && !email.trim()) || !firstName.trim() || !roleSlug}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {invite.isPending ? 'Saving…' : appAccess ? 'Send invite' : 'Add crew'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({
  staff,
  roles,
  permissionCatalog,
  onClose,
  onSaved,
  onResendInvite,
}: {
  staff: Staff
  roles: RoleOption[]
  permissionCatalog: PermissionCatalogGroup[]
  onClose: () => void
  onSaved: () => void
  onResendInvite: (resp: InviteResp) => void
}) {
  const [firstName, setFirstName] = useState(staff.first_name ?? '')
  const [lastName, setLastName] = useState(staff.last_name ?? '')
  const [phone, setPhone] = useState(staff.phone ?? '')
  const [net2phoneNumber, setNet2phoneNumber] = useState(staff.net2phone_number ?? '')
  const [smsToComms, setSmsToComms] = useState(Boolean(staff.sms_comms_passthrough))
  const [appAccess, setAppAccess] = useState(Boolean(staff.app_access))
  const [employeePortal, setEmployeePortal] = useState(Boolean(staff.employee_portal))
  const [roleSlug, setRoleSlug] = useState(staff.role_slug ?? '')
  const [status, setStatus] = useState<'active' | 'disabled'>(staff.status === 'disabled' ? 'disabled' : 'active')
  const [error, setError] = useState<string | null>(null)

  // You can't disable/delete your own account (the backend rejects it too —
  // StaffController::update/destroy). Hide the controls so it isn't offered.
  const { accountId, role_slug: myRole } = usePermissions()
  const isSelf = !!accountId && staff.id === accountId
  // Only a company owner can issue an account-deletion code (backend enforces too).
  const iAmOwner = myRole === 'owner'

  const selectedRole = roles.find((r) => r.role_slug === roleSlug)
  const rolePermissionSet = useMemo(
    () => new Set(selectedRole?.permissions ?? []),
    [selectedRole?.permissions],
  )
  const totalPermissionCount = permissionCatalog.reduce((sum, g) => sum + g.items.length, 0)
  const isOwnerRole = roleSlug === 'owner'
  const [overridePermissions, setOverridePermissions] = useState(
    Boolean(staff.permission_override_enabled),
  )
  /**
   * Every permission key the server will accept — the catalog is built from
   * Permissions::ALL, so this is exactly the valid set.
   */
  const knownPermissionKeys = useMemo(
    () => new Set(permissionCatalog.flatMap((g) => g.items.map((i) => i.key))),
    [permissionCatalog],
  )

  /**
   * Seeded from what's STORED, filtered to what still exists.
   *
   * A role or override saved before a permission was renamed keeps the old
   * string. It can never render as a checkbox (the catalog only knows current
   * keys), so nobody can untick it — and it was sent straight back on save,
   * which the server rejected with "The selected permission_overrides.22 is
   * invalid." An invisible, unremovable key that blocked every save on the
   * record. Dropping it here also cleans the row the first time it is saved.
   */
  const [allowedPermissions, setAllowedPermissions] = useState<Set<string>>(
    () => new Set(
      (staff.permission_overrides ?? selectedRole?.permissions ?? [])
        .filter((k) => knownPermissionKeys.has(k)),
    ),
  )
  const [jobScopeOverride, setJobScopeOverride] = useState<'all' | 'own'>(
    staff.data_scope_overrides?.jobs ?? selectedRole?.data_scopes?.jobs ?? 'all',
  )

  const activePermissionSet = overridePermissions ? allowedPermissions : rolePermissionSet
  const togglePermission = (key: string) =>
    setAllowedPermissions((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  const setOverrideOn = (enabled: boolean) => {
    setOverridePermissions(enabled)
    if (enabled && !overridePermissions) {
      setAllowedPermissions(new Set((selectedRole?.permissions ?? []).filter((k) => knownPermissionKeys.has(k))))
      setJobScopeOverride(selectedRole?.data_scopes?.jobs ?? 'all')
    }
  }

  useEffect(() => {
    if (overridePermissions) return
    setAllowedPermissions(new Set((selectedRole?.permissions ?? []).filter((k) => knownPermissionKeys.has(k))))
    setJobScopeOverride(selectedRole?.data_scopes?.jobs ?? 'all')
  }, [overridePermissions, selectedRole?.permissions, selectedRole?.data_scopes?.jobs])

  // Dashboard widget access: null = all widgets allowed (no restriction).
  const [restrictWidgets, setRestrictWidgets] = useState(Array.isArray(staff.dashboard_widget_ids))
  const [allowedWidgets, setAllowedWidgets] = useState<Set<string>>(
    new Set(staff.dashboard_widget_ids ?? DASHBOARD_WIDGETS.map((w) => w.id)),
  )
  const toggleWidget = (id: string) =>
    setAllowedWidgets((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName || null,
        phone: phone.trim() || null,
        net2phone_number: net2phoneNumber.trim() || null,
        sms_comms_passthrough: smsToComms,
        app_access: appAccess,
        employee_portal: employeePortal,
        role_slug: roleSlug,
        status,
        dashboard_widget_ids: restrictWidgets ? Array.from(allowedWidgets) : null,
      }
      if (!isSelf) {
        body.permission_override_enabled = isOwnerRole ? false : overridePermissions
        body.permission_overrides = !isOwnerRole && overridePermissions ? Array.from(allowedPermissions) : null
        body.data_scope_overrides = !isOwnerRole && overridePermissions ? { jobs: jobScopeOverride } : null
      }
      return apiRequest<InviteResp & { invite: InviteResp['invite'] | null }>(`/v1/staff/${staff.id}`, {
        method: 'PATCH',
        body,
      })
    },
    // Opening the employee portal for crew sends their first invite; show
    // the same result card the invite flow uses so the link is on screen.
    onSuccess: (resp) => (resp.invite ? onResendInvite(resp as InviteResp) : onSaved()),
    onError: (e: Error) => setError(e.message),
  })

  const del = useMutation({
    mutationFn: () => apiRequest(`/v1/staff/${staff.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  })

  const resend = useMutation({
    mutationFn: () =>
      apiRequest<InviteResp>(`/v1/staff/${staff.id}/resend-invite`, { method: 'POST' }),
    onSuccess: onResendInvite,
    onError: (e: Error) => setError(e.message),
  })

  // Reset a locked-out crew member's 2FA (lost authenticator phone).
  const reset2fa = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { message: string } }>(`/v1/staff/${staff.id}/reset-2fa`, { method: 'POST' }),
    onSuccess: (r) => { setError(null); window.alert(r.data.message) },
    onError: (e: Error) => setError(e.message),
  })

  // Owner-authorized account-deletion code: the owner re-confirms with their
  // own password + 2FA, and we hand back a single-use code for the tech to
  // enter in the app to delete their account.
  const [showDeleteCode, setShowDeleteCode] = useState(false)
  const [dcPassword, setDcPassword] = useState('')
  const [dcTwoFactor, setDcTwoFactor] = useState('')
  const [dcResult, setDcResult] = useState<{ code: string; minutes: number } | null>(null)
  const issueCode = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { code: string; expires_in_minutes: number } }>(
        `/v1/staff/${staff.id}/deletion-code`,
        { method: 'POST', body: { password: dcPassword, two_factor_code: dcTwoFactor } },
      ),
    onSuccess: (r) => {
      setError(null)
      setDcResult({ code: r.data.code, minutes: r.data.expires_in_minutes })
      setDcPassword('')
      setDcTwoFactor('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const inputCls =
    'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500'

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Edit staff</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <code className="text-xs text-slate-600">{staff.email}</code>
            {staff.status === 'pending' && (
              <button
                type="button"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
                className="text-xs px-2.5 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {resend.isPending ? 'Sending…' : 'Resend invite'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Mobile phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Click-to-call rings this number first, then dials the customer.
            </p>
          </div>

          <Net2PhoneNumberSelect
            value={net2phoneNumber}
            onChange={setNet2phoneNumber}
            inputCls={inputCls}
          />

          {/* Two independent doors. A tech usually has both; office staff
              have neither and get the full app by role; crew can have the
              portal without the field app — a lighter first login. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-700 uppercase tracking-wide">Access</div>
            <label className="mt-2 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={appAccess}
                onChange={(e) => setAppAccess(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">Field app</span>
                <span className="block text-[11px] text-slate-500">Logs into the phone app, auto-clocks, can lead jobs.</span>
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={employeePortal}
                onChange={(e) => setEmployeePortal(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  Employee portal
                  <Link to={`/me?as=${staff.id}`} className="text-[11px] font-semibold text-amber-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                    View as them →
                  </Link>
                </span>
                <span className="block text-[11px] text-slate-500">
                  A light web view: today's jobs, tasks, time off, messages — nothing else. Lands there on sign-in.
                  {!staff.app_access && !staff.employee_portal && employeePortal && (
                    <span className="block mt-0.5 font-medium text-amber-700">
                      {staff.email ? 'Saving sends them an invite to set a password.' : 'Needs an email address first.'}
                    </span>
                  )}
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smsToComms}
                onChange={(e) => setSmsToComms(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">Texts also hit Comms &amp; Intake</span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1.5">
              This person's inbound texts to the business/intake line also appear in the customer inbox and run through AI intake — on top of their staff thread. Leave off for regular crew.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Role</label>
            <select value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className={inputCls}>
              {roles.map((r) => (
                <option key={r.role_slug} value={r.role_slug}>{r.display_name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {roles.find((r) => r.role_slug === roleSlug)?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Status</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="status" checked={status === 'active'} onChange={() => setStatus('active')} className="text-amber-600" />
                Active
              </label>
              {!isSelf && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="status" checked={status === 'disabled'} onChange={() => setStatus('disabled')} className="text-amber-600" />
                  Disabled (can&apos;t log in)
                </label>
              )}
            </div>
            {isSelf && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                You can&apos;t disable your own account — ask another owner/admin.
              </p>
            )}
          </div>

          <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Personal permissions
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Off = follows the selected role. On = this person&apos;s checked permissions override the role defaults.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={!isOwnerRole && overridePermissions}
                  disabled={isOwnerRole || isSelf}
                  onChange={(e) => setOverrideOn(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                />
                Override role
              </label>
            </div>

            {isOwnerRole ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Owner accounts always keep full access so the shop cannot be locked out.
              </div>
            ) : isSelf ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                You can&apos;t change your own personal permissions. Ask another owner.
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job visibility
                  </span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="personal-job-scope"
                      checked={(overridePermissions ? jobScopeOverride : selectedRole?.data_scopes?.jobs ?? 'all') === 'all'}
                      disabled={!overridePermissions || isSelf}
                      onChange={() => setJobScopeOverride('all')}
                      className="text-amber-600 disabled:opacity-50"
                    />
                    All jobs
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="personal-job-scope"
                      checked={(overridePermissions ? jobScopeOverride : selectedRole?.data_scopes?.jobs ?? 'all') === 'own'}
                      disabled={!overridePermissions || isSelf}
                      onChange={() => setJobScopeOverride('own')}
                      className="text-amber-600 disabled:opacity-50"
                    />
                    Own jobs only
                  </label>
                  <span className="text-xs text-slate-400">
                    {activePermissionSet.size} of {totalPermissionCount} permissions
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {permissionCatalog.map((group) => (
                    <div key={group.group} className="rounded-md border border-slate-200 bg-white">
                      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {permissionGroupLabel(group.group)}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.items.map((item) => (
                          <label
                            key={item.key}
                            className={[
                              'flex items-center gap-3 px-3 py-2 text-sm',
                              overridePermissions ? 'cursor-pointer hover:bg-amber-50' : 'text-slate-500',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={activePermissionSet.has(item.key)}
                              disabled={!overridePermissions || isSelf}
                              onChange={() => togglePermission(item.key)}
                              className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <StaffPayrollEditor staff={staff} />

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={restrictWidgets}
                onChange={(e) => setRestrictWidgets(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                Restrict dashboard widgets
              </span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1">
              Off = inherit this person&apos;s role default (Roles &amp; Permissions). On = only the ones you check below, overriding the role.
            </p>
            {restrictWidgets && (
              <div className="mt-2 border border-slate-200 rounded-md max-h-44 overflow-y-auto divide-y divide-slate-100">
                {DASHBOARD_WIDGETS.map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={allowedWidgets.has(w.id)}
                      onChange={() => toggleWidget(w.id)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-800">{w.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {iAmOwner && !isSelf && showDeleteCode && (
            <div className="border border-red-200 bg-red-50 rounded-md p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-red-800">Account deletion code for {staff.name}</div>
                <div className="text-xs text-red-700 mt-1">
                  This lets {staff.name} permanently delete their own account in the app. Confirm with
                  your owner password and authenticator (2FA) code, then give them the one-time code.
                </div>
              </div>
              {dcResult ? (
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">
                    Give this to {staff.name} — single use, expires in {dcResult.minutes} minutes:
                  </div>
                  <div className="font-mono text-lg font-bold tracking-widest text-slate-900 bg-white border border-slate-300 rounded px-3 py-2 text-center select-all">
                    {dcResult.code}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={dcPassword}
                    onChange={(e) => setDcPassword(e.target.value)}
                    placeholder="Your password"
                    className={inputCls}
                    autoComplete="current-password"
                  />
                  <input
                    type="text"
                    value={dcTwoFactor}
                    onChange={(e) => setDcTwoFactor(e.target.value)}
                    placeholder="Authenticator (2FA) code"
                    className={inputCls}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => issueCode.mutate()}
                    disabled={issueCode.isPending || !dcPassword.trim() || !dcTwoFactor.trim()}
                    className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 w-full"
                  >
                    {issueCode.isPending ? 'Verifying…' : 'Generate delete code'}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          {isSelf ? (
            <span />
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Disable ${staff.name}? They won't be able to log in.`)) del.mutate()
                }}
                disabled={del.isPending}
                className="text-xs px-3 py-2 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50 border border-red-200"
              >
                Disable
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Reset two-factor for ${staff.name}? They'll sign in with their password and set it up again.`)) reset2fa.mutate()
                }}
                disabled={reset2fa.isPending}
                className="text-xs px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50 border border-slate-300"
              >
                {reset2fa.isPending ? 'Resetting…' : 'Reset 2FA'}
              </button>
              {iAmOwner && (
                <button
                  type="button"
                  onClick={() => { setShowDeleteCode((v) => !v); setDcResult(null) }}
                  className="text-xs px-3 py-2 text-red-700 hover:bg-red-50 rounded-md border border-red-200"
                >
                  Delete code
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">Cancel</button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || !firstName.trim() || !roleSlug}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InviteResultModal({
  email,
  email_sent,
  email_error,
  accept_url,
  onClose,
}: {
  email: string
  email_sent: boolean
  email_error: string | null
  accept_url: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(accept_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-navy-900">Invite sent ✓</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {email_sent ? (
            <p className="text-sm text-slate-700">
              We emailed <code className="text-xs">{email}</code> a link to set their password.
            </p>
          ) : (
            <>
              <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 text-amber-900">
                Email wasn&apos;t sent. Share this link manually:
              </div>
              {email_error && (
                <p className="text-xs text-red-700 font-mono break-all">{email_error}</p>
              )}
            </>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Accept link</div>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 break-all">{accept_url}</code>
              <button
                type="button"
                onClick={copy}
                className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-white"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Link expires in 14 days. The account is in <strong>pending</strong> status until they set a password.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// -------- Scorecard panel --------

interface ScoreComponent {
  label: string
  value: number
}
interface ScoreCard {
  account_id: string
  name: string
  role: string
  kind: 'tech' | 'dispatch'
  score: number
  metrics: Record<string, number | null>
  components: ScoreComponent[]
}
interface ScorecardResp {
  data: ScoreCard[]
  window_days: number
}

const METRIC_LABELS: Record<string, string> = {
  jobs_completed: 'Jobs completed',
  avg_job_minutes: 'Avg time on job',
  photo_rate: 'Jobs with photos',
  note_rate: 'Jobs with notes',
  warranty_callbacks: 'Warranty callbacks',
  nudges: 'Nudges received',
  estimates_created: 'Estimates created',
  estimates_sent: 'Estimates sent',
  estimates_approved: 'Estimates approved',
  win_rate: 'Win rate',
  jobs_booked: 'Jobs booked',
  jobs_from_estimates: 'Jobs from estimates',
  booked_revenue_cents: 'Booked revenue',
  outbound_messages: 'Outbound messages',
}

function fmtMetric(key: string, v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (key === 'booked_revenue_cents') return '$' + Math.round(v / 100).toLocaleString()
  if (key === 'win_rate' || key === 'photo_rate' || key === 'note_rate') return `${Math.round(v * 100)}%`
  if (key === 'avg_job_minutes') {
    const h = Math.floor(v / 60)
    const m = v % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }
  return String(v)
}

function ScorecardPanel() {
  const [days, setDays] = useState(90)
  const q = useQuery({
    queryKey: ['scorecard', days],
    queryFn: () => apiRequest<ScorecardResp>(`/v1/scorecard?days=${days}`),
  })
  const cards = q.data?.data ?? []

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-slate-600 max-w-2xl">
          Role-aware performance over the window. <strong>Dispatch</strong> = estimate win-rate +
          jobs booked + responsiveness; <strong>field tech</strong> = workflow (photos/notes), job
          time, callbacks &amp; nudges. Dispatch booked-job metrics only count jobs created after
          this feature shipped.
        </p>
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                days === d ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {d === 365 ? '1y' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
          No staff to score yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => (
            <ScoreCardTile key={c.account_id} card={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreCardTile({ card }: { card: ScoreCard }) {
  const tone =
    card.score >= 80 ? 'text-emerald-600' : card.score >= 60 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-navy-900 truncate">{card.name}</div>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            {card.kind === 'tech' ? 'Field tech' : 'Dispatch'} · {card.role}
          </span>
        </div>
        <div className={`text-3xl font-bold ${tone}`}>{card.score}</div>
      </div>

      <div className="mt-3 space-y-1">
        {Object.entries(card.metrics).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <span className="text-slate-500">{METRIC_LABELS[k] ?? k}</span>
            <span className="text-slate-800 font-medium">{fmtMetric(k, v)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
        {card.components.map((comp) => (
          <span
            key={comp.label}
            className={[
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              comp.value < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600',
            ].join(' ')}
            title="Score component"
          >
            {comp.label} {comp.value >= 0 ? '+' : ''}
            {comp.value}
          </span>
        ))}
      </div>
    </div>
  )
}

// -------- Timesheet panel (geofence auto-clock log) --------

interface TimeClockRow {
  id: string
  account_id: string
  account_name: string
  work_order_id: string | null
  work_order: { id: string; display_number: string; title: string } | null
  clock_in_at: string | null
  clock_out_at: string | null
  minutes: number
  open: boolean
  source: string
}
interface TimeClockResp {
  data: TimeClockRow[]
}

function fmtHm(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h}h ${r}m` : `${r}m`
}

function TimesheetPanel() {
  const [days, setDays] = useState(7)
  const [showLog, setShowLog] = useState(false)
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const q = useQuery({
    queryKey: ['time-clock', days],
    queryFn: () => apiRequest<TimeClockResp>(`/v1/time-clock?from=${from}`),
    refetchInterval: 30000,
  })
  const rows = q.data?.data ?? []

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; totalMin: number; rows: TimeClockRow[] }>()
    for (const r of rows) {
      const g = map.get(r.account_id) ?? { id: r.account_id, name: r.account_name, totalMin: 0, rows: [] }
      g.totalMin += r.minutes
      g.rows.push(r)
      map.set(r.account_id, g)
    }
    return Array.from(map.values()).sort((a, b) => b.totalMin - a.totalMin)
  }, [rows])

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-slate-600 max-w-2xl">
          Auto clock-in/out from GPS geofence — a tech clocks in on jobsite arrival and out on
          departure (separate from check-in/out). Open shifts count up to now.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLog(true)}
            className="text-sm px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            + Log time
          </button>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={[
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  days === d ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
          No clock entries yet. Turn on <strong>Auto clock-in/out by GPS geofence</strong> in Company
          Preferences (techs auto-clock on jobsite arrival), or use <strong>+ Log time</strong> to add
          hours by hand — e.g. for crew with no app.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-semibold text-navy-900">{g.name}</span>
                <span className="text-sm font-semibold text-slate-700">{fmtHm(g.totalMin)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Job</th>
                    <th className="text-left px-4 py-2 font-medium">In</th>
                    <th className="text-left px-4 py-2 font-medium">Out</th>
                    <th className="text-right px-4 py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.rows.map((r) => {
                    const inAt = r.clock_in_at ? new Date(r.clock_in_at) : null
                    const outAt = r.clock_out_at ? new Date(r.clock_out_at) : null
                    const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-slate-600">{inAt ? inAt.toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-2 text-slate-700">
                          {r.work_order ? `${r.work_order.display_number} · ${r.work_order.title}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{inAt ? t(inAt) : '—'}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {outAt ? t(outAt) : <span className="text-emerald-600 font-medium">on site</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-slate-800">
                          {fmtHm(r.minutes)}
                          {r.open ? '+' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showLog && (
        <LogTimeModal
          onClose={() => setShowLog(false)}
          onSaved={() => { setShowLog(false); q.refetch() }}
        />
      )}
    </div>
  )
}

function LogTimeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const staffQ = useQuery({
    queryKey: ['staff', 'for-timelog'],
    queryFn: () => apiRequest<StaffIndexResp>('/v1/staff?per_page=200'),
  })
  const staff = staffQ.data?.data ?? []
  const [accountId, setAccountId] = useState('')
  const tenantTimezone = useTenantTimezone()
  const [date, setDate] = useState(() => tenantDate(tenantTimezone))

  useEffect(() => {
    setDate(tenantDate(tenantTimezone))
  }, [tenantTimezone])
  const [inTime, setInTime] = useState('08:00')
  const [outTime, setOutTime] = useState('17:00')
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500'

  const save = useMutation({
    mutationFn: () => {
      const clockIn = new Date(`${date}T${inTime}`)
      const clockOut = outTime ? new Date(`${date}T${outTime}`) : null
      return apiRequest('/v1/time-clock', {
        method: 'POST',
        body: {
          account_id: accountId,
          clock_in_at: clockIn.toISOString(),
          clock_out_at: clockOut ? clockOut.toISOString() : null,
        },
      })
    },
    onSuccess: () => onSaved(),
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Log time</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Employee</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.app_access ? '' : ' (crew)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Clock in</label>
              <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">Clock out</label>
              <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Manual entry for crew (or a tech) — flows into the timesheet + payroll like an auto-clock shift. Leave clock-out blank for an open shift.</p>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !accountId || !date || !inTime}
            className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Log time'}
          </button>
        </div>
      </div>
    </div>
  )
}
