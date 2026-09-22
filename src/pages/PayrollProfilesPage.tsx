import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
type WeeklyTimeSchedule = Record<DayKey, boolean[]>

type PayrollProfile = {
  id?: string
  account_id: string
  account: {
    id: string
    email: string
    name: string
    role_slug?: string | null
    status?: string | null
  } | null
  pay_type: 'hourly' | 'salary' | 'commission' | 'hybrid'
  hourly_rate_cents: number
  annual_salary_cents: number
  commission_percent: number
  commission_basis: 'paid_revenue' | 'gross_revenue' | 'gross_margin'
  parts_commission_percent: number
  parts_commission_max_parts_cents: number
  target_margin_percent: number | null
  standard_weekly_hours: number
  weekly_time_schedule: WeeklyTimeSchedule | Partial<WeeklyTimeSchedule> | null
  sick_days_per_quarter: number
  vacation_accrual_percent: number
  pto_hours_available: number
  sick_hours_available: number
  vacation_hours_available: number
  expense_reimbursement_enabled: boolean
  active: boolean
  notes?: string | null
}

type ProfileForm = {
  pay_type: PayrollProfile['pay_type']
  hourly_rate: string
  annual_salary: string
  commission_percent: string
  commission_basis: PayrollProfile['commission_basis']
  parts_commission_percent: string
  parts_commission_max_parts: string
  target_margin_percent: string
  standard_weekly_hours: string
  weekly_time_schedule: WeeklyTimeSchedule
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

const WEEK_DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const HOUR_SLOTS = Array.from({ length: 24 }, (_, hour) => hour)

function defaultWeeklyTimeSchedule(): WeeklyTimeSchedule {
  const schedule = Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, Array.from({ length: 24 }, () => false)])) as WeeklyTimeSchedule

  WEEK_DAYS.slice(0, 5).forEach(({ key }) => {
    for (let hour = 8; hour < 17; hour += 1) {
      schedule[key][hour] = true
    }
  })

  return schedule
}

function normalizeWeeklyTimeSchedule(schedule?: PayrollProfile['weekly_time_schedule']): WeeklyTimeSchedule {
  const fallback = defaultWeeklyTimeSchedule()
  if (!schedule || typeof schedule !== 'object') return fallback

  return Object.fromEntries(WEEK_DAYS.map(({ key }) => {
    const hours = Array.isArray(schedule[key]) ? schedule[key] ?? [] : []
    return [key, HOUR_SLOTS.map((hour) => Boolean(hours[hour]))]
  })) as WeeklyTimeSchedule
}

function scheduledWeeklyHours(schedule: WeeklyTimeSchedule): number {
  return WEEK_DAYS.reduce((total, { key }) => total + schedule[key].filter(Boolean).length, 0)
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a'
  if (hour < 12) return `${hour}a`
  if (hour === 12) return '12p'
  return `${hour - 12}p`
}

function withScheduleHour(schedule: WeeklyTimeSchedule, day: DayKey, hour: number, value: boolean): WeeklyTimeSchedule {
  return {
    ...schedule,
    [day]: schedule[day].map((active, index) => (index === hour ? value : active)),
  }
}

function schedulePreset(kind: 'clear' | 'weekdays_8_5' | 'everyday_8_5'): WeeklyTimeSchedule {
  const schedule = Object.fromEntries(WEEK_DAYS.map(({ key }) => [key, Array.from({ length: 24 }, () => false)])) as WeeklyTimeSchedule
  if (kind === 'clear') return schedule

  const days = kind === 'weekdays_8_5' ? WEEK_DAYS.slice(0, 5) : WEEK_DAYS
  days.forEach(({ key }) => {
    for (let hour = 8; hour < 17; hour += 1) {
      schedule[key][hour] = true
    }
  })

  return schedule
}
function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function dollarsToCents(value: string): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function numberValue(value: string): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function payrollHourlyEquivalent(form: ProfileForm): number {
  if (form.pay_type === 'hourly' || form.pay_type === 'hybrid') {
    return dollarsToCents(form.hourly_rate)
  }

  if (form.pay_type === 'salary') {
    const annualHours = Math.max(1, numberValue(form.standard_weekly_hours) * 52)
    return Math.round(dollarsToCents(form.annual_salary) / annualHours)
  }

  return 0
}

function calculatePayrollPreview(form: ProfileForm, inputs: PayrollCalculatorInputs) {
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

function formFromProfile(profile: PayrollProfile): ProfileForm {
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
    weekly_time_schedule: normalizeWeeklyTimeSchedule(profile.weekly_time_schedule),
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


function StaffTimeScheduleEditor({ schedule, onChange }: { schedule: WeeklyTimeSchedule; onChange: (schedule: WeeklyTimeSchedule) => void }) {
  const totalHours = scheduledWeeklyHours(schedule)

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Staff time schedule</div>
          <p className="mt-1 text-xs leading-5 text-slate-600">Set this staff member's expected work window, 7 days a week, hour by hour.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{totalHours}h / week</span>
          <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => onChange(schedulePreset('weekdays_8_5'))} type="button">
            Mon-Fri 8-5
          </button>
          <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => onChange(schedulePreset('everyday_8_5'))} type="button">
            7 days 8-5
          </button>
          <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => onChange(schedulePreset('clear'))} type="button">
            Clear
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-[76px_repeat(24,minmax(36px,1fr))] border-b border-slate-200 bg-slate-100 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <div className="px-2 py-2 text-left">Day</div>
            {HOUR_SLOTS.map((hour) => <div className="px-1 py-2" key={hour}>{formatHour(hour)}</div>)}
          </div>
          {WEEK_DAYS.map(({ key, label }) => (
            <div className="grid grid-cols-[76px_repeat(24,minmax(36px,1fr))] border-b border-slate-100 last:border-b-0" key={key}>
              <div className="flex items-center px-2 text-xs font-bold text-slate-700">{label}</div>
              {HOUR_SLOTS.map((hour) => {
                const active = Boolean(schedule[key][hour])
                return (
                  <button
                    aria-label={`${label} ${formatHour(hour)} ${active ? 'scheduled' : 'off'}`}
                    className={`m-0.5 h-8 rounded-sm border text-[10px] font-bold transition ${active ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:text-amber-700'}`}
                    key={`${key}-${hour}`}
                    onClick={() => onChange(withScheduleHour(schedule, key, hour, !active))}
                    type="button"
                  >
                    {active ? 'On' : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
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

export function PayrollProfilesPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [staffSearch, setStaffSearch] = useState('')
  const [payTypeView, setPayTypeView] = useState<'all' | PayrollProfile['pay_type']>('all')
  const [profileStatusView, setProfileStatusView] = useState<'all' | 'active' | 'inactive'>('all')
  const [activeEditorTab, setActiveEditorTab] = useState<'pay' | 'schedule'>('pay')
  const [form, setForm] = useState<ProfileForm | null>(null)
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

  const profiles = profilesQ.data?.data ?? []
  const requestedAccount = searchParams.get('account')
  const staffSearchText = staffSearch.trim().toLowerCase()
  const filteredProfiles = profiles.filter((profile) => {
    const searchable = [
      profile.account?.name,
      profile.account?.email,
      profile.account?.role_slug,
      profile.pay_type,
      profile.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (staffSearchText && !searchable.includes(staffSearchText)) return false
    if (payTypeView !== 'all' && profile.pay_type !== payTypeView) return false
    if (profileStatusView === 'active' && !profile.active) return false
    if (profileStatusView === 'inactive' && profile.active) return false
    return true
  })
  const selected =
    filteredProfiles.find((profile) => profile.account_id === (selectedId ?? requestedAccount)) ??
    filteredProfiles[0] ??
    null

  const saveProfile = useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: ProfileForm }) =>
      apiRequest<{ data: PayrollProfile }>(`/v1/payroll-profiles/${encodeURIComponent(accountId)}`, {
        method: 'PATCH',
        body: {
          pay_type: payload.pay_type,
          hourly_rate: Number(payload.hourly_rate || 0),
          annual_salary: Number(payload.annual_salary || 0),
          commission_percent: Number(payload.commission_percent || 0),
          commission_basis: payload.commission_basis,
          parts_commission_percent: Number(payload.parts_commission_percent || 0),
          parts_commission_max_parts: Number(payload.parts_commission_max_parts || 0),
          target_margin_percent: payload.target_margin_percent === '' ? null : Number(payload.target_margin_percent),
          standard_weekly_hours: Number(payload.standard_weekly_hours || 40),
          weekly_time_schedule: payload.weekly_time_schedule,
          sick_days_per_quarter: Number(payload.sick_days_per_quarter || 0),
          vacation_accrual_percent: Number(payload.vacation_accrual_percent || 0),
          pto_hours_available: Number(payload.pto_hours_available || 0),
          sick_hours_available: Number(payload.sick_hours_available || 0),
          vacation_hours_available: Number(payload.vacation_hours_available || 0),
          expense_reimbursement_enabled: payload.expense_reimbursement_enabled,
          active: payload.active,
          notes: payload.notes || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-profiles'] })
    },
  })

  const editorForm = form ?? (selected ? formFromProfile(selected) : null)
  const calculatorPreview = editorForm ? calculatePayrollPreview(editorForm, calculator) : null

  function choose(profile: PayrollProfile) {
    setSelectedId(profile.account_id)
    setActiveEditorTab('pay')
    setForm(formFromProfile(profile))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || !editorForm) return
    saveProfile.mutate({ accountId: selected.account_id, payload: editorForm })
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 sm:px-6 sm:py-6 2xl:px-8">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Accounting</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Payroll Profiles</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Set how each technician is paid so Accounting can calculate labor cost, commission, PTO, reimbursement, and tech profitability.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" to="/accounting/payroll">
              Payroll workspace
            </Link>
            <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm" to="/accounting/reports">
              Tech reports
            </Link>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-bold">Staff</h2>
              <p className="text-sm text-slate-500">Select a staff member to edit pay rules.</p>
              <div className="mt-4 space-y-2">
                <input
                  type="search"
                  value={staffSearch}
                  onChange={(event) => {
                    setStaffSearch(event.target.value)
                    setSelectedId(null)
                    setForm(null)
                  }}
                  placeholder="Search name, email, role..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={payTypeView}
                    onChange={(event) => {
                      setPayTypeView(event.target.value as 'all' | PayrollProfile['pay_type'])
                      setSelectedId(null)
                      setForm(null)
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All pay types</option>
                    <option value="hourly">Hourly</option>
                    <option value="salary">Salary</option>
                    <option value="commission">Commission</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                  <select
                    value={profileStatusView}
                    onChange={(event) => {
                      setProfileStatusView(event.target.value as 'all' | 'active' | 'inactive')
                      setSelectedId(null)
                      setForm(null)
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All profiles</option>
                    <option value="active">Included</option>
                    <option value="inactive">Excluded</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {profilesQ.isLoading ? (
                <div className="p-4 text-sm text-slate-500">Loading staff...</div>
              ) : profiles.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No staff accounts found.</div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No staff match these payroll filters.</div>
              ) : filteredProfiles.map((profile) => {
                const active = selected?.account_id === profile.account_id
                return (
                  <button
                    className={`block w-full px-4 py-3 text-left transition ${active ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                    key={profile.account_id}
                    onClick={() => choose(profile)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold">{profile.account?.name ?? profile.account?.email ?? profile.account_id}</div>
                        <div className="text-xs text-slate-500">{profile.account?.role_slug ?? 'staff'} · {profile.pay_type}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${profile.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {profile.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {!selected || !editorForm ? (
              <div className="p-8 text-center text-slate-500">Select staff to edit payroll settings.</div>
            ) : (
              <form onSubmit={submit}>
                <div className="border-b border-slate-200 p-4">
                  <h2 className="text-xl font-black">{selected.account?.name ?? selected.account?.email ?? 'Staff member'}</h2>
                  <p className="text-sm text-slate-500">
                    Current rate: {money(selected.hourly_rate_cents)}/hr · Salary {money(selected.annual_salary_cents)} · {selected.commission_percent}% commission · {selected.parts_commission_percent ?? 0}% parts commission
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-bold ${activeEditorTab === 'pay' ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => setActiveEditorTab('pay')}
                      type="button"
                    >
                      Pay rules
                    </button>
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-bold ${activeEditorTab === 'schedule' ? 'bg-slate-950 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => setActiveEditorTab('schedule')}
                      type="button"
                    >
                      Work schedule
                    </button>
                  </div>
                </div>

                {activeEditorTab === 'pay' ? (
                  <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Pay type
                    <select className="rounded-md border border-slate-300 px-3 py-2" value={editorForm.pay_type} onChange={(e) => setForm({ ...editorForm, pay_type: e.target.value as PayrollProfile['pay_type'] })}>
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary</option>
                      <option value="commission">Commission</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Hourly rate
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.hourly_rate} onChange={(e) => setForm({ ...editorForm, hourly_rate: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Annual salary
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.annual_salary} onChange={(e) => setForm({ ...editorForm, annual_salary: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Commission %
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.commission_percent} onChange={(e) => setForm({ ...editorForm, commission_percent: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Commission basis
                    <select className="rounded-md border border-slate-300 px-3 py-2" value={editorForm.commission_basis} onChange={(e) => setForm({ ...editorForm, commission_basis: e.target.value as PayrollProfile['commission_basis'] })}>
                      <option value="paid_revenue">Paid revenue</option>
                      <option value="gross_revenue">Gross revenue</option>
                      <option value="gross_margin">Gross margin</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Target margin %
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.target_margin_percent} onChange={(e) => setForm({ ...editorForm, target_margin_percent: e.target.value })} />
                  </label>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2 xl:col-span-3">
                    <div className="text-sm font-bold text-slate-900">Parts commission rule</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Optional per-tech rule. Example: salary plus parts commission only when a job&apos;s parts cost is under $500.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-sm font-semibold text-slate-700">
                        Parts commission %
                        <input
                          className="rounded-md border border-slate-300 bg-white px-3 py-2"
                          inputMode="decimal"
                          value={editorForm.parts_commission_percent}
                          onChange={(e) => setForm({ ...editorForm, parts_commission_percent: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-semibold text-slate-700">
                        Only if parts are at or below
                        <input
                          className="rounded-md border border-slate-300 bg-white px-3 py-2"
                          inputMode="decimal"
                          placeholder="500"
                          value={editorForm.parts_commission_max_parts}
                          onChange={(e) => setForm({ ...editorForm, parts_commission_max_parts: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Weekly hours
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.standard_weekly_hours} onChange={(e) => setForm({ ...editorForm, standard_weekly_hours: e.target.value })} />
                  </label>

                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Sick days / quarter
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.sick_days_per_quarter} onChange={(e) => setForm({ ...editorForm, sick_days_per_quarter: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Vacation accrual %
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.vacation_accrual_percent} onChange={(e) => setForm({ ...editorForm, vacation_accrual_percent: e.target.value })} />
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2 xl:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">Tech calculator</div>
                        <p className="mt-1 text-xs">
                          Test this pay rule before saving. Parts commission honors the cap above.
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        Sick {Number(editorForm.sick_days_per_quarter || 0).toFixed(2)} days / quarter · Vacation {Number(editorForm.vacation_accrual_percent || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-5">
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Hours
                        <input className="rounded-md border border-slate-300 bg-white px-3 py-2" inputMode="decimal" value={calculator.hours} onChange={(e) => setCalculator({ ...calculator, hours: e.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Revenue
                        <input className="rounded-md border border-slate-300 bg-white px-3 py-2" inputMode="decimal" value={calculator.revenue} onChange={(e) => setCalculator({ ...calculator, revenue: e.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Paid
                        <input className="rounded-md border border-slate-300 bg-white px-3 py-2" inputMode="decimal" value={calculator.paid} onChange={(e) => setCalculator({ ...calculator, paid: e.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Gross margin
                        <input className="rounded-md border border-slate-300 bg-white px-3 py-2" inputMode="decimal" value={calculator.grossMargin} onChange={(e) => setCalculator({ ...calculator, grossMargin: e.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Parts cost
                        <input className="rounded-md border border-slate-300 bg-white px-3 py-2" inputMode="decimal" value={calculator.partsCost} onChange={(e) => setCalculator({ ...calculator, partsCost: e.target.value })} />
                      </label>
                    </div>
                    {calculatorPreview && (
                      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                        <PayrollPreviewMetric label="Labor" value={money(calculatorPreview.laborCost)} />
                        <PayrollPreviewMetric label="Commission" value={money(calculatorPreview.commissionCost)} />
                        <PayrollPreviewMetric label="Parts commission" value={money(calculatorPreview.partsCommissionCost)} />
                        <PayrollPreviewMetric label="Sick earned" value={`${calculatorPreview.sickHours}h`} />
                        <PayrollPreviewMetric label="Vacation" value={`${calculatorPreview.vacationHours}h / ${money(calculatorPreview.vacationAccrual)}`} />
                        <PayrollPreviewMetric label="Total payroll" value={money(calculatorPreview.totalPayrollCost)} strong />
                      </div>
                    )}
                  </div>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    PTO hours
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.pto_hours_available} onChange={(e) => setForm({ ...editorForm, pto_hours_available: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Sick hours
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.sick_hours_available} onChange={(e) => setForm({ ...editorForm, sick_hours_available: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Vacation hours
                    <input className="rounded-md border border-slate-300 px-3 py-2" inputMode="decimal" value={editorForm.vacation_hours_available} onChange={(e) => setForm({ ...editorForm, vacation_hours_available: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={editorForm.expense_reimbursement_enabled} onChange={(e) => setForm({ ...editorForm, expense_reimbursement_enabled: e.target.checked })} />
                    Reimburse expenses
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={editorForm.active} onChange={(e) => setForm({ ...editorForm, active: e.target.checked })} />
                    Include in payroll reports
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
                    Notes
                    <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" value={editorForm.notes} onChange={(e) => setForm({ ...editorForm, notes: e.target.value })} />
                  </label>
                  </div>
                ) : (
                  <div className="p-4">
                    <StaffTimeScheduleEditor
                      schedule={editorForm.weekly_time_schedule}
                      onChange={(nextSchedule) => setForm({
                        ...editorForm,
                        weekly_time_schedule: nextSchedule,
                        standard_weekly_hours: String(scheduledWeeklyHours(nextSchedule)),
                      })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Changes affect future payroll and profitability reports.</p>
                  <button className="rounded-md bg-slate-950 px-5 py-2 font-bold text-white disabled:opacity-60" disabled={saveProfile.isPending}>
                    {saveProfile.isPending ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
