import type { PageTour } from '../types'

/** Account & billing → Data export (/tool-shed/data-export). */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'data-export',
  route: '^/tool-shed/data-export/?$',
  intro: {
    page: 'Data export',
    purpose: 'Take a copy of your business records, one spreadsheet file per kind of record. It’s your data, and you can download it any time.',
    covers: ['How it works', 'Picking what to download', 'What’s in each file'],
  },
  steps: [
    {
      id: 'header', selector: t('export-header'),
      title: 'Export data',
      say: 'Want a copy of your records for a spreadsheet or your own files? Download them here.',
    },
    {
      id: 'steps', selector: t('export-steps'),
      title: 'Three steps',
      say: 'Choose your records, check what’s in them, then open the file in any spreadsheet app. Keep downloaded files somewhere safe.',
    },
    {
      id: 'list', selector: t('export-list'),
      title: 'Available exports',
      say: 'Each card is one kind of record, like customers, jobs or invoices.',
    },
    {
      id: 'card', selector: t('export-card'),
      title: 'One download',
      say: 'Open Included fields to see every column first. Download CSV saves the file to your computer.',
    },
    {
      id: 'notes', selector: t('export-notes'),
      title: 'What you get',
      say: 'Each file has one row per record. Passwords and keys are left out, and so is anything you’ve deleted. Line items on an invoice aren’t included yet.',
    },
  ],
}
