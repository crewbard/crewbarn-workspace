import type { PageTour } from '../types'

/**
 * Daily work → Jobs (/jobs).
 *
 * The board top to bottom. It follows the list as it is: jobs in it, an
 * empty board, nothing matching the search and filters, or jobs that
 * couldn't load; cards, rows or folders; and the chips that show when
 * something is narrowing the list.
 *
 * The page marks:
 *   jobs-list   data-list-state = loading | rows | empty | filtered | error
 *               (error: the load failed and no rows are on screen; the list
 *               shows "Couldn't load jobs." and a Try again button)
 *   jobs-views  buttons carry aria-pressed for the view in use
 *
 * Focus look: + Sub Job, + Service Agreement and the partner links fold into
 * "Partner work & service agreements" ([data-focus-jobs-partner-tools]), and
 * a row of quick filters sits above the stages ([data-focus-jobs-queues]).
 * The Scheduled date and Sort boxes, and the folder layout switch, have no
 * marker of their own yet, so they're found by their labels.
 */
const t = (id: string) => `[data-tour="${id}"]`
const list = (state: string) => `${t('jobs-list')}[data-list-state="${state}"]`
const pressed = (id: string) => `${t(id)}[aria-pressed="true"]`
const PAGE = '[data-focus-page="jobs"]'

export const PAGE_TOUR: PageTour = {
  id: 'jobs',
  route: '^/jobs/?$',
  intro: {
    page: 'Jobs',
    purpose: 'Every job your company has, from the first call to the last payment. Find one, see what it needs next, and keep it moving.',
    covers: ['Starting a job', 'Stages', 'Search, dates and sorting', 'Rows, cards or files', 'Paid or not', 'What each job needs next'],
  },
  // The intro film, before the walk-through (see ../film.ts).
  film: [
    { id: 'name', say: 'This is Jobs. Every job your company has lives right here.', visual: { kind: 'title', title: 'Jobs', subtitle: 'From the first call to the last payment' } },
    { id: 'rows', title: 'Your jobs', say: 'Each job shows who it’s for, when it happens, and where it stands, with a colored chip for its stage.', visual: { kind: 'list', heading: 'Jobs' } },
    { id: 'stages', title: 'Stages', say: 'Jobs move through stages, from booked, to done, to paid, so you always know what each one needs next.', visual: { kind: 'pipeline', stages: ['New', 'Scheduled', 'In progress', 'Done', 'Invoiced', 'Paid'], card: 'Repair visit' } },
    {
      id: 'find', title: 'Search and filters', say: 'Search by customer, address or job number, and use the filters when the list gets long.',
      visual: { kind: 'list', search: 'Oakwood', rows: [
        { title: 'New install', meta: 'Oakwood Dental · Today, 1:00', chip: 'Scheduled', tone: 'blue' },
        { title: 'Yearly inspection', meta: 'Oakwood Dental · Last month', chip: 'Paid', tone: 'green' },
      ] },
    },
    { id: 'go', say: 'Let’s walk through the board together.', visual: { kind: 'go' } },
  ],
  steps: [
    {
      id: 'header', selector: t('jobs-header'),
      title: 'The Jobs board',
      say: 'This is the Jobs board. Every job lives here, from the first call to the last payment.',
    },
    {
      id: 'new', selector: t('jobs-new'),
      title: 'New Job',
      say: 'New Job writes up a new one: the customer, the work, when, and who does it.',
    },
    {
      id: 'new-sub', selector: t('jobs-new-sub'),
      title: 'Sub Job',
      say: 'Sub Job hands a job to a partner company to do for you.',
    },
    {
      id: 'new-agreement', selector: t('jobs-new-agreement'),
      title: 'Service Agreement',
      say: 'Service Agreement is for work on a schedule, like a visit every month. The visits it makes land on this board.',
    },
    {
      id: 'partners', selector: t('jobs-partner-links'),
      title: 'Partner work',
      say: 'Inbound, Sub payouts and Sub reviews are for work shared with partners: jobs they send you, and what you owe your subs.',
    },
    {
      id: 'partner-tools', selector: '[data-focus-jobs-partner-tools]',
      title: 'Partner work & service agreements',
      say: 'Partner work & service agreements opens the extras: jobs partners sent you, sub payouts, sub reviews, a new sub job and a new service agreement.',
    },
    {
      id: 'queues', selector: '[data-focus-jobs-queues]',
      title: 'Jobs that need a nudge',
      say: 'Past due, Ready to bill, Needs parts and Parts ordered narrow the list to jobs that need a nudge. Click one again to clear it.',
    },
    {
      id: 'attention', selector: t('jobs-attention'),
      title: 'Jobs that need a nudge',
      say: 'These cards narrow the list to jobs that need a nudge: past their date, ready to bill, or waiting on parts. Click one again to clear it.',
    },
    {
      id: 'stages', selector: t('jobs-tabs'),
      title: 'Stages',
      say: 'The tabs are the stages of your work, named the way you set them up. The number is how many jobs sit in each one now. All shows every job.',
    },
    {
      id: 'search', selector: t('jobs-search'),
      title: 'Search',
      say: 'Search finds a job by its title, the customer, or the address.',
    },
    {
      id: 'week', selector: t('jobs-this-week'),
      title: 'This week',
      say: 'This week shows just the jobs booked this week. Click again to turn it off.',
      variants: [
        { when: pressed('jobs-this-week'), title: 'This week is on', say: 'This week is on, so you’re seeing just this week’s jobs. Click it to see them all again.' },
      ],
    },
    {
      id: 'filters', selector: t('jobs-filters'),
      title: 'Filters',
      say: 'Filters holds the rest: any one status, even one without a tab, and your own jobs or the ones handed to a sub.',
    },
    {
      id: 'scheduled', selector: `${PAGE} input[aria-label="Scheduled date"]`,
      title: 'Scheduled',
      say: 'Pick a date to see just the jobs booked that day. It shows up as a chip, so it’s easy to clear.',
    },
    {
      id: 'sort', selector: `${PAGE} select[aria-label="Sort jobs on this page"]`,
      title: 'Sort',
      say: 'Sort the jobs on this page by title, scheduled date, or the biggest amount first.',
    },
    {
      id: 'chips', selector: t('jobs-active-filters'),
      title: 'Filtered by',
      say: 'Anything narrowing the list shows here as a chip. Click a chip to drop it, or Clear all.',
    },
    {
      id: 'views', selector: t('jobs-views'), title: 'Rows, Cards or Files', say: '',
      variants: [
        {
          when: pressed('jobs-view-files'),
          title: 'Files',
          say: 'You’re in Files: jobs sorted into folders, each with its money collected, unpaid and not billed yet. Rows is a plain list, and Cards shows one card per job.',
        },
        {
          when: pressed('jobs-view-cards'),
          title: 'Cards',
          say: 'You’re in Cards: one card per job. Rows is a plain list, and Files sorts jobs into folders with the money in each. Your pick stays put.',
        },
        {
          when: () => true,
          title: 'Rows, Cards or Files',
          say: 'Pick how the list looks: Rows, Cards, or Files, which sorts jobs into folders with the money in each. Your pick stays put.',
        },
      ],
    },
    {
      id: 'group-by', selector: t('jobs-group-by'),
      title: 'File group',
      say: 'File group picks how the folders in Files are sorted: by status, by year, or by tech.',
    },
    {
      id: 'folder-layout', selector: `${PAGE} [aria-label="Folder layout"]`,
      title: 'Folder layout',
      say: 'Cabinet, Tree or Accordion: how the folders look in Files.',
    },

    // ── The list ──
    {
      id: 'list', selector: t('jobs-list'), title: 'Your jobs', say: '',
      variants: [
        // First: a failed load must never be described as an empty board.
        {
          when: list('error'),
          title: 'Jobs didn’t load',
          say: 'Your jobs couldn’t load just now, so this isn’t an empty board. Press Try again to load them.',
        },
        {
          when: list('empty'),
          title: 'No jobs yet',
          say: 'No jobs yet. Press New Job to write up the first one, or turn an approved estimate into one.',
        },
        {
          when: list('filtered'),
          title: 'Nothing matches',
          say: 'No job matches what you’ve picked. Clear the search or filters, or pick All, to see everything again.',
        },
        {
          when: list('rows'),
          title: 'Your jobs',
          say: 'Here are the jobs. Each shows its number, stage, customer and address, when it’s booked, who’s on it and the total.',
        },
      ],
    },
    {
      id: 'stamp', selector: t('jobs-pay-stamp'),
      title: 'Paid or not',
      say: 'The stamp says whether it’s paid. Unpaid means there’s still a balance, or no invoice yet.',
    },
    {
      id: 'next', selector: t('jobs-next-step'),
      title: 'What it needs next',
      say: 'This chip is the next step, like Schedule, Assign tech or Invoice. Click it to jump to the job.',
    },
    {
      id: 'peek', selector: t('jobs-peek'),
      title: 'Quick Peek',
      say: 'Quick Peek opens the job from the side without leaving the list. The arrow keys move between jobs.',
    },
    {
      id: 'row', selector: t('jobs-row'),
      title: 'Open a job',
      say: 'Click a job to open everything about it.',
    },
    {
      id: 'pager', selector: t('jobs-pager'),
      title: 'More pages',
      say: 'A long list comes in pages. Move between them here.',
    },
  ],
}
