import type { PageTour } from '../types'

/**
 * Developers → API tokens (/tool-shed/api-tokens).
 *
 *   api-tokens-list  data-state = empty | list
 *   api-tokens-row   data-expired = yes | no
 *
 * The create window opens from + New token and closes with its own Cancel;
 * no token is made.
 */
const t = (id: string) => `[data-tour="${id}"]`
const CREATE = t('api-tokens-create')

export const PAGE_TOUR: PageTour = {
  id: 'api-tokens',
  route: '^/tool-shed/api-tokens/?$',
  intro: {
    page: 'API tokens',
    purpose: 'Long-lasting keys that let your own systems talk to CrewBarn. Each one carries your permissions, so give it a name you’ll remember.',
    covers: ['Three steps', 'Your tokens', 'Making one', 'Revoking'],
  },
  steps: [
    {
      id: 'header', selector: t('api-tokens-header'),
      title: 'API tokens',
      say: 'A token is shown once, when you make it, and never again. Keep it somewhere safe.',
    },
    {
      id: 'guide', selector: t('api-tokens-guide-link'),
      title: 'Endpoint guide',
      say: 'The endpoint guide shows what a token can ask for, with examples to copy.',
    },
    {
      id: 'steps', selector: t('api-tokens-steps'),
      title: 'Three steps',
      say: 'Name it after what will use it, keep it on a server rather than in a web page, and send it with each request.',
    },
    {
      id: 'list', selector: t('api-tokens-list'), title: 'Your tokens', say: '',
      variants: [
        { when: `${t('api-tokens-list')}[data-state="empty"]`, title: 'No tokens yet', say: 'No tokens yet. Make one when you hook up your first outside tool.' },
        { when: `${t('api-tokens-list')}[data-state="list"]`, say: 'Each token shows when it was made, when it was last used, and when it runs out.' },
      ],
    },
    {
      id: 'expired', selector: `${t('api-tokens-row')}[data-expired="yes"]`,
      title: 'Expired',
      say: 'This one has run out. Make a new one and swap it in wherever the old one was used.',
    },
    {
      id: 'revoke', selector: t('api-tokens-row'),
      title: 'Revoke',
      say: 'Revoke stops a token working straight away. Anything still using it will be turned away.',
    },
    {
      id: 'session', selector: t('api-tokens-session-note'),
      title: 'Not your sign-in',
      say: 'These tokens are separate from your own sign-in, so signing in somewhere else doesn’t stop them.',
    },
    {
      id: 'create', selector: CREATE, open: `click:${t('api-tokens-new')}`, waitMs: 1200,
      title: 'Making a token',
      say: 'Give it a name, and pick when it runs out. Shorter is safer, and every token runs out eventually.',
    },
    {
      id: 'create-note', when: CREATE,
      title: 'Shown once',
      say: 'Create token makes it and shows it once, ready to copy. We’ll press Cancel, so nothing is made.',
    },
    {
      id: 'done', click: t('api-tokens-cancel'), selector: t('api-tokens-steps'),
      title: 'That’s API tokens',
      say: 'When an outside tool is retired, revoke its token so it can’t be used again.',
    },
  ],
}
