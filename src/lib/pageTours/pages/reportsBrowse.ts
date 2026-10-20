import type { PageTour } from '../types'

/**
 * Accounting → Browse all reports (/accounting/reports/browse).
 *
 * States: reports-list only in the browser layout.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'reports-browse',
  route: '^/accounting/reports/browse/?$',
  intro: {
    page: 'Browse all reports',
    purpose: 'Every report by name, with dates and filters, ready to download as a PDF or spreadsheet for you or your bookkeeper.',
    covers: ['Saved views', 'Picking a report', 'Dates and filters', 'Downloading'],
  },
  steps: [
    { id: 'root', selector: t('reports-root'), title: 'Every report', say: 'This is for pulling files to send or save. Charts are on the Financial overview.' },
    { id: 'saved', selector: t('reports-saved-views'), title: 'Saved views', say: 'Save a report with its filters and dates, and open it again in one press.' },
    { id: 'list', selector: t('reports-list'), title: 'Pick a report', say: 'Choose one report from the list.' },
    { id: 'controls', selector: t('reports-controls'), title: 'Report controls', say: 'Dates, how many rows, the layout, and the download buttons.' },
    { id: 'filters', selector: t('reports-filters'), title: 'Filters', say: 'Narrow it to a customer, tech, status and more.' },
    { id: 'guide', selector: t('reports-guide'), title: 'About this report', say: 'What the report shows, and whether it covers a date range or a single day.' },
    { id: 'panels', selector: t('reports-panels'), title: 'The report', say: 'The report itself, ready to read or download.' },
  ],
}
