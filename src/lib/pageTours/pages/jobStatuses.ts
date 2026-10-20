import type { PageTour } from '../types'

/**
 * Jobs & workflow → Job statuses (/tool-shed/job-statuses).
 * Three views (Stages, Rules, Customer updates) and a status editor.
 *
 *   job-statuses-empty           no statuses yet
 *   company-automation-switch    data-paused = yes | no
 *   job-statuses-pause           data-paused = yes | no
 *   job-statuses-new             only for people who can edit
 *   job-status-form-*, job-status-edit-tab-*  only while a status is open
 */
const t = (id: string) => `[data-tour="${id}"]`
const ALL_PAUSED = `${t('company-automation-switch')}[data-paused="yes"]`
const STATUS_PAUSED = `${t('job-statuses-pause')}[data-paused="yes"]`

export const PAGE_TOUR: PageTour = {
  id: 'job-statuses',
  route: '^/tool-shed/job-statuses/?$',
  intro: {
    page: 'Job statuses',
    purpose: 'The stages a job moves through, from booked to done, what each one tells the customer, and the rules for moving between them.',
    covers: ['Customer updates, carefully', 'The stages board', 'Rules between stages', 'What each stage sends', 'Inside a status'],
  },
  steps: [
    {
      id: 'header', selector: t('job-statuses-header'),
      title: 'Job statuses',
      say: 'Every job sits in one status at a time. You name them, colour them, and decide what happens at each one.',
    },
    {
      id: 'learn', selector: t('job-statuses-learn'),
      title: 'How stages work',
      say: 'How stages work plays a two-minute film, if you’d like the longer version.',
    },
    {
      id: 'new', selector: t('job-statuses-new'),
      title: 'New status',
      say: 'New status adds a stage of your own. Nothing is made until you save it.',
    },
    {
      id: 'empty', selector: t('job-statuses-empty'),
      title: 'No statuses yet',
      say: 'No statuses yet. Start with three or four, like Scheduled, On site and Complete.',
    },

    // ── Customer updates, carefully ──
    {
      id: 'setup', selector: t('job-statuses-setup'),
      title: 'Customer updates, carefully',
      say: 'This box helps you turn on customer updates safely: pick them, check your email and texting, preview the wording, then switch on only what you want.',
    },
    {
      id: 'master', selector: t('company-automation-switch'), title: 'The big red switch',
      say: 'This switch stops every automatic customer message and outside connection at once. Your crew’s own alerts keep working.',
      variants: [
        { when: ALL_PAUSED, title: 'Automations are off', say: 'Automatic customer messages are switched off for the whole company right now. Nothing goes out on its own until it’s turned back on.' },
      ],
    },
    {
      id: 'pause', selector: t('job-statuses-pause'), title: 'Pause status messages',
      say: 'This pauses just the emails and texts sent when a job changes status. Each message keeps its own setting for when you resume.',
      variants: [
        { when: STATUS_PAUSED, title: 'Status messages paused', say: 'Status emails and texts are paused right now. Resume status messages starts them again. Ones skipped while paused aren’t sent later.' },
      ],
    },

    // ── Three views ──
    {
      id: 'views', selector: t('job-statuses-views'),
      title: 'Three views',
      say: 'Three views of the same stages. Stages is the board, Rules is what a job needs before it moves, and Customer updates is what each stage sends.',
    },
    {
      id: 'board', selector: t('job-statuses-board'), click: t('job-statuses-view-stages'),
      title: 'The stages board',
      say: 'Your statuses sit in four lanes: Not started, Working, Waiting and Done. Add a status drops a new one into a lane.',
    },
    {
      id: 'card', selector: t('job-statuses-card'),
      title: 'One status',
      say: 'Each card shows the status’s colour and badges, like where new jobs start, where they finish, and which crew app button moves a job here.',
    },
    {
      id: 'rules', selector: t('job-statuses-rules'), click: t('job-statuses-view-rules'),
      title: 'Rules between stages',
      say: 'Rules guard changes made by hand. For example, nobody can pick Complete until the customer has signed and the photos are in.',
    },
    {
      id: 'review', selector: t('job-statuses-review'), click: t('job-statuses-view-review'),
      title: 'Customer updates',
      say: 'This lists every status with the email and text it sends. Review opens one to check the wording and switch it on or off.',
    },

    // ── Inside a status (only while one is open) ──
    {
      id: 'form-name', selector: t('job-status-form-name'),
      title: 'Basics',
      say: 'The name, icon and colour. The colour shows everywhere the status does: the calendar, job cards and the board.',
    },
    {
      id: 'form-category', selector: t('job-status-form-category'),
      title: 'Category',
      say: 'Category decides which lane it sits in, and how reports count it.',
    },
    {
      id: 'form-field', selector: t('job-status-form-field-action'),
      title: 'Moved by the crew app',
      say: 'The crew app button that moves a job here by itself, like Start travel or Check in. Leave it off, and jobs only move here by hand.',
    },
    {
      id: 'form-flags', selector: t('job-status-form-flags'),
      title: 'Start, finish, invoice',
      say: 'Initial is where a new job starts. Terminal means the job is finished here. The invoicing box adds an invoice to-do when a job lands here.',
    },
    {
      id: 'form-customer', selector: t('job-status-form-customer'), click: t('job-status-edit-tab-customer'),
      title: 'Tell the customer',
      say: 'Pick the email and text that go out when a job reaches this status. Each has its own switch, so the wording can wait until you’re ready.',
    },
    {
      id: 'form-automations', selector: t('job-status-edit-tab-automations'),
      title: 'Automations and Rules',
      say: 'On a saved status, Automations lists everything else that happens when a job lands here, and Rules sets where a job can come from.',
    },
  ],
}
