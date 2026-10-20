import type { PageTour } from '../types'

/** Account & billing → Usage & limits (/tool-shed/usage). */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'usage',
  route: '^/tool-shed/usage/?$',
  intro: {
    page: 'Usage & limits',
    purpose: 'A count of the records your business keeps in CrewBarn, like customers, jobs and invoices, next to the plan you’re on.',
    covers: ['Your plan', 'Your record counts', 'Refreshing the numbers'],
  },
  steps: [
    {
      id: 'header', selector: t('usage-header'),
      title: 'Usage & limits',
      say: 'This page counts what your business keeps in CrewBarn. Press Refresh any time for up-to-date numbers.',
    },
    {
      id: 'plan', selector: t('usage-plan'),
      title: 'Your plan',
      say: 'The plan you’re on. View plan and billing opens your subscription.',
    },
    {
      id: 'records', selector: t('usage-records'),
      title: 'Business records',
      say: 'Your records, grouped by kind. The time on the right is when these numbers were counted.',
    },
    {
      id: 'section', selector: t('usage-section'),
      title: 'One group',
      say: 'Each box is one kind of record and how many you have.',
    },
    {
      id: 'note', selector: t('usage-note'),
      title: 'Not a bill',
      say: 'These are just counts. They aren’t a bill, and they don’t use up an allowance.',
    },
  ],
}
