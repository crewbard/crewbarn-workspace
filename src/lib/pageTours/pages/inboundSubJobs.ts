import type { PageTour } from '../types'

/** Daily work → Inbound sub jobs (/inbound-sub-jobs). Jobs other companies send you. */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'inbound-sub-jobs',
  route: '^/inbound-sub-jobs/?$',
  intro: {
    page: 'Inbound sub jobs',
    purpose: 'Jobs other companies send you to do for them. Accept one and it becomes one of your own jobs.',
    covers: ['Jobs sent to you', 'Accept or decline', 'Recent decisions'],
  },
  steps: [
    { id: 'header', selector: t('inbound-header'), title: 'Jobs sent to you', say: 'Jobs other companies send you wait here until you answer.' },
    {
      id: 'pending', selector: t('inbound-pending'), title: 'Waiting for you', say: 'Who sent it, the address, any spending limit, and what the job is.',
      variants: [{ when: (page) => page.text(t('inbound-pending')).includes('Nothing waiting'), say: 'Nothing waiting. New jobs from the companies you work for show up here.' }],
    },
    { id: 'actions', selector: t('inbound-actions'), title: 'Accept or decline', say: 'Accept puts the job on your own board, ready to schedule. Decline asks why, and that reason goes back to them.' },
    { id: 'recent', selector: t('inbound-recent'), title: 'Recent decisions', say: 'Jobs you accepted or declined in the last thirty days.' },
  ],
}
