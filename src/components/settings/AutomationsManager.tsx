import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

/**
 * Automations — recipe-gallery-first builder for the generic workflow-gate
 * engine (AutomationEngine). End users lead with plain-English outcomes
 * ("Thank customers when they pay") that turn on in one click + an optional
 * customize step with a live message preview. A segmented toggle flips to a
 * Step-by-step wizard for building arbitrary rules, and any rule that doesn't
 * match a recipe still shows in a "Your custom automations" list so nothing
 * is hidden.
 *
 * Only WIRED gates are offered, so a rule a user creates always fires.
 */

type Audience = 'customer' | 'office'
type Action = 'send_email' | 'send_sms'

interface AutomationRule {
  id: string
  gate: string
  audience: string
  action: Action
  email_template_id: string | null
  sms_template_id: string | null
  delay_minutes: number
  label: string | null
  active: boolean
}

interface TemplateOption {
  id: string
  name: string
}

interface AutomationRun {
  id: string
  subject_type: string
  subject_id: string
  status: 'queued' | 'sent' | 'skipped' | 'failed'
  recipient: string | null
  error: string | null
  fired_at: string | null
  due_at: string | null
}

interface GateDef {
  value: string
  label: string
  emoji: string
  desc: string
}
const GATES: GateDef[] = [
  { value: 'invoice.paid', label: 'A customer pays an invoice', emoji: '💰', desc: 'Fires when an invoice is marked paid in full.' },
  { value: 'invoice.sent', label: 'You send an invoice', emoji: '📨', desc: 'Fires when an invoice is sent to the customer.' },
  { value: 'job.completed', label: 'You finish a job', emoji: '🎉', desc: 'Fires when a work order is marked complete.' },
  { value: 'warranty.expiring', label: 'A warranty is expiring soon', emoji: '🛡️', desc: 'Fires from the daily marketing sweep when an active warranty enters its expiring-soon window.' },
  { value: 'customer.win_back', label: 'A customer has gone quiet', emoji: '📣', desc: 'Fires from the daily marketing sweep for opted-in customers who have not heard from you in 180 days.' },
]
const GATE_BY_VALUE: Record<string, GateDef> = Object.fromEntries(GATES.map((g) => [g.value, g]))
const AUDIENCE_LABEL: Record<string, string> = { customer: 'the customer', office: 'the office' }
const ACTION_LABEL: Record<Action, string> = { send_email: 'Email', send_sms: 'Text' }

/** Curated outcome recipes. Matched to a live rule by gate + audience. */
interface Recipe {
  key: string
  emoji: string
  title: string
  desc: string
  gate: string
  audience: Audience
  action: Action
  delayMinutes: number
}
const RECIPES: Recipe[] = [
  {
    key: 'thank-on-paid',
    emoji: '💰',
    title: 'Thank customers when they pay',
    desc: 'Sends a friendly thank-you the moment an invoice is paid.',
    gate: 'invoice.paid', audience: 'customer', action: 'send_email', delayMinutes: 0,
  },
  {
    key: 'review-after-job',
    emoji: '🎉',
    title: 'Ask for a review after a job',
    desc: 'Texts the customer a little while after a job is marked complete.',
    gate: 'job.completed', audience: 'customer', action: 'send_sms', delayMinutes: 60,
  },
  {
    key: 'invoice-followup',
    emoji: '📨',
    title: 'Invoice follow-up',
    desc: 'Nudges the customer a day after you send an invoice.',
    gate: 'invoice.sent', audience: 'customer', action: 'send_sms', delayMinutes: 1440,
  },
  {
    key: 'office-paid-alert',
    emoji: '🏢',
    title: 'Tell the office when you get paid',
    desc: 'Emails your company inbox the moment an invoice is paid.',
    gate: 'invoice.paid', audience: 'office', action: 'send_email', delayMinutes: 0,
  },
  {
    key: 'warranty-expiring',
    emoji: '🛡️',
    title: 'Warranty expiring reminder',
    desc: 'Nudges customers before active coverage expires, using your warranty lead-time setting.',
    gate: 'warranty.expiring', audience: 'customer', action: 'send_email', delayMinutes: 0,
  },
  {
    key: 'customer-win-back',
    emoji: '📣',
    title: 'Win back quiet customers',
    desc: 'Texts opted-in customers who have not had contact in 180 days.',
    gate: 'customer.win_back', audience: 'customer', action: 'send_sms', delayMinutes: 0,
  },
]

function formatDelay(mins: number): string {
  if (mins === 0) return 'right away'
  if (mins < 60) return `${mins} minutes later`
  if (mins < 60 * 24) { const h = Math.round(mins / 60); return h === 1 ? '1 hour later' : `${h} hours later` }
  const d = Math.round(mins / (60 * 24)); return d === 1 ? '1 day later' : `${d} days later`
}
function shortDelay(mins: number): string {
  if (mins === 0) return ''
  if (mins < 60) return ` + ${mins}m`
  if (mins < 60 * 24) return ` + ${Math.round(mins / 60)}h`
  return ` + ${Math.round(mins / (60 * 24))}d`
}

/** Client-side mirror of AutomationEngine default copy, with sample data. */
function defaultPreview(gate: string, action: Action): { subject?: string; body: string } {
  const name = 'Sarah'
  const company = 'your company'
  const body: Record<string, string> = {
    'invoice.paid': `Hi ${name}, thanks — ${company} received your payment. We appreciate your business!`,
    'invoice.sent': `Hi ${name}, ${company} sent you an invoice. Reach out with any questions.`,
    'job.completed': `Hi ${name}, your job with ${company} is complete. Thank you for your business!`,
    'warranty.expiring': `Hi ${name}, your warranty with ${company} is expiring soon. Call us with any questions or to schedule service.`,
    'customer.win_back': `Hi ${name}, it has been a while since we helped you. Reply or call ${company} when you need service again.`,
  }
  const subject: Record<string, string> = {
    'invoice.paid': `Payment received — ${company}`,
    'invoice.sent': `Your invoice — ${company}`,
    'job.completed': `Your job is complete — ${company}`,
    'warranty.expiring': `Your warranty is expiring soon — ${company}`,
    'customer.win_back': `We would love to help again — ${company}`,
  }
  return {
    subject: action === 'send_email' ? (subject[gate] ?? `Update from ${company}`) : undefined,
    body: body[gate] ?? `Hi ${name}, an update from ${company}.`,
  }
}

interface PreviewResponse {
  channel: string
  subject: string | null
  body: string
  used_template: boolean
}

/** Fetch the real server-rendered message for a (possibly unsaved) rule. */
function useMessagePreview(gate: string, action: Action, templateId: string) {
  return useQuery({
    queryKey: ['automation-preview', gate, action, templateId],
    queryFn: () => apiRequest<{ data: PreviewResponse }>('/v1/automation-rules/preview', {
      method: 'POST',
      body: {
        gate,
        action,
        email_template_id: action === 'send_email' && templateId ? templateId : null,
        sms_template_id: action === 'send_sms' && templateId ? templateId : null,
      },
    }),
    staleTime: 30_000,
  })
}

/**
 * Live "what the recipient gets" panel. Shows the REAL server-rendered
 * message (templates included, merge tags filled from a recent record).
 * Falls back to the client-side default copy instantly while the request
 * is in flight so the panel never flashes empty.
 */
function MessagePreview({ gate, action, audience, templateId }: {
  gate: string
  action: Action
  audience: Audience
  templateId: string
}) {
  const q = useMessagePreview(gate, action, templateId)
  const fallback = defaultPreview(gate, action)
  const data = q.data?.data
  const subject = data ? data.subject : fallback.subject
  const body = data ? data.body : fallback.body
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">
        {audience === 'office' ? 'What your office gets' : 'What the customer gets'}
        {q.isFetching && <span className="ml-1 normal-case font-normal text-slate-400">updating…</span>}
      </div>
      <div className="bg-white border border-slate-200 rounded-md p-3 max-w-md">
        {action === 'send_email' && subject && (
          <div className="text-sm font-medium text-slate-900 mb-1">{subject}</div>
        )}
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{body}</div>
      </div>
    </div>
  )
}

export function AutomationsManager() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => apiRequest<{ data: AutomationRule[] }>('/v1/automation-rules'),
  })
  const rules = q.data?.data ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: ['automation-rules'] })

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

  const create = useMutation({
    mutationFn: (body: Partial<AutomationRule>) =>
      apiRequest('/v1/automation-rules', { method: 'POST', body }),
    onSuccess: invalidate,
  })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AutomationRule> }) =>
      apiRequest(`/v1/automation-rules/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/v1/automation-rules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  // Match each recipe to a live rule by gate + audience (first match wins).
  const matchOf = (recipe: Recipe): AutomationRule | undefined =>
    rules.find((r) => r.gate === recipe.gate && r.audience === recipe.audience)
  // Rules not represented by any recipe → shown in the custom list.
  const customRules = useMemo(
    () => rules.filter((r) => !RECIPES.some((rec) => rec.gate === r.gate && rec.audience === r.audience)),
    [rules],
  )

  const [mode, setMode] = useState<'recipes' | 'wizard'>('recipes')
  // Which recipe's customize drawer is open.
  const [customizing, setCustomizing] = useState<Recipe | null>(null)

  return (
    <div className="space-y-6">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Automations</h3>
          <p className="text-[11px] text-slate-500">Let CrewBarn reach out automatically when something happens.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => { setMode('recipes'); setCustomizing(null) }}
            className={`px-3 py-1.5 rounded-md font-medium ${mode === 'recipes' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Quick start
          </button>
          <button
            type="button"
            onClick={() => { setMode('wizard'); setCustomizing(null) }}
            className={`px-3 py-1.5 rounded-md font-medium ${mode === 'wizard' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Step-by-step
          </button>
        </div>
      </div>

      {mode === 'recipes' ? (
        <>
          {/* Recipe gallery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RECIPES.map((recipe) => {
              const match = matchOf(recipe)
              const isOn = !!match?.active
              return (
                <div
                  key={recipe.key}
                  className={`rounded-lg border p-4 transition ${
                    isOn ? 'border-2 border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start">
                    <span className="text-2xl leading-none">{recipe.emoji}</span>
                    {isOn && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> On
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-slate-900 mt-1">{recipe.title}</div>
                  <p className="text-xs text-slate-500 mt-1">{recipe.desc}</p>

                  {isOn && match ? (
                    <div className="flex items-center gap-3 mt-3 text-xs">
                      <span className="text-slate-500">
                        {ACTION_LABEL[match.action]} {AUDIENCE_LABEL[match.audience]} {formatDelay(match.delay_minutes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomizing(recipe)}
                        className="ml-auto text-slate-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => patch.mutate({ id: match.id, body: { active: false } })}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Turn off
                      </button>
                    </div>
                  ) : match ? (
                    // Rule exists but is paused — one click reactivates.
                    <button
                      type="button"
                      onClick={() => patch.mutate({ id: match.id, body: { active: true } })}
                      className="mt-3 w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
                    >
                      Turn back on
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomizing(recipe)}
                      className="mt-3 w-full py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
                    >
                      Turn on
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Customize drawer */}
          {customizing && (
            <CustomizeDrawer
              recipe={customizing}
              existing={matchOf(customizing)}
              emailTemplates={emailTemplates}
              smsTemplates={smsTemplates}
              onCancel={() => setCustomizing(null)}
              onSave={(body) => {
                const existing = matchOf(customizing)
                if (existing) {
                  patch.mutate({ id: existing.id, body: { ...body, active: true } }, { onSuccess: () => setCustomizing(null) })
                } else {
                  create.mutate(body, { onSuccess: () => setCustomizing(null) })
                }
              }}
              saving={create.isPending || patch.isPending}
            />
          )}
        </>
      ) : (
        <Wizard
          emailTemplates={emailTemplates}
          smsTemplates={smsTemplates}
          saving={create.isPending}
          onCreate={(body) => create.mutate(body, { onSuccess: () => setMode('recipes') })}
        />
      )}

      {/* Custom automations not covered by a recipe */}
      {customRules.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-900">Your custom automations</h4>
            <p className="text-[11px] text-slate-500">Rules you built that aren't one of the quick-start recipes.</p>
          </div>
          <ul className="divide-y divide-slate-200">
            {customRules.map((r) => (
              <CustomRuleRow
                key={r.id}
                rule={r}
                emailTemplates={emailTemplates}
                smsTemplates={smsTemplates}
                onToggle={() => patch.mutate({ id: r.id, body: { active: !r.active } })}
                onDelete={() => {
                  if (confirm('Delete this automation? Past runs stay in the history.')) remove.mutate(r.id)
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- */
/* Customize drawer (opens from a recipe "Turn on" / "Edit")          */
/* ----------------------------------------------------------------- */
function CustomizeDrawer({
  recipe, existing, emailTemplates, smsTemplates, onCancel, onSave, saving,
}: {
  recipe: Recipe
  existing?: AutomationRule
  emailTemplates: TemplateOption[]
  smsTemplates: TemplateOption[]
  onCancel: () => void
  onSave: (body: Partial<AutomationRule>) => void
  saving: boolean
}) {
  const [action, setAction] = useState<Action>(existing?.action ?? recipe.action)
  const [delayMinutes, setDelayMinutes] = useState<number>(existing?.delay_minutes ?? recipe.delayMinutes)
  const [templateId, setTemplateId] = useState<string>(
    existing ? (existing.email_template_id || existing.sms_template_id || '') : '',
  )
  const templates = action === 'send_sms' ? smsTemplates : emailTemplates

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{recipe.emoji}</span>
        <span className="font-semibold text-slate-900">{recipe.title}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <label className="block text-xs text-slate-600">Send a
          <select value={action} onChange={(e) => { setAction(e.target.value as Action); setTemplateId('') }}
            className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            <option value="send_email">Email</option>
            <option value="send_sms">Text message</option>
          </select>
        </label>
        <label className="block text-xs text-slate-600">When
          <select
            value={[0, 15, 60, 1440].includes(delayMinutes) ? String(delayMinutes) : 'custom'}
            onChange={(e) => { const v = e.target.value; if (v === 'custom') setDelayMinutes(delayMinutes || 30); else setDelayMinutes(parseInt(v, 10)) }}
            className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            <option value="0">Right away</option>
            <option value="15">15 minutes later</option>
            <option value="60">1 hour later</option>
            <option value="1440">1 day later</option>
            <option value="custom">Custom…</option>
          </select>
        </label>
        <label className="block text-xs text-slate-600">Message
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            <option value="">Friendly default</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>

      {![0, 15, 60, 1440].includes(delayMinutes) && (
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={1} max={43200} value={delayMinutes}
            onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)}
            className="w-24 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
          <span className="text-xs text-slate-500">minutes after (max 30 days)</span>
        </div>
      )}

      {/* Message preview — real server-rendered output */}
      <div className="mt-3">
        <MessagePreview gate={recipe.gate} action={action} audience={recipe.audience} templateId={templateId} />
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({
            gate: recipe.gate,
            audience: recipe.audience,
            action,
            email_template_id: action === 'send_email' && templateId ? templateId : null,
            sms_template_id: action === 'send_sms' && templateId ? templateId : null,
            delay_minutes: Math.max(0, Math.floor(delayMinutes || 0)),
          })}
          className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Turn on automation'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- */
/* Step-by-step wizard                                                */
/* ----------------------------------------------------------------- */
function Wizard({
  emailTemplates, smsTemplates, onCreate, saving,
}: {
  emailTemplates: TemplateOption[]
  smsTemplates: TemplateOption[]
  onCreate: (body: Partial<AutomationRule>) => void
  saving: boolean
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [gate, setGate] = useState(GATES[0].value)
  const [action, setAction] = useState<Action>('send_email')
  const [audience, setAudience] = useState<Audience>('customer')
  const [delayMinutes, setDelayMinutes] = useState<number>(0)
  const [templateId, setTemplateId] = useState('')
  const templates = action === 'send_sms' ? smsTemplates : emailTemplates

  const Stepper = (
    <div className="flex items-center gap-2 text-xs mb-4">
      {[1, 2, 3].map((n, i) => (
        <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
          <span className={`flex items-center gap-1.5 font-semibold ${step >= n ? 'text-amber-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full grid place-items-center ${step >= n ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{n}</span>
            {['When', 'What', 'Review'][i]}
          </span>
          {n < 3 && <span className="flex-1 h-px bg-slate-200" />}
        </div>
      ))}
    </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {Stepper}

      {step === 1 && (
        <div>
          <h4 className="text-base font-bold text-slate-900">When should this happen?</h4>
          <p className="text-sm text-slate-500 mb-3">Pick the moment that kicks things off.</p>
          <div className="space-y-2 max-w-lg">
            {GATES.map((g) => (
              <label key={g.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${gate === g.value ? 'border-2 border-amber-400 bg-amber-50/50' : 'border-slate-200 hover:border-amber-300'}`}>
                <input type="radio" name="wiz-gate" className="accent-amber-600" checked={gate === g.value} onChange={() => setGate(g.value)} />
                <span className="text-xl">{g.emoji}</span>
                <div>
                  <div className="font-medium text-slate-900">{g.label}</div>
                  <div className="text-[11px] text-slate-500">{g.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end mt-5">
            <button type="button" onClick={() => setStep(2)} className="px-5 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">Next: what happens →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h4 className="text-base font-bold text-slate-900">What should happen?</h4>
          <p className="text-sm text-slate-500 mb-3">Choose how and when to reach out.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <label className="block text-xs text-slate-600">Reach out by
              <select value={action} onChange={(e) => { setAction(e.target.value as Action); setTemplateId('') }} className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm">
                <option value="send_email">📧 Email</option><option value="send_sms">💬 Text</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">Send to
              <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm">
                <option value="customer">👤 the customer</option><option value="office">🏢 the office</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">Wait
              <select value={[0, 15, 60, 1440].includes(delayMinutes) ? String(delayMinutes) : 'custom'}
                onChange={(e) => { const v = e.target.value; if (v === 'custom') setDelayMinutes(delayMinutes || 30); else setDelayMinutes(parseInt(v, 10)) }}
                className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm">
                <option value="0">Right away</option><option value="15">15 minutes later</option><option value="60">1 hour later</option><option value="1440">1 day later</option><option value="custom">Custom…</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">Message
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">Friendly default</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
          {![0, 15, 60, 1440].includes(delayMinutes) && (
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min={1} max={43200} value={delayMinutes} onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)} className="w-24 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
              <span className="text-xs text-slate-500">minutes after</span>
            </div>
          )}
          <div className="flex justify-between mt-5">
            <button type="button" onClick={() => setStep(1)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">← Back</button>
            <button type="button" onClick={() => setStep(3)} className="px-5 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">Next: review →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h4 className="text-base font-bold text-slate-900">Review</h4>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 max-w-lg mt-2">
            <div className="text-sm font-medium text-slate-900 mb-3">
              {ACTION_LABEL[action]} {AUDIENCE_LABEL[audience]} {formatDelay(delayMinutes)} after {GATE_BY_VALUE[gate]?.label.toLowerCase()}.
            </div>
            <MessagePreview gate={gate} action={action} audience={audience} templateId={templateId} />
          </div>
          <div className="flex justify-between mt-5">
            <button type="button" onClick={() => setStep(2)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">← Back</button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onCreate({
                gate, audience, action,
                email_template_id: action === 'send_email' && templateId ? templateId : null,
                sms_template_id: action === 'send_sms' && templateId ? templateId : null,
                delay_minutes: Math.max(0, Math.floor(delayMinutes || 0)),
              })}
              className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Turning on…' : 'Turn it on'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- */
/* Custom rule row (rules not matching a recipe) + audit + test fire  */
/* ----------------------------------------------------------------- */
function CustomRuleRow({
  rule, emailTemplates, smsTemplates, onToggle, onDelete,
}: {
  rule: AutomationRule
  emailTemplates: TemplateOption[]
  smsTemplates: TemplateOption[]
  onToggle: () => void
  onDelete: () => void
}) {
  const def = GATE_BY_VALUE[rule.gate]
  const tplName = (rule.email_template_id || rule.sms_template_id)
    ? [...emailTemplates, ...smsTemplates].find((t) => t.id === (rule.email_template_id || rule.sms_template_id))?.name
    : null
  const [open, setOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const qc = useQueryClient()
  const testFire = useMutation({
    mutationFn: () => apiRequest<{ data: { ok: boolean; message: string } }>(
      `/v1/automation-rules/${rule.id}/test-fire`, { method: 'POST', body: { recipient: recipient.trim() } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-rules', rule.id, 'runs'] }),
  })

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none pt-0.5">{def?.emoji ?? '⚡'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-800">When {def?.label ?? rule.gate}{shortDelay(rule.delay_minutes)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ACTION_LABEL[rule.action]} {AUDIENCE_LABEL[rule.audience] ?? rule.audience}
            {tplName ? <span className="text-violet-600"> · {tplName}</span> : <span className="text-slate-400"> · default copy</span>}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={rule.active} onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${rule.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${rule.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex items-center gap-1 mt-2 pl-9 text-[11px]">
        <button type="button" onClick={() => setTestOpen(!testOpen)} className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100">{testOpen ? 'Cancel test' : 'Send test'}</button>
        <button type="button" onClick={() => setOpen(!open)} className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100">{open ? 'Hide history' : 'View history'}</button>
        <span className="flex-1" />
        <button type="button" onClick={onDelete} className="px-2 py-1 rounded text-rose-600 hover:bg-rose-50">Delete</button>
      </div>
      {testOpen && (
        <div className="mt-2 ml-9 bg-amber-50 border border-amber-200 rounded-md p-3">
          <label className="block text-xs text-amber-900">Send a test {rule.action === 'send_sms' ? 'text' : 'email'} to:
            <input type={rule.action === 'send_sms' ? 'tel' : 'email'} value={recipient} onChange={(e) => setRecipient(e.target.value)}
              placeholder={rule.action === 'send_sms' ? '(555) 555-5555' : 'your@email.com'} autoFocus
              className="mt-1 w-full px-2.5 py-1.5 border border-amber-300 rounded text-sm bg-white" />
          </label>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" disabled={!recipient.trim() || testFire.isPending} onClick={() => testFire.mutate()}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50">
              {testFire.isPending ? 'Sending…' : 'Send test'}
            </button>
            {testFire.data && <span className={`text-xs ${testFire.data.data.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{testFire.data.data.message}</span>}
          </div>
        </div>
      )}
      {open && <RuleAuditPanel ruleId={rule.id} />}
    </li>
  )
}

function RuleAuditPanel({ ruleId }: { ruleId: string }) {
  const q = useQuery({
    queryKey: ['automation-rules', ruleId, 'runs'],
    queryFn: () => apiRequest<{ data: AutomationRun[] }>(`/v1/automation-rules/${ruleId}/runs`),
    refetchOnWindowFocus: true,
  })
  const runs = q.data?.data ?? []
  return (
    <div className="mt-3 ml-9 border border-slate-200 bg-slate-50 rounded-md overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-500 bg-white border-b border-slate-200">Recent activity</div>
      {q.isLoading ? (
        <p className="text-xs text-slate-400 px-3 py-2">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-slate-500 px-3 py-2">No fires yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {runs.map((r) => (
            <li key={r.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
              <span className={statusPillClass(r.status)}>{r.status}</span>
              <span className="text-slate-700"><span className="text-slate-400">{r.subject_type}:</span> {r.subject_id.slice(0, 16)}…</span>
              {r.recipient && <span className="text-slate-500">→ {r.recipient}</span>}
              {r.status === 'queued' && r.due_at && <span className="text-amber-700">due {relativeTime(r.due_at)}</span>}
              {r.error && <span className="text-rose-600 truncate" title={r.error}>· {r.error}</span>}
              {r.fired_at && <span className="text-slate-400 ml-auto whitespace-nowrap">{relativeTime(r.fired_at)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function statusPillClass(s: AutomationRun['status']): string {
  const base = 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide'
  switch (s) {
    case 'sent':    return `${base} bg-emerald-100 text-emerald-700`
    case 'queued':  return `${base} bg-amber-100 text-amber-700`
    case 'skipped': return `${base} bg-slate-200 text-slate-600`
    case 'failed':  return `${base} bg-rose-100 text-rose-700`
  }
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return iso
  const diff = (t - Date.now()) / 1000
  const ago = diff < 0
  const a = Math.abs(diff)
  const fmt = (n: number, unit: string) => ago ? `${n}${unit} ago` : `in ${n}${unit}`
  if (a < 60) return fmt(Math.round(a), 's')
  if (a < 3600) return fmt(Math.round(a / 60), 'm')
  if (a < 86400) return fmt(Math.round(a / 3600), 'h')
  return fmt(Math.round(a / 86400), 'd')
}
