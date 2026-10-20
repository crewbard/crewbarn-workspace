import type { PageTour } from '../types'

/**
 * CBI AI → Activity (/tool-shed/ai/activity). Refreshes itself every
 * thirty seconds.
 *
 *   ai-activity-list  data-rows = yes | no
 */
const t = (id: string) => `[data-tour="${id}"]`
const ROWS = `${t('ai-activity-list')}[data-rows="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'ai-activity',
  route: '^/tool-shed/ai/activity/?$',
  intro: {
    page: 'Activity',
    purpose: 'The last twenty things AI did, newest first, with what each one cost and anything that didn’t work.',
    covers: ['Totals', 'Each thing it did', 'Refreshing'],
  },
  steps: [
    {
      id: 'header', selector: t('ai-activity-header'),
      title: 'What AI has been doing',
      say: 'This list updates by itself while you watch.',
    },
    {
      id: 'refresh', selector: t('ai-activity-refresh'),
      title: 'Refresh',
      say: 'Refresh activity checks right now, without waiting.',
    },
    {
      id: 'stats', selector: t('ai-activity-stats'),
      title: 'Totals',
      say: 'How many things it did, what they cost when the AI company reported it, and how many didn’t work.',
    },
    {
      id: 'list', selector: t('ai-activity-list'), title: 'Each thing it did', say: '',
      variants: [
        { when: ROWS, say: 'Green worked, red didn’t, and grey means it decided there was nothing to do. Failures say why.' },
        { when: `!${ROWS}`, title: 'Nothing yet', say: 'Nothing yet. Once you allow AI a job and one comes up, it appears here.' },
      ],
    },
  ],
}
