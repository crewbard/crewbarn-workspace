import type { PageTour } from '../types'

/**
 * Customers & sites → Contract invoices
 * (/tool-shed/preferences/contract-invoices). Whether invoices raised by a
 * service agreement wait as drafts.
 *
 *   setting-control  data-setting-value = true (counted straight away) | false (drafts)
 */
const t = (id: string) => `[data-tour="${id}"]`
const ON = `${t('setting-control')}[data-setting-value="true"]`
const OFF = `${t('setting-control')}[data-setting-value="false"]`

export const PAGE_TOUR: PageTour = {
  id: 'contract-invoices',
  route: '^/tool-shed/preferences/contract-invoices/?$',
  intro: {
    page: 'Contract invoices',
    purpose: 'Service agreements raise their own invoices each billing period. Choose whether those wait as drafts for you, or count straight away.',
    covers: ['Drafts or straight away', 'What it means for your books', 'What it leaves alone', 'Saving'],
  },
  steps: [
    {
      id: 'title', selector: t('setting-title'),
      title: 'Contract invoices',
      say: 'When an agreement’s billing period starts, CrewBarn raises the invoice for you. This decides what happens next.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can see this setting, but not change it. Ask an owner or admin if it needs to change.',
    },
    {
      id: 'control', selector: t('setting-control'), title: 'Drafts or straight away',
      say: 'On counts each invoice as soon as it’s raised. Off leaves it as a draft for someone to check and issue.',
      variants: [
        { when: ON, title: 'Counted straight away', say: 'Right now they count straight away. Each one is a real invoice the moment its period starts.' },
        { when: OFF, title: 'Waiting as drafts', say: 'Right now they wait as drafts. Nothing counts until someone opens each one and issues it.' },
      ],
    },
    {
      id: 'what', selector: t('setting-consequences'), title: 'With this choice', say: '',
      variants: [
        { when: ON, say: 'They count toward what you’re owed and reach your books right away. Nothing is emailed to the customer; sending is still up to you.' },
        { when: OFF, say: 'Drafts pile up in your invoice list until you issue them. Fine for a few agreements, but a lot of clicking for fifty.' },
      ],
    },
    {
      id: 'scope', selector: t('setting-scope'),
      title: 'Only agreement invoices',
      say: 'This only touches invoices raised by an agreement. Invoices you make from a job are left alone.',
    },
    {
      id: 'save', selector: t('setting-savebar'),
      title: 'Save or cancel',
      say: 'Nothing changes until you press Save change. Cancel puts it back the way it was.',
    },
  ],
}
