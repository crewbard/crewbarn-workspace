import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import { JobRemindersManager } from '@/components/settings/JobRemindersManager'
import { SettingsSectionNav, settingsSectionFromHash, updateSettingsSectionHash } from '@/components/settings/SettingsSectionNav'
import { DeletePermissionsPage } from '@/pages/DeletePermissionsPage'

/**
 * Tool Shed → General → Company Preferences.
 *
 * Shop-wide defaults distinct from "info":
 *   - Outbound sender echo (from email + SMS number — edited on
 *     /tool-shed/communication)
 *   - Auto-numbering starting points for the 5 record types that hand
 *     out sequential numbers (customers, work orders, estimates,
 *     invoices, POs)
 */

interface Payload {
  from_email_name: string | null
  from_email_address: string | null
  from_sms_number: string | null
  next_customer_account_number: number | null
  next_work_order_number: number | null
  next_estimate_number: number | null
  next_invoice_number: number | null
  next_po_number: number | null
  dormant_tech_nudge_enabled: boolean
  dormant_require_notes_enabled: boolean
  dormant_days: number
  dormant_max_nudges_per_job: number
  max_video_clip_seconds: number
  /** Backup-code methods the team may enroll. Empty/absent = all three. */
  two_factor_allowed_methods?: Array<'totp' | 'sms' | 'email'>
  cod_force_collection_enabled: boolean
  geofence_auto_clock_enabled: boolean
  job_reminders_enabled: boolean
  reminder_quiet_start: string | null
  reminder_quiet_end: string | null
  geofence_auto_checkin_enabled: boolean
  geofence_dwell_minutes: number
  geofence_early_checkin_minutes: number
  geofence_left_site_reminder_minutes: number
  geofence_dispatcher_alert_minutes: number
  geofence_strict_mode: boolean
  geofence_require_note_outside_m: number
  geofence_late_arrival_lead_minutes: number
  geofence_late_arrival_threshold_minutes: number
  intake_requirements: Record<string, boolean>
}

// Tenant intake workflow default and optional required fields. Keys match
// TenantPreferencesController::INTAKE_KEYS.
const INTAKE_REQS: { key: string; label: string; hint: string }[] = [
  { key: 'guided_default', label: 'Default to step-by-step intake', hint: 'New users start with one complete work area at a time. Each dispatcher can still switch to full-page entry.' },
  { key: 'estimate_location', label: 'Require a service location on estimates', hint: 'Estimates normally allow a phone quote with no location. Turn on to require one.' },
  { key: 'schedule', label: 'Require a schedule on new jobs', hint: 'Force a date/time when creating a job instead of leaving it unscheduled.' },
  { key: 'lead_tech', label: 'Require a crew/tech on new jobs', hint: 'Force assigning a crew (or lead tech) at creation.' },
  { key: 'description', label: 'Require a description / scope', hint: 'Force a description on new jobs and estimates.' },
]

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono'

type PreferenceSection = 'sender' | 'numbering' | 'field-rules' | 'intake' | 'reminders' | 'gps' | 'team-security' | 'delete-permissions'

const preferenceSections = [
  { id: 'sender', label: 'Outbound sender', description: 'Customer-facing email and SMS identity', group: 'Communication' },
  { id: 'numbering', label: 'Auto-numbering', description: 'Next customer, job, estimate, invoice, and PO numbers', group: 'Records' },
  { id: 'field-rules', label: 'Field rules', description: 'Dormant jobs, video, security, and collection rules', group: 'Workflows' },
  { id: 'intake', label: 'Job intake', description: 'Required fields and default entry mode', group: 'Workflows' },
  { id: 'reminders', label: 'Appointment reminders', description: 'Timing rules and quiet hours', group: 'Workflows' },
  { id: 'gps', label: 'GPS check-in', description: 'Geofence automation and alerts', group: 'Field operations' },
  // Shop rules is where the owner sets policy, so team-wide security policy
  // belongs here rather than on My Security — that page is for a person
  // enrolling their OWN 2FA, which is a different decision by a different
  // someone.
  { id: 'team-security', label: 'Team security', description: 'Which two-factor methods your team may use', group: 'Security' },
  { id: 'delete-permissions', label: 'Delete permissions', description: 'Who can delete records and how they confirm it', group: 'Security' },
] satisfies Array<{ id: PreferenceSection; label: string; description: string; group: string }>

/** Backup-code methods a tenant can allow. Push-to-approve is always on. */
const TWO_FACTOR_METHODS = [
  { id: 'totp', label: 'Authenticator app', hint: 'Most secure, works offline (Google Authenticator, Authy, 1Password).' },
  { id: 'email', label: 'Email codes', hint: 'A code emailed at each sign-in. Everyone has an email.' },
  { id: 'sms', label: 'Text codes', hint: 'A code texted at each sign-in. Needs a mobile number on file.' },
] as const
const NUMBER_FIELDS: { key: keyof Payload; label: string; hint: string }[] = [
  {
    key: 'next_customer_account_number',
    label: 'Customer account #',
    hint: 'Next account number assigned to a new customer.',
  },
  {
    key: 'next_work_order_number',
    label: 'Work order #',
    hint: 'Next WO number assigned when a job is created.',
  },
  {
    key: 'next_estimate_number',
    label: 'Estimate #',
    hint: 'Next estimate number issued to a customer-facing quote.',
  },
  {
    key: 'next_invoice_number',
    label: 'Invoice #',
    hint: 'Next invoice number issued at billing.',
  },
  {
    key: 'next_po_number',
    label: 'Purchase order #',
    hint: 'Next PO number generated for vendor orders.',
  },
]

export function SettingsPreferencesPage() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['tenant-preferences'],
    queryFn: () => apiRequest<{ data: Payload }>('/v1/tenant-settings/preferences'),
  })

  const [form, setForm] = useState<Payload | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [activeSection, setActiveSection] = useState<PreferenceSection>(() => settingsSectionFromHash(preferenceSections, 'sender'))

  useEffect(() => {
    if (query.data && form === null) setForm(query.data.data)
  }, [query.data, form])


  const save = useMutation({
    mutationFn: (payload: Partial<Payload>) =>
      apiRequest<{ data: Payload }>('/v1/tenant-settings/preferences', {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: (res) => {
      qc.setQueryData(['tenant-preferences'], res)
      setForm(res.data)
      setSavedAt(new Date())
    },
  })

  const original = query.data?.data
  const dirty = useMemo(() => {
    if (!form || !original) return false
    return NUMBER_FIELDS.some((f) => form[f.key] !== original[f.key])
  }, [form, original])

  if (!form) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-500">Loading…</div>
    )
  }

  const handleSave = () => {
    if (!form || !original) return
    const payload: Record<string, number> = {}
    for (const f of NUMBER_FIELDS) {
      if (form[f.key] !== original[f.key]) {
        const val = form[f.key]
        if (typeof val === 'number' && val >= 1) {
          payload[f.key] = val
        }
      }
    }
    if (Object.keys(payload).length > 0) save.mutate(payload as Partial<Payload>)
  }

  const goingBackwards = NUMBER_FIELDS.some((f) => {
    const next = form[f.key]
    const cur = original?.[f.key]
    return typeof next === 'number' && typeof cur === 'number' && next < cur
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">
          Shop-wide defaults — the sender info your customers see, plus the
          starting points for every auto-assigned record number.
        </p>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <SettingsSectionNav
          active={activeSection}
          items={preferenceSections}
          onSelect={(section) => {
            setActiveSection(section)
            updateSettingsSectionHash(section)
          }}
          title="Preference settings"
        />
        <main className="min-w-0 space-y-6">

      {/* Sender — read-only here */}
      {activeSection === 'sender' && (
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-900">Outbound sender</h2>
          <Link
            to="/tool-shed/communication"
            className="text-xs text-amber-700 hover:underline font-semibold"
          >
            Configure phone, SMS & email →
          </Link>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          What customers see in the "from" field on outbound email and SMS.
          Managed on the Phone, SMS & Email page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              From email name
            </div>
            <div className="text-sm text-slate-900">
              {form.from_email_name || <span className="text-slate-400 italic">Not set</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              From email address
            </div>
            <div className="text-sm font-mono text-slate-900 break-all">
              {form.from_email_address || <span className="text-slate-400 italic">Not set</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              From SMS number
            </div>
            <div className="text-sm font-mono text-slate-900">
              {form.from_sms_number || <span className="text-slate-400 italic">Not set</span>}
            </div>
          </div>
        </div>
      </section>

      )}

      {/* Auto-numbering */}
      {activeSection === 'numbering' && (
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Auto-numbering</h2>
        <p className="text-xs text-slate-500 mb-4">
          The very next number that'll be handed out to each kind of record.
          Increment automatically as records are created.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NUMBER_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-700 mb-1">{f.label}</label>
              <input
                type="number"
                min={1}
                value={(form[f.key] as number | null) ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.key]: e.target.value === '' ? null : parseInt(e.target.value, 10),
                  })
                }
                className={inputCls}
              />
              <p className="text-[11px] text-slate-500 mt-1">{f.hint}</p>
            </div>
          ))}
        </div>

        {goingBackwards && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
            ⚠ You're setting a numbering value <strong>lower</strong> than the
            current next. This can produce duplicate numbers if you've already
            issued records past the new value. We allow it — but make sure you
            know why.
          </div>
        )}
      </section>

      )}

      {/* Field rules & automation — dormant-job handling. Each toggle
          saves immediately (independent of the numbering save bar). */}
      {activeSection === 'field-rules' && (
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Field rules & automation</h2>
        <p className="text-xs text-slate-500 mb-4">
          Dormant = an open/in-progress job with no update in{' '}
          <strong>{form.dormant_days}</strong> day{form.dormant_days === 1 ? '' : 's'}. Everything here
          is off by default.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs font-medium text-slate-700">Dormant after</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.dormant_days}
            onChange={(e) => setForm({ ...form, dormant_days: parseInt(e.target.value, 10) || 1 })}
            onBlur={() => save.mutate({ dormant_days: form.dormant_days } as Partial<Payload>)}
            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-500">days</span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs font-medium text-slate-700">Max video clip length</label>
          <input
            type="number"
            min={5}
            max={300}
            value={form.max_video_clip_seconds}
            onChange={(e) => setForm({ ...form, max_video_clip_seconds: parseInt(e.target.value, 10) || 30 })}
            onBlur={() => save.mutate({ max_video_clip_seconds: form.max_video_clip_seconds } as Partial<Payload>)}
            className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-500">sec — caps BarnCam recording &amp; gallery clips in the field app</span>
        </div>

        {/* Removed: a "Two-factor login (staff, web)" Off/Optional/Required
            select. two_factor_policy had NO backend consumer — the control
            wrote a column nothing read, and it displayed "Off" while 2FA was
            in fact mandatory for every web sign-in. Team 2FA is now the
            Team security section of this page.

            Removed: a "Surface dormant jobs to the office" toggle.
            dormant_alerts_enabled had no consumer either; dormant jobs surface
            unconditionally, so the switch could not turn anything off. */}

        <div className="divide-y divide-slate-100">
          <ToggleRow
            label="Auto-text the assigned tech"
            hint="Message the lead tech “what's the hold-up?” when their job goes dormant."
            checked={form.dormant_tech_nudge_enabled}
            onChange={(v) => { setForm({ ...form, dormant_tech_nudge_enabled: v }); save.mutate({ dormant_tech_nudge_enabled: v } as Partial<Payload>) }}
          />
          {/* Max nudges per job — only shown when the nudge rule is on. */}
          {form.dormant_tech_nudge_enabled && (
            <div className="flex items-center gap-2 py-3 pl-4">
              <label className="text-xs font-medium text-slate-700">Max nudges per job</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.dormant_max_nudges_per_job}
                onChange={(e) => setForm({ ...form, dormant_max_nudges_per_job: parseInt(e.target.value, 10) || 1 })}
                onBlur={() => save.mutate({ dormant_max_nudges_per_job: form.dormant_max_nudges_per_job } as Partial<Payload>)}
                className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-500">then stop reminding</span>
            </div>
          )}
          <ToggleRow
            label="Require a note before working a dormant job"
            hint="Block the job in the tech app until they log an update on what's going on."
            checked={form.dormant_require_notes_enabled}
            onChange={(v) => { setForm({ ...form, dormant_require_notes_enabled: v }); save.mutate({ dormant_require_notes_enabled: v } as Partial<Payload>) }}
          />
          <ToggleRow
            label="Force COD collection before the next job"
            hint="COD customers only — tech must collect payment before moving on."
            checked={form.cod_force_collection_enabled}
            onChange={(v) => { setForm({ ...form, cod_force_collection_enabled: v }); save.mutate({ cod_force_collection_enabled: v } as Partial<Payload>) }}
          />
          <ToggleRow
            label="Auto clock-in/out by GPS geofence"
            hint="Auto-clock a tech in when their phone arrives at a scheduled jobsite and out when they leave (separate from check-in/out). Turning this ON enables it for ALL crew — turn individuals off in Staff & Crews."
            checked={form.geofence_auto_clock_enabled}
            onChange={(v) => { setForm({ ...form, geofence_auto_clock_enabled: v }); save.mutate({ geofence_auto_clock_enabled: v } as Partial<Payload>) }}
          />
        </div>
      </section>

      )}

      {/* Intake requirements — which optional create-form fields to require.
          Each toggle saves immediately. Off by default = fast intake. */}
      {activeSection === 'intake' && (
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">New job / estimate intake</h2>
        <p className="text-xs text-slate-500 mb-4">
          Choose the default intake workflow and what your shop must collect
          before a record can be saved. Customer, title, job type, and starting
          status are always visible and required.
        </p>
        <div className="divide-y divide-slate-100">
          {INTAKE_REQS.map((r) => (
            <ToggleRow
              key={r.key}
              label={r.label}
              hint={r.hint}
              checked={!!form.intake_requirements?.[r.key]}
              onChange={(v) => {
                const next = { ...(form.intake_requirements ?? {}), [r.key]: v }
                setForm({ ...form, intake_requirements: next })
                save.mutate({ intake_requirements: next } as Partial<Payload>)
              }}
            />
          ))}
        </div>
      </section>

      )}

      {/* Appointment reminders — master toggle + per-rule manager. */}
      {activeSection === 'reminders' && (
      <section id="reminders" className="scroll-mt-24 bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Appointment reminders</h2>
        <p className="text-xs text-slate-500 mb-4">
          Automatically remind techs and customers around a scheduled job —
          before it starts, if it&apos;s running late, and (with GPS) when the
          tech is on the way. Flip it on, then add the reminders you want below.
        </p>
        <div className="divide-y divide-slate-100">
          <ToggleRow
            label="Enable appointment reminders"
            hint="Master switch. When off, nothing is sent regardless of the rules below."
            checked={form.job_reminders_enabled}
            onChange={(v) => { setForm({ ...form, job_reminders_enabled: v }); save.mutate({ job_reminders_enabled: v } as Partial<Payload>) }}
          />
        </div>
        {form.job_reminders_enabled && (
          <>
            {/* Quiet hours — customer reminders are held back inside this local
                window (overnight windows like 21:00→08:00 are fine). Blank = none. */}
            <div className="mt-4 flex flex-wrap items-end gap-3 text-xs text-slate-600">
              <div>
                <span className="block mb-1">Quiet hours start</span>
                <input
                  type="time"
                  value={form.reminder_quiet_start ?? ''}
                  onChange={(e) => setForm({ ...form, reminder_quiet_start: e.target.value || null })}
                  onBlur={() => save.mutate({ reminder_quiet_start: form.reminder_quiet_start } as Partial<Payload>)}
                  className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <span className="block mb-1">Quiet hours end</span>
                <input
                  type="time"
                  value={form.reminder_quiet_end ?? ''}
                  onChange={(e) => setForm({ ...form, reminder_quiet_end: e.target.value || null })}
                  onBlur={() => save.mutate({ reminder_quiet_end: form.reminder_quiet_end } as Partial<Payload>)}
                  className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <span className="text-[11px] text-slate-400 pb-2">
                Customer reminders only — tech/dispatch alerts always send.
              </span>
            </div>
            <div className="mt-4">
              <JobRemindersManager />
            </div>
          </>
        )}
      </section>

      )}

      {/* Field check-in (GPS geofence) — visit lifecycle. Advisory by default. */}
      {activeSection === 'gps' && (
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Field check-in (GPS)</h2>
        <p className="text-xs text-slate-500 mb-4">
          Use the assigned tech&apos;s location to ease check-in/out and flag jobs
          that need attention — without punishing weak GPS. Leaving a site never
          auto-closes a job; it just raises a &quot;checkout needed&quot; flag.
        </p>
        <div className="divide-y divide-slate-100">
          <ToggleRow
            label="Auto check-in by GPS geofence"
            hint="When the assigned tech sits inside the jobsite radius for the dwell time (and the job starts soon), check them in automatically. They can undo."
            checked={form.geofence_auto_checkin_enabled}
            onChange={(v) => { setForm({ ...form, geofence_auto_checkin_enabled: v }); save.mutate({ geofence_auto_checkin_enabled: v } as Partial<Payload>) }}
          />
          <ToggleRow
            label="Strict mode (block outside-geofence check-in)"
            hint="Off (recommended): techs can check in from outside the radius but must add a note. On: outside check-in is blocked without a dispatcher override."
            checked={form.geofence_strict_mode}
            onChange={(v) => { setForm({ ...form, geofence_strict_mode: v }); save.mutate({ geofence_strict_mode: v } as Partial<Payload>) }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          {([
            { key: 'geofence_dwell_minutes', label: 'Dwell (min)', hint: 'Minutes inside the radius before auto check-in.' },
            { key: 'geofence_early_checkin_minutes', label: 'Early window (min)', hint: 'How early before start auto check-in is allowed.' },
            { key: 'geofence_left_site_reminder_minutes', label: 'Left-site reminder (min)', hint: 'Delay before reminding a tech who left with an open visit.' },
            { key: 'geofence_dispatcher_alert_minutes', label: 'Dispatcher alert (min)', hint: 'Further delay before alerting dispatch.' },
            { key: 'geofence_require_note_outside_m', label: 'Note beyond (m)', hint: 'Require a note when checking in farther than this from the site.' },
            { key: 'geofence_late_arrival_lead_minutes', label: 'Late watch (min)', hint: 'How soon before start to start watching for a late arrival.' },
            { key: 'geofence_late_arrival_threshold_minutes', label: 'Late grace (min)', hint: 'Alert dispatch when the tech’s ETA is this many minutes past the start.' },
          ] as { key: keyof Payload; label: string; hint: string }[]).map((f) => (
            <label key={f.key} className="text-xs text-slate-600" title={f.hint}>
              <span className="block mb-1">{f.label}</span>
              <input
                type="number"
                min={0}
                value={form[f.key] as number}
                onChange={(e) => setForm({ ...form, [f.key]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                onBlur={() => save.mutate({ [f.key]: form[f.key] } as Partial<Payload>)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
              />
            </label>
          ))}
        </div>
      </section>

      )}

      {activeSection === 'team-security' && (
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Team two-factor</h2>
        <p className="text-xs text-slate-500 mb-4">
          Two-factor is on for everyone who signs in on the web or desktop — it can&apos;t be turned
          off. (The phone app is unaffected.) Approve-on-phone is always available; choose which{' '}
          <span className="font-medium">backup code</span> methods your team may set up.
        </p>

        <div className="space-y-3">
          {TWO_FACTOR_METHODS.map((opt) => {
            const allowed = form.two_factor_allowed_methods ?? ['totp', 'sms', 'email']
            const on = allowed.includes(opt.id)
            // Push-to-approve alone is no help on a lost phone, and the server
            // reads an empty list as "all" — so the last one on stays on.
            const isLastOn = on && allowed.length === 1
            return (
              <label key={opt.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={isLastOn}
                  title={isLastOn ? 'Keep at least one method enabled.' : undefined}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...new Set([...allowed, opt.id])]
                      : allowed.filter((m) => m !== opt.id)
                    if (next.length === 0) return
                    setForm({ ...form, two_factor_allowed_methods: next })
                    save.mutate({ two_factor_allowed_methods: next } as Partial<Payload>)
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-500 disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{opt.label}</span>
                  <span className="block text-xs text-slate-500">{opt.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          A method you turn off here can&apos;t be chosen by staff who haven&apos;t set up 2FA yet.
          Anyone already using it keeps working until they switch. Each person picks their own
          method under My Security.
        </p>

      </section>
      )}

      {activeSection === 'delete-permissions' && (
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Delete permissions</h2>
        <p className="text-xs text-slate-500 mb-4">
          Who can delete company records, and what they have to do to confirm it.
          Owner-only to change; enforced server-side, not just hidden here.
        </p>
        {/* The whole editor, reused. It fetches and saves against its own
            owner-gated endpoint, so embedding it keeps one implementation
            rather than a second copy that drifts. */}
        <DeletePermissionsPage embedded />
      </section>
      )}

      {/* Sticky save bar */}
      <div
        className={[
          'sticky bottom-4 mx-auto bg-white border rounded-xl px-5 py-3 shadow-sm flex items-center justify-between',
          dirty ? 'border-amber-200 bg-amber-50' : 'border-slate-200',
        ].join(' ')}
      >
        <div className="text-xs text-slate-500">
          {save.isError ? (
            <span className="text-red-700">{(save.error as Error).message}</span>
          ) : savedAt && !dirty ? (
            <span className="text-emerald-700">✓ Saved {savedAt.toLocaleTimeString()}</span>
          ) : dirty ? (
            'Unsaved changes'
          ) : (
            'Up to date'
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(original ?? form)}
              disabled={save.isPending}
              className="text-sm px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || save.isPending}
            className="text-sm px-4 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
        </main>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-amber-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
