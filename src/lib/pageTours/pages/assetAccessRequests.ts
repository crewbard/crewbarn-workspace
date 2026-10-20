import type { PageTour } from '../types'

/**
 * Customers & sites → Asset access requests (/asset-access-requests).
 *
 *   access-requests-tabs     data-tab = pending | approved | denied | all
 *   access-requests-empty    nothing on this tab
 *   access-requests-row      data-status = pending | approved | denied
 *   access-requests-actions  Deny / Approve buttons, pending rows, editors only
 *   access-requests-code     a code that has been issued
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (key: string) => `${t('access-requests-tabs')}[data-tab="${key}"]`

export const PAGE_TOUR: PageTour = {
  id: 'asset-access-requests',
  route: '^/asset-access-requests/?$',
  intro: {
    page: 'Asset access requests',
    purpose: 'When someone scans a secured piece of equipment and asks to see it, the request lands here for you to approve or deny.',
    covers: ['Waiting for you', 'How to review', 'Pending, approved and denied', 'Approving and the code'],
  },
  steps: [
    {
      id: 'header', selector: t('access-requests-header'),
      title: 'Who’s asking',
      say: 'These are people who scanned a secured item’s code and asked for access to its record.',
    },
    {
      id: 'count', selector: t('access-requests-count'),
      title: 'Waiting for you',
      say: 'This number is how many requests are waiting for a decision.',
    },
    {
      id: 'steps', selector: t('access-requests-steps'),
      title: 'Three steps',
      say: 'Check who’s asking, choose how much they can see, and CrewBarn sends them a code that works for twenty-four hours.',
    },
    {
      id: 'tabs', selector: t('access-requests-tabs'), title: 'Pending, approved, denied',
      say: 'Use these tabs to switch between pending, approved, denied, or all requests.',
      variants: [
        { when: tab('pending'), say: 'You’re on Pending, the ones waiting for you. The other tabs show what’s been approved or denied.' },
        { when: tab('approved'), say: 'You’re on Approved. Each one shows its code, when it runs out, and whether it’s been used.' },
        { when: tab('denied'), say: 'You’re on Denied, the requests you turned down.' },
      ],
    },
    {
      id: 'empty', selector: t('access-requests-empty'), title: 'Nothing here',
      say: 'Nothing on this tab right now.',
      variants: [
        { when: tab('pending'), title: 'All caught up', say: 'No requests are waiting. When someone asks, it shows up here.' },
      ],
    },
    {
      id: 'row', selector: t('access-requests-row'),
      title: 'One request',
      say: 'Each card shows the item they scanned, who they are, how to reach them, and any message they left.',
    },
    {
      id: 'actions', selector: t('access-requests-actions'),
      title: 'Approve or deny',
      say: 'Approve item opens just that one thing. Approve full tree also opens the related secured items at the same site. Deny turns it down.',
    },
    {
      id: 'code', selector: t('access-requests-code'),
      title: 'The access code',
      say: 'Once approved, the code shows here. It’s texted and emailed when we have their details. Copy code if you need to pass it on yourself.',
    },
  ],
}
