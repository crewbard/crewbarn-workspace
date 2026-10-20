import type { PageTour } from '../types'

/**
 * CBI AI (all-in-one page) (/tool-shed/ai). Everything about CBI on one
 * page, split into sections picked from the side list. The tour opens each
 * section in the list's order; opening one only changes what is shown.
 *
 *   cbi-status  data-cbi-state = active | inactive
 */
const t = (id: string) => `[data-tour="${id}"]`
const tab = (id: string) => t(`cbi-tabs-${id}`)
const ACTIVE = `${t('cbi-status')}[data-cbi-state="active"]`

export const PAGE_TOUR: PageTour = {
  id: 'cbi-ai',
  route: '^/tool-shed/ai/?$',
  intro: {
    page: 'CBI AI',
    purpose: 'Everything about your assistant on one page: teach it how you work, check what it learned, choose its jobs, and set up the AI behind it.',
    covers: ['Is CBI on', 'Teaching and checking', 'Its skills', 'Provider and key', 'Allowed tasks', 'Learning and voice'],
  },
  steps: [
    {
      id: 'header', selector: t('cbi-header'),
      title: 'CBI AI',
      say: 'Teach CBI your way of working, check what it learns, and choose what it’s responsible for.',
    },
    {
      id: 'status', selector: t('cbi-status'), title: 'CBI is not active',
      say: 'CBI isn’t active yet. The three steps here get it going: a provider and key, the master switch, and showing it in your menus.',
      variants: [
        { when: ACTIVE, title: 'CBI is active', say: 'CBI is active: the master switch is on and a key is saved. Each job still needs its own permission.' },
      ],
    },
    {
      id: 'sections', selector: t('cbi-sections'),
      title: 'Sections',
      say: 'Pick a section here. Teach CBI is about knowledge, Skills are the jobs it can help with, and Setup is the AI behind it.',
    },
    {
      id: 'overview', selector: t('cbi-overview'), click: tab('overview'), waitMs: 1200,
      title: 'Overview',
      say: 'Teach a rule, see how many suggestions are waiting, and follow the road from training to letting it help on its own.',
    },
    {
      id: 'review', selector: t('cbi-review'), click: tab('review'), waitMs: 1200,
      title: 'Is this right?',
      say: 'Check one suggestion at a time against what it learned from. Keep it, fix it, or reject it.',
    },
    {
      id: 'memory', selector: t('cbi-memory'), click: tab('memory'), waitMs: 1200,
      title: 'What CBI knows',
      say: 'Everything CBI knows about your company, in one list.',
    },
    {
      id: 'memory-teach', selector: t('cbi-memory-teach'),
      title: 'Teach a rule',
      say: 'Write a rule yourself, like a price you always charge or a customer’s gate code habit.',
    },
    {
      id: 'memory-find', selector: t('cbi-memory-find'),
      title: 'Find knowledge',
      say: 'Search and filter what it knows by where it came from.',
    },
    {
      id: 'memory-queue', selector: t('cbi-memory-queue'),
      title: 'Waiting for review',
      say: 'Suggestions still waiting for you. You can approve or reject several at once.',
    },
    {
      id: 'memory-confirmed', selector: t('cbi-memory-confirmed'),
      title: 'Confirmed',
      say: 'Knowledge you’ve approved, which guides its answers. Forget anything that’s no longer true.',
    },
    {
      id: 'intake', selector: t('cbi-intake'), click: tab('intake'), waitMs: 1200,
      title: 'Train intake',
      say: 'Real calls and texts turned into draft jobs. Correct them here, and CBI gets better at the next one. Nothing becomes a job until a person says so.',
    },
    {
      id: 'invoicing', selector: t('cbi-invoicing'), click: tab('invoicing'), waitMs: 1200,
      title: 'Invoice learning',
      say: 'CBI can learn your pricing from your quotes and invoices. It never makes, sends or changes an invoice itself.',
    },
    {
      id: 'reminders', selector: t('cbi-reminders'), click: tab('reminders'), waitMs: 1200,
      title: 'Payment reminders',
      say: 'CBI can draft a polite reminder when an invoice is overdue. A person always reads it and sends it.',
    },
    {
      id: 'activity', selector: t('cbi-activity'), click: tab('activity'), waitMs: 1200,
      title: 'Recent activity',
      say: 'Every draft, send, failure and skipped run, refreshed every thirty seconds.',
    },
    {
      id: 'provider', selector: t('cbi-provider'), click: tab('provider'), waitMs: 1200,
      title: 'Provider and model',
      say: 'Which AI company does the thinking. Prefer one question at a time? The guided setup link above opens each setting on its own page.',
    },
    {
      id: 'key', selector: t('cbi-key'),
      title: 'Your key',
      say: 'Paste the key from that company’s website. It’s stored locked away.',
    },
    {
      id: 'model', selector: t('cbi-model'),
      title: 'Model',
      say: 'Which of their models to use. The recommended one is marked.',
    },
    {
      id: 'test', selector: t('cbi-test'),
      title: 'Test the connection',
      say: 'Test sends one tiny question to make sure the key works.',
    },
    {
      id: 'master', selector: t('cbi-master'), click: tab('capabilities'), waitMs: 1200,
      title: 'Master switch',
      say: 'Off pauses every AI job at once, without losing your choices. Turning it on needs a saved key.',
    },
    {
      id: 'tasks', selector: t('cbi-tasks'),
      title: 'Tasks it may do',
      say: 'Each job has its own switch, and saves the moment you flip it.',
    },
    {
      id: 'learning', selector: t('cbi-learning'), click: tab('learning'), waitMs: 1200,
      title: 'Where it learns',
      say: 'Where it may pick things up, whether it asks first, and how long to keep what it found.',
    },
    {
      id: 'voice', selector: t('cbi-voice'), click: tab('voice'), waitMs: 1200,
      title: 'CBI voice',
      say: 'Switch Hey CrewBarn on or off for the whole crew app.',
    },
  ],
}
