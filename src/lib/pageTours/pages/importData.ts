import type { PageTour } from '../types'

/**
 * Account & billing → Import data (/tool-shed/import).
 *
 * Three steps on one page; only the step on screen is walked. The page
 * marks its state for the tour:
 *   import-quickbooks > [data-qbo] = connected | off
 *   import-commit  data-ready = yes | no   (every required column matched)
 *   import-results data-errors = yes | no
 *   import-read-only shows for people who can look but not import.
 */
const t = (id: string) => `[data-tour="${id}"]`

export const PAGE_TOUR: PageTour = {
  id: 'import-data',
  route: '^/tool-shed/import/?$',
  intro: {
    page: 'Import data',
    purpose: 'Bring your customers, jobs and parts over from another system or QuickBooks. You check everything before a single record is made.',
    covers: ['Importing from QuickBooks', 'Importing a spreadsheet', 'Matching the columns', 'What came in'],
  },
  steps: [
    {
      id: 'header', selector: t('import-header'),
      title: 'Import data',
      say: 'Moving from another system? Export a spreadsheet from it and drop it here. CrewBarn matches up the columns for you.',
    },
    {
      id: 'stepper', selector: t('import-stepper'),
      title: 'Three steps',
      say: 'Upload, match the columns, done. The lit-up number shows where you are.',
    },
    {
      id: 'read-only', selector: t('import-read-only'),
      title: 'View only',
      say: 'Importing makes new records, so it needs permission to change settings. Ask an owner or admin to run it.',
    },

    // ── Step 1 ──
    {
      id: 'quickbooks', selector: t('import-quickbooks'), title: 'From QuickBooks',
      say: 'Use QuickBooks Online? Connect it, and pull customers, products and invoices straight over. No spreadsheet needed.',
      variants: [
        {
          when: `${t('import-quickbooks')} [data-qbo="connected"]`,
          say: 'QuickBooks is connected. Tick what to bring over, then press Import from QuickBooks.',
        },
      ],
    },
    {
      id: 'entity', selector: t('import-entity'),
      title: 'What are you importing?',
      say: 'Or bring in a file. First pick what’s in it: customers, jobs, parts, and so on.',
    },
    {
      id: 'file', selector: t('import-file'),
      title: 'Choose your file',
      say: 'Then choose a CSV or Excel file. The first row should be the column names.',
    },

    // ── Step 2 ──
    {
      id: 'mapping', selector: t('import-mapping'),
      title: 'Match the columns',
      say: 'Each line here is something CrewBarn keeps, next to the column from your file that fills it. Check the matches, and change any that are wrong.',
    },
    {
      id: 'preview', selector: t('import-preview'),
      title: 'Preview',
      say: 'Here are the first few rows the way they’ll come in. If something looks off, fix the match above.',
    },
    {
      id: 'commit', selector: t('import-commit'), title: 'Import',
      say: 'Ready? The Import button brings every row in. Start over picks a different file.',
      variants: [
        {
          when: `${t('import-commit')}[data-ready="no"]`,
          say: 'A few must-have fields aren’t matched yet. Match them above, and the Import button unlocks.',
        },
      ],
    },

    // ── Step 3 ──
    {
      id: 'results', selector: t('import-results'), title: 'Import complete',
      say: 'Done. You can see how many records were made, and how many were skipped because they were already here.',
      variants: [
        {
          when: `${t('import-results')}[data-errors="yes"]`,
          say: 'Done. Most rows came in, but a few didn’t. The list shows each row and why, so you can fix them and import just those.',
        },
      ],
    },
  ],
}
