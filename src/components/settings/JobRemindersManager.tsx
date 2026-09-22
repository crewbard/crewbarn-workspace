import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Manages tenant appointment-reminder rules (CRUD over /v1/job-reminder-rules).
 * Mounted under the "Appointment reminders" section of Company Preferences,
 * shown only when the master toggle is on.
 *
 * Each rule = audience (tech | customer) × kind (before | late | enroute) ×
 * offset_minutes × channels[]. The everyMinute crewbarn:job-reminders engine
 * reads these.
 */

type Audience = 'tech' | 'customer'
type Kind = 'before' | 'late' | 'enroute' | 'at_risk'

interface ReminderRule {
  id: string
  audience: Audience
  kind: Kind
  offset_minutes: number
  channels: string[]
  label: string | null
  active: boolean
  sms_template_id: string | null
  email_template_id: string | null
}

interface TemplateOption {
  id: string
  name: string
}

const AUDIENCE_LABEL: Record<Audience, string> = { tech: 'Tech', customer: 'Customer' }
const KIND_LABEL: Record<Kind, string> = {
  before: 'Before start',
  late: 'Late alert',
  enroute: 'On the way (GPS)',
  at_risk: 'May be late (GPS)',
}

/** Human phrasing for a rule's offset, which means different things per kind. */
function describe(rule: ReminderRule): string {
  const m = rule.offset_minutes
  const hrs = m % 60 === 0 ? `${m / 60} hr` : `${m} min`
  if (rule.kind === 'before') return `${hrs} before start`
  if (rule.kind === 'late') return `${m} min after start (if not started)`
  if (rule.kind === 'at_risk') return `when predicted >${m} min late`
  return `when ≤ ${m} min away`
}

export function JobRemindersManager() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['job-reminder-rules'],
    queryFn: () => apiRequest<{ data: ReminderRule[] }>('/v1/job-reminder-rules'),
  })
  const rules = q.data?.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['job-reminder-rules'] })

  // Optional per-channel message templates (else default copy).
  const emailTemplatesQ = useQuery({
    queryKey: ['email-templates', 'active'],
    queryFn: () => apiRequest<{ data: TemplateOption[] }>('/v1/email-templates?active=true'),
    staleTime: 60_000,
  })
  const smsTemplatesQ = useQuery({
    queryKey: ['sms-templates', 'active'],
    queryFn: () => apiRequest<{ data: TemplateOption[] }>('/v1/sms-templates?active=true'),
    staleTime: 60_000,
  })
  const emailTemplates = emailTemplatesQ.data?.data ?? []
  const smsTemplates = smsTemplatesQ.data?.data ?? []
  const tplName = (list: TemplateOption[], id: string | null) =>
    id ? (list.find((t) => t.id === id)?.name ?? 'Template') : null

  const create = useMutation({
    mutationFn: (body: Partial<ReminderRule>) =>
      apiRequest('/v1/job-reminder-rules', { method: 'POST', body }),
    onSuccess: invalidate,
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ReminderRule> }) =>
      apiRequest(`/v1/job-reminder-rules/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/job-reminder-rules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  // Add-rule form
  const [audience, setAudience] = useState<Audience>('customer')
  const [kind, setKind] = useState<Kind>('before')
  const [offset, setOffset] = useState(120)
  const [channels, setChannels] = useState<string[]>(['sms'])
  const [smsTemplateId, setSmsTemplateId] = useState('')
  const [emailTemplateId, setEmailTemplateId] = useState('')

  // enroute = customer-only "on the way"; at_risk = tech-only predictive "you
  // may be late" — both GPS-driven.
  const kindOptions: Kind[] = audience === 'tech' ? ['before', 'late', 'at_risk'] : ['before', 'late', 'enroute']
  const effectiveKind: Kind = kindOptions.includes(kind) ? kind : 'before'

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const canAdd = channels.length > 0 && offset >= 1

  const offsetHint =
    effectiveKind === 'before'
      ? 'minutes before start'
      : effectiveKind === 'late'
        ? 'minutes after start'
        : effectiveKind === 'at_risk'
          ? 'grace min (alert if predicted later)'
          : 'ETA minutes (send when this close)'

  const add = () => {
    if (!canAdd || create.isPending) return
    create.mutate(
      {
        audience,
        kind: effectiveKind,
        offset_minutes: offset,
        channels,
        sms_template_id: channels.includes('sms') && smsTemplateId ? smsTemplateId : null,
        email_template_id: channels.includes('email') && emailTemplateId ? emailTemplateId : null,
      },
      { onSuccess: () => { setSmsTemplateId(''); setEmailTemplateId(''); invalidate() } },
    )
  }

  return (
    <div className="border-t border-slate-100 pt-4">
      {/* Existing rules */}
      {q.isLoading ? (
        <p className="text-xs text-slate-400">Loading reminders…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-slate-400 mb-3">No reminders yet — add one below.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 text-sm border border-slate-200 rounded-md px-3 py-2"
            >
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                {AUDIENCE_LABEL[r.audience]}
              </span>
              <span className="font-medium text-slate-800">{KIND_LABEL[r.kind]}</span>
              <span className="text-slate-500">{describe(r)}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                {r.channels.join(' + ')}
              </span>
              {r.sms_template_id && (
                <span className="text-[10px] text-violet-600" title="Custom SMS template">💬 {tplName(smsTemplates, r.sms_template_id)}</span>
              )}
              {r.email_template_id && (
                <span className="text-[10px] text-violet-600" title="Custom email template">📧 {tplName(emailTemplates, r.email_template_id)}</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch.mutate({ id: r.id, body: { active: !r.active } })}
                  className={`text-[11px] px-2 py-0.5 rounded ${
                    r.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.active ? 'Active' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(r.id)}
                  className="text-[11px] text-rose-600 hover:text-rose-700"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add a rule */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            <span className="block mb-1">Notify</span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            >
              <option value="customer">Customer</option>
              <option value="tech">Tech</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            <span className="block mb-1">When</span>
            <select
              value={effectiveKind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            >
              {kindOptions.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {effectiveKind !== 'enroute' || audience === 'customer' ? (
            <label className="text-xs text-slate-600">
              <span className="block mb-1">{offsetHint}</span>
              <input
                type="number"
                min={1}
                value={offset}
                onChange={(e) => setOffset(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded-md"
              />
            </label>
          ) : null}
          <div className="text-xs text-slate-600">
            <span className="block mb-1">Channels</span>
            <div className="flex items-center gap-3 py-1.5">
              {['sms', 'email', 'push'].map((c) => (
                <label key={c} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="uppercase">{c}</span>
                </label>
              ))}
            </div>
            {channels.includes('push') && (
              <p className="text-[11px] text-slate-500">
                Push notifies the assigned tech&apos;s mobile app (tech reminders only; skipped for customer reminders). Requires the app installed + notifications allowed.
              </p>
            )}
          </div>
          {channels.includes('sms') && (
            <label className="text-xs text-slate-600">
              <span className="block mb-1">SMS template</span>
              <select
                value={smsTemplateId}
                onChange={(e) => setSmsTemplateId(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-300 rounded-md min-w-[150px]"
              >
                <option value="">Default copy</option>
                {smsTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {channels.includes('email') && (
            <label className="text-xs text-slate-600">
              <span className="block mb-1">Email template</span>
              <select
                value={emailTemplateId}
                onChange={(e) => setEmailTemplateId(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-300 rounded-md min-w-[150px]"
              >
                <option value="">Default copy</option>
                {emailTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={add}
            disabled={!canAdd || create.isPending}
            className="px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md disabled:opacity-50"
          >
            {create.isPending ? 'Adding…' : 'Add reminder'}
          </button>
        </div>
        {(effectiveKind === 'enroute' || effectiveKind === 'at_risk') && (
          <p className="text-[11px] text-slate-500 mt-2">
            Needs the assigned tech to have a GPS tracking device with a recent
            fix. Uses straight-line distance ÷ ~30 mph as a rough ETA.
          </p>
        )}
      </div>
    </div>
  )
}
