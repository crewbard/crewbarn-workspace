import { apiRequest } from '@/lib/api'
import type { SettingDefinition } from '@/settings/types'

/**
 * Settings that belong to maintenance contracts.
 *
 * One so far. A contract bills on its own cadence without anybody
 * remembering, which raises the question this setting answers: does the
 * invoice it produces wait for a person, or not?
 */

const preferences = () => apiRequest<{ data: Record<string, unknown> }>('/v1/tenant-settings/preferences')
const savePreference = (key: string, value: unknown) =>
  apiRequest('/v1/tenant-settings/preferences', { method: 'PATCH', body: { [key]: value } })

/** A boolean straight off the preferences payload. */
function fromPreferences<V>(key: string, fallback: V) {
  return {
    load: async () => {
      const res = await preferences()
      return { value: (res.data[key] ?? fallback) as V, data: null }
    },
    save: (value: V) => savePreference(key, value),
  }
}

// ── whether contract invoices wait for you ───────────────────────────────────

export const contractAutoIssue: SettingDefinition<boolean, null> = {
  key: 'money.contract-auto-issue',
  // Filed with the agreement it bills for, not with the money it collects:
  // somebody changing this is looking at a customer's contract.
  route: '/tool-shed/preferences/contract-invoices',
  section: 'customers',

  title: 'Whether contract invoices wait for you',
  blurb:
    'Maintenance contracts raise their own invoices when each billing period starts. CrewBarn can leave those as drafts for you to check, or count them straight away.',
  keywords: ['contract', 'maintenance', 'invoice', 'draft', 'issue', 'recurring', 'automatic'],
  permission: 'settings_preferences.edit',

  control: {
    kind: 'toggle',
    on: 'Contract invoices count as soon as they are raised, without anybody opening them.',
    off: 'Each one waits as a draft until somebody reads it and issues it.',
  },

  ...fromPreferences<boolean>('contract_auto_issue_enabled', false),

  consequences: (value) =>
    value
      ? [
          'A contract invoice is a real invoice the moment its period starts — it counts towards what you are owed, and it appears in your books.',
          'Nothing is emailed to the customer. Sending an invoice is still something you do.',
          'If anything goes wrong raising one, it falls back to a draft rather than disappearing.',
        ]
      : [
          'Contract invoices pile up as drafts in your invoice list until you issue them.',
          'Nothing counts towards what you are owed, and nothing reaches your books, until you do.',
          'Fine for a few agreements. A shop with fifty is opening fifty invoices a month.',
        ],

  scopeNote:
    'Only affects invoices raised by a maintenance contract. Invoices you create from a job are untouched.',

  summary: (value) => (value ? 'Counted straight away' : 'Wait as drafts'),
}
