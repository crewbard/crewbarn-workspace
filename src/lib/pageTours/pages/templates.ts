import type { PageTour } from '../types'

/**
 * Jobs & workflow → Templates & forms (/custom-documents).
 * Four views of the same templates: Journey, List, Job stages, By channel.
 *
 *   templates-views          data-view = journey | list | library | advanced
 *   templates-moment-preview data-state = empty (no moment picked) | open
 *   templates-new, templates-starter, templates-banners  editors only
 */
const t = (id: string) => `[data-tour="${id}"]`
const view = (v: string) => `${t('templates-views')}[data-view="${v}"]`

export const PAGE_TOUR: PageTour = {
  id: 'templates',
  route: '^/custom-documents/?$',
  intro: {
    page: 'Templates & forms',
    purpose: 'Everything CrewBarn sends, prints or gets signed, from appointment reminders to invoices, laid out in the order your jobs happen.',
    covers: ['Four ways to look', 'Starter templates', 'Making a new one', 'In job order', 'What the customer gets'],
  },
  steps: [
    {
      id: 'header', selector: `${t('templates-header')}, ${t('templates-easy-header')}`,
      title: 'Templates & forms',
      say: 'Every email, text and document you send lives here, with the wording your customers see.',
    },
    {
      id: 'views', selector: t('templates-views'), title: 'Four ways to look',
      say: 'These buttons change how you look at the same templates: Journey, List, Job stages, and By channel.',
      variants: [
        { when: view('journey'), say: 'Four ways to look at the same templates. You’re on Journey, a board in the order a job happens. List puts each one on its own row.' },
        { when: view('list'), say: 'Four ways to look at the same templates. You’re on List, one template per row. Journey shows them in the order a job happens.' },
        { when: view('library'), say: 'Four ways to look at the same templates. You’re on Job stages, which checks your set is complete.' },
        { when: view('advanced'), say: 'Four ways to look at the same templates. You’re on By channel, with emails, documents and texts each on their own tab.' },
      ],
    },
    {
      id: 'starter', selector: t('templates-starter'),
      title: 'Starter templates',
      say: 'Add missing CrewBarn templates fills any gaps with tested versions. Nothing changes until you pick which ones to add.',
    },
    {
      id: 'new', selector: t('templates-new'),
      title: 'Start a new one',
      say: 'Write one with CBI describes it in a sentence and lets CBI write it. New template starts one yourself in three quick picks.',
    },
    {
      id: 'banners', selector: t('templates-extra-copies'),
      title: 'Extra copies',
      say: 'You have more than one version for some moments. Only one is sent, so it’s worth tidying the spares.',
    },

    // ── Journey ──
    {
      id: 'search', selector: t('templates-journey-search'), when: view('journey'),
      title: 'Search',
      say: 'Search finds a moment or a template by name. Try reminder or invoice.',
    },
    {
      id: 'filter', selector: t('templates-journey-filter'), when: view('journey'),
      title: 'One channel at a time',
      say: 'These narrow the board to email, text or documents.',
    },
    {
      id: 'form', selector: t('templates-make-form'),
      title: 'Make a form',
      say: 'Make a form builds a printable document, like an inspection sheet, by picking fields.',
    },
    {
      id: 'legend', selector: t('templates-legend'),
      title: 'What the chips mean',
      say: 'Green sends. Grey is switched off. Dashed hasn’t been made yet. Amber with a number has extra copies.',
    },
    {
      id: 'stage', selector: t('templates-stage-before'),
      title: 'In job order',
      say: 'The board reads top to bottom, in the order a job happens: before the job, on the job, getting paid, and after.',
    },
    {
      id: 'preview', selector: t('templates-moment-preview'), title: 'What the customer gets', say: '',
      variants: [
        { when: `${t('templates-moment-preview')}[data-state="empty"]`, say: 'Click any moment on the board, and this side shows exactly what the customer gets.' },
        { when: `${t('templates-moment-preview')}[data-state="open"]`, say: 'This is what the customer gets at that moment. The tabs switch between email and text.' },
      ],
    },
    {
      id: 'facts', selector: t('templates-preview-facts'),
      title: 'When and how many',
      say: 'When it sends, how many versions are on or off, and when it was last changed.',
    },
    {
      id: 'preview-job', selector: t('templates-preview-job'),
      title: 'Preview with job data',
      say: 'Fill it in with one of your real jobs, to read exactly what the customer would. Nothing gets sent.',
    },
    {
      id: 'edit', selector: t('templates-preview-edit'),
      title: 'Edit',
      say: 'Edit opens this template so you can change the wording.',
    },
    {
      id: 'else', selector: t('templates-everything-else'),
      title: 'Everything else',
      say: 'Your own templates that aren’t tied to a moment are kept down here.',
    },

    // ── The other views ──
    {
      id: 'list', selector: t('templates-list'),
      title: 'Every template',
      say: 'Every template on its own row. Search, or filter by channel, then click one to open it.',
    },
    {
      id: 'library', selector: t('templates-library'),
      title: 'Is your set complete?',
      say: 'This checks your set: how many CrewBarn templates are ready, any duplicate names, and anything that needs a look.',
    },
    {
      id: 'channels', selector: t('templates-channels'),
      title: 'By channel',
      say: 'Emails, documents and texts each have their own tab, with every template of that kind in a list.',
    },
  ],
}
