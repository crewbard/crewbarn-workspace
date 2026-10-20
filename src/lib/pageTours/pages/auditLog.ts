import type { PageTour } from '../types'

/**
 * Account & billing → Audit log (/tool-shed/audit-log).
 * Two tabs (Activity, Deletions); each step presses its tab first.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'audit-log',
  route: '^/tool-shed/audit-log/?$',
  intro: {
    page: 'Audit log',
    purpose: 'A record of what your team did in CrewBarn and when, plus every deletion and the reason given. Nobody can edit it.',
    covers: ['Activity', 'Narrowing it down', 'Deletions and reasons'],
  },
  steps: [
    {
      id: 'header', selector: t('audit-header'),
      title: 'Audit log',
      say: 'Need to know who changed something, or what a tech looked up on their phone? It’s all recorded here, and the history can’t be changed.',
    },
    {
      id: 'tabs', selector: t('audit-tabs'),
      title: 'Two tabs',
      say: 'Activity shows what people did. Deletions shows what was deleted, and why.',
    },

    // ── Activity ──
    {
      id: 'filters', click: t('audit-tab-activity'), selector: t('audit-filters'),
      title: 'Narrow it down',
      say: 'Search for a kind of record, like customers or jobs. Pick phone app or web, and how far back to look. Refresh fetches the latest.',
    },
    {
      id: 'activity', click: t('audit-tab-activity'), selector: t('audit-table'), title: 'What happened',
      say: 'Each line is one thing someone did: when, who, from which app, and whether it worked.',
      variants: [
        {
          when: t('audit-empty'), selector: t('audit-empty'),
          say: 'Nothing matches these filters. Try a longer time range, or clear the search.',
        },
      ],
    },

    // ── Deletions ──
    {
      id: 'deletions-search', click: t('audit-deletions'), selector: t('audit-deletions-search'),
      title: 'Deletions',
      say: 'Every deletion is kept here, with who did it and the reason they gave. Search by the record, the reason or the person.',
    },
    {
      id: 'deletions-list', click: t('audit-deletions'), selector: t('audit-deletions-list'), title: 'Deleted records',
      say: 'Each card is one deleted record and the reason given. Permanent means it can’t be brought back.',
      variants: [
        {
          when: t('audit-deletions-empty'), selector: t('audit-deletions-empty'),
          say: 'Nothing has been deleted yet. When someone deletes a record, it shows up here with their reason.',
        },
      ],
    },
  ],
}
