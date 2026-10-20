import type { PageTour } from '../types'

/**
 * Communications → Intake (/intake): new requests that AI turned into
 * draft jobs and estimates, waiting to be checked. The tour opens the first
 * draft to look; it never creates, dismisses or retries anything.
 *
 *   intake-row          data-status = pending | reviewed | approved | failed | dismissed
 *   intake-detail-head  data-status = the open draft's status
 */
const t = (id: string) => `[data-tour="${id}"]`
const OPEN = t('intake-detail-head')
const status = (s: string) => `${OPEN}[data-status="${s}"]`

export const PAGE_TOUR: PageTour = {
  id: 'intake',
  route: '^/intake/?$',
  intro: {
    page: 'Intake',
    purpose: 'New requests from calls and texts, already pulled apart into who, where and what. Check each draft, then turn it into a job or estimate.',
    covers: ['Draft status', 'The list', 'One draft', 'What AI found', 'Create or dismiss'],
  },
  steps: [
    {
      id: 'header', selector: t('intake-header'),
      title: 'Intake queue',
      say: 'Nothing here becomes a job on its own. A person always checks it first.',
    },
    {
      id: 'alerts', selector: t('intake-alerts'),
      title: 'Pop-up alerts',
      say: 'Choose whether a pop-up tells you when a new request comes in.',
    },
    {
      id: 'status', selector: t('intake-status'),
      title: 'By status',
      say: 'Pending is new. Then reviewed, approved, failed, dismissed, or all of them.',
    },
    {
      id: 'list', selector: t('intake-list'), title: 'Drafts', say: '',
      variants: [
        { when: t('intake-empty'), title: 'Nothing here', say: 'No drafts with this status right now. New requests show up as soon as they come in.' },
        { when: t('intake-row'), say: 'Each draft shows who it’s from and what they need.' },
      ],
    },
    {
      id: 'pages', selector: t('intake-pages'),
      title: 'More pages',
      say: 'Step through older drafts a page at a time.',
    },
    {
      id: 'open', selector: OPEN, open: `first:${t('intake-row')}`, waitMs: 1200, title: 'One draft',
      say: 'Open a draft to see what AI found, and how sure it is.',
      variants: [
        { when: status('failed'), title: 'This one failed', say: 'AI couldn’t read this one. Retry AI extraction gives it another go.' },
        { when: status('dismissed'), title: 'Dismissed', say: 'This one was dismissed. Reopen brings it back if that was a mistake.' },
      ],
    },
    {
      id: 'review', selector: t('intake-review'), when: OPEN,
      title: 'Check it',
      say: 'Correct anything AI got wrong. Your corrections help it get the next one right.',
    },
    {
      id: 'follow-up', selector: t('intake-follow-up'), when: OPEN,
      title: 'Ask for what’s missing',
      say: 'Missing something, like an address or a photo? Draft a follow-up message here.',
    },
    {
      id: 'customer', selector: t('intake-customer'), when: OPEN,
      title: 'Customer',
      say: 'Who it’s from, as AI understood it.',
    },
    {
      id: 'equipment', selector: t('intake-equipment'), when: OPEN,
      title: 'What needs work',
      say: 'The equipment or item they mentioned, with any serial or model numbers read from photos.',
    },
    {
      id: 'part', selector: t('intake-part'), when: OPEN,
      title: 'Part guess',
      say: 'AI’s best guess at a part you might need. Check it before you order anything.',
    },
    {
      id: 'job', selector: t('intake-job'), when: OPEN,
      title: 'The job',
      say: 'The job or estimate AI put together.',
    },
    {
      id: 'address', selector: t('intake-address'), when: OPEN,
      title: 'Where',
      say: 'The service address.',
    },
    {
      id: 'transcript', selector: t('intake-transcript'), when: OPEN,
      title: 'What they said',
      say: 'The original words, so you can check AI against them.',
    },
    {
      id: 'actions', selector: t('intake-actions'), when: OPEN,
      title: 'Create or dismiss',
      say: 'Open thread shows the conversation. Create job opens a new job already filled in for you to check. Dismiss clears a draft you don’t need.',
    },
  ],
}
