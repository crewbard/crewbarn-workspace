import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import {
  toHexColor,
  STATUS_COLOR_PRESETS,
  STATUS_COLOR_FALLBACK,
  statusBackground,
  getRecentColors,
  pushRecentColor,
} from '@/lib/statusColor'
import { JobStatusTransitionsManager } from '@/components/settings/JobStatusTransitionsManager'
import { STATUS_ICON_NAMES, StatusIcon } from '@/lib/statusIcons'

/**
 * /tool-shed/job-statuses
 *
 * Per-tenant lifecycle states for work orders + the automation
 * triggers that fire when a job moves into each one.
 *
 * Two layers in one page:
 *   1. Statuses — name, color, category, reorder, defaults
 *   2. Triggers per status — "send invoice email when status =
 *      Invoiced", "render work order doc when status = Complete", etc.
 */

type FieldAction = 'travel' | 'arrive' | 'return_needed' | 'complete' | 'cancel'

interface JobStatus {
  id: string
  name: string
  slug: string
  color: string
  /** Optional second color — when set, the status renders as a gradient. */
  color_secondary: string | null
  /** Optional emoji/glyph shown next to the status everywhere. */
  icon: string | null
  category: 'open' | 'in_progress' | 'blocked' | 'complete' | 'cancelled'
  field_action: FieldAction | null
  is_initial: boolean
  is_terminal: boolean
  sort_order: number
  active: boolean
}

interface JobStatusTrigger {
  id: string
  job_status_id: string
  name: string
  action_type:
    | 'log'
    | 'send_email_template'
    | 'send_sms'
    | 'generate_document'
    | 'webhook_post'
  action_config: Record<string, unknown>
  /** Audience tokens — who gets notified when this trigger fires. */
  recipients: Array<'customer' | 'technician' | 'office_staff'>
  active: boolean
  sort_order: number
}

interface AiEmailDraft {
  name: string
  category: string
  subject: string
  body: string
  design_tokens?: Record<string, unknown>
}

interface AiSmsDraft {
  name: string
  category: string
  body: string
}

const AI_EMAIL_DRAFT = '__ai_email_draft__'
const AI_SMS_DRAFT = '__ai_sms_draft__'

type RecipientRole = JobStatusTrigger['recipients'][number]

const RECIPIENT_ROLES: Array<{ value: RecipientRole; label: string; hint: string; icon: string }> = [
  { value: 'customer',     label: 'Customer',     icon: '👤', hint: 'Service customer\'s primary contact email/phone.' },
  { value: 'technician',   label: 'Technician',   icon: '🔧', hint: 'The WO\'s assigned lead tech.' },
  { value: 'office_staff', label: 'Office staff', icon: '🏢', hint: 'Every account at the tenant on the office distribution list.' },
]

const RECIPIENT_LABEL: Record<RecipientRole, string> = {
  customer: 'Customer',
  technician: 'Technician',
  office_staff: 'Office staff',
}

const CATEGORIES: Array<{ value: JobStatus['category']; label: string; hint: string }> = [
  { value: 'open',        label: 'Open',        hint: 'Lead / scheduled / not started yet.' },
  { value: 'in_progress', label: 'In progress', hint: 'Actively being worked on.' },
  { value: 'blocked',     label: 'Blocked',     hint: 'Waiting on parts / customer / etc.' },
  { value: 'complete',    label: 'Complete',    hint: 'Terminal: paid, invoiced, closed.' },
  { value: 'cancelled',   label: 'Canceled',    hint: 'Terminal: job called off. Does not show the Invoice Job button.' },
]

const FIELD_ACTIONS: Array<{ value: FieldAction | ''; label: string; hint: string }> = [
  { value: '',              label: 'No automatic field action', hint: 'This status is selected manually or by its own automations.' },
  { value: 'travel',        label: 'Start travel',              hint: 'The mobile Start travel action moves the job here.' },
  { value: 'arrive',        label: 'Check in / arrived',        hint: 'A successful field check-in moves the job here.' },
  { value: 'return_needed', label: 'Check out - needs return',  hint: 'Checkout that needs another visit moves the job here.' },
  { value: 'complete',      label: 'Check out - work complete', hint: 'Completed checkout moves the job here.' },
  { value: 'cancel',        label: 'Cancel / close field work', hint: 'This is the tenant status used for cancellation.' },
]

const CATEGORY_META: Record<JobStatus['category'], { label: string; icon: string; tint: string }> = {
  open:        { label: 'Open',        icon: '○', tint: 'text-slate-600 bg-slate-100' },
  in_progress: { label: 'In progress', icon: '◐', tint: 'text-blue-700 bg-blue-50' },
  blocked:     { label: 'Blocked',     icon: '⏸', tint: 'text-amber-800 bg-amber-50' },
  complete:    { label: 'Complete',    icon: '●', tint: 'text-emerald-700 bg-emerald-50' },
  cancelled:   { label: 'Canceled',    icon: '✕', tint: 'text-rose-700 bg-rose-50' },
}

// Status icons are the curated Tabler line-icon set (see @/lib/statusIcons).
// The stored value is a short name like "truck-delivery"; legacy emoji still
// render (StatusIcon falls back to the raw glyph) until a status is re-picked.

const ACTION_TYPES: Array<{ value: JobStatusTrigger['action_type']; label: string; hint: string }> = [
  { value: 'log',                 label: 'Log only (no side effects)', hint: 'Records the fire event in the AI audit log. Good for testing.' },
  { value: 'send_email_template', label: 'Send email template',         hint: 'Renders + emails the template to the chosen recipients when a job enters this status. Needs a verified sending domain.' },
  { value: 'generate_document',   label: 'Generate document PDF',       hint: 'Pick a Document Template — renderer wires in a later release.' },
  { value: 'send_sms',            label: 'Send SMS template',           hint: 'Renders + texts the template to the chosen recipients when a job enters this status. Needs your SMS provider connected in Communication Settings.' },
  { value: 'webhook_post',        label: 'POST to webhook (stub)',      hint: 'Send the WO payload to a tenant-defined URL.' },
]

export function JobStatusesPage() {
  const statuses = useQuery({
    queryKey: ['job-statuses'],
    queryFn: () => apiRequest<{ data: JobStatus[] }>('/v1/job-statuses?active_only=0'),
  })

  const [editing, setEditing] = useState<JobStatus | null>(null)
  const [creating, setCreating] = useState(false)
  const [expandedTriggers, setExpandedTriggers] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...(statuses.data?.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [statuses.data],
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Job Statuses + Triggers</h1>
          <p className="text-sm text-slate-600 mt-1">
            Define every state a job can be in (Scheduled, On Site, Complete, etc.).
            Attach <strong>triggers</strong> to fire automations when a job moves into a
            status — send an email, render a PDF, fire a webhook.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setCreating(true)
          }}
          className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          + New status
        </button>
      </div>

      {statuses.isLoading && (
        <div className="mt-6 px-6 py-12 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl">
          Loading…
        </div>
      )}
      {!statuses.isLoading && sorted.length === 0 && (
        <div className="mt-6 px-6 py-12 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl">
          No statuses yet. Click <strong>+ New status</strong> to add the first one
          (e.g. Scheduled, On Site, Complete).
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {sorted.map((s) => {
          const hex = toHexColor(s.color)
          const bg = statusBackground(s.color, s.color_secondary)
          const isOpen = expandedTriggers === s.id
          // Tolerate a status whose category isn't one of the known five
          // (legacy / blank / unexpected) — fall back to a neutral chip so
          // one odd row can't crash the whole page.
          const cat = CATEGORY_META[s.category] ?? {
            label: s.category || 'Uncategorized',
            icon: '○',
            tint: 'text-slate-600 bg-slate-100',
          }
          return (
            <li
              key={s.id}
              className={[
                'bg-white border border-slate-200 rounded-lg overflow-hidden transition-shadow relative',
                isOpen ? 'shadow-md' : 'hover:shadow-sm',
              ].join(' ')}
            >
              {/* Color stripe — solid hex when no secondary, gradient
                  when one is set. Lives as an absolute-positioned bar
                  so we can apply linear-gradient (not allowed on
                  border-left). */}
              <span
                className="absolute top-0 bottom-0 left-0 w-1.5"
                style={{ background: bg }}
                aria-hidden
              />
              <div className="pl-4 pr-4 py-3 flex items-center gap-3 flex-wrap">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: hex }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-base font-semibold text-slate-900 truncate">
                      {s.icon && <StatusIcon name={s.icon} size={16} className="inline-block mr-1 align-[-2px]" />}
                      {s.name}
                    </span>
                    <span
                      className={[
                        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded',
                        cat.tint,
                      ].join(' ')}
                    >
                      <span aria-hidden>{cat.icon}</span>
                      {cat.label}
                    </span>
                    {s.is_initial && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-blue-700">
                        ✦ initial
                      </span>
                    )}
                    {s.is_terminal && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700">
                        ✓ terminal
                      </span>
                    )}
                    {!s.active && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                        — inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandedTriggers(isOpen ? null : s.id)}
                    className={[
                      'text-xs px-2.5 py-1 rounded-md border font-medium transition-colors',
                      isOpen
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900',
                    ].join(' ')}
                  >
                    ⚡ Triggers
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setEditing(s)
                    }}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-300 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100">
                  <TriggersList statusId={s.id} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Slice 4/5 — the allowed-move state machine for these statuses. */}
      {!statuses.isLoading && sorted.length > 0 && (
        <JobStatusTransitionsManager
          statuses={sorted.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            category: s.category,
          }))}
        />
      )}

      {(creating || editing) && (
        <StatusEditor
          status={editing}
          isCreate={creating}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ---------- Status editor modal ----------

function StatusEditor({
  status,
  isCreate,
  onClose,
}: {
  status: JobStatus | null
  isCreate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(status?.name ?? '')
  // Always work in #rrggbb internally. Legacy rows that stored
  // Tailwind names ("navy", "amber") normalize via toHexColor on load
  // and save back as a hex code so all downstream consumers (calendar,
  // cards, PDFs) get a single canonical format.
  const [color, setColor] = useState<string>(toHexColor(status?.color ?? STATUS_COLOR_FALLBACK))
  const [colorSecondary, setColorSecondary] = useState<string | null>(
    status?.color_secondary ? toHexColor(status.color_secondary) : null,
  )
  const [recents, setRecents] = useState<string[]>(() => getRecentColors())
  const [icon, setIcon] = useState<string>(status ? status.icon ?? '' : 'clipboard-text')
  const [category, setCategory] = useState<JobStatus['category']>(status?.category ?? 'open')
  const [fieldAction, setFieldAction] = useState<FieldAction | ''>(status?.field_action ?? '')
  const [isInitial, setIsInitial] = useState(!!status?.is_initial)
  const [isTerminal, setIsTerminal] = useState(!!status?.is_terminal)
  const [active, setActive] = useState(status ? status.active : true)
  const [sortOrder, setSortOrder] = useState(status?.sort_order ?? 0)

  // SF-style inline notifications: pick an email / text template to send
  // the customer when a job enters this status. These map to a single
  // customer-recipient trigger each, reconciled on save.
  const emailTemplatesQ = useQuery({
    queryKey: ['email-templates', 'active'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/v1/email-templates?active=true'),
    staleTime: 30_000,
  })
  const smsTemplatesQ = useQuery({
    queryKey: ['sms-templates', 'active'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/v1/sms-templates?active=true'),
    staleTime: 30_000,
  })
  const triggersQ = useQuery({
    queryKey: ['job-status-triggers', status?.id],
    queryFn: () => apiRequest<{ data: JobStatusTrigger[] }>(`/v1/job-statuses/${status!.id}/triggers`),
    enabled: !isCreate && !!status?.id,
  })

  // Locate the single customer-recipient email / sms trigger this inline
  // editor manages (advanced multi-trigger setups stay on the list below).
  const inlineEmailTrigger = (triggersQ.data?.data ?? []).find(
    (t) => t.action_type === 'send_email_template' && (t.recipients ?? []).includes('customer'),
  )
  const inlineSmsTrigger = (triggersQ.data?.data ?? []).find(
    (t) => t.action_type === 'send_sms' && (t.recipients ?? []).includes('customer'),
  )
  const tplFromTrigger = (t?: JobStatusTrigger): string => {
    const cfg = (t?.action_config ?? {}) as Record<string, any>
    return cfg.templates?.customer ?? cfg.email_template_id ?? cfg.sms_template_id ?? ''
  }

  const [emailTplId, setEmailTplId] = useState('')
  const [smsTplId, setSmsTplId] = useState('')
  const [aiDrafts, setAiDrafts] = useState<{ email: AiEmailDraft; sms: AiSmsDraft } | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [triggersHydrated, setTriggersHydrated] = useState(isCreate)
  if (!triggersHydrated && triggersQ.data?.data) {
    setEmailTplId(tplFromTrigger(inlineEmailTrigger))
    setSmsTplId(tplFromTrigger(inlineSmsTrigger))
    setTriggersHydrated(true)
  }

  async function generateNotificationDrafts() {
    if (!name.trim()) {
      setAiError('Enter a status name first.')
      return
    }

    setAiGenerating(true)
    setAiError(null)
    const fieldMeaning = FIELD_ACTIONS.find((action) => action.value === fieldAction)?.label
      ?? 'No automatic field action'
    const brief = [
      'This notification is sent to a customer when a job enters the custom status "' + name.trim() + '".',
      'The status category is "' + category + '" and its field meaning is "' + fieldMeaning + '".',
      'Infer the plain-language meaning of the status and explain what changed, what the customer should expect next, and how to contact the company.',
      'Do not invent dates, prices, arrival times, completed work, payment links, or promises that are not implied by the status.',
      'Use only relevant CrewBarn merge tags and keep the tone clear, calm, and professional.',
    ].join(' ')

    try {
      const [emailResult, smsResult] = await Promise.all([
        apiRequest<{ data: { ok: boolean; draft: AiEmailDraft | null; error?: string | null } }>(
          '/v1/email-templates/ai-draft',
          {
            method: 'POST',
            body: {
              description: brief,
              category: 'job',
              name: name.trim() + ' status update',
            },
          },
        ),
        apiRequest<{ data: { ok: boolean; draft: AiSmsDraft | null; error?: string | null } }>(
          '/v1/sms-templates/ai-draft',
          {
            method: 'POST',
            body: {
              description: brief + ' Keep the text concise enough for two SMS segments.',
              category: 'job',
              name: name.trim() + ' status update (text)',
            },
          },
        ),
      ])

      if (!emailResult.data.ok || !emailResult.data.draft) {
        throw new Error(emailResult.data.error || 'AI could not draft the email.')
      }
      if (!smsResult.data.ok || !smsResult.data.draft) {
        throw new Error(smsResult.data.error || 'AI could not draft the text message.')
      }

      setAiDrafts({ email: emailResult.data.draft, sms: smsResult.data.draft })
      setEmailTplId(AI_EMAIL_DRAFT)
      setSmsTplId(AI_SMS_DRAFT)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI template generation failed.')
    } finally {
      setAiGenerating(false)
    }
  }

  async function resolveNotificationTemplateIds(): Promise<{ email: string; sms: string }> {
    let email = emailTplId
    let sms = smsTplId

    if (email === AI_EMAIL_DRAFT) {
      if (!aiDrafts?.email) throw new Error('The AI email draft is missing.')
      const created = await apiRequest<{ data: { id: string } }>('/v1/email-templates', {
        method: 'POST',
        body: {
          ...aiDrafts.email,
          category: 'job',
          active: true,
          is_default: false,
        },
      })
      email = created.data.id
    }

    if (sms === AI_SMS_DRAFT) {
      if (!aiDrafts?.sms) throw new Error('The AI text draft is missing.')
      const created = await apiRequest<{ data: { id: string } }>('/v1/sms-templates', {
        method: 'POST',
        body: {
          ...aiDrafts.sms,
          category: 'job',
          active: true,
          is_default: false,
        },
      })
      sms = created.data.id
    }

    return { email, sms }
  }

  async function reconcileTrigger(
    statusId: string,
    actionType: 'send_email_template' | 'send_sms',
    templateId: string,
    existing: JobStatusTrigger | undefined,
    triggerName: string,
  ) {
    if (templateId) {
      const body = {
        name: triggerName,
        action_type: actionType,
        recipients: ['customer'],
        action_config: { templates: { customer: templateId } },
        active: true,
      }
      if (existing) {
        await apiRequest(`/v1/job-statuses/${statusId}/triggers/${existing.id}`, { method: 'PATCH', body })
      } else {
        await apiRequest(`/v1/job-statuses/${statusId}/triggers`, { method: 'POST', body })
      }
    } else if (existing) {
      await apiRequest(`/v1/job-statuses/${statusId}/triggers/${existing.id}`, { method: 'DELETE' })
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const templateIds = await resolveNotificationTemplateIds()
      const payload: Record<string, unknown> = {
        name,
        color,
        color_secondary: colorSecondary, // null clears the gradient
        icon: icon || null,
        category,
        field_action: fieldAction || null,
        is_initial: isInitial,
        is_terminal: isTerminal,
        active,
        sort_order: sortOrder,
      }
      const res = await apiRequest<{ data: { id: string } }>(
        isCreate ? '/v1/job-statuses' : `/v1/job-statuses/${status!.id}`,
        { method: isCreate ? 'POST' : 'PATCH', body: payload },
      )
      const statusId = isCreate ? res.data.id : status!.id

      // Reconcile the inline customer email/text notifications into triggers.
      await reconcileTrigger(statusId, 'send_email_template', templateIds.email, inlineEmailTrigger, `Email customer — ${name}`)
      await reconcileTrigger(statusId, 'send_sms', templateIds.sms, inlineSmsTrigger, `Text customer — ${name}`)
    },
    onSuccess: () => {
      // Remember the colors the user actually saved so they surface
      // as Recents next time the picker opens.
      pushRecentColor(color)
      if (colorSecondary) pushRecentColor(colorSecondary)
      qc.invalidateQueries({ queryKey: ['job-statuses'] })
      qc.invalidateQueries({ queryKey: ['job-status-triggers'] })
      qc.invalidateQueries({ queryKey: ['email-templates'] })
      qc.invalidateQueries({ queryKey: ['sms-templates'] })
      onClose()
    },
  })


  const del = useMutation({
    mutationFn: () => apiRequest(`/v1/job-statuses/${status!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-statuses'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            {isCreate ? 'New job status' : `Edit ${status?.name}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <Row label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Scheduled, On Site, Invoiced, Complete"
              className={inputCls}
              autoFocus
            />
          </Row>
          <Row label="Icon" hint="A quick visual marker shown next to this status on the board, calendar, and dropdowns.">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={`w-9 h-9 rounded-md border text-xs flex items-center justify-center ${
                  icon === '' ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold' : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                }`}
                title="No icon"
              >
                None
              </button>
              {STATUS_ICON_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  title={n}
                  className={`w-9 h-9 rounded-md border flex items-center justify-center ${
                    icon === n ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-400 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <StatusIcon name={n} size={20} />
                </button>
              ))}
            </div>
          </Row>
          <Row label="Color" hint="Used everywhere this status appears — calendar events, status cards, kanban edges.">
            {/* Live preview pill — reflects gradient when secondary is set. */}
            <div
              className="mb-3 h-9 rounded-md border border-slate-200 shadow-inner flex items-center justify-center text-xs font-medium"
              style={{
                background: statusBackground(color, colorSecondary),
                color: '#fff',
                textShadow: '0 0 4px rgba(0,0,0,0.35)',
              }}
            >
              {icon && <StatusIcon name={icon} size={16} className="mr-1.5" />}
              {name || 'Status preview'}
            </div>

            <ColorPickerRow
              label="Primary"
              value={color}
              onChange={(v) => setColor(v)}
            />

            {/* Gradient toggle */}
            <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={colorSecondary !== null}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Default the secondary to a slightly-darker shade
                    // of the primary so the gradient looks intentional.
                    setColorSecondary(darken(color, 0.25))
                  } else {
                    setColorSecondary(null)
                  }
                }}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="font-medium">Gradient</span>
                <span className="ml-1 text-slate-500">(adds a second color for calendar events + cards)</span>
              </span>
            </label>

            {colorSecondary !== null && (
              <div className="mt-2">
                <ColorPickerRow
                  label="Secondary"
                  value={colorSecondary}
                  onChange={(v) => setColorSecondary(v)}
                />
              </div>
            )}

            {/* Presets */}
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                Presets
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setColor(p.value)}
                    title={p.label}
                    className={[
                      'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                      color.toLowerCase() === p.value.toLowerCase()
                        ? 'border-slate-900 ring-2 ring-slate-300'
                        : 'border-white shadow-sm',
                    ].join(' ')}
                    style={{ background: p.value }}
                    aria-label={`Pick ${p.label} (${p.value})`}
                  />
                ))}
              </div>
            </div>

            {/* Recents (only if any saved) */}
            {recents.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1 flex items-center gap-2">
                  Recents
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem('crewbarn_color_recents')
                      setRecents([])
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-700 underline normal-case tracking-normal font-normal"
                  >
                    clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recents.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setColor(r)}
                      title={r}
                      className={[
                        'w-6 h-6 rounded-md border transition-transform hover:scale-110',
                        color.toLowerCase() === r ? 'border-slate-900' : 'border-slate-200',
                      ].join(' ')}
                      style={{ background: r }}
                    />
                  ))}
                </div>
              </div>
            )}
          </Row>
          <Row label="Category" required>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as JobStatus['category'])}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label} — {c.hint}</option>
              ))}
            </select>
          </Row>
          <Row
            label="Mobile field action"
            hint="Controls which tenant status the field app selects. Choosing an action moves that assignment from any other status; the status name remains customizable."
          >
            <select
              value={fieldAction}
              onChange={(e) => setFieldAction(e.target.value as FieldAction | '')}
              className={inputCls}
            >
              {FIELD_ACTIONS.map((action) => (
                <option key={action.value || 'none'} value={action.value}>
                  {action.label} - {action.hint}
                </option>
              ))}
            </select>
          </Row>

          {/* SF-style "When this status is selected" — notify the customer. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                When this status is selected
              </div>
              <button
                type="button"
                onClick={() => void generateNotificationDrafts()}
                disabled={aiGenerating || !name.trim()}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50"
              >
                <StatusIcon name="sparkles" size={15} />
                {aiGenerating ? 'Writing...' : 'Write both with AI'}
              </button>
            </div>
            {aiError && (
              <div className="text-xs text-red-700 border-t border-red-200 pt-2">{aiError}</div>
            )}
            {aiDrafts && (
              <div className="border-y border-slate-200 py-2 space-y-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">Email subject</span>
                  <input
                    value={aiDrafts.email.subject}
                    onChange={(e) => setAiDrafts((current) => current
                      ? { ...current, email: { ...current.email, subject: e.target.value } }
                      : current)}
                    className={inputCls + ' mt-1'}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">Email body</span>
                  <textarea
                    value={aiDrafts.email.body}
                    onChange={(e) => setAiDrafts((current) => current
                      ? { ...current, email: { ...current.email, body: e.target.value } }
                      : current)}
                    rows={5}
                    className={inputCls + ' mt-1 resize-y'}
                  />
                </label>
                <label className="block border-t border-slate-200 pt-2">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">Text body</span>
                  <textarea
                    value={aiDrafts.sms.body}
                    onChange={(e) => setAiDrafts((current) => current
                      ? { ...current, sms: { ...current.sms, body: e.target.value } }
                      : current)}
                    rows={3}
                    className={inputCls + ' mt-1 resize-y'}
                  />
                </label>
              </div>
            )}
            <Row label="Email the customer" hint="Sends this email template to the customer the moment a job enters this status.">
              <select
                value={emailTplId}
                onChange={(e) => setEmailTplId(e.target.value)}
                className={inputCls}
                disabled={!triggersHydrated}
              >
                <option value="">— Don't send an email —</option>
                {aiDrafts && <option value={AI_EMAIL_DRAFT}>AI draft - {aiDrafts.email.name}</option>}
                {(emailTemplatesQ.data?.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Row>
            {emailTplId && emailTplId !== AI_EMAIL_DRAFT && <TemplateTestRow channel="email" templateId={emailTplId} />}
            <Row label="Text the customer" hint="Sends this SMS template to the customer when a job enters this status — once your SMS provider (Twilio) is connected in Communication Settings.">
              <select
                value={smsTplId}
                onChange={(e) => setSmsTplId(e.target.value)}
                className={inputCls}
                disabled={!triggersHydrated}
              >
                <option value="">— Don't send a text —</option>
                {aiDrafts && <option value={AI_SMS_DRAFT}>AI draft - {aiDrafts.sms.name}</option>}
                {(smsTemplatesQ.data?.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Row>
            {smsTplId && smsTplId !== AI_SMS_DRAFT && <TemplateTestRow channel="sms" templateId={smsTplId} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isInitial}
                onChange={(e) => setIsInitial(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="font-medium">Initial</span>
                <span className="block text-[11px] text-slate-500">New jobs land in this status by default.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isTerminal}
                onChange={(e) => setIsTerminal(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="font-medium">Terminal</span>
                <span className="block text-[11px] text-slate-500">No further progress expected from this state.</span>
              </span>
            </label>
          </div>
          <Row label="Sort order">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
              className={inputCls + ' w-24'}
            />
          </Row>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Active</span>
          </label>
          {save.isError && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {(save.error as Error).message}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          <div>
            {!isCreate && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-sm px-3 py-2 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || aiGenerating || !name.trim()}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isCreate ? 'Create status' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Triggers list (inline per status) ----------

function TriggersList({ statusId }: { statusId: string }) {
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['job-status-triggers', statusId],
    queryFn: () =>
      apiRequest<{ data: JobStatusTrigger[] }>(`/v1/job-statuses/${statusId}/triggers`),
  })
  // Lookup tables for showing each trigger's templates by NAME in the
  // row, not just id. Both queries are cheap (active templates only)
  // and TanStack dedupes if the editor below also fetches them.
  const emails = useQuery({
    queryKey: ['email-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/v1/email-templates?active=true'),
  })
  const docs = useQuery({
    queryKey: ['document-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/v1/document-templates?active=true'),
  })
  const sms = useQuery({
    queryKey: ['sms-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/v1/sms-templates?active=true'),
  })
  const templateName = (kind: 'email' | 'doc' | 'sms', id: string): string | null => {
    const pool = kind === 'email' ? emails.data?.data : kind === 'sms' ? sms.data?.data : docs.data?.data
    return pool?.find((t) => t.id === id)?.name ?? null
  }
  const [editing, setEditing] = useState<JobStatusTrigger | null>(null)
  const [creating, setCreating] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  return (
    <div className="mt-3 ml-4 pl-4 border-l-2 border-amber-200 bg-amber-50/30 rounded-r py-2">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-amber-900 font-semibold px-2">
          ⚡ Triggers — fire when a job moves into this status
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setCreating(true)
          }}
          className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-medium mr-2"
        >
          + Add trigger
        </button>
      </div>
      {list.isLoading && <p className="text-xs text-slate-500 italic px-2">Loading…</p>}
      {!list.isLoading && (list.data?.data?.length ?? 0) === 0 && (
        <p className="text-xs text-slate-500 italic px-2">
          No triggers on this status yet.
        </p>
      )}
      <ul className="divide-y divide-amber-100/60">
        {(list.data?.data ?? []).map((t) => {
          const recipients = Array.isArray(t.recipients) ? t.recipients : []
          const needsRecipients = t.action_type === 'send_email_template' || t.action_type === 'send_sms'
          const cfg = (t.action_config ?? {}) as Record<string, any>
          const tplMap = (cfg.templates ?? {}) as Record<string, string>
          const flatTpl =
            t.action_type === 'generate_document'
              ? (cfg.document_template_id as string | undefined)
              : t.action_type === 'send_sms'
              ? (cfg.sms_template_id as string | undefined)
              : (cfg.email_template_id as string | undefined)
          const templateKind: 'email' | 'doc' | 'sms' | null =
            t.action_type === 'send_email_template' ? 'email'
              : t.action_type === 'generate_document' ? 'doc'
              : t.action_type === 'send_sms' ? 'sms'
              : null
          // Build the per-role "Customer → InvoiceEmail" lines.
          const perRecipient = recipients.map((r) => {
            const tplId = tplMap[r] ?? flatTpl
            const tplLabel = tplId && templateKind ? (templateName(templateKind, tplId) ?? tplId.slice(0, 6)) : null
            return tplLabel
              ? `${RECIPIENT_LABEL[r]} → ${tplLabel}`
              : templateKind
                ? `${RECIPIENT_LABEL[r]} (no template ⚠)`
                : RECIPIENT_LABEL[r]
          })
          const canTest = (t.action_type === 'send_email_template' || t.action_type === 'send_sms')
            && recipients.length > 0
          return (
          <li key={t.id} className="px-2 py-1.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-900">{t.name}</div>
                <div className="text-[10px] text-slate-600">
                  {ACTION_TYPES.find((a) => a.value === t.action_type)?.label ?? t.action_type}
                  {perRecipient.length > 0 && (
                    <span className="ml-1 text-slate-700">· {perRecipient.join(' · ')}</span>
                  )}
                  {recipients.length === 0 && needsRecipients && (
                    <span className="ml-1 text-amber-700 font-medium">· no recipients ⚠</span>
                  )}
                  {!t.active && <span className="ml-1 text-slate-500">(inactive)</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {canTest && (
                  <button
                    type="button"
                    onClick={() => setTesting(testing === t.id ? null : t.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    Send test
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setEditing(t)
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-300 hover:bg-white"
                >
                  Edit
                </button>
              </div>
            </div>
            {canTest && testing === t.id && (
              <TriggerTestForm
                statusId={statusId}
                trigger={t}
                onClose={() => setTesting(null)}
              />
            )}
          </li>
          )
        })}
      </ul>
      {(creating || editing) && (
        <TriggerEditor
          statusId={statusId}
          trigger={editing}
          isCreate={creating}
          onClose={() => {
            setCreating(false)
            setEditing(null)
            qc.invalidateQueries({ queryKey: ['job-status-triggers', statusId] })
          }}
        />
      )}
    </div>
  )
}

/**
 * Inline "Send test" form for a trigger. Renders the chosen recipient role's
 * template against the latest job and sends it to a test address you enter —
 * so you can preview what the customer (and the tech) would receive.
 */
function TriggerTestForm({
  statusId,
  trigger,
  onClose,
}: {
  statusId: string
  trigger: JobStatusTrigger
  onClose: () => void
}) {
  const channel: 'email' | 'sms' = trigger.action_type === 'send_sms' ? 'sms' : 'email'
  const recipients = (Array.isArray(trigger.recipients) ? trigger.recipients : []) as RecipientRole[]
  const [role, setRole] = useState<RecipientRole>(recipients[0] ?? 'customer')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<{ ok: boolean; to?: string; subject?: string; error?: string } | null>(null)

  const send = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { ok: boolean; to?: string; subject?: string; error?: string } }>(
        `/v1/job-statuses/${statusId}/triggers/${trigger.id}/test`,
        {
          method: 'POST',
          body: {
            recipient_role: role,
            to_email: channel === 'email' ? email || null : null,
            to_phone: channel === 'sms' ? phone || null : null,
          },
        },
      ),
    onSuccess: (r) => setResult(r.data),
    onError: (e: Error) => setResult({ ok: false, error: e.message }),
  })

  return (
    <div className="ml-1 mt-1 rounded-md border border-emerald-200 bg-emerald-50/50 p-2.5 text-[11px]">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-emerald-900">
          As recipient
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RecipientRole)}
            className="mt-0.5 text-xs px-2 py-1 border border-emerald-300 rounded bg-white"
          >
            {recipients.map((r) => (
              <option key={r} value={r}>{RECIPIENT_LABEL[r]}</option>
            ))}
          </select>
        </label>
        {channel === 'email' ? (
          <label className="flex flex-col text-emerald-900 flex-1 min-w-[180px]">
            Send test email to
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-0.5 text-xs px-2 py-1 border border-emerald-300 rounded bg-white"
            />
          </label>
        ) : (
          <label className="flex flex-col text-emerald-900 flex-1 min-w-[180px]">
            Send test text to
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="mt-0.5 text-xs px-2 py-1 border border-emerald-300 rounded bg-white"
            />
          </label>
        )}
        <button
          type="button"
          disabled={send.isPending || (channel === 'email' ? !email : !phone)}
          onClick={() => { setResult(null); send.mutate() }}
          className="text-xs px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-40"
        >
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
        >
          Close
        </button>
      </div>
      {result && (
        <div className={`mt-1.5 ${result.ok ? 'text-emerald-800' : 'text-red-700'}`}>
          {result.ok
            ? `✓ Sent ${channel} to ${result.to}${result.subject ? ` — "${result.subject}"` : ''}`
            : `✕ ${result.error ?? 'Test failed.'}`}
        </div>
      )}
      <div className="mt-1 text-[10px] text-emerald-700/70">
        Rendered against your most recent job. Switch the recipient to preview the
        customer vs. technician version.
      </div>
    </div>
  )
}

/**
 * Inline "Send test" under the status editor's Email/Text-the-customer
 * pickers. Tests the SELECTED template directly (the trigger may not exist
 * yet), rendering against the latest job and sending a [TEST] copy to you.
 */
function TemplateTestRow({ channel, templateId }: { channel: 'email' | 'sms'; templateId: string }) {
  const [dest, setDest] = useState('')
  const [result, setResult] = useState<{ ok: boolean; to?: string; subject?: string; error?: string } | null>(null)

  const send = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { ok: boolean; to?: string; subject?: string; error?: string } }>(
        '/v1/templates/test-send',
        {
          method: 'POST',
          body: {
            channel,
            template_id: templateId,
            to_email: channel === 'email' ? dest || null : null,
            to_phone: channel === 'sms' ? dest || null : null,
          },
        },
      ),
    onSuccess: (r) => setResult(r.data),
    onError: (e: Error) => setResult({ ok: false, error: e.message }),
  })

  return (
    <div className="-mt-1 ml-1 flex flex-wrap items-center gap-2">
      <input
        type={channel === 'email' ? 'email' : 'tel'}
        value={dest}
        onChange={(e) => setDest(e.target.value)}
        placeholder={channel === 'email' ? 'you@example.com' : '+1 555 123 4567'}
        className="text-xs px-2 py-1 border border-slate-300 rounded w-52"
      />
      <button
        type="button"
        disabled={!dest || send.isPending}
        onClick={() => { setResult(null); send.mutate() }}
        className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
      >
        {send.isPending ? 'Sending…' : `Send test ${channel === 'email' ? 'email' : 'text'}`}
      </button>
      {result && (
        <span className={`text-[11px] ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {result.ok ? `✓ Sent to ${result.to}` : `✕ ${result.error ?? 'Failed.'}`}
        </span>
      )}
    </div>
  )
}

function TriggerEditor({
  statusId,
  trigger,
  isCreate,
  onClose,
}: {
  statusId: string
  trigger: JobStatusTrigger | null
  isCreate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(trigger?.name ?? '')
  const [actionType, setActionType] = useState<JobStatusTrigger['action_type']>(trigger?.action_type ?? 'send_email_template')
  const [active, setActive] = useState(trigger ? trigger.active : true)
  const [webhookUrl, setWebhookUrl] = useState<string>(
    (trigger?.action_config?.url as string) ?? '',
  )

  /**
   * Per-recipient template map. Stored as `action_config.templates` —
   * `{ customer: tpl_id, technician: tpl_id, office_staff: tpl_id }`.
   * Older triggers wrote a flat `email_template_id` /
   * `document_template_id` / `sms_template_id` and no map; we read the
   * flat value as the fallback for every role on load so existing
   * triggers don't lose their setting when the operator opens this
   * editor.
   */
  const initialTemplates: Record<RecipientRole, string> = (() => {
    const cfg = (trigger?.action_config ?? {}) as Record<string, unknown>
    const map = (cfg.templates as Record<string, string> | undefined) ?? {}
    const flatKey =
      trigger?.action_type === 'generate_document'
        ? 'document_template_id'
        : trigger?.action_type === 'send_sms'
        ? 'sms_template_id'
        : 'email_template_id'
    const flat = (cfg[flatKey] as string | undefined) ?? ''
    return {
      customer: map.customer ?? flat,
      technician: map.technician ?? flat,
      office_staff: map.office_staff ?? flat,
    }
  })()
  const [templates, setTemplates] = useState<Record<RecipientRole, string>>(initialTemplates)
  const setTemplateFor = (role: RecipientRole, id: string) =>
    setTemplates((prev) => ({ ...prev, [role]: id }))

  // Recipients — who gets notified when the trigger fires. The
  // dispatcher resolves each token to an email/phone at fire time so
  // we don't need to pick concrete addresses here.
  const [recipients, setRecipients] = useState<RecipientRole[]>(
    Array.isArray(trigger?.recipients) ? (trigger!.recipients as RecipientRole[]) : [],
  )
  const toggleRecipient = (r: RecipientRole) => {
    setRecipients((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  const emails = useQuery({
    queryKey: ['email-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string; category: string }> }>('/v1/email-templates?active=true'),
    enabled: actionType === 'send_email_template',
  })
  const docs = useQuery({
    queryKey: ['document-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string; type: string }> }>('/v1/document-templates?active=true'),
    enabled: actionType === 'generate_document',
  })
  const sms = useQuery({
    queryKey: ['sms-templates', 'for-triggers'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string; category: string }> }>('/v1/sms-templates?active=true'),
    enabled: actionType === 'send_sms',
  })

  function configFor(type: JobStatusTrigger['action_type']): Record<string, unknown> {
    switch (type) {
      case 'send_email_template':
      case 'generate_document':
      case 'send_sms': {
        // Build a per-role map containing only roles that are actually
        // selected AND have a template picked. Then mirror the first
        // resolved id into the legacy flat field so older consumers
        // (and the audit log fallback) keep working.
        const map: Record<string, string> = {}
        for (const role of recipients) {
          const tpl = templates[role]
          if (tpl) map[role] = tpl
        }
        const flat = Object.values(map)[0] ?? null
        if (type === 'send_email_template') return { templates: map, email_template_id: flat }
        if (type === 'generate_document') return { templates: map, document_template_id: flat }
        return { templates: map, sms_template_id: flat }
      }
      case 'webhook_post':
        return { url: webhookUrl || null }
      default:
        return {}
    }
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest(
        isCreate
          ? `/v1/job-statuses/${statusId}/triggers`
          : `/v1/job-statuses/${statusId}/triggers/${trigger!.id}`,
        {
          method: isCreate ? 'POST' : 'PATCH',
          body: {
            name,
            action_type: actionType,
            action_config: configFor(actionType),
            // Send null when the user picked nobody — the column is
            // nullable and a null reads cleaner than an empty array.
            recipients: recipients.length ? recipients : null,
            active,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-status-triggers', statusId] })
      onClose()
    },
  })

  const del = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/job-statuses/${statusId}/triggers/${trigger!.id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-status-triggers', statusId] })
      onClose()
    },
  })

  useEffect(() => {
    // If user switched action_type, the new config fields might be
    // empty — clear stale-looking values so save doesn't ship them.
  }, [actionType])

  const at = ACTION_TYPES.find((a) => a.value === actionType)

  return (
    <div className="fixed inset-0 z-[55] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            {isCreate ? 'New trigger' : `Edit ${trigger?.name}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <Row label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Send invoice email"
              className={inputCls}
              autoFocus
            />
          </Row>
          <Row label="Action" required hint={at?.hint}>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as JobStatusTrigger['action_type'])}
              className={inputCls}
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Row>

          {actionType === 'webhook_post' && (
            <Row label="Webhook URL" required>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/hook"
                className={inputCls}
              />
            </Row>
          )}

          {/* Recipients — who the dispatcher should target. When the
              action is email or doc render, each picked recipient gets
              its own template selector so customer / tech / office can
              receive different templates from a single trigger. */}
          <Row
            label="Notify"
            hint={
              actionType === 'send_email_template'
                ? 'Pick one or more audiences. Each one can receive its own template — e.g. invoice to customer, pay summary to tech.'
                : actionType === 'send_sms'
                ? 'Pick at least one — these are the audiences who receive the SMS when the trigger fires.'
                : actionType === 'generate_document'
                ? 'Optional. Picking a recipient lets you target a different template per audience.'
                : 'Optional for this action type. Useful if a downstream step should email a result.'
            }
          >
            <div className="space-y-1.5">
              {RECIPIENT_ROLES.map((r) => {
                const checked = recipients.includes(r.value)
                const needsTemplate = checked &&
                  (actionType === 'send_email_template' ||
                    actionType === 'generate_document' ||
                    actionType === 'send_sms')
                const list =
                  actionType === 'generate_document'
                    ? docs.data?.data ?? []
                    : actionType === 'send_sms'
                    ? sms.data?.data ?? []
                    : emails.data?.data ?? []
                return (
                  <div
                    key={r.value}
                    className={[
                      'rounded-md border transition-colors',
                      checked
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <label className="flex items-start gap-2 px-2.5 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecipient(r.value)}
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-lg leading-none" aria-hidden>{r.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-900">{r.label}</span>
                        <span className="block text-[11px] text-slate-500">{r.hint}</span>
                      </span>
                    </label>
                    {needsTemplate && (
                      <div className="px-2.5 pb-2 -mt-0.5 ml-7">
                        <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">
                          Template for {r.label.toLowerCase()}
                        </label>
                        <select
                          value={templates[r.value] ?? ''}
                          onChange={(e) => setTemplateFor(r.value, e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— pick one —</option>
                          {list.map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                              {t.category ? ` (${t.category})` : t.type ? ` (${t.type})` : ''}
                            </option>
                          ))}
                        </select>
                        {!templates[r.value] && (
                          <p className="text-[11px] text-amber-800 mt-1">
                            ⚠ No template — {r.label.toLowerCase()} will be skipped at fire time.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {(actionType === 'send_email_template' || actionType === 'send_sms') &&
              recipients.length === 0 && (
                <p className="text-[11px] text-amber-800 mt-1">
                  ⚠ This action sends a message — pick at least one recipient or the dispatcher will skip it.
                </p>
              )}
          </Row>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Active</span>
          </label>

          {save.isError && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {(save.error as Error).message}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
          <div>
            {!isCreate && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-sm px-3 py-2 text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || !name.trim()}
              className="text-sm px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : isCreate ? 'Create trigger' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * One row of the picker: round swatch + native wheel + hex input +
 * optional eyedropper. Used for both the primary + secondary slots.
 */
function ColorPickerRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label
        className="relative w-10 h-10 rounded-full border-2 border-slate-300 shadow-inner cursor-pointer overflow-hidden shrink-0"
        style={{ background: value }}
        title="Click to open the color wheel"
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={`Pick ${label.toLowerCase()} color`}
        />
      </label>
      <div className="flex-1 min-w-[110px]">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
          {label}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          placeholder="#3b82f6"
          className={inputCls + ' font-mono text-xs w-28'}
        />
      </div>
    </div>
  )
}

/**
 * Darken a #rrggbb hex by `amount` (0-1). Used when the user flips
 * on Gradient — we seed the secondary as a darker primary so it
 * looks intentional without forcing them to pick a color first.
 */
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)))
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const inputCls =
  'w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'

function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
