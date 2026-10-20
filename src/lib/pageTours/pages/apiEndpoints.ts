import type { PageTour } from '../types'

/**
 * Developers → API endpoint guide (/tool-shed/api-endpoints).
 * Sections for what you can send and what comes back only show for the
 * endpoints that have them.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'api-endpoints',
  route: '^/tool-shed/api-endpoints/?$',
  intro: {
    page: 'API endpoint guide',
    purpose: 'Every way your own systems can read or change your CrewBarn data. Pick what you need, copy the example, and put in your token.',
    covers: ['First steps', 'Finding an endpoint', 'What to send and get back', 'Copying the example'],
  },
  steps: [
    {
      id: 'header', selector: t('api-guide-header'),
      title: 'API endpoint guide',
      say: 'A plain guide to connecting your own systems to your CrewBarn data.',
    },
    {
      id: 'tokens', selector: t('api-guide-tokens'),
      title: 'Manage API tokens',
      say: 'Every example needs a token. Make one here first.',
    },
    {
      id: 'first', selector: t('api-guide-first-steps'),
      title: 'First steps',
      say: 'Three things to know before you start.',
    },
    {
      id: 'base', selector: t('api-guide-base'),
      title: 'Base address',
      say: 'Every request starts with this address.',
    },
    {
      id: 'tree', selector: t('api-guide-tree'),
      title: 'Pick one',
      say: 'Everything you can ask for, grouped by area, like customers, jobs or invoices. Click a group to open it.',
    },
    {
      id: 'search', selector: t('api-guide-search'),
      title: 'Find an endpoint',
      say: 'Type a word, like invoice, to narrow the list.',
    },
    {
      id: 'detail', selector: t('api-guide-detail'),
      title: 'Read it',
      say: 'What the one you picked does, and its address.',
    },
    {
      id: 'send', selector: t('api-guide-send'),
      title: 'What you can send',
      say: 'The details you can include, and what each one means.',
    },
    {
      id: 'returns', selector: t('api-guide-returns'),
      title: 'What comes back',
      say: 'Each piece of information you get back, explained.',
    },
    {
      id: 'errors', selector: t('api-guide-errors'),
      title: 'If something goes wrong',
      say: 'What each error number means, so you know what to fix.',
    },
    {
      id: 'code', selector: t('api-guide-code'),
      title: 'Copy it',
      say: 'A ready example to copy, and what a good answer looks like.',
    },
    {
      id: 'safety', selector: t('api-guide-safety'),
      title: 'Safe by design',
      say: 'A token only reaches your own company’s data, and can never do more than the person who made it.',
    },
  ],
}
