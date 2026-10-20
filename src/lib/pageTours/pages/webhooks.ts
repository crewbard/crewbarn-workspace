import type { PageTour } from '../types'

/**
 * Developers → Webhooks (/tool-shed/webhooks).
 *
 *   webhooks-list      data-state = empty | list
 *   webhooks-endpoint  data-health = ok | failing | off
 *
 * The editor opens from + Add endpoint and closes with its own Cancel;
 * nothing is saved.
 */
const t = (id: string) => `[data-tour="${id}"]`
const EDITOR = t('webhooks-editor')
const health = (h: string) => `${t('webhooks-endpoint')}[data-health="${h}"]`

export const PAGE_TOUR: PageTour = {
  id: 'webhooks',
  route: '^/tool-shed/webhooks/?$',
  intro: {
    page: 'Webhooks',
    purpose: 'Tell your own systems the moment something happens in CrewBarn, like a new job or a paid invoice.',
    covers: ['How it works', 'Your endpoints', 'Testing and the log', 'Adding one'],
  },
  steps: [
    {
      id: 'header', selector: t('webhooks-header'),
      title: 'Webhooks',
      say: 'When something you picked happens, CrewBarn sends a signed message to your address.',
    },
    {
      id: 'how', selector: t('webhooks-how'),
      title: 'Three steps',
      say: 'Choose the events, check the signature on what arrives, then test it and read the log.',
    },
    {
      id: 'list', selector: t('webhooks-list'), title: 'Your endpoints', say: '',
      variants: [
        { when: `${t('webhooks-list')}[data-state="empty"]`, title: 'None yet', say: 'No endpoints yet. Add one to start sending events.' },
        { when: `${t('webhooks-list')}[data-state="list"]`, say: 'Each address you send to, with the events it gets. Green is working, red is failing, grey is switched off.' },
      ],
    },
    {
      id: 'failing', selector: health('failing'),
      title: 'Failing',
      say: 'This one has been failing. It shows how many times in a row, and the last answer it got back.',
    },
    {
      id: 'actions', selector: t('webhooks-actions'),
      title: 'Test, log, edit',
      say: 'Send test fires a sample message. Log shows every delivery and its answer. Edit changes the address or events.',
    },
    {
      id: 'secret', selector: t('webhooks-secret'),
      title: 'Signing secret',
      say: 'Your system uses this secret to prove a message really came from CrewBarn. Reveal or copy it when you set that up.',
    },
    {
      id: 'editor', selector: EDITOR, open: `click:${t('webhooks-add')}`, waitMs: 1200,
      title: 'Adding an endpoint',
      say: 'The address to send to, and a short description so you know what it’s for.',
    },
    {
      id: 'events', selector: t('webhooks-editor-events'), when: EDITOR,
      title: 'Pick events',
      say: 'Tick only what your system needs.',
    },
    {
      id: 'done', click: t('webhooks-editor-cancel'), selector: t('webhooks-how'),
      title: 'Nothing saved',
      say: 'Cancel closes it without saving. Your endpoint starts getting events once you save it.',
    },
  ],
}
