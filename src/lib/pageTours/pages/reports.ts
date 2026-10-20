import type { PageTour } from '../types'

/**
 * Accounting → Reports (/accounting/reports): reports asked as questions.
 *
 * States: reports-pinned only when there are saved views and no search;
 * reports-nomatch when a search finds nothing; report-overlay while a
 * report is open.
 */
const t = (id: string) => `[data-tour="${id}"]`
const OPEN = t('report-overlay')

export const PAGE_TOUR: PageTour = {
  id: 'reports',
  route: '^/accounting/reports/?$',
  intro: {
    page: 'Reports',
    purpose: 'Your reports, asked as plain questions like who owes me, or which techs make the most. Pick one and the answer comes first.',
    covers: ['Asking a question', 'Your saved views', 'The questions', 'Reading a report', 'Every report'],
  },
  steps: [
    { id: 'header', selector: t('reports-front-header'), title: 'What do you want to know?', say: 'The same reports as the full list, plus sales tax, asked as questions instead of named.' },
    {
      id: 'search', selector: t('reports-search'), title: 'Ask', say: 'Type a few words, like who owes me or inventory, and the matching questions stay.',
      variants: [{ when: t('reports-nomatch'), say: 'Nothing matches what’s typed. Try a word from the question, or clear the box.' }],
    },
    { id: 'pinned', selector: t('reports-pinned'), title: 'Your saved views', say: 'Report views you saved, pinned at the top for one press.' },
    { id: 'questions', selector: t('reports-groups'), when: `!${OPEN}`, title: 'The questions', say: 'Grouped by what they’re about: money in, money out, your team, your stock.' },
    { id: 'card', selector: t('reports-question-card'), when: `!${OPEN}`, title: 'Open one', say: 'Press a question to open its answer. The report names are underneath if you know them.' },
    { id: 'overlay', selector: OPEN, title: 'The answer', say: 'The answer comes first, then the table behind it, with PDF and spreadsheet downloads. All questions takes you back.' },
    { id: 'browse', selector: t('reports-browse-link'), when: `!${OPEN}`, title: 'Every report', say: 'Prefer a list? This opens every report by name, with full filters.' },
  ],
}
