import type { PageTour } from '../types'

/**
 * Account & billing, the area page (/connect/account).
 *
 * Groups a person can't open are left off the page (Company files needs its
 * own permission; Franchise access is for franchises), so steps for a
 * missing group or setting are skipped.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-account',
  route: '^/connect/account/?$',
  intro: {
    page: 'Account & billing',
    purpose: 'Your CrewBarn account itself: what you pay, what you use, your data coming in and going out, the record of who changed what, and getting set up.',
    covers: ['Jumping and searching', 'Your plan', 'Your data', 'Records', 'Getting started'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Account & billing',
      say: 'This area is about your CrewBarn account, not your customers. The number on the right is how many settings are in it.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting in this area by name.',
      variants: [
        {
          when: t('connect-area-nomatch'),
          say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.',
        },
      ],
    },
    {
      id: 'plan', selector: t('connect-group-plan'),
      title: 'Plan',
      say: 'Plan is what you pay us: your subscription and seats, and how many records your business keeps.',
    },
    {
      id: 'data', selector: t('connect-group-your-data'),
      title: 'Your data',
      say: 'Your data brings records in from another system, downloads them out again, and keeps sensitive ones locked with your own key.',
    },
    {
      id: 'company-files', selector: t('connect-setting-company-files'),
      title: 'Company files',
      say: 'Company files is a locked vault for paperwork that isn’t tied to one customer, like insurance or licences.',
    },
    {
      id: 'records', selector: t('connect-group-records'),
      title: 'Records',
      say: 'The audit log shows who changed what, and every deletion with its reason.',
    },
    {
      id: 'started', selector: t('connect-group-getting-started'),
      title: 'Getting started',
      say: 'Guided setup is your step-by-step checklist.',
      variants: [
        {
          when: t('connect-setting-franchise-access'),
          say: 'Guided setup is your step-by-step checklist. Franchise access lets your franchisor in to help, only when you say so.',
        },
      ],
    },
  ],
}
