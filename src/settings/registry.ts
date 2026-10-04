import { apiRequest } from '@/lib/api'
import { PERM } from '@/hooks/usePermissions'
import type { SettingDefinition } from '@/settings/types'
import { aiProvider } from '@/settings/ai'
import { settingsLocation } from '@/settings/workspace'
import {
  autoCheckIn,
  codCollection,
  dormantDays,
  jobReminders,
  maxVideoClip,
} from '@/settings/shopRules'

export { autoCheckIn, codCollection, dormantDays, jobReminders, maxVideoClip }
export { contractAutoIssue } from '@/settings/contracts'
export { aiProvider } from '@/settings/ai'
export { settingsLocation } from '@/settings/workspace'

/**
 * The settings, declared.
 *
 * Each shape is proved against a real endpoint:
 *
 *   a choice      where card payments go        PATCH /v1/payments/processor
 *   a number      when a warranty is "expiring" PATCH /v1/settings/warranty
 *   a toggle      reminders before a visit      PATCH /v1/tenant-settings/preferences
 *   credentials   texting from your own Twilio  the setup wizard
 *
 * The ones lifted out of "Shop rules" live in ./shopRules.ts, because that
 * one page holds about thirty-four settings on its own.
 *
 * Copy rules, since this file is where they are kept or lost:
 *   - the title is the OUTCOME, not the machinery
 *   - every option says what happens if you pick it
 *   - no jargon without a plain line under it
 *   - the consequences are what you would say out loud to a person
 */

// ── where card payments go ───────────────────────────────────────────────────

interface ProcessorData {
  stripe_ready: boolean
  godaddy_connected: boolean
}

export const cardProcessor: SettingDefinition<'stripe' | 'godaddy', ProcessorData> = {
  key: 'money.card-processor',
  route: '/tool-shed/payments',
  section: 'money',

  title: 'Where card payments go',
  blurb:
    'You have more than one way to take a card. Pick the one that charges your customers. The money goes to you — CrewBarn never holds it.',
  keywords: ['stripe', 'godaddy', 'card', 'processor', 'tap to pay', 'terminal'],
  permission: PERM.SETTINGS_EDIT,

  control: {
    kind: 'choice',
    options: [
      {
        value: 'stripe',
        label: 'Stripe',
        detail:
          'Card payments in the customer portal and from the office, plus Tap to Pay on the tech’s phone.',
        unavailable: (d) =>
          (d as ProcessorData)?.stripe_ready ? null : 'Connect Stripe first — until then there is nothing to send payments to.',
      },
      {
        value: 'godaddy',
        label: 'GoDaddy Payments',
        detail:
          'Card payments in the customer portal and from the office, plus your GoDaddy Smart Terminal.',
        unavailable: (d) =>
          (d as ProcessorData)?.godaddy_connected ? null : 'Connect GoDaddy Payments first — until then there is nothing to send payments to.',
      },
    ],
  },

  load: async () => {
    const res = await apiRequest<{
      data: { card_processor: 'stripe' | 'godaddy' | null; connected?: boolean; stripe_ready?: boolean }
    }>('/v1/payments/processor')
    return {
      value: res.data.card_processor ?? 'stripe',
      data: {
        stripe_ready: res.data.stripe_ready ?? true,
        godaddy_connected: res.data.connected ?? false,
      },
    }
  },
  save: (value) => apiRequest('/v1/payments/processor', { method: 'PATCH', body: { card_processor: value } }),

  consequences: (value) =>
    value === 'stripe'
      ? [
          'Customers paying from the portal are charged through Stripe.',
          'Card payments taken in the office go through Stripe.',
          'Techs can take Tap to Pay on their phone. The GoDaddy Smart Terminal is not used.',
        ]
      : [
          'Customers paying from the portal are charged through GoDaddy.',
          'Card payments taken in the office go through GoDaddy.',
          'Techs use the GoDaddy Smart Terminal. Tap to Pay on the phone is off — that is Stripe only.',
        ],

  scopeNote: 'Only changes new charges. Payments you have already taken keep their records and their refunds.',

  summary: (value, d) => (value === 'stripe' ? 'Stripe' : 'GoDaddy') + (d?.godaddy_connected || d?.stripe_ready ? ' · in use' : ''),

  attention: (_v, d) =>
    d && !d.stripe_ready && !d.godaddy_connected ? 'No way to take a card payment yet' : null,
}

// ── when a warranty counts as expiring ───────────────────────────────────────

export const warrantyExpiringSoon: SettingDefinition<number, unknown> = {
  key: 'workflow.warranty-expiring',
  route: '/tool-shed/warranty-settings',
  section: 'workflow',

  title: 'When to warn you a warranty is running out',
  blurb:
    'CrewBarn flags warranties before they end so you can offer the work again while it is still covered. Choose how much notice you want.',
  keywords: ['warranty', 'expiring', 'reminder', 'days'],
  permission: 'settings_warranty.edit',

  control: { kind: 'number', min: 0, max: 365, step: 5, unit: 'days of notice' },

  load: async () => {
    const res = await apiRequest<{ data: { warranty_expiring_soon_days?: number } }>('/v1/settings/warranty')
    return { value: res.data.warranty_expiring_soon_days ?? 30, data: null }
  },
  save: (value) =>
    apiRequest('/v1/settings/warranty', { method: 'PATCH', body: { warranty_expiring_soon_days: value } }),

  consequences: (value) =>
    value === 0
      ? ['Nothing is flagged early — a warranty simply ends on its date.']
      : [
          `A warranty shows as "expiring soon" ${value} days before it ends.`,
          'Those jobs appear on the dashboard panel so somebody can act on them.',
          'Nothing is sent to the customer automatically.',
        ],

  scopeNote: 'Changes what is highlighted, not the warranties themselves. No cover is shortened or extended.',

  summary: (value) => (value === 0 ? 'No early warning' : `${value} days`),
}

// ── texting from your own Twilio number ──────────────────────────────────────

interface TwilioData {
  configured: boolean
  live: boolean
}

export const twilioTexting: SettingDefinition<boolean, TwilioData> = {
  key: 'connections.twilio',
  route: '/tool-shed/communication',
  section: 'connections',

  title: 'Communications',
  blurb:
    'By default CrewBarn sends texts for you. If you already have a Twilio account, your texts can come from your own number instead. Twilio is a company that sends texts — you would have an account with them, not with us.',
  keywords: ['twilio', 'sms', 'text', 'byo', 'number'],
  permission: PERM.SETTINGS_EDIT,

  control: { kind: 'wizard', cta: 'Set up my Twilio number' },

  load: async () => {
    const res = await apiRequest<{
      data: { twilio_enabled?: boolean; twilio_account_sid_present?: boolean; twilio_from_number?: string | null }
    }>('/v1/settings/communication')
    const configured = Boolean(res.data.twilio_account_sid_present && res.data.twilio_from_number)
    return { value: Boolean(res.data.twilio_enabled), data: { configured, live: Boolean(res.data.twilio_enabled) } }
  },
  save: (value) => apiRequest('/v1/settings/communication', { method: 'PATCH', body: { twilio_enabled: value } }),

  consequences: (value, d) =>
    !d?.configured
      ? ['Nothing changes yet — there are no Twilio details saved.', 'The setup takes about five minutes and asks for three things from your Twilio dashboard.']
      : value
        ? [
            'Texts to customers come from your Twilio number.',
            'Twilio bills you for them directly, not CrewBarn.',
            'You can switch back to CrewBarn Hosted at any time.',
          ]
        : [
            'Texts to customers come from CrewBarn as before.',
            'Your Twilio details stay saved, so turning this back on takes one click.',
          ],

  scopeNote: 'Only affects texts to customers. Sign-in codes and staff messages are unchanged.',

  summary: (_v, d) => (d?.live ? 'Your Twilio number' : d?.configured ? 'Set up, not in use' : 'CrewBarn sends them'),

  attention: (_v, d) => (d?.configured && !d.live ? 'Twilio is set up but not switched on' : null),
}

/** Everything declared so far. Search, section lists and Home read this. */
export const SETTINGS: Array<SettingDefinition<never, never>> = [
  settingsLocation,
  aiProvider,
  cardProcessor,
  warrantyExpiringSoon,
  twilioTexting,
  jobReminders,
  codCollection,
  dormantDays,
  maxVideoClip,
  autoCheckIn,
] as unknown as Array<SettingDefinition<never, never>>
