import type { PageTour } from '../types'

/**
 * Connections → Partner connections (/tool-shed/partner-connections).
 *
 *   partners-list  data-state = empty | list
 *   partners-row   data-status = pending | active | denied | revoked
 */
const t = (id: string) => `[data-tour="${id}"]`
const row = (s: string) => `${t('partners-row')}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'partner-connections',
  route: '^/tool-shed/partner-connections/?$',
  intro: {
    page: 'Partner connections',
    purpose: 'Partners you’ve invited can ask to pull your work into their own systems. Approve them here, see what they’ve done, and cut them off any time.',
    covers: ['Requests', 'Active partners', 'Their access log'],
  },
  steps: [
    {
      id: 'header', selector: t('partners-header'),
      title: 'Partner connections',
      say: 'Nobody gets in unless you approve them.',
    },
    {
      id: 'list', selector: t('partners-list'), title: 'Your partners', say: '',
      variants: [
        { when: `${t('partners-list')}[data-state="empty"]`, title: 'No requests yet', say: 'No partner has asked yet. When one you’ve invited asks for access, it shows here for you to approve.' },
        { when: `${t('partners-list')}[data-state="list"]`, say: 'Each partner, whether they’re active or waiting, and when they last pulled anything.' },
      ],
    },
    {
      id: 'pending', selector: row('pending'),
      title: 'Asking for access',
      say: 'This partner is asking for access. Approve lets them in. Deny turns them down.',
    },
    {
      id: 'active', selector: row('active'),
      title: 'Active',
      say: 'An active partner can pull your work. Revoke stops them straight away.',
    },
    {
      id: 'log', selector: t('partners-log'),
      title: 'Access log',
      say: 'View access log lists everything they’ve asked for, and when.',
    },
  ],
}
