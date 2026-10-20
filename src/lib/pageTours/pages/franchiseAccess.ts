import type { PageTour } from '../types'

/**
 * Account & billing → Franchise access (/franchise-support).
 *
 * The page marks its state for the tour:
 *   franchise-access-requests data-count = some | none
 *   franchise-access-active   data-count = some | none
 */
const t = (id: string) => `[data-tour="${id}"]`
const READ_ONLY = t('settings-read-only')

export const PAGE_TOUR: PageTour = {
  id: 'franchise-access',
  route: '^/franchise-support/?$',
  intro: {
    page: 'Franchise access',
    purpose: 'Decide whether your franchisor can step into your account to help, and for how long. Everything they do is recorded, and you can end it any time.',
    covers: ['Requests to help', 'Who has access now'],
  },
  steps: [
    {
      id: 'header', selector: t('franchise-access-header'), title: 'Franchise access',
      say: 'Your franchisor can only get into your account when you say yes. Everything they do shows up in your audit log.',
      variants: [
        {
          when: READ_ONLY, selector: READ_ONLY, title: 'View only',
          say: 'You can see who has asked and who has access, but only an owner or admin can say yes or end it.',
        },
      ],
    },
    {
      id: 'requests', selector: t('franchise-access-requests'), title: 'Requests',
      say: 'When your franchisor asks to help, the request shows up here.',
      variants: [
        {
          when: `${t('franchise-access-requests')}[data-count="some"]`,
          say: 'Your franchisor is asking to help. Pick how long they can stay, then press Approve, or press Decline.',
        },
        {
          when: `${t('franchise-access-requests')}[data-count="none"]`,
          say: 'No one is asking right now. When your franchisor asks to help, the request shows up here for you to approve or decline.',
        },
      ],
    },
    {
      id: 'active', selector: t('franchise-access-active'), title: 'Active access',
      say: 'Anyone who can get in right now is listed here.',
      variants: [
        {
          when: `${t('franchise-access-active')}[data-count="some"]`,
          say: 'Your franchisor has access right now, until the time shown. End access now shuts them out straight away.',
        },
        {
          when: `${t('franchise-access-active')}[data-count="none"]`,
          say: 'No one has access to your account right now.',
        },
      ],
    },
  ],
}
