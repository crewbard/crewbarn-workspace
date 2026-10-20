import type { PageTour } from '../types'

/**
 * Developers, the area page (/connect/developers).
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'area-developers',
  route: '^/connect/developers/?$',
  intro: {
    page: 'Developers',
    purpose: 'For hooking your own systems up to CrewBarn: keys for the API, a guide to what you can ask for, alerts sent to your systems, and running the office console on your own address.',
    covers: ['API keys and guide', 'Events', 'Self-hosted'],
  },
  steps: [
    {
      id: 'header', selector: t('connect-area-header'),
      title: 'Developers',
      say: 'Most companies never need this area. It’s here for whoever builds your own tools and reports.',
    },
    {
      id: 'filter', selector: t('connect-area-filter'), title: 'Jump or search',
      say: 'The chips jump to a group, and the box finds a setting by name.',
      variants: [
        { when: t('connect-area-nomatch'), say: 'Nothing matches what’s in the search box. Press Clear search to see every setting again.' },
      ],
    },
    {
      id: 'api', selector: t('connect-group-api'),
      title: 'API',
      say: 'API tokens are the keys your own systems use to read and change your data. The endpoint guide shows what they can ask for, with examples to copy.',
    },
    {
      id: 'events', selector: t('connect-group-events'),
      title: 'Events',
      say: 'Webhooks tell your own systems the moment something happens, like a job finished or an invoice paid.',
    },
    {
      id: 'self-hosted', selector: t('connect-group-self-hosted'),
      title: 'Self-hosted',
      say: 'Run the office console on your own web address. Your data and logins stay on CrewBarn.',
    },
  ],
}
