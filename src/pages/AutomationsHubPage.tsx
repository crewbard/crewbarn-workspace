import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AutomationsManager } from '@/components/settings/AutomationsManager'
import { apiRequest } from '@/lib/api'

type CategoryKey = 'reminders' | 'triggers' | 'gps' | 'integrations' | 'marketing'
type AutomationStatus = 'active' | 'needs_setup' | 'soon'

interface AutomationCard {
  title: string
  summary: string
  to?: string
  status: AutomationStatus
  audience: string
  rules: string[]
  lastActivity?: string
}

interface AutomationCategory {
  key: CategoryKey
  label: string
  title: string
  description: string
  cards: AutomationCard[]
}

interface ReminderRule {
  id: string
  audience: 'customer' | 'tech'
  kind: string
  offset_minutes: number
  channels: string[]
  active: boolean
}

interface StatusTrigger {
  id: string
  action_type: string
  recipients: string[]
  active: boolean
}

interface AutomationRule {
  id: string
  gate: string
  audience: string
  action: string
  active: boolean
}

interface WebhookEndpoint {
  id: string
  active: boolean
}

interface Preferences {
  job_reminders_enabled: boolean
  geofence_auto_checkin_enabled: boolean
  geofence_auto_clock_enabled: boolean
}

const BASE_CATEGORIES: AutomationCategory[] = [
  {
    key: 'reminders',
    label: 'Reminders',
    title: 'Customer and tech reminders',
    description: 'Time-based nudges around scheduled work, late arrivals, and job follow-up.',
    cards: [
      {
        title: 'Appointment reminders',
        summary: 'Send customers reminders before scheduled jobs.',
        to: '/tool-shed/preferences#reminders',
        status: 'needs_setup',
        audience: 'Customers',
        rules: ['Master switch off or no customer rules'],
        lastActivity: 'Runs from reminder rules',
      },
      {
        title: 'Tech reminder defaults',
        summary: 'Default reminder timing for dispatchers and field techs.',
        to: '/tool-shed/preferences#reminders',
        status: 'needs_setup',
        audience: 'Techs',
        rules: ['Master switch off or no tech rules'],
      },
    ],
  },
  {
    key: 'triggers',
    label: 'Job Triggers',
    title: 'Workflow triggers',
    description: 'Fire actions when a job, invoice, or estimate reaches a workflow gate.',
    cards: [
      {
        title: 'Job status triggers',
        summary: 'Send a message, generate a document, or post a webhook when a job enters a status.',
        to: '/tool-shed/job-statuses',
        status: 'needs_setup',
        audience: 'Customers, techs, office',
        rules: ['No active status triggers'],
        lastActivity: 'Managed from job statuses',
      },
      {
        title: 'Invoice and job lifecycle rules',
        summary: 'Quick-start recipes and custom when-this-then-that rules.',
        status: 'needs_setup',
        audience: 'Customer or office',
        rules: ['No active lifecycle rules'],
        lastActivity: 'Manage below',
      },
    ],
  },
  {
    key: 'gps',
    label: 'GPS Rules',
    title: 'Field and GPS automation',
    description: 'Location-aware rules for check-ins, reviews, and field exceptions.',
    cards: [
      {
        title: 'Field check-in',
        summary: 'Auto check-in when a tech dwells inside the job geofence.',
        to: '/tool-shed/preferences',
        status: 'needs_setup',
        audience: 'Techs and dispatch',
        rules: ['Auto check-in', 'Left-site review', 'No closeout warning'],
        lastActivity: 'GPS automation off',
      },
      {
        title: 'GPS devices',
        summary: 'Register and assign tracking devices used by field automation.',
        to: '/tool-shed/gps',
        status: 'needs_setup',
        audience: 'Techs',
        rules: ['Device assignment', 'Location stream', 'Battery health'],
      },
      {
        title: 'Field review queue',
        summary: 'Review jobs with loose ends, missed check-ins, or GPS issues.',
        to: '/dispatch/field-review',
        status: 'active',
        audience: 'Dispatch',
        rules: ['Past end time', 'Left site open', 'GPS issue'],
      },
    ],
  },
  {
    key: 'integrations',
    label: 'Webhooks',
    title: 'Integrations',
    description: 'Push signed events out to external systems and tenant-owned tools.',
    cards: [
      {
        title: 'Webhooks',
        summary: 'Send signed HTTP callbacks when events happen in CrewBarn.',
        to: '/tool-shed/webhooks',
        status: 'needs_setup',
        audience: 'External systems',
        rules: ['No active webhook endpoints'],
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    title: 'Marketing automation',
    description: 'Promotional and retention campaigns kept separate from operations.',
    cards: [
      {
        title: 'Marketing automations',
        summary: 'Win-back, review requests, warranty-expiring, and seasonal campaigns.',
        status: 'needs_setup',
        audience: 'Opted-in customers',
        rules: ['No active marketing rules'],
        lastActivity: 'Runs from daily sweep',
      },
    ],
  },
]

const STATUS_COPY: Record<AutomationStatus, { label: string; tone: string; dot: string }> = {
  active: {
    label: 'Active',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  needs_setup: {
    label: 'Needs setup',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  soon: {
    label: 'Soon',
    tone: 'border-slate-200 bg-slate-50 text-slate-500',
    dot: 'bg-slate-400',
  },
}

export function AutomationsHubPage() {
  const [activeKey, setActiveKey] = useState<CategoryKey>('reminders')
  const prefsQ = useQuery({
    queryKey: ['tenant-settings', 'preferences'],
    queryFn: () => apiRequest<{ data: Preferences }>('/v1/tenant-settings/preferences'),
    staleTime: 30_000,
  })
  const remindersQ = useQuery({
    queryKey: ['job-reminder-rules'],
    queryFn: () => apiRequest<{ data: ReminderRule[] }>('/v1/job-reminder-rules'),
    staleTime: 30_000,
  })
  const triggersQ = useQuery({
    queryKey: ['job-status-triggers'],
    queryFn: () => apiRequest<{ data: StatusTrigger[] }>('/v1/job-status-triggers'),
    staleTime: 30_000,
  })
  const automationRulesQ = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => apiRequest<{ data: AutomationRule[] }>('/v1/automation-rules'),
    staleTime: 30_000,
  })
  const webhooksQ = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiRequest<{ data: WebhookEndpoint[] }>('/v1/webhooks'),
    staleTime: 30_000,
  })

  const prefs = prefsQ.data?.data
  const reminderRules = remindersQ.data?.data ?? []
  const statusTriggers = triggersQ.data?.data ?? []
  const automationRules = automationRulesQ.data?.data ?? []
  const webhooks = webhooksQ.data?.data ?? []

  const activeCustomerReminderRules = reminderRules.filter((rule) => rule.active && rule.audience === 'customer')
  const activeTechReminderRules = reminderRules.filter((rule) => rule.active && rule.audience === 'tech')
  const activeStatusTriggers = statusTriggers.filter((trigger) => trigger.active)
  const activeAutomationRules = automationRules.filter((rule) => rule.active)
  const activeMarketingRules = activeAutomationRules.filter((rule) => rule.gate.startsWith('customer.') || rule.gate.startsWith('warranty.'))
  const activeLifecycleRules = activeAutomationRules.filter((rule) => !activeMarketingRules.includes(rule))
  const activeWebhooks = webhooks.filter((webhook) => webhook.active)
  const appointmentRemindersOn = Boolean(prefs?.job_reminders_enabled)
  const gpsOn = Boolean(prefs?.geofence_auto_checkin_enabled || prefs?.geofence_auto_clock_enabled)

  const categories = useMemo(() => BASE_CATEGORIES.map((category) => ({
    ...category,
    cards: category.cards.map((card) => {
      if (card.title === 'Appointment reminders') {
        return {
          ...card,
          status: appointmentRemindersOn && activeCustomerReminderRules.length > 0 ? 'active' : 'needs_setup',
          rules: activeCustomerReminderRules.length > 0
            ? activeCustomerReminderRules.map((rule) => reminderRuleLabel(rule))
            : ['Master switch off or no customer rules'],
          lastActivity: appointmentRemindersOn ? 'Runs from reminder rules' : 'Master switch off',
        } satisfies AutomationCard
      }
      if (card.title === 'Tech reminder defaults') {
        return {
          ...card,
          status: appointmentRemindersOn && activeTechReminderRules.length > 0 ? 'active' : 'needs_setup',
          rules: activeTechReminderRules.length > 0
            ? activeTechReminderRules.map((rule) => reminderRuleLabel(rule))
            : ['Master switch off or no tech rules'],
          lastActivity: appointmentRemindersOn ? 'Runs from reminder rules' : 'Master switch off',
        } satisfies AutomationCard
      }
      if (card.title === 'Job status triggers') {
        return {
          ...card,
          status: activeStatusTriggers.length > 0 ? 'active' : 'needs_setup',
          rules: activeStatusTriggers.length > 0
            ? [`${activeStatusTriggers.length} active trigger${activeStatusTriggers.length === 1 ? '' : 's'}`]
            : ['No active status triggers'],
        } satisfies AutomationCard
      }
      if (card.title === 'Invoice and job lifecycle rules') {
        return {
          ...card,
          status: activeLifecycleRules.length > 0 ? 'active' : 'needs_setup',
          rules: activeLifecycleRules.length > 0
            ? activeLifecycleRules.map((rule) => `${rule.gate} -> ${rule.action}`)
            : ['No active lifecycle rules'],
        } satisfies AutomationCard
      }
      if (card.title === 'Marketing automations') {
        return {
          ...card,
          status: activeMarketingRules.length > 0 ? 'active' : 'needs_setup',
          rules: activeMarketingRules.length > 0
            ? activeMarketingRules.map((rule) => `${rule.gate} -> ${rule.action}`)
            : ['No active marketing rules'],
        } satisfies AutomationCard
      }
      if (card.title === 'Field check-in') {
        return {
          ...card,
          status: gpsOn ? 'active' : 'needs_setup',
          lastActivity: gpsOn ? 'Runs from GPS preferences' : 'GPS automation off',
        } satisfies AutomationCard
      }
      if (card.title === 'Webhooks') {
        return {
          ...card,
          status: activeWebhooks.length > 0 ? 'active' : 'needs_setup',
          rules: activeWebhooks.length > 0
            ? [`${activeWebhooks.length} active endpoint${activeWebhooks.length === 1 ? '' : 's'}`]
            : ['No active webhook endpoints'],
        } satisfies AutomationCard
      }
      return card
    }),
  })), [
    activeLifecycleRules,
    activeMarketingRules,
    activeCustomerReminderRules,
    activeStatusTriggers,
    activeTechReminderRules,
    activeWebhooks,
    appointmentRemindersOn,
    gpsOn,
  ])
  const activeCategory = categories.find((category) => category.key === activeKey) ?? categories[0]

  const stats = useMemo(() => {
    const cards = categories.flatMap((category) => category.cards)
    return {
      active: cards.filter((card) => card.status === 'active').length,
      needsSetup: cards.filter((card) => card.status === 'needs_setup').length,
      soon: cards.filter((card) => card.status === 'soon').length,
      totalRules: activeCustomerReminderRules.length
        + activeTechReminderRules.length
        + activeStatusTriggers.length
        + activeAutomationRules.length
        + activeWebhooks.length,
    }
  }, [
    activeAutomationRules.length,
    activeCustomerReminderRules.length,
    activeStatusTriggers.length,
    activeTechReminderRules.length,
    activeWebhooks.length,
    categories,
  ])

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div className="min-w-0">
          <Link to="/tool-shed/preferences" className="text-sm text-amber-700 hover:underline">
            Back to Tool Shed
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 mt-2">Automation Hub</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Control reminders, workflow triggers, GPS rules, webhooks, and marketing workflows from one place.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="#rules-builder"
            className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
          >
            New automation
          </a>
          <a
            href="#templates"
            className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
          >
            Templates
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label="Active surfaces" value={stats.active} tone="emerald" />
        <Metric label="Need setup" value={stats.needsSetup} tone="amber" />
        <Metric label="Rules on" value={stats.totalRules} tone="blue" />
        <Metric label="Coming soon" value={stats.soon} tone="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex gap-1 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setActiveKey(category.key)}
                    className={`px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                      activeKey === category.key
                        ? 'bg-navy-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-navy-900">{activeCategory.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{activeCategory.description}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {activeCategory.cards.length} surface{activeCategory.cards.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {activeCategory.cards.map((card) => (
                  <AutomationSurfaceCard key={card.title} card={card} />
                ))}
              </div>
            </div>
          </section>

          <section id="rules-builder" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-navy-900">Rules builder</h2>
                  <p className="text-sm text-slate-500">
                    Turn on quick-start recipes or build custom lifecycle automations.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Live engine
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <AutomationsManager />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SetupChecklist
            appointmentRemindersOn={appointmentRemindersOn}
            customerRules={activeCustomerReminderRules.length}
            techRules={activeTechReminderRules.length}
            gpsOn={gpsOn}
            webhooks={activeWebhooks.length}
          />
          <section id="templates" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-navy-900">Template readiness</h2>
            <p className="text-xs text-slate-500 mt-1">
              Automations work best when each role has default email and SMS copy.
            </p>
            <div className="mt-3 space-y-2">
              <ReadinessRow label="Customer templates" status="Review defaults" good={activeCustomerReminderRules.length > 0} />
              <ReadinessRow label="Tech templates" status={activeTechReminderRules.length > 0 ? 'Ready' : 'Review defaults'} good={activeTechReminderRules.length > 0} />
              <ReadinessRow label="Office alerts" status={activeAutomationRules.some((rule) => rule.audience === 'office') ? 'Ready' : 'Review defaults'} good={activeAutomationRules.some((rule) => rule.audience === 'office')} />
              <ReadinessRow label="Marketing copy" status={activeMarketingRules.length > 0 ? 'Ready' : 'Review defaults'} good={activeMarketingRules.length > 0} />
            </div>
          </section>
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-navy-900">Automation activity</h2>
            <p className="text-xs text-slate-500 mt-1">
              Recent send/test history appears inside each rule in the builder.
            </p>
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              Use rule history to confirm messages sent, queued, skipped, or failed before turning on more complex workflows.
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function reminderRuleLabel(rule: ReminderRule): string {
  const channel = rule.channels.length > 0 ? rule.channels.join('+') : 'no channel'
  if (rule.kind === 'before') return `${rule.offset_minutes} min before (${channel})`
  if (rule.kind === 'late') return `${rule.offset_minutes} min late (${channel})`
  if (rule.kind === 'enroute') return `ETA ${rule.offset_minutes} min (${channel})`
  if (rule.kind === 'at_risk') return `At-risk ${rule.offset_minutes} min (${channel})`
  return `${rule.kind} (${channel})`
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'emerald' | 'amber' | 'blue' | 'slate'
}) {
  const toneClass = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    slate: 'text-slate-600 bg-slate-50 border-slate-200',
  }[tone]

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs font-semibold mt-1">{label}</div>
    </div>
  )
}

function AutomationSurfaceCard({ card }: { card: AutomationCard }) {
  const status = STATUS_COPY[card.status]
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <h3 className="font-bold text-navy-900">{card.title}</h3>
          </div>
          <p className="text-sm text-slate-600 mt-1">{card.summary}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Audience</div>
          <div className="text-sm text-slate-800 mt-0.5">{card.audience}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">Activity</div>
          <div className="text-sm text-slate-800 mt-0.5">{card.lastActivity ?? 'No recent activity'}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Rules</div>
        <div className="flex flex-wrap gap-1.5">
          {card.rules.map((rule) => (
            <span key={rule} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {rule}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold text-amber-700">
        {card.to ? 'Manage' : card.status === 'soon' ? 'Planned' : 'Manage below'}
      </div>
    </>
  )

  if (!card.to) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4">{content}</div>
  }

  return (
    <Link to={card.to} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition">
      {content}
    </Link>
  )
}

function SetupChecklist({
  appointmentRemindersOn,
  customerRules,
  techRules,
  gpsOn,
  webhooks,
}: {
  appointmentRemindersOn: boolean
  customerRules: number
  techRules: number
  gpsOn: boolean
  webhooks: number
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-navy-900">Setup checklist</h2>
      <p className="text-xs text-slate-500 mt-1">Know what is ready before automations start sending.</p>
      <div className="mt-3 space-y-2">
        <ReadinessRow label="Message templates" status="Review defaults" good />
        <ReadinessRow
          label="Customer reminders"
          status={appointmentRemindersOn && customerRules > 0 ? 'Ready' : 'Off or no rules'}
          good={appointmentRemindersOn && customerRules > 0}
        />
        <ReadinessRow
          label="Tech reminders"
          status={appointmentRemindersOn && techRules > 0 ? 'Ready' : 'Off or no rules'}
          good={appointmentRemindersOn && techRules > 0}
        />
        <ReadinessRow label="GPS rules" status={gpsOn ? 'Ready' : 'Needs geofence settings'} good={gpsOn} />
        <ReadinessRow label="Webhook signing" status={webhooks > 0 ? 'Ready' : 'Needs endpoint'} good={webhooks > 0} />
      </div>
    </section>
  )
}

function ReadinessRow({
  label,
  status,
  good = false,
  muted = false,
}: {
  label: string
  status: string
  good?: boolean
  muted?: boolean
}) {
  const dot = good ? 'bg-emerald-500' : muted ? 'bg-slate-400' : 'bg-amber-500'

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-sm text-slate-800 truncate">{label}</span>
      </div>
      <span className="text-xs text-slate-500 shrink-0">{status}</span>
    </div>
  )
}