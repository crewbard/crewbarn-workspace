import type { PageTour } from '../types'

/**
 * CBI AI → Memory (/tool-shed/ai/memory): "Is this right?", one
 * suggestion at a time. The tour never approves, fixes or rejects.
 *
 *   ai-memory-empty    nothing learned yet
 *   ai-memory-waiting  data-waiting = yes | no
 *   ai-memory-kept     confirmed memories (only when there are some)
 */
const t = (id: string) => `[data-tour="${id}"]`
const WAITING = `${t('ai-memory-waiting')}[data-waiting="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-memory',
  route: '^/tool-shed/ai/memory/?$',
  intro: {
    page: 'Memory',
    purpose: 'Check what CBI thinks it has learned against where it learned it, then keep it, fix it, or throw it out.',
    covers: ['What’s waiting', 'One suggestion', 'Keep, fix or reject', 'What it already knows'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-memory-header'),
      title: 'Is this right?',
      say: 'Saying yes saves knowledge. It never gives CBI permission to do anything new.',
    },
    {
      id: 'read-only', selector: t('settings-read-only'),
      title: 'View only',
      say: 'You can read what it learned, but not change it.',
    },
    {
      id: 'counts', selector: t('ai-memory-counts'),
      title: 'Waiting and confirmed',
      say: 'How many suggestions are waiting for you, and how many it already uses.',
    },
    {
      id: 'refresh', selector: t('ai-memory-refresh'),
      title: 'Refresh',
      say: 'Refresh memories checks for anything new.',
    },
    {
      id: 'empty', selector: t('ai-memory-empty'),
      title: 'Nothing yet',
      say: 'It hasn’t picked anything up so far. If you expected something, check where it’s allowed to look on the Learning page.',
    },
    {
      id: 'waiting', selector: t('ai-memory-waiting'), title: 'Waiting on you', say: '',
      variants: [
        { when: WAITING, say: 'These suggestions are waiting for you. Take them one at a time.' },
        { when: t('ai-memory-waiting'), title: 'Nothing waiting', say: 'Nothing is waiting for you right now. New suggestions show up here.' },
      ],
    },
    {
      id: 'review', selector: t('ai-memory-review'),
      title: 'One suggestion',
      say: 'What it thinks it learned, and the words it learned it from, side by side. Check one against the other.',
    },
    {
      id: 'actions', selector: t('ai-memory-actions'),
      title: 'Keep, fix or reject',
      say: 'Yes, remember this keeps it. Fix it lets you correct the wording first. No, reject it throws it out. The keys Y, F and N work too.',
    },
    {
      id: 'queue', selector: t('ai-memory-queue'),
      title: 'The queue',
      say: 'Everything waiting, in a list. Pick any one to look at it next.',
    },
    {
      id: 'kept', selector: t('ai-memory-kept'),
      title: 'What it already uses',
      say: 'Open this to search what CBI already knows, and forget anything that’s no longer true.',
    },
    {
      id: 'footer', selector: t('ai-memory-footer'),
      title: 'Where it looks',
      say: 'Where it looks, and whether it asks you first, is on the Learning page.',
    },
  ],
}
